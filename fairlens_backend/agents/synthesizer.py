from google.adk.agents import LlmAgent
from google.adk.planners import BuiltInPlanner
from google.genai.types import ThinkingConfig

from prompts.system_prompts import SYNTHESIZER_SYSTEM_PROMPT
from models.provider import GEMINI_MODEL as MODEL
from models.schemas import SynthesizerOutput

verdict_synthesizer = LlmAgent(
    name="VerdictSynthesizer",
    model=MODEL,
    instruction=SYNTHESIZER_SYSTEM_PROMPT,
    output_key="final_verdict",
    output_schema=SynthesizerOutput,
    planner=BuiltInPlanner(thinking_config=ThinkingConfig(thinking_budget=1024)),
)
