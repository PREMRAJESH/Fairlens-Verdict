from google.adk.agents import LlmAgent
from google.adk.tools import google_search

from prompts.system_prompts import TECHNICAL_SYSTEM_PROMPT
from models.provider import GEMINI_MODEL as MODEL

# The Technical agent autonomously decides when to verify a claim. This is intentional —
# we do not tell it when to search. Autonomous tool use is the agentic behavior we want to demonstrate.
technical_interviewer = LlmAgent(
    name="TechnicalInterviewer",
    model=MODEL,
    instruction=TECHNICAL_SYSTEM_PROMPT,
    tools=[google_search],
    output_key="technical_transcript",
)
