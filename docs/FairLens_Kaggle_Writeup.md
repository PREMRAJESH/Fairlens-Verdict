# FairLens: AI That Audits Its Own Bias

**A multi-agent hiring panel that doesn't just evaluate candidates — it evaluates itself.**

Submitted to: 5-Day AI Agents Intensive Vibe Coding Course With Google (Kaggle x Google, June 2026)
Built by: Prem Rajesh Sargara
Stack: Google ADK · Gemini 2.5 Flash · React 19 · FastAPI · Server-Sent Events

> **TL;DR:** FairLens runs a 3-agent hiring panel in parallel, then a 4th agent audits the _panel's own reasoning_ for cognitive bias — not the candidate's resume. A 5th agent re-checks the verdict with that biased reasoning stripped out. When the bias was load-bearing, the verdict flips. When it wasn't, the verdict is confirmed. Either way, you see the real answer underneath.

**By the numbers:** 5 agents · 8 bias types detected · 3 LLM providers with automatic failover.

---

## The Problem

Every hiring panel — human or AI — carries bias into its judgments. Pedigree bias toward big-name companies. Halo effects from confident communication. Affinity bias toward candidates who "feel like a culture fit." The standard fix in AI hiring tools is to pretend this doesn't happen, or to bolt on a disclaimer after the fact.

FairLens takes a different position: **if you're going to build an AI hiring panel, the panel's own reasoning is the highest-risk surface in the system, and it deserves the same scrutiny as the candidate.**

So FairLens doesn't just produce a verdict. It produces a verdict, _audits the reasoning that produced it_, and shows you — transparently, in real time — what changes when the biased reasoning is removed.

---

## What FairLens Does

A recruiter or hiring manager pastes a real candidate profile (JSON or PDF resume) into FairLens. From there:

1. **Three independent agents evaluate the candidate in parallel** — a Technical Interviewer (with live Google Search grounding to verify claims like past companies or technologies), a Culture-Fit Assessor, and a Seniority Assessor calibrated to the target level (L3–L6).
2. **A fourth agent — the Bias Auditor — reads the panel's own transcripts**, not the candidate's resume, and flags cognitive bias patterns: pedigree bias, halo effect, horn effect, affinity bias, anchoring, attribution bias, recency bias, and in-group favoritism. Each flag includes the exact quote, severity, and a corrective reframe.
3. **A fifth agent — the Verdict Synthesizer — re-evaluates the panel's majority position with the flagged reasoning stripped out.** If a position was only standing on biased reasoning, the debiased verdict can flip. If it holds up on the remaining evidence, the verdict is confirmed — but the _confidence score_ still reflects how much the panel leaned on flawed reasoning to get there.

The entire process streams live to the frontend over Server-Sent Events — you watch each agent think in real time, watch bias flags slide into the transcript the moment they're raised, and watch the raw verdict transform into the debiased one.

