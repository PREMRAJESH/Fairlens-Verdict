from google.adk.agents import LlmAgent
from google.adk.planners import BuiltInPlanner
from google.genai.types import ThinkingConfig
from google.adk.tools import FunctionTool

from prompts.system_prompts import AUDITOR_SYSTEM_PROMPT
from tools.flag_bias import flag_bias
from models.provider import GEMINI_MODEL as MODEL

flag_bias_tool = FunctionTool(flag_bias)

bias_auditor = LlmAgent(
    name="BiasAuditor",
    model=MODEL,
    instruction=AUDITOR_SYSTEM_PROMPT,
    tools=[flag_bias_tool],
    output_key="bias_report",
    planner=BuiltInPlanner(thinking_config=ThinkingConfig(thinking_budget=8192)),
)
