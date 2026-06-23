# FairLens Backend Architecture

## Overview

FairLens backend is a **Python** FastAPI server that orchestrates a multi-agent AI pipeline to audit job candidate evaluations for cognitive bias. It supports two AI providers -- **Google Gemini** (primary, via Google ADK) and **xAI Grok** (fallback) -- and streams real-time results to the frontend via Server-Sent Events (SSE).

---

## Technology Stack

| Technology          | Purpose                                                                |
| ------------------- | ---------------------------------------------------------------------- |
| Python 3.9+         | Runtime                                                                |
| FastAPI 0.115+      | REST API framework                                                     |
| Uvicorn 0.34+       | ASGI server                                                            |
| Pydantic v2         | Data validation / schemas                                              |
| Google ADK          | Agent orchestration (LlmAgent, ParallelAgent, SequentialAgent, Runner) |
| google-generativeai | Gemini model access (`gemini-2.5-flash`)                               |
| OpenAI Python SDK   | Grok (xAI) fallback via `openai>=1.0`                                  |
| python-dotenv       | `.env` loading                                                         |
| sse-starlette       | Server-Sent Events streaming                                           |

---

## Project Structure

```
fairlens_backend/
├── .env                        # Environment variables (API keys)
├── requirements.txt            # Python dependencies
├── main.py                     # FastAPI entry point (routes, CORS, session mgmt)
├── pipeline.py                 # Gemini ADK pipeline orchestrator
├── grok_pipeline.py            # Grok/xAI fallback pipeline (manual OpenAI SDK calls)
├── agents/
│   ├── __init__.py
│   ├── technical.py            # TechnicalInterviewer agent
│   ├── culture.py              # CultureFitAssessor agent
│   ├── seniority.py            # SeniorityAssessor agent
│   ├── auditor.py              # BiasAuditor agent
│   └── synthesizer.py          # VerdictSynthesizer agent
├── models/
│   ├── __init__.py
│   ├── schemas.py              # Pydantic models (RunRequest, FinalVerdict, BiasFlag, etc.)
│   └── provider.py             # Provider resolution (Gemini vs Grok)
├── prompts/
│   ├── __init__.py
│   └── system_prompts.py       # System prompts for all 5 agents
└── tools/
    ├── __init__.py
    └── flag_bias.py            # Bias flagging function tool (in-memory store)
```

---

## API Endpoints

### `GET /health`

Health check.

**Response:**

```json
{ "status": "ok" }
```

---

### `POST /run`

Kicks off the multi-agent pipeline. Returns an SSE stream.

**Request Body** (`RunRequest`):

```json
{
  "session_id": "uuid-string",
  "candidate": { "name": "...", "experience": "...", ... },
  "target_level": "L3 | L4 | L5 | L6",
  "panel_mode": "Balanced | Technical-heavy | Culture-heavy"
}
```

**Response:** SSE (Server-Sent Events) stream with the following event types:

| Event              | Data Fields                                                                                                                   | Description                                  |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `pipeline_start`   | `provider: "gemini" \| "grok"`                                                                                                | Pipeline has begun                           |
| `agent_start`      | `agent: string`                                                                                                               | An agent has begun reasoning                 |
| `transcript_chunk` | `agent, text`                                                                                                                 | 14-char text chunks of agent output          |
| `agent_verdict`    | `agent, position, justification`                                                                                              | Parsed structured verdict from a panel agent |
| `agent_done`       | `agent`                                                                                                                       | Agent has finished                           |
| `bias_flag`        | `agent_name, bias_type, quote, severity, explanation, corrective_reframe`                                                     | A bias instance flagged by the auditor       |
| `auditor_summary`  | `total_flags, high/medium/low_severity_count, most_biased_agent, dominant_bias_types, confidence_score, auditor_summary_text` | Summary after auditor completes              |
| `final_verdict`    | Full `FinalVerdict` object                                                                                                    | Final synthesized verdict                    |
| `error`            | `type, message, agent`                                                                                                        | Error event                                  |
| `done`             | `session_id`                                                                                                                  | Pipeline complete                            |

**Errors:** `409 Conflict` if session already running.

---

### `GET /report/{session_id}`

Retrieves the final verdict for a completed session.

**Response:** `FinalVerdict` JSON object.

**Errors:**

- `425 Too Early` if pipeline still running
- `404 Not Found` if session does not exist

---

## Agent Architecture

### Gemini Pipeline (`pipeline.py`)

