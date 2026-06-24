# FairLens: Multi-Agent AI Hiring Panel & Bias Auditor

FairLens is an advanced, real-time AI-powered hiring evaluation simulator designed to audit candidate reviews for cognitive biases. Built with a modern **React 19 / TanStack Start** frontend and a **Python FastAPI** backend powered by the **Google Agent Development Kit (ADK)**, FairLens orchestrates a panel of expert agents to analyze resumes, simulate evaluation transcripts, flag biases in real time, and synthesize debiased final hiring decisions.

---

## 🚀 Key Features

*   **Structured Resume Parsing:** Extract structured JSON profiles from PDF resumes using PyMuPDF (`fitz`) and Generative AI extraction models.
*   **Multi-Agent Collaborative Panel:** Simulates deliberation between three expert interviewers (Technical, Culture Fit, and Seniority) utilizing specialized personas.
*   **Real-time Bias Auditing:** A dedicated `BiasAuditor` agent monitors evaluation transcripts, dynamically flagging cognitive biases (e.g., gender, age, pedigree, or confirmation bias) with severity classifications (Low, Medium, High).
*   **Debiased Verdict Synthesis:** A `VerdictSynthesizer` resolves conflicting feedback and synthesizes a final, objective hire/no-hire verdict.
*   **Server-Sent Events (SSE) Streaming:** Deliberation scripts, real-time bias flags, and status transitions stream instantly from the backend to the UI.
*   **Premium dark-mode UI:** Dynamic animations, custom typography (Inter & JetBrains Mono), visual dashboard widgets, and analytics charts powered by Tailwind CSS v4, shadcn/ui, and Recharts.

---

## 🏗️ System Architecture

FairLens uses a modern decoupled architecture. The frontend displays the live orchestration of the backend agent panel:

![FairLens System Architecture](docs/system_architecture.jpg)

---

## 🛠️ Technology Stack

### Frontend
*   **Framework:** React 19 (Single Page Application via TanStack Start)
*   **Routing:** `@tanstack/react-router` (File-based routing)
*   **Styles:** Tailwind CSS v4 + HSL/OKLCH variable design system
*   **Components:** shadcn/ui primitives built on Radix UI
*   **Charts:** Recharts (visualization of bias categories and ratings)
*   **Icons:** Lucide React
*   **Package Manager:** Bun

### Backend
*   **Runtime:** Python 3.9+
*   **Web Framework:** FastAPI (Asynchronous endpoints + CORS)
*   **Server:** Uvicorn (ASGI server with reload support)
*   **AI SDK:** Google ADK (Agent Development Kit for orchestration)
*   **Fallback Client:** OpenAI Python SDK (fallback to xAI Grok / Groq APIs)
*   **PDF Extraction:** PyMuPDF (`fitz`)
*   **Validation:** Pydantic v2

---

## 📂 Project Structure

```
Fairlens/
├── .venv/                      # Python virtual environment
├── docs/                       # Project architecture blueprints and schemas
│   ├── backend-architecture.md # Detailed backend engine breakdown
│   └── ui-architecture.md      # UI design tokens and component structure
├── fairlens_backend/           # FastAPI application
│   ├── main.py                 # FastAPI server entry point and routes
│   ├── pipeline.py             # Gemini ADK pipeline orchestrator
│   ├── grok_pipeline.py        # Fallback pipeline using xAI Grok / Groq
│   ├── agents/                 # Agent definitions (technical, culture, seniority, etc.)
│   ├── models/                 # Pydantic schema validation & provider resolver
│   ├── prompts/                # Prompt templates for all agent roles
│   └── tools/                  # Custom tools (e.g., bias flagging)
├── src/                        # React 19 application code
│   ├── components/             # Reusable UI widgets and blocks
│   ├── lib/                    # React hooks, constants, and utilities
│   ├── routes/                 # App routes and stage controllers
│   └── styles.css              # Custom OKLCH design variables and global styles
├── package.json                # Frontend package metadata
├── tsconfig.json               # TypeScript configurations
└── README.md                   # Project documentation
```

---

## 🚀 Setup & Installation

### Prerequisites
*   [Python 3.9+](https://www.python.org/downloads/)
*   [Bun](https://bun.sh/) (or Node.js v18+)
*   An API Key from Google AI Studio (`GEMINI_API_KEY`) and/or xAI / Groq.

### 1. Environment Configuration

Create a `.env` file in the **root** folder:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

Create a `.env` file in the **`fairlens_backend`** folder:
```env
GOOGLE_API_KEY=your_google_api_key_here
GOOGLE_GENAI_USE_VERTEXAI=FALSE
XAI_API_KEY=your_xai_api_key_here
# Optionals (Groq fallback):
# GROQ_API_KEY=your_groq_api_key_here
```

### 2. Backend Setup
Activate the virtual environment, install requirements, and run the FastAPI server:

```bash
# Navigate to backend directory
cd fairlens_backend

# Activate the virtual environment
# On Windows (PowerShell):
..\.venv\Scripts\Activate.ps1
# On macOS/Linux:
source ../.venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the development server
uvicorn main:app --reload --port 8000
```
The backend server will run at `http://localhost:8000`.

### 3. Frontend Setup
Open a new terminal window, navigate to the project root directory, and launch the dev server:

```bash
# Install dependencies
bun install

# Start the Vite development server
bun run dev
```
The application will be accessible at `http://localhost:5173`.

---

## 🔌 API Endpoints Reference

### `GET /health`
Verifies backend connectivity.
*   **Response:** `{"status": "ok"}`

### `POST /parse-resume`
Extracts raw text from a PDF resume and structures it into a candidate profile.
*   **Payload:** Multipart Form Data (`file: UploadFile`)
*   **Response (JSON):**
    ```json
    {
      "candidate": {
        "name": "Alex Smith",
        "target_role": "Software Engineer",
        "target_level": "Senior",
        "years_experience": 8,
        "education": "...",
        "current_company": "...",
        "current_title": "...",
        "past_companies": [...],
        "key_projects": [...],
        "interview_notes": "...",
        "interviewer_raw_notes": [...]
      },
      "raw_text_preview": "Full resume text extracted..."
    }
    ```

### `POST /run`
Runs a multi-agent deliberation simulation on the candidate and streams real-time status and bias checks.
*   **Payload (JSON):**
    ```json
    {
      "session_id": "uuid-string",
      "candidate": { ... },
      "target_level": "L3 / L4 / L5 / L6",
      "panel_mode": "balanced / rigorous / lenient"
    }
    ```
*   **Response:** Server-Sent Events (SSE) stream (`text/event-stream`).

---

## 🎨 Architectural References
For more detailed architecture notes, please review:
*   [Backend Engine Architecture](file:///d:/New%20folder/Fairlens/docs/backend-architecture.md)
*   [UI / Frontend Architecture](file:///d:/New%20folder/Fairlens/docs/ui-architecture.md)
