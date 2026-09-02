import os
import logging

logger = logging.getLogger("fairlens")

GEMINI_MODEL = "gemini-2.5-flash"
GROK_MODEL = "grok-2-1212"
GROQ_MODEL = "qwen/qwen3.6-27b"

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
XAI_API_KEY = os.getenv("XAI_API_KEY", "")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

# Map GOOGLE_API_KEY to GEMINI_API_KEY for Google ADK / GenAI SDK compatibility
if GOOGLE_API_KEY and not os.getenv("GEMINI_API_KEY"):
    os.environ["GEMINI_API_KEY"] = GOOGLE_API_KEY

# --- Key format validation helpers ---

def _looks_like_gemini_key(key: str) -> bool:
    """Gemini API keys start with 'AIza' (legacy) or 'AQ.' (newer format)."""
    if key.startswith("AIza") and len(key) >= 35:
        return True
    if key.startswith("AQ.") and len(key) >= 20:
        return True
    return False


def _looks_like_xai_key(key: str) -> bool:
    """xAI API keys typically start with 'xai-'."""
    return key.startswith("xai-") and len(key) >= 20


def _looks_like_groq_key(key: str) -> bool:
    """Groq API keys typically start with 'gsk_'."""
    return key.startswith("gsk_") and len(key) >= 20


def _auto_detect_groq_key():
    """If XAI_API_KEY looks like a Groq key and GROQ_API_KEY is empty, remap it."""
    global GROQ_API_KEY, XAI_API_KEY
    if XAI_API_KEY and _looks_like_groq_key(XAI_API_KEY) and not GROQ_API_KEY:
        logger.warning(
            "XAI_API_KEY looks like a Groq key (starts with 'gsk_'). "
            "Auto-remapping to GROQ_API_KEY. Set GROQ_API_KEY explicitly to avoid this."
        )
        GROQ_API_KEY = XAI_API_KEY
        os.environ["GROQ_API_KEY"] = XAI_API_KEY
        XAI_API_KEY = ""

_auto_detect_groq_key()


# --- Startup validation warnings ---

def validate_keys_on_startup():
    """Log warnings for obviously invalid API keys. Called once at import time."""
    if GOOGLE_API_KEY and not _looks_like_gemini_key(GOOGLE_API_KEY):
        logger.warning(
            "⚠ GOOGLE_API_KEY doesn't look like a valid Gemini key "
            "(expected 'AIza...'). Got prefix: '%s...'. "
            "Get a valid key at https://aistudio.google.com/apikey",
            GOOGLE_API_KEY[:8],
        )
    if XAI_API_KEY and not _looks_like_xai_key(XAI_API_KEY):
        logger.warning(
            "⚠ XAI_API_KEY doesn't look like a valid xAI key "
            "(expected 'xai-...'). Got prefix: '%s...'. "
            "Get a valid key at https://console.x.ai/",
            XAI_API_KEY[:8],
        )
    if GROQ_API_KEY and not _looks_like_groq_key(GROQ_API_KEY):
        logger.warning(
            "⚠ GROQ_API_KEY doesn't look like a valid Groq key "
            "(expected 'gsk_...'). Got prefix: '%s...'.",
            GROQ_API_KEY[:8],
        )
    configured = []
    if GOOGLE_API_KEY:
        configured.append(f"Gemini ({'✓ valid format' if _looks_like_gemini_key(GOOGLE_API_KEY) else '✗ bad format'})")
    if XAI_API_KEY:
        configured.append(f"xAI ({'✓ valid format' if _looks_like_xai_key(XAI_API_KEY) else '✗ bad format'})")
    if GROQ_API_KEY:
        configured.append(f"Groq ({'✓ valid format' if _looks_like_groq_key(GROQ_API_KEY) else '✗ bad format'})")
    if configured:
        logger.info("API keys configured: %s", ", ".join(configured))
    else:
        logger.error("❌ No API keys configured! Set GOOGLE_API_KEY, XAI_API_KEY, or GROQ_API_KEY in .env")

validate_keys_on_startup()


# --- Provider availability ---

def gemini_available() -> bool:
    return bool(GOOGLE_API_KEY) and _looks_like_gemini_key(GOOGLE_API_KEY)


def grok_available() -> bool:
    return bool(XAI_API_KEY) and _looks_like_xai_key(XAI_API_KEY)


def groq_available() -> bool:
    return bool(GROQ_API_KEY) and _looks_like_groq_key(GROQ_API_KEY)


def resolve_provider() -> str:
    if gemini_available():
        return "gemini"
    if grok_available():
        logger.warning("Gemini unavailable — falling back to Grok (xAI)")
        return "grok"
    if groq_available():
        logger.warning("Gemini & Grok unavailable — falling back to Groq")
        return "groq"
    logger.error("No AI provider with valid keys configured (Gemini, Grok, or Groq)")
    return "none"


def get_model() -> str:
    provider = resolve_provider()
    if provider == "gemini":
        return GEMINI_MODEL
    elif provider == "grok":
        return GROK_MODEL
    elif provider == "groq":
        return GROQ_MODEL
    return GEMINI_MODEL


def is_grok() -> bool:
    return resolve_provider() == "grok"


def is_gemini() -> bool:
    return resolve_provider() == "gemini"


def is_groq() -> bool:
    return resolve_provider() == "groq"


def get_provider_status() -> dict:
    """Return a diagnostic dict of all provider statuses."""
    return {
        "gemini": {
            "key_set": bool(GOOGLE_API_KEY),
            "key_valid_format": _looks_like_gemini_key(GOOGLE_API_KEY) if GOOGLE_API_KEY else False,
            "available": gemini_available(),
        },
        "grok": {
            "key_set": bool(XAI_API_KEY),
            "key_valid_format": _looks_like_xai_key(XAI_API_KEY) if XAI_API_KEY else False,
            "available": grok_available(),
        },
        "groq": {
            "key_set": bool(GROQ_API_KEY),
            "key_valid_format": _looks_like_groq_key(GROQ_API_KEY) if GROQ_API_KEY else False,
            "available": groq_available(),
        },
        "active_provider": resolve_provider(),
    }
