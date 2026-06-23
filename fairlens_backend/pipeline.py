import json
import asyncio
import re
import logging
from typing import Optional

from google.adk.agents import LlmAgent, ParallelAgent, SequentialAgent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService

from agents import (
    technical_interviewer,
    culture_assessor,
    seniority_assessor,
    bias_auditor,
    verdict_synthesizer,
)
from tools.flag_bias import clear_session, store_flag, get_auditor_summary
from models.provider import resolve_provider, gemini_available, grok_available, GEMINI_MODEL as MODEL

logger = logging.getLogger("fairlens")

panel = ParallelAgent(
    name="HiringPanel",
    sub_agents=[technical_interviewer, culture_assessor, seniority_assessor],
)

post_panel = SequentialAgent(
    name="AuditAndSynthesize",
    sub_agents=[bias_auditor, verdict_synthesizer],
)

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

    provider = resolve_provider()

    if provider == "grok":
        logger.info("Using Grok (xAI) pipeline")
        from grok_pipeline import run_grok_pipeline
        await run_grok_pipeline(session_id, candidate_json, sse_queue)
        return

    if provider != "gemini":
        sse_queue.put_nowait({
            "type": "error",
            "message": "No AI provider available. Set GOOGLE_API_KEY or XAI_API_KEY in .env",
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
            new_message=(
                f"Evaluate this candidate:\n\n{candidate_json}"
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
                        _emit({"type": "bias_flag", **flag})

            # agent_start on first event for each agent
            if (
                author in PANEL_AGENTS | {"BiasAuditor", "VerdictSynthesizer"}
                and author not in agent_started
            ):
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
                            _emit(pos)

            # agent_done via final response
            is_final = getattr(event, "is_final", False)
            if callable(getattr(event, "is_final_response", None)):
                is_final = is_final or event.is_final_response()

            if is_final and author:
                if author in PANEL_AGENTS:
                    if not agent_done_flags.get(author, False):
                        agent_done_flags[author] = True
                        _emit({"type": "agent_done", "agent": author})

                elif author == "BiasAuditor":
                    if not agent_done_flags.get(author, False):
                        agent_done_flags[author] = True
                        summary = get_auditor_summary(session_id)
                        _emit({"type": "auditor_summary", **summary})
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

                            bias_summary = get_auditor_summary(session_id)
                            verdict_json.setdefault("bias_summary", {
                                "total_flags": bias_summary["total_flags"],
                                "high_severity_count": bias_summary["high_severity_count"],
                                "medium_severity_count": bias_summary["medium_severity_count"],
                                "low_severity_count": bias_summary["low_severity_count"],
                                "most_biased_agent": bias_summary["most_biased_agent"],
                                "dominant_bias_types": bias_summary["dominant_bias_types"],
                                "confidence_score": bias_summary["confidence_score"],
                            })

                            _emit({"type": "final_verdict", **verdict_json})
                        except (json.JSONDecodeError, Exception):
                            _emit({
                                "type": "error",
                                "message": "Failed to parse final verdict from synthesizer output",
                                "agent": "VerdictSynthesizer",
                            })

                        _emit({"type": "agent_done", "agent": author})

        _emit({"type": "done", "session_id": session_id})

    except Exception as exc:
        exc_str = str(exc).lower()
        is_auth_error = any(k in exc_str for k in [
            "api_key", "api key", "not found", "not found for url",
            "permission", "unauthorized", "403", "401", "404",
            "quota", "rate limit", "429", "resource exhausted",
            "unavailable", "503", "internal", "500",
        ])

        if is_auth_error and grok_available():
            logger.warning("Gemini pipeline failed (%s) — falling back to Grok", exc)
            from grok_pipeline import run_grok_pipeline
            await run_grok_pipeline(session_id, candidate_json, sse_queue)
        else:
            _emit({
                "type": "error",
                "message": f"Pipeline error: {exc}",
                "agent": None,
            })
            _emit({"type": "done", "session_id": session_id})
