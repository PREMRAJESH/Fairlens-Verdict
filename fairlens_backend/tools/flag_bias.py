from typing import Literal

_store: dict[str, list[dict]] = {}


def flag_bias(
    bias_type: Literal[
        "pedigree_bias", "halo_effect", "horn_effect", "affinity_bias",
        "anchoring", "attribution_bias", "recency_bias", "in_group_favoritism",
    ],
    quote: str,
    agent_name: Literal[
        "TechnicalInterviewer", "CultureFitAssessor", "SeniorityAssessor",
    ],
    severity: Literal["LOW", "MEDIUM", "HIGH"],
    explanation: str,
    corrective_reframe: str,
) -> dict:
    return {"status": "flagged"}


def store_flag(session_id: str, flag: dict):
    if session_id not in _store:
        _store[session_id] = []
    _store[session_id].append(flag)


def get_flags(session_id: str) -> list[dict]:
    return _store.get(session_id, [])


def get_auditor_summary(session_id: str) -> dict:
    flags = get_flags(session_id)
    if not flags:
        return {
            "total_flags": 0,
            "high_severity_count": 0,
            "medium_severity_count": 0,
            "low_severity_count": 0,
            "most_biased_agent": "None",
            "dominant_bias_types": [],
            "confidence_score": 100,
            "auditor_summary_text": "No bias flags raised.",
        }

    high = sum(1 for f in flags if f["severity"] == "HIGH")
    medium = sum(1 for f in flags if f["severity"] == "MEDIUM")
    low = sum(1 for f in flags if f["severity"] == "LOW")

    agent_counts: dict[str, int] = {}
    type_counts: dict[str, int] = {}
    for f in flags:
        agent_counts[f["agent_name"]] = agent_counts.get(f["agent_name"], 0) + 1
        type_counts[f["bias_type"]] = type_counts.get(f["bias_type"], 0) + 1

    most_biased = max(agent_counts, key=agent_counts.get)
    sorted_types = sorted(type_counts, key=type_counts.get, reverse=True)

    total = len(flags)
    score = max(0, 100 - (total * 12) - (high * 8))

    return {
        "total_flags": total,
        "high_severity_count": high,
        "medium_severity_count": medium,
        "low_severity_count": low,
        "most_biased_agent": most_biased,
        "dominant_bias_types": sorted_types,
        "confidence_score": min(score, 100),
        "auditor_summary_text": (
            f"Found {total} bias flag(s) across {len(agent_counts)} agent(s). "
            f"{most_biased} showed the most biased reasoning, "
            f"dominated by {sorted_types[0] if sorted_types else 'none'}."
        ),
    }


def clear_session(session_id: str):
    _store.pop(session_id, None)
