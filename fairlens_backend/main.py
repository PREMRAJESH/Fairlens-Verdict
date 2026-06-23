import json
import asyncio
import logging
import os
import re
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse

import fitz
import google.generativeai as genai

from models.schemas import RunRequest, FinalVerdict
from tools.flag_bias import clear_session
from pipeline import run_pipeline

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("fairlens")

app = FastAPI(title="FairLens Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_sessions: dict[str, Optional[FinalVerdict]] = {}
_running: set[str] = set()


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/parse-resume")
async def parse_resume(file: UploadFile = File(...)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    pdf_bytes = await file.read()
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")

    full_text = ""
    for page in doc:
        full_text += page.get_text() + "\n"
    doc.close()

    if not full_text.strip():
        raise HTTPException(
            status_code=422,
            detail="Could not extract text from PDF. Try a text-based PDF, not a scan.",
        )

    model = genai.GenerativeModel("gemini-2.5-flash")

    prompt = f"""You are a resume parser. Extract information from this resume text and return ONLY a valid JSON object. No explanation, no markdown, no code fences — raw JSON only.

Structure the output exactly like this schema:
{{
  "name": "candidate full name or initials",
  "target_role": "",
  "target_level": "L3 / L4 / L5 / L6",
  "years_experience": 0,
  "education": "most recent degree or training",
  "current_company": "current employer and approximate size if known",
  "current_title": "current or most recent job title",
  "past_companies": ["previous employer 1", "previous employer 2"],
  "key_projects": [
    "project name — what they built, scale, impact",
    "project name — what they led, team size, outcome"
  ],
  "interview_notes": "",
  "interviewer_raw_notes": []
}}

Rules:
- Leave target_role, interview_notes, and interviewer_raw_notes as empty — user will fill these
- For years_experience: calculate from earliest job date to most recent, round to nearest whole number
- For key_projects: extract up to 5 most significant projects mentioned. Include scale and impact if stated.
- If a field cannot be determined, use empty string or empty array — never guess or invent data
- Return ONLY the JSON object, nothing else

Resume text:
{full_text[:6000]}"""

    response = model.generate_content(prompt)
    raw = response.text.strip()

    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    try:
        structured = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Failed to parse Gemini response as JSON. Try again.")

    return {"candidate": structured, "raw_text_preview": full_text[:500]}


@app.post("/run")
async def run(request: RunRequest):
    session_id = request.session_id

    if session_id in _running:
        raise HTTPException(status_code=409, detail="Session already running")

    _running.add(session_id)
    _sessions[session_id] = None
    clear_session(session_id)

    candidate_json = request.candidate.model_dump_json()
    sse_queue: asyncio.Queue = asyncio.Queue()

    pipeline_task = asyncio.create_task(
        run_pipeline(session_id, candidate_json, sse_queue)
    )

    async def event_generator():
        try:
            while True:
                try:
                    event = await asyncio.wait_for(sse_queue.get(), timeout=120.0)
                except asyncio.TimeoutError:
                    yield {"event": "error", "data": json.dumps({"type": "error", "message": "Pipeline timeout"})}
                    break

                if event.get("type") == "final_verdict":
                    try:
                        verdict = FinalVerdict(**event)
                        _sessions[session_id] = verdict
                    except Exception as exc:
                        logger.warning("Failed to validate final_verdict: %s", exc)

                yield {"event": "message", "data": json.dumps(event)}

                if event.get("type") == "done":
                    break

                if event.get("type") == "error":
                    logger.error("Pipeline error: %s", event.get("message"))
                    break
        finally:
            _running.discard(session_id)
            try:
                await asyncio.wait_for(pipeline_task, timeout=5.0)
            except (asyncio.TimeoutError, Exception):
                pipeline_task.cancel()

    return EventSourceResponse(event_generator())


@app.get("/report/{session_id}")
async def get_report(session_id: str):
    verdict = _sessions.get(session_id)
    if verdict is None:
        if session_id in _running:
            raise HTTPException(status_code=425, detail="Pipeline still running")
        raise HTTPException(status_code=404, detail="Session not found")

    return verdict.model_dump()
