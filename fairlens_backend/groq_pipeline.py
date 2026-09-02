import json
import asyncio
import re
import logging
from typing import Optional

from openai import AsyncOpenAI

from models.provider import GROQ_MODEL, GROQ_API_KEY
from prompts.system_prompts import (
    TECHNICAL_SYSTEM_PROMPT,
    CULTURE_SYSTEM_PROMPT,
    SENIORITY_SYSTEM_PROMPT,
    AUDITOR_SYSTEM_PROMPT_TEMPLATE,
    SYNTHESIZER_SYSTEM_PROMPT,
)
from tools.flag_bias import store_flag, get_auditor_summary, clear_session

logger = logging.getLogger("fairlens")

# Groq qwen/qwen3.6-27b has an 8000 TPM input limit per request.
# We must keep all requests safely under this threshold.
MAX_INPUT_TOKENS = 6500  # target buffer for safety

client = AsyncOpenAI(
    api_key=GROQ_API_KEY,
    base_url="https://api.groq.com/openai/v1",
)

PANEL_AGENTS = {"TechnicalInterviewer", "CultureFitAssessor", "SeniorityAssessor"}

POSITION_PATTERN = re.compile(
    r"(TECHNICAL|CULTURE|SENIORITY)_POSITION:\s*(STRONG_HIRE|HIRE|LEAN_HIRE|LEAN_NO_HIRE|NO_HIRE|STRONG_NO_HIRE)"
)
JUSTIFICATION_PATTERN = re.compile(
    r"(TECHNICAL|CULTURE|SENIORITY)_JUSTIFICATION:\s*(.+)"
)

BIAS_FUNCTIONS = [
    {
        "type": "function",
        "function": {
            "name": "flag_bias",
            "description": "Flag an instance of cognitive bias detected in a panelist's reasoning",
            "parameters": {
                "type": "object",
                "properties": {
                    "bias_type": {
                        "type": "string",
                        "enum": [
                            "pedigree_bias", "halo_effect", "horn_effect", "affinity_bias",
                            "anchoring", "attribution_bias", "recency_bias", "in_group_favoritism",
                        ],
                    },
                    "quote": {"type": "string"},
                    "agent_name": {
                        "type": "string",
                        "enum": ["TechnicalInterviewer", "CultureFitAssessor", "SeniorityAssessor"],
                    },
                    "severity": {"type": "string", "enum": ["LOW", "MEDIUM", "HIGH"]},
                    "explanation": {"type": "string"},
                    "corrective_reframe": {"type": "string"},
                },
                "required": ["bias_type", "quote", "agent_name", "severity", "explanation"],
            },
        },
    }
]


def _compress_candidate(candidate_json: str) -> str:
    """Extract only essential fields from candidate JSON to reduce token count.

    Keeps: name, target_role, target_level, years_experience, education,
    current_company, current_title, past_companies, key_projects (capped at 3).
    Removes: interview_notes, interviewer_raw_notes, and verbose fields.
    """
    try:
        data = json.loads(candidate_json)
        if not isinstance(data, dict):
            return candidate_json[:2000]

        compressed = {
            "name": data.get("name", ""),
            "target_role": data.get("target_role", ""),
            "target_level": data.get("target_level", ""),
            "years_experience": data.get("years_experience", 0),
            "education": data.get("education", ""),
            "current_company": data.get("current_company", ""),
            "current_title": data.get("current_title", ""),
            "past_companies": data.get("past_companies", [])[:5],
            "key_projects": [
                p if isinstance(p, str) else json.dumps(p)
                for p in data.get("key_projects", [])[:3]
            ],
        }
        return json.dumps(compressed, separators=(",", ":"))
    except (json.JSONDecodeError, TypeError):
        return candidate_json[:2000]


def _summarize_transcripts(transcripts: str, max_chars: int = 3000) -> str:
    """Truncate combined transcripts to fit within token budget.

    Keeps the most recent/relevant content by trimming from the start.
    """
    if len(transcripts) <= max_chars:
        return transcripts
    # Keep the last max_chars (most recent reasoning is usually most relevant)
    return "..." + transcripts[-(max_chars - 3):]


async def _call_agent(
    system_prompt: str,
    user_message: str,
    agent_name: str,
    session_id: str,
    sse_queue: asyncio.Queue,
    transcript_buffer: list[str],
    tools: Optional[list] = None,
) -> str:
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_message},
    ]

    sse_queue.put_nowait({"type": "agent_start", "agent": agent_name})

    accumulated = ""

    if tools:
        response = await client.chat.completions.create(
            model=GROQ_MODEL,
            messages=messages,
            tools=tools,
            tool_choice="auto",
            stream=False,
            max_tokens=1500,
        )

        msg = response.choices[0].message

        if msg.tool_calls:
            for tc in msg.tool_calls:
                if tc.function.name == "flag_bias":
                    try:
                        args = json.loads(tc.function.arguments)
                    except json.JSONDecodeError:
                        args = {}
                    flag = {
                        "agent_name": args.get("agent_name", ""),
                        "bias_type": args.get("bias_type", ""),
                        "quote": args.get("quote", ""),
                        "severity": args.get("severity", ""),
                        "explanation": args.get("explanation", ""),
                        "corrective_reframe": args.get("corrective_reframe", ""),
                    }
                    store_flag(session_id, flag)
                    sse_queue.put_nowait({"type": "bias_flag", **flag})

            messages.append(msg)
            messages.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": json.dumps({"status": "flagged"}),
            })

            response = await client.chat.completions.create(
                model=GROQ_MODEL,
                messages=messages,
                stream=False,
                max_tokens=1500,
            )
            msg = response.choices[0].message

        if msg.content:
            accumulated = msg.content
            for chunk in _split_chunks(msg.content):
                sse_queue.put_nowait({
                    "type": "transcript_chunk",
                    "agent": agent_name,
                    "text": chunk,
                })
            transcript_buffer.append(msg.content)
    else:
        stream = await client.chat.completions.create(
            model=GROQ_MODEL,
            messages=messages,
            stream=True,
            max_tokens=1500,
        )

        async for chunk in stream:
            delta = chunk.choices[0].delta if chunk.choices else None
            if delta and delta.content:
                accumulated += delta.content
                for c in _split_chunks(delta.content):
                    sse_queue.put_nowait({
                        "type": "transcript_chunk",
                        "agent": agent_name,
                        "text": c,
                    })

        transcript_buffer.append(accumulated)

    sse_queue.put_nowait({"type": "agent_done", "agent": agent_name})
    return accumulated


