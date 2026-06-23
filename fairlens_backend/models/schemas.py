from pydantic import BaseModel, RootModel
from typing import Optional, Any


class CandidateProfile(RootModel):
    root: dict[str, Any]


class RunRequest(BaseModel):
    session_id: str
    candidate: CandidateProfile
    target_level: str
    panel_mode: str


class AgentPosition(BaseModel):
    TechnicalInterviewer: str
    CultureFitAssessor: str
    SeniorityAssessor: str


class RawVerdict(BaseModel):
    majority_position: str
    positions: AgentPosition
    dissent: Optional[str] = None


class BiasSummary(BaseModel):
    total_flags: int
    high_severity_count: int
    medium_severity_count: int
    low_severity_count: int
    most_biased_agent: str
    dominant_bias_types: list[str]
    confidence_score: int


class DebiasedVerdict(BaseModel):
    position: str
    changed_from_raw: bool
    change_explanation: Optional[str] = None
    key_reasons_for: list[str] = []
    key_reasons_against: list[str] = []


class FinalRecommendation(BaseModel):
    decision: str
    confidence: int
    justification: list[str]


class FinalVerdict(BaseModel):
    session_id: str
    raw_verdict: RawVerdict
    bias_summary: BiasSummary
    debiased_verdict: DebiasedVerdict
    final_recommendation: FinalRecommendation


class BiasFlag(BaseModel):
    agent_name: str
    bias_type: str
    quote: str
    severity: str
    explanation: str
    corrective_reframe: str


class RunResponse(BaseModel):
    session_id: str
    status: str


class SynthesizerOutput(BaseModel):
    raw_verdict: RawVerdict
    bias_summary: BiasSummary
    debiased_verdict: DebiasedVerdict
    final_recommendation: FinalRecommendation


VERDICT_SCALE = [
    "STRONG_HIRE", "HIRE", "LEAN_HIRE",
    "LEAN_NO_HIRE", "NO_HIRE", "STRONG_NO_HIRE",
]

BIAS_TYPES = [
    "pedigree_bias", "halo_effect", "horn_effect", "affinity_bias",
    "anchoring", "attribution_bias", "recency_bias", "in_group_favoritism",
]

SEVERITY_LEVELS = ["LOW", "MEDIUM", "HIGH"]

AGENT_NAMES = [
    "TechnicalInterviewer",
    "CultureFitAssessor",
    "SeniorityAssessor",
    "BiasAuditor",
    "VerdictSynthesizer",
]
