import os
import logging

logger = logging.getLogger("fairlens")

GEMINI_MODEL = "gemini-2.5-flash"
GROK_MODEL = "grok-2-1212"

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
XAI_API_KEY = os.getenv("XAI_API_KEY", "")


def gemini_available() -> bool:
    return bool(GOOGLE_API_KEY) and GOOGLE_API_KEY != "YOUR_GOOGLE_API_KEY_HERE"


def grok_available() -> bool:
    return bool(XAI_API_KEY)


def resolve_provider() -> str:
    if gemini_available():
        return "gemini"
    if grok_available():
        logger.warning("Gemini unavailable — falling back to Grok (xAI)")
        return "grok"
    logger.error("No AI provider configured (Gemini or Grok)")
    return "none"


def get_model() -> str:
    provider = resolve_provider()
    if provider == "gemini":
        return GEMINI_MODEL
    elif provider == "grok":
        return GROK_MODEL
    return GEMINI_MODEL


def is_grok() -> bool:
    return resolve_provider() == "grok"


def is_gemini() -> bool:
    return resolve_provider() == "gemini"