def _split_chunks(text: str, chunk_size: int = 14) -> list[str]:
    return [text[i : i + chunk_size] for i in range(0, len(text), chunk_size)]


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


def _strip_markdown_fences(text: str) -> str:
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"\s*```$", "", text, flags=re.MULTILINE)
    return text.strip()


async def run_groq_pipeline(
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

    try:
        panel_transcripts: dict[str, str] = {}
        transcript_buffers: dict[str, list[str]] = {a: [] for a in PANEL_AGENTS}

        sse_queue.put_nowait({"type": "pipeline_start", "provider": "groq"})

        # --- Panel agents (Technical, Culture, Seniority) ---
        # Compress candidate JSON to essential fields only (stay under 8000 TPM)
        compressed_candidate = _compress_candidate(candidate_json)

        panel_specs = [
            ("TechnicalInterviewer", TECHNICAL_SYSTEM_PROMPT),
            ("CultureFitAssessor", CULTURE_SYSTEM_PROMPT),
            ("SeniorityAssessor", SENIORITY_SYSTEM_PROMPT),
        ]

        for agent_name, sys_prompt in panel_specs:
            text = await _call_agent(
                system_prompt=sys_prompt,
                user_message=f"Evaluate this candidate:\n\n{compressed_candidate}",
                agent_name=agent_name,
                session_id=session_id,
                sse_queue=sse_queue,
                transcript_buffer=transcript_buffers[agent_name],
            )
            panel_transcripts[agent_name] = text

            pos = _parse_position(agent_name, text)
            if pos:
                just = _parse_justification(agent_name, text)
                if just:
                    pos["justification"] = just
                sse_queue.put_nowait(pos)

        # --- Bias Auditor ---
        # Summarize transcripts to stay under token limit
        combined_transcripts = "\n\n".join(
            f"[{name} transcript]:\n{panel_transcripts.get(name, '')}"
            for name in ["TechnicalInterviewer", "CultureFitAssessor", "SeniorityAssessor"]
        )
        summarized_transcripts = _summarize_transcripts(combined_transcripts, max_chars=2500)

        auditor_prompt = AUDITOR_SYSTEM_PROMPT_TEMPLATE.format(target_level=target_level)
        await _call_agent(
            system_prompt=auditor_prompt,
            user_message=f"Panel transcripts to audit for bias:\n\n{summarized_transcripts}",
            agent_name="BiasAuditor",
            session_id=session_id,
            sse_queue=sse_queue,
            transcript_buffer=[],
            tools=BIAS_FUNCTIONS,
        )

        summary = get_auditor_summary(session_id)
        sse_queue.put_nowait({"type": "auditor_summary", **summary})

        # --- Verdict Synthesizer ---
        bias_report = get_auditor_summary(session_id)
        # Use summarized transcripts + compressed bias report to stay under token limit
        compressed_bias_report = {
            "total_flags": bias_report.get("total_flags", 0),
            "high_severity_count": bias_report.get("high_severity_count", 0),
            "medium_severity_count": bias_report.get("medium_severity_count", 0),
            "low_severity_count": bias_report.get("low_severity_count", 0),
            "most_biased_agent": bias_report.get("most_biased_agent", ""),
            "dominant_bias_types": bias_report.get("dominant_bias_types", []),
        }
        synthesizer_input = (
            f"Panel transcripts:\n\n{summarized_transcripts}\n\n"
            f"Bias audit report:\n{json.dumps(compressed_bias_report, separators=(',', ':'))}"
        )

        synth_buffer: list[str] = []
        verdict_text = await _call_agent(
            system_prompt=SYNTHESIZER_SYSTEM_PROMPT,
            user_message=synthesizer_input,
            agent_name="VerdictSynthesizer",
            session_id=session_id,
            sse_queue=sse_queue,
            transcript_buffer=synth_buffer,
        )

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

            sse_queue.put_nowait({"type": "final_verdict", **verdict_json})
        except (json.JSONDecodeError, Exception) as exc:
            sse_queue.put_nowait({
                "type": "error",
                "message": f"Failed to parse final verdict from synthesizer output: {exc}",
                "agent": "VerdictSynthesizer",
            })

        sse_queue.put_nowait({"type": "done", "session_id": session_id})

    except Exception as exc:
        logger.exception("Groq pipeline error")
        sse_queue.put_nowait({
            "type": "error",
            "message": f"Groq pipeline error: {exc}",
            "agent": None,
        })
        sse_queue.put_nowait({"type": "done", "session_id": session_id})