```
full_pipeline (SequentialAgent)
  ├── HiringPanel (ParallelAgent)
  │   ├── TechnicalInterviewer (LlmAgent)    — model=gemini-2.5-flash, tool=google_search
  │   ├── CultureFitAssessor (LlmAgent)      — model=gemini-2.5-flash
  │   └── SeniorityAssessor (LlmAgent)        — model=gemini-2.5-flash
  └── AuditAndSynthesize (SequentialAgent)
      ├── BiasAuditor (LlmAgent)             — model=gemini-2.5-flash, tool=flag_bias, thinking_budget=8192
      └── VerdictSynthesizer (LlmAgent)       — model=gemini-2.5-flash, output_schema=VERDICT_SCHEMA, thinking_budget=8192
```

1. **HiringPanel** (ParallelAgent) runs all three evaluators concurrently.
2. **AuditAndSynthesize** (SequentialAgent) runs the BiasAuditor first, then the VerdictSynthesizer.

### Grok Fallback Pipeline (`grok_pipeline.py`)

Manual sequential execution via OpenAI SDK (no ADK):

1. TechnicalInterviewer (`grok-2-1212`, streaming)
2. CultureFitAssessor (`grok-2-1212`, streaming)
3. SeniorityAssessor (`grok-2-1212`, streaming)
4. BiasAuditor (`grok-2-1212`, tool calls via `flag_bias`)
5. VerdictSynthesizer (`grok-2-1212`)

---

## Agent Definitions

| Agent                | File                    | Role                                               | Tools                          | Output                                      |
| -------------------- | ----------------------- | -------------------------------------------------- | ------------------------------ | ------------------------------------------- |
| TechnicalInterviewer | `agents/technical.py`   | Evaluates skill depth, projects, system design     | `google_search`                | TECHNICAL_POSITION, TECHNICAL_JUSTIFICATION |
| CultureFitAssessor   | `agents/culture.py`     | Evaluates communication, ownership, growth mindset | --                             | CULTURE_POSITION, CULTURE_JUSTIFICATION     |
| SeniorityAssessor    | `agents/seniority.py`   | Evaluates scope of impact (L3-L6)                  | --                             | SENIORITY_POSITION, SENIORITY_JUSTIFICATION |
| BiasAuditor          | `agents/auditor.py`     | Detects cognitive biases in panel reasoning        | `flag_bias()` function tool    | Bias flags + auditor summary                |
| VerdictSynthesizer   | `agents/synthesizer.py` | Synthesizes final debiased verdict                 | `output_schema=VERDICT_SCHEMA` | Strict JSON matching `FinalVerdict`         |

---

## Schemas (Pydantic Models)

**File:** `models/schemas.py`

