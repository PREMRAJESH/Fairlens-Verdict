from google.adk.agents import LlmAgent

from prompts.system_prompts import SENIORITY_SYSTEM_PROMPT
from models.provider import GEMINI_MODEL as MODEL

seniority_assessor = LlmAgent(
    name="SeniorityAssessor",
    model=MODEL,
    instruction=SENIORITY_SYSTEM_PROMPT,
    output_key="seniority_transcript",
)
