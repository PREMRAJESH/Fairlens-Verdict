# FairLens — Multi-Agent Hiring Panel with Real-Time Bias Auditing

**AI that checks its own blind spots.**

**Track: Agents for Business**

---

## The Problem

Hiring bias is one of the most documented and
expensive problems in talent acquisition. Studies
show that identical candidates receive different
evaluations based on the name on their resume,
the prestige of their university, or whether an
interviewer personally liked their energy.

The bias is not malicious. It is cognitive —
baked into how human reasoning works under
time pressure and uncertainty. Pedigree bias,
anchoring, halo effect, affinity bias — these
are patterns that repeat across every hiring
panel, in every company, every day.

The cost is real. Companies miss strong candidates.
Candidates never know why they didn't get the
callback. And no one in the room notices it
happening because no one is watching.

FairLens watches.

---

## Why Agents

A static tool cannot solve this problem.

The bias happens inside reasoning — in the words
an interviewer uses while forming their opinion,
not in the final verdict they submit. By the time
a score hits a spreadsheet, the bias is invisible.

Only an agent can watch another agent reason in
real time. Only a multi-agent architecture allows
one agent to evaluate the panel's thinking as it
forms — before a verdict is reached, while there
is still time to correct it.

This is why FairLens is an agent system and not
a form validator or a post-hoc analytics tool.
The auditor must be inside the deliberation,
not reviewing its output.

---

## The Solution

FairLens simulates a hiring panel of three AI
agents that evaluate a candidate simultaneously.
A fourth agent — the Bias Auditor — watches all
three transcripts in real time and calls a
structured tool function every time it detects
cognitive bias. A fifth agent synthesizes two
verdicts: what the panel said, and what they
would have said without the biased reasoning.

The gap between those two verdicts is the proof
that bias was affecting the decision.

---

## Architecture

[ARCHITECTURE DIAGRAM — docs/system_architecture.jpg]

The pipeline uses Google ADK with five LlmAgents:

**ParallelAgent — HiringPanel**
Three agents run simultaneously with no shared
context. Independence is deliberate — if agents
saw each other's reasoning first, they would
anchor on it, defeating the audit.

- TechnicalInterviewer — evaluates skill depth
  and project complexity. Uses ADK's built-in
  google_search tool autonomously to verify
  candidate claims against live web results.
  
- CultureFitAssessor — evaluates communication
  style, ownership signals, and growth mindset.

- SeniorityAssessor — maps scope of impact
  against an L3–L6 leveling rubric.

**SequentialAgent — AuditAndSynthesize**
Runs after the panel completes, in strict order.

- BiasAuditor — reads all three transcripts.
  Uses BuiltInPlanner with thinking_budget=8192
  to reason carefully before flagging. Calls
  FunctionTool(flag_bias) for each bias instance
  found. Detects eight bias types: pedigree bias,
  halo effect, horn effect, anchoring, affinity
  bias, attribution bias, recency bias, and
  in-group favoritism.

- VerdictSynthesizer — receives transcripts and
  the full bias report. Uses BuiltInPlanner and
  output_schema to produce validated JSON
  containing both raw and debiased verdicts.

Everything streams to the React frontend via
Server-Sent Events. The bias flag card appears
inline in the agent's transcript mid-sentence —
not in a sidebar, not in a report — inline,
as the agent speaks.

---

## Course Concepts Demonstrated

| Concept | Implementation | Location |
|---|---|---|
| Multi-agent system (ADK) | ParallelAgent + 2× SequentialAgent + 5× LlmAgent + Runner + InMemorySessionService + FunctionTool | pipeline.py, agents/ |
| Security features | UUID validation, input size limits, session limits, no data persistence, CORS restriction | main.py, SECURITY.md |
| Deployability | Docker + docker-compose, environment config, health check endpoint | Dockerfile, docker-compose.yml |
| Antigravity | Used to index codebase for architecture diagram generation and cross-file reasoning | Video demonstration |

---

## Technical Highlights

**Autonomous tool use**
The Technical Interviewer is given google_search
but not told when or what to search. Gemini 2.5
Flash decides mid-reasoning to verify a claim.
This is genuine agentic behavior — not hardcoded
search triggers.

**Real SSE streaming**
The frontend uses fetch() with ReadableStream,
not EventSource. This is required because the
/run endpoint uses POST. Every token, every bias
flag, and every verdict streams live.

**Triple provider fallback**
Gemini 2.5 Flash is primary. On any exception,
the pipeline falls back to Grok (grok-2-1212),
then Groq (llama-3.3-70b-versatile). The
frontend never sees an error.

**Confidence score**
Calculated as: 100 − (HIGH×15 + MEDIUM×7 + LOW×3)
If the verdict did not change after debiasing,
the penalty is halved — the panel held up under
scrutiny. Range: 20–100.

---

## Demo

The demo uses a candidate profile engineered to
trigger pedigree bias and affinity bias while
having objectively strong project evidence.

The Technical Interviewer writes:
"bootcamp background concerns me for L5"

The Bias Auditor flags it immediately:
PEDIGREE BIAS · HIGH — credential used as proxy
for ability despite clear project evidence.

Raw panel verdict: NO HIRE
Debiased verdict: HIRE

That flip is the demo. It happens live.

---

## What I Learned

Building FairLens taught me that the hardest
part of multi-agent systems is not the agents —
it is the orchestration. Deciding which agents
run in parallel versus in sequence, how session
state flows between them, and how to stream
partial results without blocking — these are
architectural decisions that ADK makes possible
but still requires careful thought.

The most surprising discovery was that the
BiasAuditor works better with BuiltInPlanner.
Without it, the agent would flag aggressively
and immediately. With it, the agent reads all
three transcripts before forming a judgment —
which is exactly what a good auditor does.

---

## Conclusion

FairLens does not replace the hiring manager.
It makes the panel's reasoning visible and
accountable — for the first time.

When the raw verdict says NO HIRE and the
debiased verdict says HIRE, you now know exactly
what changed and why. That is not just a feature.
That is a different standard for how hiring
decisions get made.

Five agents. One mission. Make fairer decisions.