| Model                 | Fields                                                                                                                                                      |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CandidateProfile`    | `RootModel[dict[str, Any]]` -- arbitrary JSON profile                                                                                                       |
| `RunRequest`          | `session_id: str`, `candidate: CandidateProfile`, `target_level: str`, `panel_mode: str`                                                                    |
| `AgentPosition`       | `TechnicalInterviewer: str`, `CultureFitAssessor: str`, `SeniorityAssessor: str`                                                                            |
| `RawVerdict`          | `majority_position: str`, `positions: AgentPosition`, `dissent: Optional[str]`                                                                              |
| `BiasSummary`         | `total_flags: int`, `high/medium/low_severity_count: int`, `most_biased_agent: str`, `dominant_bias_types: list[str]`, `confidence_score: int (0-100)`      |
| `DebiasedVerdict`     | `position: str`, `changed_from_raw: bool`, `change_explanation: Optional[str]`, `key_reasons_for: list[str]`, `key_reasons_against: list[str]`              |
| `FinalRecommendation` | `decision: str (HIRE\|NO_HIRE)`, `confidence: int`, `justification: list[str]`                                                                              |
| `FinalVerdict`        | `session_id: str`, `raw_verdict: RawVerdict`, `bias_summary: BiasSummary`, `debiased_verdict: DebiasedVerdict`, `final_recommendation: FinalRecommendation` |
| `BiasFlag`            | `agent_name: str`, `bias_type: str` (one of 8 types), `quote: str`, `severity: str (LOW\|MEDIUM\|HIGH)`, `explanation: str`, `corrective_reframe: str`      |
| `RunResponse`         | `session_id: str`, `status: str`                                                                                                                            |

### Constants

- **Verdict scale:** `STRONG_HIRE`, `HIRE`, `LEAN_HIRE`, `LEAN_NO_HIRE`, `NO_HIRE`, `STRONG_NO_HIRE`
- **Bias types:** `pedigree_bias`, `halo_effect`, `horn_effect`, `affinity_bias`, `anchoring`, `attribution_bias`, `recency_bias`, `in_group_favoritism`
- **Severity levels:** `LOW`, `MEDIUM`, `HIGH`
- **Agent names:** `TechnicalInterviewer`, `CultureFitAssessor`, `SeniorityAssessor`, `BiasAuditor`, `VerdictSynthesizer`

---

## Provider Resolution

**File:** `models/provider.py`

Resolution order:

1. If `GOOGLE_API_KEY` is set and valid → Gemini (`gemini-2.5-flash`)
2. Else if `XAI_API_KEY` is set → Grok (`grok-2-1212`)
3. If neither → error

**Auto-failover:** If the Gemini pipeline throws an auth/rate-limit error, the server automatically falls back to Grok.

---

## System Prompts

**File:** `prompts/system_prompts.py`

Five detailed prompts:

1. **Technical** -- Senior Technical Interviewer evaluating skill depth, project complexity, system design. Uses `google_search` to verify claims.
2. **Culture** -- Culture and Team-Fit Specialist evaluating communication, ownership, growth mindset.
3. **Seniority** -- Leveling Specialist evaluating scope of impact against L3-L6 guide.
4. **Auditor** -- Cognitive Bias Auditor evaluating the panel's reasoning (NOT the candidate). Detects 8 bias types.
5. **Synthesizer** -- Hiring Committee Chair synthesizing evaluations + bias audit into a final debiased verdict.

---

## Bias Flagging Tool

**File:** `tools/flag_bias.py`

In-memory per-session bias flag storage:

| Function                                                                                         | Description                                                                                               |
| ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `flag_bias(session_id, agent_name, bias_type, quote, severity, explanation, corrective_reframe)` | Stores a bias flag; returns `{"status": "flagged"}`                                                       |
| `get_flags(session_id)`                                                                          | Retrieves all flags for a session                                                                         |
| `get_auditor_summary(session_id)`                                                                | Computes summary (total flags, severity counts, most biased agent, dominant bias types, confidence score) |
| `clear_session(session_id)`                                                                      | Clears in-memory data                                                                                     |

**Confidence score formula:** `max(0, 100 - (total_flags * 12) - (high_severity_count * 8))`

---

## Session Management

Sessions are stored **in-memory** on the FastAPI server:

```python
_sessions: dict[str, FinalVerdict | None] = {}
_running: set[str] = set()
```

- `_running` prevents concurrent runs for the same `session_id`.
- After completion, the final verdict is stored in `_sessions` for retrieval via `GET /report/{session_id}`.
- **No database** -- everything resets on server restart.

---

## CORS

Configured in `main.py` to allow `http://localhost:3000` (frontend dev server).

---

## Environment Variables

**File:** `fairlens_backend/.env`

```
GOOGLE_API_KEY=<your_gemini_api_key>
GOOGLE_GENAI_USE_VERTEXAI=FALSE
XAI_API_KEY=<your_xai_grok_api_key>
```

- `GOOGLE_API_KEY` -- Gemini / Google ADK authentication
- `GOOGLE_GENAI_USE_VERTEXAI=FALSE` -- Uses non-Vertex AI endpoint
- `XAI_API_KEY` -- xAI (Grok) API key for fallback provider

---

## Running the Backend

```bash
# From the fairlens_backend/ directory
pip install -r requirements.txt
uvicorn main:app --reload     # Dev server on http://localhost:8000
uvicorn main:app              # Production server on http://localhost:8000
```

---

## Frontend-Backend Communication

The React frontend communicates with the backend at `http://localhost:8000`:

- `POST /run` with `RunRequest` JSON body → receives SSE stream
- `GET /report/{session_id}` → retrieves final verdict

SSE stream is consumed via the `useBackendRuntime` hook (`src/lib/use-backend-runtime.ts`) using `response.body.getReader()` for real-time parsing of `event:` and `data:` SSE lines.

Agent name mapping: `TechnicalInterviewer → "technical"`, `CultureFitAssessor → "culture"`, `SeniorityAssessor → "seniority"`

---

## Error Handling

- **Dual provider fallback:** Gemini → Grok → error
- **SSE error event:** `{"event": "error", "data": {"type": "...", "message": "...", "agent": "..."}}`
- **HTTP errors:** 409 (conflict), 425 (too early), 404 (not found)
- Error logs written to `backend_err.log`