**Live walkthrough:** [video link]
**Code:** [github.com/PREMRAJESH/fairlens](https://github.com/PREMRAJESH/fairlens)

---

## Why I Built This

I came into this course already deep in multi-agent orchestration — I'd just finished building DebateVerse, a 9-agent advisory council, for a previous Kaggle capstone. What stuck with me from that project wasn't the orchestration itself; it was watching agents converge on a position that _sounded_ well-reasoned but was clearly anchored on one strong early signal.

That's exactly what happens in real hiring panels. A recruiter's first impression — a brand-name internship, a confident answer in the first five minutes — quietly reshapes how every later answer gets interpreted. FairLens is my attempt to build a system that doesn't just replicate that failure mode with AI, but actively interrogates it.

Hiring decisions, especially for internships and entry-level roles, are where pedigree bias and halo effects do the most damage — to candidates with real projects and skills but no brand-name company on their resume yet. FairLens is built for that candidate.

---

## How FairLens Maps to the Course

| Day       | Theme                                     | Where it shows up in FairLens                                                                                                                                                                                                                                                                                                                                                                                                      |
| --------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Day 1** | Vibe coding & autonomous agents           | The entire frontend (React 19 + TanStack Start) and backend (FastAPI + ADK) were built through natural-language-driven iteration, not hand-specified line by line — true to the course's "vibe coding" framing, while still producing a typed, schema-validated production system.                                                                                                                                                 |
| **Day 2** | Tool integration & agent interoperability | The Technical Interviewer agent calls `google_search` live to verify candidate claims (e.g., confirming a stated internship company exists). The Bias Auditor uses a custom `flag_bias()` function tool with structured args (agent_name, bias_type, quote, severity, explanation, corrective_reframe) rather than free-text output — a deliberate interoperability choice so the frontend can render flags without parsing prose. |
| **Day 3** | Skilled agents with memory & context      | Each of the five agents has a distinct system prompt encoding a specific evaluative _skill_ (technical depth assessment, culture-fit assessment, leveling against an L3–L6 rubric, bias pattern detection, debiased synthesis). The Auditor and Synthesizer agents use elevated `thinking_budget` (8192 tokens) because their task — reasoning _about_ reasoning — needs more deliberation than a first-pass evaluation.           |
| **Day 4** | Security, evaluation, and guardrails      | The Bias Auditor _is_ the evaluation layer — it's a built-in guardrail against a specific, well-documented failure mode (cognitive bias in AI-assisted hiring) rather than a generic "is this output safe" check. On the infrastructure side: strict UUID v4 validation on session IDs, a 50KB candidate-profile size cap, and a 10-session concurrency limit guard the pipeline against malformed or abusive input.               |
| **Day 5** | Spec-driven, production-grade deployment  | The backend is fully typed end-to-end with Pydantic v2 schemas (`FinalVerdict`, `BiasFlag`, `RunRequest`, etc.), containerized via Docker Compose with a health-checked FastAPI service, and built with a triple-provider failover chain (Gemini → Grok → Groq) so the pipeline degrades gracefully instead of hard-failing when one provider is rate-limited.                                                                     |

---

## Architecture

![FairLens System Architecture](System-Architecture.png)

The orchestration follows ADK's `SequentialAgent` / `ParallelAgent` composition: a `ParallelAgent` runs the three-agent hiring panel concurrently (no reason for Technical, Culture, and Seniority assessments to wait on each other), followed by a `SequentialAgent` that runs the Bias Auditor _before_ the Verdict Synthesizer — order matters here, since the Synthesizer's whole job depends on having the Auditor's flags already in hand.

**Provider resilience:** if `GOOGLE_API_KEY` fails (auth, rate-limit, or connection error), the system automatically fails over to a manually-orchestrated Grok pipeline, then to Groq — same five-agent structure, same schema, no ADK dependency. This isn't a fallback in name only; it's a fully parallel implementation that activates without the frontend ever knowing the provider changed.

---

## The Hardest Problem: Making the Audit _Mean_ Something

The obvious failure mode for a tool like this is building an auditor that flags bias cosmetically — it produces nice-looking flag cards, but the final decision never actually changes. That's a bias _detector_, not a bias _corrector_, and the distinction matters enormously for a tool whose entire premise is "we check our own blind spots."

I built FairLens to be stress-tested against exactly this failure mode. I ran a profile where the panel was swayed by a recognizable internship name and a confident interview style — exactly the pedigree bias and halo effect FairLens is designed to catch — while the underlying technical evidence (unverifiable claims, a failed fundamentals question, no working demos) didn't actually support a HIRE. The Synthesizer's job in that run is to re-evaluate the panel's majority position _after_ discarding the bias-tainted reasoning spans, and confirm whether the remaining evidence still supports it.

[FILL IN AFTER YOUR FINAL TEST RUN — pick whichever sentence matches what you actually captured on camera:]

- _If it flipped:_ "In that run, it flipped — the raw verdict was HIRE, and the debiased verdict came back NO_HIRE once the biased reasoning was removed. You can watch that exact run in the demo video."
- _If it confirmed:_ "In that run, the verdict held — the technical concerns were real enough on their own that removing the bias didn't change the outcome, only the confidence score. Which is itself a meaningful result: it means the system isn't flip-happy, it only moves the verdict when the evidence actually demands it."

That's the difference between confidence-score theater and an audit with teeth: the debiased verdict has to be _able_ to move, and when it does, the system needs to say so plainly (`changed_from_raw: true`) and explain why.

---

## What I'd Build Next

- **Persistent audit history** — right now sessions are ephemeral (in-memory, cleared on restart). A real deployment would log every audit so an organization could track whether specific bias types recur across a hiring pipeline over time, not just within a single candidate review.
- **Calibration against real outcomes** — the confidence-score formula is currently a reasonable heuristic (severity-weighted deduction, halved if the verdict didn't flip), not something validated against actual hire/no-hire outcomes. A production version would need a feedback loop.
- **Multi-candidate comparative auditing** — detecting bias _between_ candidates in the same hiring round (e.g., consistently harsher scrutiny applied to one demographic pattern of resume) is a different and harder problem than auditing one candidate's panel in isolation, and it's the natural next step.

---

## Closing

FairLens isn't trying to claim AI can be made "unbiased." It's trying to demonstrate something narrower and more honest: that a multi-agent system can be designed to interrogate its own reasoning, surface the specific moments where that reasoning leaned on something other than evidence, and show — transparently — whether the conclusion holds up without it. That's a meaningfully different design goal than most AI hiring tools on the market today, and I think it's the right one.

**FairLens surfaces potential bias patterns for reflection. Final hiring decisions remain with humans.**

---

_Built with Gemini 2.5 Flash, Google ADK, React 19, FastAPI, and a lot of stress-testing on my own resume._
