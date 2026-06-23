from google.adk.agents import LlmAgent
from google.adk.tools import google_search

from prompts.system_prompts import TECHNICAL_SYSTEM_PROMPT
from models.provider import GEMINI_MODEL as MODEL

technical_interviewer = LlmAgent(
    name="TechnicalInterviewer",
    model=MODEL,
    instruction=TECHNICAL_SYSTEM_PROMPT,
    tools=[google_search],
    output_key="technical_transcript",
)
