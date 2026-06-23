import json
from pathlib import Path

LABELS = {
    0: "Frontend Screens & Components",
    1: "UI Primitives — Layout & Navigation",
    2: "Backend AI Agents Pipeline",
    3: "Frontend Routing & Error Handling",
    4: "UI Primitives — Buttons & Controls",
    5: "UI Primitives — Forms & Selection",
    6: "UI Primitives — Command Palette",
    7: "UI Primitives — Menus",
    8: "Backend Data Models & Schemas",
    9: "UI Primitives — Form Fields",
    10: "UI Primitives — Carousel",
    11: "UI Primitives — Charts",
    12: "UI Primitives — Context Menu",
    13: "UI Primitives — Dropdown Menu",
    14: "UI Primitives — Alert Dialog",
    15: "UI Primitives — Table",
    16: "UI Primitives — Breadcrumb",
    17: "UI Primitives — Drawer",
    18: "UI Primitives — Navigation Menu",
    19: "UI Primitives — Select",
    20: "UI Primitives — Card",
    21: "UI Primitives — Toggle",
    22: "UI Primitives — Alert",
    23: "UI Primitives — Input OTP",
    24: "Python Dependencies — FastAPI Server Stack",
    25: "UI Primitives — Accordion",
    26: "UI Primitives — Avatar",
    27: "UI Primitives — Badge",
    28: "UI Primitives — Tabs",
    29: "UI Primitives — Scroll Area",
    30: "UI Primitives — Sonner Toaster",
    31: "Lint Configuration — ESLint",
    32: "Tools Package Init",
    33: "Python Dependency — Google ADK",
    34: "Python Dependency — Google Generative AI",
    35: "Python Dependency — OpenAI SDK",
    36: "Python Dependency — PyMuPDF",
    37: "Python Dependency — Python Dotenv",
    38: "UI Primitives — Aspect Ratio",
    39: "UI Primitives — Collapsible",
    40: "Build Config — Vite",
}

graph_path = Path("D:/New folder/Fairlens/graphify-out/graph.json")
graph = json.loads(graph_path.read_text(encoding="utf-8"))

labels_out = {}
for n in graph.get("nodes", []):
    cid = n.get("community", -1)
    if cid in LABELS:
        labels_out[n["id"]] = LABELS[cid]

labels_path = Path("D:/New folder/Fairlens/graphify-out/.graphify_labels.json")
labels_path.write_text(json.dumps(labels_out, indent=2), encoding="utf-8")
print(f"Wrote {len(labels_out)} labels to {labels_path}")
