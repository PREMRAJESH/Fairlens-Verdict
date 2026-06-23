# FairLens UI Architecture

> A single-page React application simulating a multi-agent AI hiring panel that detects and surfaces bias in real time.

---

## Table of Contents

1. [Technology Stack](#technology-stack)
2. [Page Architecture](#page-architecture)
3. [Design System](#design-system)
4. [Component Tree](#component-tree)
5. [Screens (Stages)](#screens-stages)
6. [UI Primitives](#ui-primitives)
7. [Animations](#animations)
8. [Data Flow](#data-flow)

---

## Technology Stack

| Layer             | Technology                                          |
| ----------------- | --------------------------------------------------- |
| Framework         | React 19                                            |
| Meta-framework    | TanStack Start (TanStack Router + Vite + Nitro)     |
| Routing           | `@tanstack/react-router` (file-based, single route) |
| Styling           | Tailwind CSS v4 + CSS custom properties (OKLCH)     |
| UI Primitives     | shadcn/ui (New York style) on Radix UI              |
| Icons             | Lucide React                                        |
| Charts            | Recharts                                            |
| State + Streaming | Custom React hooks (`useBackendRuntime` for SSE, `useScenarioRuntime` for mock fallback) |
| Package Manager   | Bun                                                 |

---

## Page Architecture

The app has **exactly one route** (`/`), driven by a 3-stage state machine:

```
input  -->  panel  -->  report
  |            |            |
Select      Watch       View bias
candidate   agents      report +
& start     deliberate  debiased
                        verdict
```

Stage management lives in `src/routes/index.tsx:25`:

```tsx
const [stage, setStage] = useState<Stage>("input");
```

The root layout (`__root.tsx`) provides the HTML shell, font loading (Inter + JetBrains Mono), `QueryClientProvider`, error boundary, and 404 page. The index page renders a flex container with a persistent sidebar and a main content area that swaps between the three screens.

---

## Design System

Defined entirely in `src/styles.css` using the OKLCH color space for perceptual uniformity.

### Core Surfaces

| Token                | Value                   | Purpose                                    |
| -------------------- | ----------------------- | ------------------------------------------ |
| `--background`       | `oklch(0.16 0.015 265)` | Deep navy page background                  |
| `--foreground`       | `oklch(0.96 0.005 250)` | Near-white body text                       |
| `--surface`          | `oklch(0.21 0.018 265)` | Card / panel background                    |
| `--surface-elevated` | `oklch(0.25 0.022 265)` | Elevated card (e.g., bias flags in report) |
| `--border`           | `oklch(0.31 0.022 265)` | Subtle borders                             |
| `--border-strong`    | `oklch(0.40 0.028 265)` | Stronger borders                           |

### Brand & Semantic Colors

| Token              | OKLCH           | Usage                                    |
| ------------------ | --------------- | ---------------------------------------- |
| `--brand`          | `0.66 0.21 285` | Purple — primary actions, agent identity |
| `--brand-glow`     | `0.74 0.18 285` | Lighter purple — highlights, hover glow  |
| `--flag-high`      | `0.66 0.24 25`  | Warm red — high-severity bias            |
| `--flag-medium`    | `0.72 0.20 50`  | Amber — medium-severity bias             |
| `--flag-low`       | `0.82 0.16 90`  | Yellow-green — low-severity bias         |
| `--verdict-hire`   | `0.72 0.20 145` | Green — hire verdicts                    |
| `--verdict-nohire` | `0.66 0.24 25`  | Red — no-hire verdicts                   |
| `--auditor`        | `0.70 0.20 20`  | Orange — Bias Auditor identity           |
| `--synth`          | `0.75 0.15 175` | Teal — Verdict Synthesizer identity      |
| `--google`         | `0.65 0.18 255` | Blue — Google Search badge               |

### Typography

- **Inter** — body text (system-ui fallback)
- **JetBrains Mono** — monospace for transcripts, labels, and numbers (`font-variant-numeric: tabular-nums`)

Fonts are loaded from Google Fonts in `__root.tsx`:

```
/inter-gf-var.woff2  /jetbrains-mono-gf-var.woff2
```

### Tailwind Utilities (Custom)

| Utility             | Definition                                           |
| ------------------- | ---------------------------------------------------- |
| `.fl-mono`          | `JetBrains Mono` + `tabular-nums`                    |
| `.fl-label-sm`      | `11px`, `0.08em` letter-spacing, uppercase           |
| `.fl-card`          | Surface bg, 1px border, 12px radius                  |
| `.fl-card-elevated` | Elevated surface, stronger border                    |
| `.fl-chip`          | `10.5px`, uppercase, 999px border-radius pill        |
| `.fl-transcript`    | `13px` monospace, `pre-wrap`, 82% opacity foreground |

---

## Component Tree

```
<RootLayout>                         (__root.tsx)
  <Index>                            (routes/index.tsx)
    <FairLensSidebar>                (Sidebar.tsx)
    <main>
      {stage === "input"  && <InputScreen />}     (InputScreen.tsx)
      {stage === "panel"  && <LivePanel />}       (LivePanel.tsx)
      {stage === "report" && <ReportScreen />}    (ReportScreen.tsx)
    </main>

  <!-- Shared primitives (primitives.tsx) -->
  <Chip />
  <InlineFlag />
  <VerdictBadge />
  <ConfidenceRing />
```

---

## Screens (Stages)

### Stage 1: InputScreen (`InputScreen.tsx`)

**Purpose:** Candidate selection and panel configuration.

**Layout:** Centered `max-w-[680px]` column.

**Elements:**

1. **Brand header** — "Fair**Lens**" in 34px with purple glow on the "Lens" portion, plus tagline "AI that checks its own blind spots" and tech stack chips (Gemini 2.5 Flash, Google ADK, Parallel Agents).

2. **Tabbed Layout Selector:**
   * **JSON Profile Tab:** Manual editing of candidate JSON parameters and access to preset candidate selectors.
   * **Upload PDF Resume Tab:** Drag-and-drop or click-to-browse PDF file upload. Calls the backend `/parse-resume` endpoint to extract candidate structure and auto-populates the JSON Profile parameters.

3. **Preset candidate selector (under JSON Profile tab)** — Three pill buttons (Alex Kim, Jordan Lee, Sam Patel) with active state indicated by solid purple fill. Each preset auto-fills the profile, target level, and panel mode. A contextual blurb below describes the bias scenario each candidate triggers (e.g., "pedigree bias", "affinity bias").

4. **Candidate profile textarea (under JSON Profile tab)** — `12-row` monospace textarea pre-filled with JSON. Editable. Focus highlights border in brand purple.

5. **Configuration dropdowns (under JSON Profile tab)** — Two-column grid:
   - Target Level: L3 / L4 / L5 / L6 (Auditor bias severity detection thresholds adapt based on target level).
   - Panel Mode: Balanced / Technical-heavy / Culture-heavy

6. **"Convene the Panel →" button** — Full-width purple button with hover glow effect (box-shadow transition). The primary action that transitions to the panel stage.

7. **Footer disclaimer** — "FairLens surfaces potential bias patterns for reflection. Final hiring decisions remain with humans."

---

### Stage 2: LivePanel (`LivePanel.tsx`)

**Purpose:** Real-time agent deliberation with streaming transcripts.

**Layout:** Full-height flex column with a status bar and a 3-column grid.

**Status Bar:**

- Left side: Animated pulsing dot + "Panel convened — three agents reasoning in parallel…" during deliberation. When complete: green dot + "Panel deliberation complete — synthesizer ready".
- Right side: Elapsed timer in `mm:ss` format (monospace). When done: "See the auditor's report →" button.

**Agent Columns** (3-column grid, `grid-cols-1 md:grid-cols-3`):

Each column contains:

1. **Sticky header** — Agent chip (e.g., "TECH"), agent name. Below: "Gemini 2.5 Flash" model label. Technical agent additionally shows "Google Search active" in blue.

2. **Transcript area** — Scrollable monospace text rendered character-by-character via `useScenarioRuntime`. A blinking cursor appears at the end while streaming. Bias flags (`InlineFlag`) appear inline with a slide-down animation.

3. **Verdict footer** — Appears with a fade-up animation when the agent finishes. Shows the raw verdict via `VerdictBadge`.

**States per column:**

- **Empty** (queued): pulsing dot + "queued…" in muted text
- **Streaming**: monospace text with blinking purple cursor
- **Flag encountered**: inline card with severity-colored left border
- **Done**: verdict badge in footer, cursor removed

---

### Stage 3: ReportScreen (`ReportScreen.tsx`)

**Purpose:** Bias audit findings, verdict comparison, and final recommendation.

**Layout:** Centered `max-w-[1100px]` column with two sections.

#### Section A: Bias Auditor Report

- **Header:** "BIAS AUDITOR" chip + "Report" label + "Bias detected" heading.
- **Subtitle:** Flag count summary with total confidence score.

**Two-column layout** (`grid-cols-1 lg:grid-cols-[2fr_1fr]`):

**Left — Flag Cards:**

- Each flag is an elevated card with:
  - Agent chip (e.g., `TECH`), bias type chip (e.g., `Pedigree Bias`), severity chip (`HIGH` / `MEDIUM` / `LOW`)
  - Quoted text with severity-colored left border in monospace
  - Explanation text
  - "→ Reframe on observable evidence..." mitigation suggestion in teal

**Right — Summary Sidebar:**

- `ConfidenceRing` SVG — circular progress indicator with color thresholds (green ≥ 75, amber ≥ 50, red < 50)
- Metric pills — Total / High / Medium / Low severity counts
- Bias type breakdown — horizontal bar chart
- Most flagged agent — name in red

#### Section B: Verdict Synthesizer

**Header:** "SYNTHESIZER" chip + "Final verdict" heading + subtitle.

**Verdict Flip** (3-column grid `md:grid-cols-[1fr_auto_1fr]`):

1. **Raw panel verdict** (left) — slides in from left. Shows verdict text in large monospace + per-agent chips with individual votes.

2. **Arrow** (center) — "→" icon with pulsing purple border if the verdict changed. Shows "[N] bias flag(s) removed".

3. **Debiased verdict** (right) — slides in from right. If changed: pulsing purple border, purple-tinted background. If unchanged: green-tinted background. Shows "Removing flagged reasoning changes the outcome." or "Panel verdict confirmed — bias found but did not alter outcome."

**What changed** — Card explaining the reasoning shift.

**Final recommendation** — Card with thick purple left border:

- Large verdict text (HIRE / NO HIRE) in green or red
- Confidence score
- Bullet-point reasoning with purple bullet markers
- Small `ConfidenceRing` (64px) aligned right

**Export row:**

- "Download JSON report" (surface-toned, placeholder)
- "Download PDF report" (surface-toned, placeholder)
- "Run another candidate →" (brand purple, resets to input stage)

---

## Sidebar: FairLensSidebar (`Sidebar.tsx`)

**Purpose:** Persistent pipeline status indicator.

**Layout:** Fixed `260px` left sidebar, hidden on mobile (`hidden lg:flex`).

**Sections:**

1. **Branding** — "Fair**Lens**" logo with purple glow + event subtitle.

2. **Pipeline list** — 6 rows showing status per entity:
   - Technical Interviewer, Culture-Fit Assessor, Seniority Assessor
   - _(separator)_
   - Bias Auditor, Verdict Synthesizer

3. **Status indicators per row:**
   - **waiting** — gray dot + "waiting" chip
   - **running** — animated pulsing dot (brand/auditor/synth color) + "running" chip
   - **done** — green dot + "done" chip
   - **flagged** — red dot + "[N] flags" chip

4. **Stack legend** — Bottom section listing: Gemini 2.5 Flash, Google ADK, ParallelAgent + SequentialAgent, FunctionTool: flag_bias(), Google Search grounding.

---

## UI Primitives (`primitives.tsx`)

### Chip

A rounded pill badge with 9 tone variants, each with distinct background, text, and border colors:

| Tone      | Visual                    |
| --------- | ------------------------- |
| `neutral` | Subtle surface on surface |
| `brand`   | Purple-tinted on surface  |
| `auditor` | Orange-tinted             |
| `high`    | Red-tinted                |
| `medium`  | Amber-tinted              |
| `low`     | Yellow-green-tinted       |
| `synth`   | Teal-tinted               |
| `google`  | Blue-tinted               |
| `success` | Green-tinted              |

All variants use `color-mix()` to blend the hue into the surface background at low opacity, keeping the dark theme cohesive.

### InlineFlag

A bias flag card appearing inline in agent transcripts:

- 3px left border colored by severity (red/amber/green)
- Semi-transparent background matching the severity color
- Flag icon (⚑) + severity chip at top
- Quoted text in monospace italics
- Explanation with "→" prefix

### VerdictBadge

A full-width verdict display with 6 levels, each with proportional opacity:

| Level          | Opacity      |
| -------------- | ------------ |
| STRONG_HIRE    | 28% green bg |
| HIRE           | 20% green bg |
| LEAN_HIRE      | 12% green bg |
| LEAN_NO_HIRE   | 12% red bg   |
| NO_HIRE        | 20% red bg   |
| STRONG_NO_HIRE | 28% red bg   |

### ConfidenceRing

An SVG circular progress indicator:

- Parameters: `value` (0–100), `size` (default 96px)
- Stroke thickness scales with size (6%)
- Color thresholds: ≥ 75 green, ≥ 50 amber, < 50 red
- 800ms transition on stroke-dashoffset
- Numeric value centered inside the ring

---

## Animations

All animations are defined in `src/styles.css` as `@keyframes` with corresponding utility classes:

| Name                  | Duration | Curve                    | Purpose                                    |
| --------------------- | -------- | ------------------------ | ------------------------------------------ |
| `fl-pulse-border`     | 2.2s     | ease-in-out              | Pulsing border glow on verdict flip arrow  |
| `fl-dot-pulse`        | 1.2s     | ease-in-out              | Pulsing status dot (running agents)        |
| `fl-flag-in`          | 360ms    | cubic-bezier(.2,.8,.2,1) | Slide-down entrance for bias flags         |
| `fl-fade-up`          | 450ms    | cubic-bezier(.2,.8,.2,1) | Fade in + slide up (verdicts, done states) |
| `fl-slide-from-left`  | 500ms    | cubic-bezier(.2,.8,.2,1) | Raw verdict card entrance                  |
| `fl-slide-from-right` | 500ms    | cubic-bezier(.2,.8,.2,1) | Debiased verdict card entrance             |
| `fl-cursor-blink`     | 1s       | steps(1)                 | Blinking text cursor during streaming      |

---

## Data Flow & Streaming

### Live SSE Integration (`use-backend-runtime.ts`)

The real-time agent transcripts and pipeline updates are driven by the FastAPI backend over Server-Sent Events (SSE). The `useBackendRuntime` custom hook orchestrates this integration:

1. **Request Initiation:** Sends a `POST /run` request to the backend with candidate data, triggering the backend pipeline task and establishing a connection.
2. **SSE Chunk Reading:** Reads raw chunk byte-streams asynchronously using standard `ReadableStream` decoding.
3. **Event Dispatching:** Handles multi-agent pipeline signals, modifying the local React state machine based on the following event types:
   * `pipeline_start`: Updates UI with the active provider (`gemini` / `grok` / `groq`).
   * `agent_start`: Transitions the specific agent column to a `running` status indicator.
   * `transcript_chunk`: Appends incoming characters to the targeted panel interviewer transcript text buffer. Events from `BiasAuditor` and `VerdictSynthesizer` are filtered out to prevent raw JSON and summary transcripts from bleeding into the primary column channels.
   * `agent_verdict`: Sets structured intermediate recommendations (e.g. `HIRE`, `LEAN HIRE`) in the agent's verdict footer.
   * `agent_done`: Sets the column status to `done`, finalizing the specific panel agent execution.
   * `bias_flag`: Extracted from the Auditor's calls to the `flag_bias` tool. Displays an animated inline flag warning block with correct severity styles.
   * `auditor_summary`: Renders the intermediate Auditor summary metrics.
   * `final_verdict`: Emits the full structured final debiased recommendation JSON.
4. **Timer synchronization:** Tracks active run-time duration locally.
5. **Float-to-Integer Calibration:** Incorporates validation safeguards on confidence values; float scores (e.g., `0.6` indicating 60%) are dynamically scaled to integers (`60`) for clean display in `ConfidenceRing` and template labels.

### Streaming Simulation fallback (`use-scenario-runtime.ts`)
* Used as a client-side mock fallback when running in fully disconnected mode or utilizing local presets. Matches the tick rate, character chunks, and flag pauses of the real-time agent pipeline.

### State Ownership

```
Index (routes/index.tsx)
  ├── stage: "input" | "panel" | "report"
  ├── scenario: Scenario (selected preset)
  ├── running: boolean (triggers streaming)
  ├── runtime, allDone, elapsedMs (from hook)
  │
  ├── FairLensSidebar
  │   └── reads: stage, scenario, runtime, panelDone
  │       → derives status per agent
  │
  ├── InputScreen
  │   └── writes: scenario selection via onStart()
  │
  ├── LivePanel
  │   └── reads: scenario, runtime, elapsedMs, allDone
  │       → renders streaming transcripts
  │
  └── ReportScreen
      └── reads: scenario, runtime
          → collects flags, computes aggregates, renders report
```

### Scenario Data (`fairlens-data.ts`)

Three presets, each containing:

- Candidate profile JSON
- Target level, panel mode
- 3 agent scripts with pre-authored transcripts including bias flag positions
- Raw verdict (per agent), debiased verdict, confidence score
- Change explanation and final reasoning bullets

---

## shadcn/ui Integration

The project includes 46 shadcn/ui primitive components in `src/components/ui/`. These are unstyled Radix-based primitives wrapped with the dark theme's CSS variables. The sidebar component (`sidebar.tsx`) is the shadcn/ui sidebar variant, though the app uses a custom `FairLensSidebar` instead. Key primitives used by the app include:

- `button.tsx` — though the app mostly uses inline-styled `<button>` elements
- `card.tsx` — patterns mirrored in `.fl-card` / `.fl-card-elevated` utilities
- `badge.tsx` — patterns mirrored in `Chip` component
- `separator.tsx` — replaced by `<div>` with border

The `components.json` configures shadcn with:

- Style: "new-york"
- Rounded radius: 0.75rem
- CSS variables (OKLCH)
- React Hook Form / Zod for form handling (available but not used in current UI)
