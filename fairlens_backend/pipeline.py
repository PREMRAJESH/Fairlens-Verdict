import json
import asyncio
import re
import logging
from typing import Optional

from google.adk.agents import LlmAgent, ParallelAgent, SequentialAgent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from agents import (
    technical_interviewer,
    culture_assessor,
    seniority_assessor,
    bias_auditor,
    verdict_synthesizer,
)
from tools.flag_bias import clear_session, store_flag, get_auditor_summary
from models.provider import resolve_provider, gemini_available, grok_available, groq_available, GEMINI_MODEL as MODEL

logger = logging.getLogger("fairlens")

# ParallelAgent: The HiringPanel runs all three assessor agents (Technical, Culture, Seniority)
# concurrently and independently. This separation is critical: if they shared context or saw
# each other's reasoning early, they would anchor on each other, defeating the purpose
# of the independent panel and rendering the bias audit meaningless.
panel = ParallelAgent(
    name="HiringPanel",
    sub_agents=[technical_interviewer, culture_assessor, seniority_assessor],
)

# SequentialAgent: The BiasAuditor MUST run and complete its task before the VerdictSynthesizer.
# This ensures that the synthesizer receives a complete bias report (containing all flagged
# reasoning) so it can accurately compare the raw and debiased verdicts side-by-side.
post_panel = SequentialAgent(
    name="AuditAndSynthesize",
    sub_agents=[bias_auditor, verdict_synthesizer],
)

# full_pipeline wraps the parallel hiring panel and the sequential audit/synthesis steps
# in a top-level SequentialAgent. This defines the two-phase lifecycle: first, the panel
# runs to generate raw candidate assessments, then the audit/synthesis phase evaluates
# those assessments for cognitive bias and produces the final recommendation.
full_pipeline = SequentialAgent(
    name="BiasAuditorPanel",
    sub_agents=[panel, post_panel],
)

PANEL_AGENTS = {"TechnicalInterviewer", "CultureFitAssessor", "SeniorityAssessor"}
POSITION_PATTERN = re.compile(
    r"(TECHNICAL|CULTURE|SENIORITY)_POSITION:\s*(STRONG_HIRE|HIRE|LEAN_HIRE|LEAN_NO_HIRE|NO_HIRE|STRONG_NO_HIRE)"
)
JUSTIFICATION_PATTERN = re.compile(
    r"(TECHNICAL|CULTURE|SENIORITY)_JUSTIFICATION:\s*(.+)"
)


def _parse_position(agent: str, text: str) -> Optional[dict]:
    prefix = {
        "TechnicalInterviewer": "TECHNICAL",
        "CultureFitAssessor": "CULTURE",
        "SeniorityAssessor": "SENIORITY",
    }.get(agent)
    if not prefix:
        return None

    m = POSITION_PATTERN.search(text)
    if m and m.group(1) == prefix:
        return {
            "type": "agent_verdict",
            "agent": agent,
            "position": m.group(2),
            "justification": "",
        }
    return None


def _parse_justification(agent: str, text: str) -> Optional[str]:
    prefix = {
        "TechnicalInterviewer": "TECHNICAL",
        "CultureFitAssessor": "CULTURE",
        "SeniorityAssessor": "SENIORITY",
    }.get(agent)
    if not prefix:
        return None

    m = JUSTIFICATION_PATTERN.search(text)
    if m and m.group(1) == prefix:
        return m.group(2).strip()
    return None


def _split_chunks(text: str, chunk_size: int = 14) -> list[str]:
    return [text[i : i + chunk_size] for i in range(0, len(text), chunk_size)]


def _strip_markdown_fences(text: str) -> str:
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"\s*```$", "", text, flags=re.MULTILINE)
    return text.strip()


