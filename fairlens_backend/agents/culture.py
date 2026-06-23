from google.adk.agents import LlmAgent

from prompts.system_prompts import CULTURE_SYSTEM_PROMPT
from models.provider import GEMINI_MODEL as MODEL

culture_assessor = LlmAgent(
    name="CultureFitAssessor",
    model=MODEL,
    instruction=CULTURE_SYSTEM_PROMPT,
    output_key="culture_transcript",
)
