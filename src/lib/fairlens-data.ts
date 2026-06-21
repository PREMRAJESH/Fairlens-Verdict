// Scripted FairLens scenarios — three preset candidates.
// Each scenario drives the live panel: per-agent transcript chunks
// (some carrying inline bias flags), per-agent raw verdict,
// auditor flags, and the debiased synthesizer verdict.

export type Verdict =
  | "STRONG_HIRE" | "HIRE" | "LEAN_HIRE"
  | "LEAN_NO_HIRE" | "NO_HIRE" | "STRONG_NO_HIRE";

export type Severity = "HIGH" | "MEDIUM" | "LOW";

export type AgentKey = "technical" | "culture" | "seniority";

export type AgentMeta = {
  key: AgentKey;
  name: string;
  short: string;
  tool: string;
};

export const AGENTS: Record<AgentKey, AgentMeta> = {
  technical: { key: "technical", name: "Technical Interviewer", short: "TECHNICAL",  tool: "Google Search active" },
  culture:   { key: "culture",   name: "Culture-Fit Assessor",  short: "CULTURE",    tool: "Gemini 2.5 Flash" },
  seniority: { key: "seniority", name: "Seniority Assessor",    short: "SENIORITY",  tool: "Gemini 2.5 Flash" },
};

export type TranscriptChunk =
  | { kind: "text"; text: string }
  | {
      kind: "flag";
      severity: Severity;
      biasType: string;     // e.g. "Pedigree bias"
      quote: string;        // the smoking-gun sentence
      explain: string;      // why it's a bias
    };

export type AgentScript = {
  agent: AgentKey;
  chunks: TranscriptChunk[];
  rawVerdict: Verdict;
  debiasedVerdict: Verdict;
};

export type Scenario = {
  id: string;
  name: string;
  blurb: string;
  profileJson: string;
  level: "L3" | "L4" | "L5" | "L6";
  panelMode: "Balanced" | "Technical-heavy" | "Culture-heavy";
  scripts: AgentScript[];
  rawVerdict: Verdict;
  debiasedVerdict: Verdict;
  changeExplanation: string;
  finalReasons: string[];
  confidence: number; // 0-100
};

// ---------- helpers for verdict aggregation ----------

const verdictRank: Record<Verdict, number> = {
  STRONG_NO_HIRE: -3, NO_HIRE: -2, LEAN_NO_HIRE: -1,
  LEAN_HIRE: 1, HIRE: 2, STRONG_HIRE: 3,
};

export function verdictIsHire(v: Verdict) {
  return verdictRank[v] > 0;
}

export function verdictLabel(v: Verdict) {
  return v.replace(/_/g, " ");
}

// ---------- the three presets ----------