async def run_pipeline(
    session_id: str,
    candidate_json: str,
    sse_queue: asyncio.Queue,
):
    clear_session(session_id)

    target_level = "L3"
    try:
        cand_data = json.loads(candidate_json)
        if isinstance(cand_data, dict):
            target_level = cand_data.get("target_level", "L3")
    except Exception:
        pass

    from prompts.system_prompts import AUDITOR_SYSTEM_PROMPT_TEMPLATE
    bias_auditor.instruction = AUDITOR_SYSTEM_PROMPT_TEMPLATE.format(target_level=target_level)

    provider = resolve_provider()

    if provider == "grok":
        logger.info("Using Grok (xAI) pipeline")
        from grok_pipeline import run_grok_pipeline
        await run_grok_pipeline(session_id, candidate_json, sse_queue)
        return

    if provider == "groq":
        logger.info("Using Groq pipeline")
        from groq_pipeline import run_groq_pipeline
        await run_groq_pipeline(session_id, candidate_json, sse_queue)
        return

    if provider != "gemini":
        sse_queue.put_nowait({
            "type": "error",
            "message": "No AI provider available. Set GOOGLE_API_KEY, XAI_API_KEY, or GROQ_API_KEY in .env",
            "agent": None,
        })
        sse_queue.put_nowait({"type": "done", "session_id": session_id})
        return

    # --- Gemini pipeline (existing google.adk logic) ---
    session_service = InMemorySessionService()
    await session_service.create_session(
        app_name="fairlens",
        user_id="user",
        session_id=session_id,
    )

    # The Runner orchestrates the execution of full_pipeline. It runs async and generates
    # events which are translated to Server-Sent Events (SSE) and streamed to the React frontend.
    # The event stream handles partial results, token chunks, bias flags, and final summaries,
    # enabling a live multi-agent interface that updates incrementally without blocking.
    runner = Runner(
        agent=full_pipeline,
        app_name="fairlens",
        session_service=session_service,
    )

    transcript_buffers: dict[str, str] = {a: "" for a in PANEL_AGENTS}
    parsed_verdicts: dict[str, dict] = {}
    agent_started: set[str] = set()
    agent_done_flags: dict[str, bool] = {}

    def _emit(event_dict: dict):
        sse_queue.put_nowait(event_dict)

    try:
        async for event in runner.run_async(
            user_id="user",
            session_id=session_id,
            new_message=types.Content(
                role="user",
                parts=[types.Part.from_text(text=f"Evaluate this candidate:\n\n{candidate_json}")]
            ),
        ):
            author = getattr(event, "author", None) or ""
            content = getattr(event, "content", None)

            if not author:
                continue

            # Intercept flag_bias function calls from BiasAuditor
            actions = getattr(event, "actions", None)
            if actions:
                function_calls = getattr(actions, "function_calls", []) or []
                for fc in function_calls:
                    if getattr(fc, "name", None) == "flag_bias":
                        args = getattr(fc, "args", {}) or {}
                        flag = {
                            "agent_name": args.get("agent_name", ""),
                            "bias_type": args.get("bias_type", ""),
                            "quote": args.get("quote", ""),
                            "severity": args.get("severity", ""),
                            "explanation": args.get("explanation", ""),
                            "corrective_reframe": args.get("corrective_reframe", ""),
                        }
                        store_flag(session_id, flag)
                        # UI effect: A red/orange/yellow flag card slides in mid-transcript in the corresponding agent's column,
                        # showing the severity, the quote, the bias explanation, and a suggested corrective reframe.
                        _emit({"type": "bias_flag", **flag})

            # agent_start on first event for each agent
            if (
                author in PANEL_AGENTS | {"BiasAuditor", "VerdictSynthesizer"}
                and author not in agent_started
            ):
                # UI effect: Highlights the agent in the sidebar (making the status dot pulse) and makes a cursor blink
                # in the agent's transcript column to show they have started reasoning.
                _emit({"type": "agent_start", "agent": author})
                agent_started.add(author)

            # Transcript chunk streaming for panel agents
            if author in PANEL_AGENTS and content is not None:
                text_content = ""
                parts = getattr(content, "parts", []) or []
                for part in parts:
                    txt = getattr(part, "text", "") or ""
                    if txt:
                        text_content += txt

                if text_content:
                    transcript_buffers[author] += text_content
                    for chunk in _split_chunks(text_content):
                        # UI effect: Appends the streaming transcript text chunk character-by-character to the active agent's column in real time.
                        _emit({
                            "type": "transcript_chunk",
                            "agent": author,
                            "text": chunk,
                        })

                    # Try to parse position from accumulated text
                    if author not in parsed_verdicts:
                        pos = _parse_position(author, transcript_buffers[author])
                        if pos:
                            just = _parse_justification(author, transcript_buffers[author])
                            if just:
                                pos["justification"] = just
                            parsed_verdicts[author] = pos
                            # UI effect: Renders the parsed structured position (e.g. STRONG_HIRE, NO_HIRE) in the column footer for that panel agent.
                            _emit(pos)

            # agent_done via final response
            is_final = getattr(event, "is_final", False)
            if callable(getattr(event, "is_final_response", None)):
                is_final = is_final or event.is_final_response()

            if is_final and author:
                if author in PANEL_AGENTS:
                    if not agent_done_flags.get(author, False):
                        agent_done_flags[author] = True
                        # UI effect: The agent's status dot in the sidebar turns green (or orange for Auditor), indicating that agent has finished execution.
                        _emit({"type": "agent_done", "agent": author})

                elif author == "BiasAuditor":
                    if not agent_done_flags.get(author, False):
                        agent_done_flags[author] = True
                        summary = get_auditor_summary(session_id)
                        # UI effect: Draws the bias confidence ring, unlocks the auditor report tab, and populates the summary metrics (counts of flags, most flagged agent, etc.).
                        _emit({"type": "auditor_summary", **summary})
                        # UI effect: The agent's status dot in the sidebar turns green, indicating they have completed their analysis.
                        _emit({"type": "agent_done", "agent": author})

                elif author == "VerdictSynthesizer":
                    if not agent_done_flags.get(author, False):
                        agent_done_flags[author] = True

                        raw_output = getattr(event, "content", None)
                        verdict_text = ""

                        if raw_output:
                            parts = getattr(raw_output, "parts", []) or []
                            for part in parts:
                                txt = getattr(part, "text", "") or ""
                                if txt:
                                    verdict_text += txt

                        if not verdict_text and actions:
                            function_responses = getattr(actions, "function_responses", []) or []
                            for fr in function_responses:
                                response = getattr(fr, "response", None) or {}
                                verdict_text = json.dumps(response)

                        verdict_text = _strip_markdown_fences(verdict_text)

                        try:
                            verdict_json = json.loads(verdict_text)
                            verdict_json["session_id"] = session_id

                            changed_from_raw = False
                            if "debiased_verdict" in verdict_json and isinstance(verdict_json["debiased_verdict"], dict):
                                changed_from_raw = verdict_json["debiased_verdict"].get("changed_from_raw", False)

                            bias_summary = get_auditor_summary(session_id, changed_from_raw=changed_from_raw)
                            verdict_json.setdefault("bias_summary", {
                                "total_flags": bias_summary["total_flags"],
                                "high_severity_count": bias_summary["high_severity_count"],
                                "medium_severity_count": bias_summary["medium_severity_count"],
                                "low_severity_count": bias_summary["low_severity_count"],
                                "most_biased_agent": bias_summary["most_biased_agent"],
                                "dominant_bias_types": bias_summary["dominant_bias_types"],
                                "confidence_score": bias_summary["confidence_score"],
                            })

                            # UI effect: Unlocks the final verdict tab in the UI, rendering the raw vs debiased verdict comparison chart and the final recommendation.
                            _emit({"type": "final_verdict", **verdict_json})
                        except (json.JSONDecodeError, Exception):
                            # UI effect: Displays a red error toast or text in the UI to notify the user of a pipeline failure.
                            _emit({
                                "type": "error",
                                "message": "Failed to parse final verdict from synthesizer output",
                                "agent": "VerdictSynthesizer",
                            })

                        # UI effect: The agent's status dot in the sidebar turns green, indicating they have completed their analysis.
                        _emit({"type": "agent_done", "agent": author})

        # UI effect: Confirms the entire multi-agent pipeline is complete, stopping the session timer and finalizing all active UI elements.
        _emit({"type": "done", "session_id": session_id})

    except Exception as exc:
        logger.warning("Gemini pipeline failed: %s", exc)

        # Always try fallback providers on any Gemini failure
        if grok_available():
            logger.info("Falling back to Grok (xAI)")
            from grok_pipeline import run_grok_pipeline
            await run_grok_pipeline(session_id, candidate_json, sse_queue)
        elif groq_available():
            logger.info("Falling back to Groq")
            from groq_pipeline import run_groq_pipeline
            await run_groq_pipeline(session_id, candidate_json, sse_queue)
        else:
            _emit({
                "type": "error",
                "message": f"Pipeline error: {exc}",
                "agent": None,
            })
            _emit({"type": "done", "session_id": session_id})

