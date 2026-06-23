export type Verdict =
  | "STRONG_HIRE"
  | "HIRE"
  | "LEAN_HIRE"
  | "LEAN_NO_HIRE"
  | "NO_HIRE"
  | "STRONG_NO_HIRE";

export type Severity = "HIGH" | "MEDIUM" | "LOW";

export type AgentKey = "technical" | "culture" | "seniority";

export type BackendAgentName =
  | "TechnicalInterviewer"
  | "CultureFitAssessor"
  | "SeniorityAssessor"
  | "BiasAuditor"
  | "VerdictSynthesizer";

export type AgentStatus = "waiting" | "running" | "done" | "flagged" | "error";

type AgentMeta = {
  key: AgentKey;
  name: string;
  short: string;
  tool: string;
  backendName: BackendAgentName;
};

export const AGENTS: Record<AgentKey, AgentMeta> = {
  technical: {
    key: "technical",
    name: "Technical Interviewer",
    short: "TECHNICAL",
    tool: "Google Search active",
    backendName: "TechnicalInterviewer",
  },
  culture: {
    key: "culture",
    name: "Culture-Fit Assessor",
    short: "CULTURE",
    tool: "Gemini 2.5 Flash",
    backendName: "CultureFitAssessor",
  },
  seniority: {
    key: "seniority",
    name: "Seniority Assessor",
    short: "SENIORITY",
    tool: "Gemini 2.5 Flash",
    backendName: "SeniorityAssessor",
  },
};

export const AGENT_BACKEND_TO_FRONTEND: Record<BackendAgentName, AgentKey> = {
  TechnicalInterviewer: "technical",
  CultureFitAssessor: "culture",
  SeniorityAssessor: "seniority",
  BiasAuditor: "technical",
  VerdictSynthesizer: "technical",
};

export const ALL_AGENTS: {
  label: string;
  key: string;
  backendName: BackendAgentName;
  tone: "brand" | "auditor" | "synth";
}[] = [
  {
    label: "Technical Interviewer",
    key: "TechnicalInterviewer",
    backendName: "TechnicalInterviewer",
    tone: "brand",
  },
  {
    label: "Culture-Fit Assessor",
    key: "CultureFitAssessor",
    backendName: "CultureFitAssessor",
    tone: "brand",
  },
  {
    label: "Seniority Assessor",
    key: "SeniorityAssessor",
    backendName: "SeniorityAssessor",
    tone: "brand",
  },
  { label: "Bias Auditor", key: "BiasAuditor", backendName: "BiasAuditor", tone: "auditor" },
  {
    label: "Verdict Synthesizer",
    key: "VerdictSynthesizer",
    backendName: "VerdictSynthesizer",
    tone: "synth",
  },
];

export type TranscriptChunk =
  | { kind: "text"; text: string }
  | {
      kind: "flag";
      severity: Severity;
      biasType: string;
      quote: string;
      explain: string;
      correctiveReframe: string;
    };

export type BiasFlag = {
  agent_name: string;
  bias_type: string;
  quote: string;
  severity: Severity;
  explanation: string;
  corrective_reframe: string;
};

export type RawVerdict = {
  majority_position: string;
  positions: Record<string, string>;
  dissent: string | null;
};

export type BiasSummary = {
  total_flags: number;
  high_severity_count: number;
  medium_severity_count: number;
  low_severity_count: number;
  most_biased_agent: string;
  dominant_bias_types: string[];
  confidence_score: number;
};

export type DebiasedVerdict = {
  position: string;
  changed_from_raw: boolean;
  change_explanation: string | null;
  key_reasons_for: string[];
  key_reasons_against: string[];
};

export type FinalRecommendation = {
  decision: string;
  confidence: number;
  justification: string[];
};

export type FinalVerdictData = {
  session_id: string;
  raw_verdict: RawVerdict;
  bias_summary: BiasSummary;
  debiased_verdict: DebiasedVerdict;
  final_recommendation: FinalRecommendation;
};

export type AuditorSummaryData = {
  total_flags: number;
  high_severity_count: number;
  medium_severity_count: number;
  low_severity_count: number;
  most_biased_agent: string;
  dominant_bias_types: string[];
  confidence_score: number;
  auditor_summary_text: string;
};

const verdictRank: Record<Verdict, number> = {
  STRONG_NO_HIRE: -3,
  NO_HIRE: -2,
  LEAN_NO_HIRE: -1,
  LEAN_HIRE: 1,
  HIRE: 2,
  STRONG_HIRE: 3,
};

export function verdictIsHire(v: Verdict) {
  return verdictRank[v] > 0;
}

export function verdictLabel(v: Verdict) {
  return v.replace(/_/g, " ");
}