export const SCENARIOS: Scenario[] = [
  {
    id: "alex",
    name: "Alex Kim",
    blurb:
      "Bootcamp grad, senior-scope projects. Designed to trigger pedigree bias. Best for the demo.",
    level: "L5",
    panelMode: "Balanced",
    profileJson: JSON.stringify(
      {
        name: "Alex Kim",
        education: "App Academy bootcamp, 2019",
        experience_years: 6,
        current_role: "Staff-adjacent engineer, fintech (Series C)",
        recent_projects: [
          "Designed sharded ledger handling 4k tps, p99 < 80ms",
          "Led migration off monolith into 3 services, owned rollback plan",
          "OSS maintainer of a TypeScript schema library (3.2k stars)",
        ],
        signals: ["Direct communicator", "Prefers async docs over meetings"],
      },
      null,
      2,
    ),
    scripts: [
      {
        agent: "technical",
        rawVerdict: "LEAN_NO_HIRE",
        debiasedVerdict: "HIRE",
        chunks: [
          { kind: "text", text: "System-design discussion centered on the sharded ledger. The candidate walked through partition keys, hot-shard mitigation, and a clean rollback plan." },
          { kind: "text", text: "\n\nThe scope here is real — 4k tps with p99 < 80ms is L5+ territory, and the migration plan shows ownership of failure modes." },
          {
            kind: "flag",
            severity: "HIGH",
            biasType: "Pedigree bias",
            quote: "the bootcamp background still concerns me at this level",
            explain:
              "Over-weighting credentials over demonstrated impact. The shipped scope contradicts the implied gap.",
          },
          { kind: "text", text: "\n\nVerified the OSS repo via Google Search — 3.2k stars, active maintainership, real architectural commits. Technical depth is not in question." },
        ],
      },
      {
        agent: "culture",
        rawVerdict: "LEAN_NO_HIRE",
        debiasedVerdict: "LEAN_HIRE",
        chunks: [
          { kind: "text", text: "Candidate gave direct, structured answers and pushed back on one of the panel's framing questions with a specific counter-example." },
          {
            kind: "flag",
            severity: "MEDIUM",
            biasType: "Affinity bias",
            quote: "felt a little blunt for our collaborative environment",
            explain:
              "Directness conflated with poor collaboration. The candidate cited written design docs as their preferred mode — a style preference, not a risk.",
          },
          { kind: "text", text: "\n\nNo evidence of dismissiveness or steamrolling. Async-first communication is well-documented at this scope." },
        ],
      },
      {
        agent: "seniority",
        rawVerdict: "HIRE",
        debiasedVerdict: "HIRE",
        chunks: [
          { kind: "text", text: "Project scope cleanly matches L5 expectations: cross-team migration, owned rollback, measurable latency targets." },
          { kind: "text", text: "\n\nDecision-making evidence is strong — chose service boundaries with explicit tradeoffs. Ready for L5; arguably underleveled today." },
        ],
      },
    ],
    rawVerdict: "NO_HIRE",
    debiasedVerdict: "HIRE",
    changeExplanation:
      "The pedigree_bias flag on the Technical agent and the affinity_bias flag on the Culture agent were the only signals supporting No Hire. Removing them, the remaining evidence — verified system-design scope, OSS maintainership, and clear L5 ownership — all support Hire.",
    finalReasons: [
      "Verified system-design scope matches L5 expectations (4k tps, p99 < 80ms).",
      "OSS contributions independently confirm the technical depth claimed.",
      "Communication directness is a style preference, not a risk signal.",
    ],
    confidence: 71,
  },

  {
    id: "jordan",
    name: "Jordan Lee",
    blurb: "Traditional CS background, mid-level scope. Low-bias control case — verdict holds.",
    level: "L4",
    panelMode: "Balanced",
    profileJson: JSON.stringify(
      {
        name: "Jordan Lee",
        education: "BS Computer Science, state university",
        experience_years: 4,
        current_role: "Software Engineer II, mid-size SaaS",
        recent_projects: [
          "Owned billing webhooks reliability (retry + dedupe)",
          "Shipped feature-flag rollout framework used by 5 teams",
        ],
        signals: ["Strong written communicator", "Pair-programs frequently"],
      },
      null,
      2,
    ),
    scripts: [
      {
        agent: "technical",
        rawVerdict: "HIRE",
        debiasedVerdict: "HIRE",
        chunks: [
          { kind: "text", text: "Webhook reliability discussion was sharp — idempotency keys, exponential backoff with jitter, dead-letter handling." },
          { kind: "text", text: "\n\nDesign is appropriate for L4 scope. No overreach, no gaps." },
        ],
      },
      {
        agent: "culture",
        rawVerdict: "HIRE",
        debiasedVerdict: "HIRE",
        chunks: [
          { kind: "text", text: "Collaborative, reflective, gave credit clearly to teammates on the flag-rollout project." },
          {
            kind: "flag",
            severity: "LOW",
            biasType: "Halo effect",
            quote: "really likeable — would want them on my team",
            explain:
              "Likeability is leaking into the rating. Restate the call on observable evidence only.",
          },
        ],
      },
      {
        agent: "seniority",
        rawVerdict: "HIRE",
        debiasedVerdict: "HIRE",
        chunks: [
          { kind: "text", text: "Scope is squarely L4: owns a component, coordinates across teams, escalates appropriately. No L5 stretch evidence yet, and none claimed." },
        ],
      },
    ],
    rawVerdict: "HIRE",
    debiasedVerdict: "HIRE",
    changeExplanation:
      "One low-severity halo-effect flag was logged on the Culture agent, but removing it does not change the outcome. All three panel verdicts independently support Hire on observable evidence.",
    finalReasons: [
      "Engineering scope cleanly matches L4 expectations.",
      "Reliability reasoning (idempotency, backoff, DLQs) is concrete and correct.",
      "Collaboration evidence holds without the likeability framing.",
    ],
    confidence: 84,
  },

  {
    id: "sam",
    name: "Sam Patel",
    blurb: "Career switcher from product management. Triggers affinity + horn bias.",
    level: "L5",
    panelMode: "Culture-heavy",
    profileJson: JSON.stringify(
      {
        name: "Sam Patel",
        education: "MBA + self-taught engineering (4 years full-time SWE)",
        experience_years: 4,
        current_role: "Senior Engineer, growth platform",
        recent_projects: [
          "Built experimentation pipeline used across 12 product teams",
          "Owned data contract with analytics, reduced incident rate 60%",
          "Mentored 3 junior engineers through promotion",
        ],
        signals: ["Cross-functional communicator", "Comfortable with ambiguity"],
      },
      null,
      2,
    ),
    scripts: [
      {
        agent: "technical",
        rawVerdict: "LEAN_HIRE",
        debiasedVerdict: "HIRE",
        chunks: [
          { kind: "text", text: "Experimentation pipeline walkthrough was solid — event schema versioning, backfill strategy, traffic-splitting." },
          {
            kind: "flag",
            severity: "MEDIUM",
            biasType: "Horn effect",
            quote: "MBA background makes me skeptical of the depth here",
            explain:
              "Credential bias inverted — penalizing a non-traditional path despite four years of shipping evidence.",
          },
        ],
      },
      {
        agent: "culture",
        rawVerdict: "HIRE",
        debiasedVerdict: "HIRE",
        chunks: [
          { kind: "text", text: "Strong cross-functional fluency. Explicitly named tradeoffs the analytics team had to absorb in the data-contract work." },
          { kind: "text", text: "\n\nMentorship signal is concrete: three named ICs, each with a promotion outcome." },
        ],
      },
      {
        agent: "seniority",
        rawVerdict: "LEAN_NO_HIRE",
        debiasedVerdict: "LEAN_HIRE",
        chunks: [
          {
            kind: "flag",
            severity: "HIGH",
            biasType: "Tenure bias",
            quote: "only four years of engineering tenure — not L5 yet",
            explain:
              "Treating years as a proxy for scope. The 60% incident-rate reduction and 12-team platform are L5 outcomes regardless of tenure.",
          },
          { kind: "text", text: "\n\nWhen judged on outcomes rather than years, the scope is L5-appropriate." },
        ],
      },
    ],
    rawVerdict: "LEAN_NO_HIRE",
    debiasedVerdict: "HIRE",
    changeExplanation:
      "Two flags drove the negative lean: a horn-effect penalty on credential path, and a tenure-as-proxy judgment on seniority. Both contradict the shipped evidence — a 12-team platform, measurable incident reduction, and three mentored promotions all read as L5 scope.",
    finalReasons: [
      "Platform reach (12 product teams) matches L5 cross-org scope.",
      "60% incident-rate reduction is a concrete, measurable outcome.",
      "Mentorship-through-promotion signal supports the senior level.",
    ],
    confidence: 68,
  },
];

export function getScenario(id: string): Scenario {
  return SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0];
}
