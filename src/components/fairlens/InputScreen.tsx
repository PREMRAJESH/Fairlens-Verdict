import { useRef, useState } from "react";
import { Chip } from "./primitives";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const BACKEND_URL = (() => {
  if (import.meta.env.VITE_BACKEND_URL) return import.meta.env.VITE_BACKEND_URL;
  if (import.meta.env.DEV) return "http://localhost:8000";
  throw new Error(
    "Backend URL is not configured. Set VITE_BACKEND_URL in the Vercel Production environment and redeploy.",
  );
})();

const EMPTY_TEMPLATE = {
  name: "Candidate name",
  target_role: "Role they are applying for",
  target_level: "L3 / L4 / L5 / L6",
  years_experience: 0,
  education: "Degree, bootcamp, self-taught, etc.",
  current_company: "Company name and size",
  current_title: "Their current job title",
  past_companies: ["Previous company 1", "Previous company 2"],
  key_projects: [
    "Project 1 — what they built, scale, impact",
    "Project 2 — what they led, team size, outcome",
    "Project 3 — any cross-team or org-wide impact",
  ],
  interview_notes:
    "What happened in the interview — how they communicated, how they handled pushback, any standout moments positive or negative.",
  interviewer_raw_notes: [
    "Note from interviewer 1 — their honest reaction",
    "Note from interviewer 2 — their honest reaction",
    "Note from interviewer 3 — their honest reaction",
  ],
};

type InputTab = "json" | "pdf";

export function InputScreen({
  onStart,
}: {
  onStart: (profileJson: Record<string, unknown>, level: string, mode: string) => void;
}) {
  const [inputTab, setInputTab] = useState<InputTab>("json");
  const [profile, setProfile] = useState(() => JSON.stringify(EMPTY_TEMPLATE, null, 2));
  const [level, setLevel] = useState("L5");
  const [mode, setMode] = useState("Balanced");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isValidJson = (() => {
    try {
      JSON.parse(profile);
      return true;
    } catch {
      return false;
    }
  })();

  const handleJsonChange = (val: string) => {
    setProfile(val);
    setJsonError(null);
    setSuccessMsg(null);
  };

  const handleStart = () => {
    try {
      const parsed = JSON.parse(profile);
      setJsonError(null);

      if (parsed.name === "Candidate name") {
        setSuccessMsg(
          "Looks like you haven't filled in the candidate details yet. The audit will be more accurate with real data.",
        );
      }

      onStart(parsed, level, mode);
    } catch {
      setJsonError("Invalid JSON — fix before running the panel");
      textareaRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleFileSelect = (file: File | null) => {
    if (!file) return;
    if (!file.name.endsWith(".pdf")) {
      setPdfError("Only PDF files are accepted");
      return;
    }
    setPdfFile(file);
    setPdfError(null);
    uploadPdf(file);
  };

  const uploadPdf = async (file: File) => {
    setUploading(true);
    setPdfError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${BACKEND_URL}/parse-resume`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        if (res.status === 400) {
          setPdfError(err.detail ?? "Only PDF files are accepted");
        } else if (res.status === 422) {
          setPdfError(
            "Could not read this PDF — it may be a scanned image without a text layer. Try copy-pasting the text into the JSON field manually.",
          );
        } else if (res.status === 500) {
          setPdfError(
            "Gemini had trouble parsing this resume. Try again or paste the details manually.",
          );
        } else {
          setPdfError(err.detail ?? "Failed to parse resume");
        }
        return;
      }

      const result = await res.json();
      const candidate = result.candidate as Record<string, unknown>;

      setProfile(JSON.stringify(candidate, null, 2));
      setInputTab("json");
      setSuccessMsg("✓ Resume parsed by Gemini — review before running");
      setTimeout(() => setSuccessMsg(null), 4000);
      setTimeout(() => textareaRef.current?.focus(), 100);
    } catch {
      setPdfError(
        "Cannot reach backend — check that the backend is running and VITE_BACKEND_URL is configured correctly.",
      );
    } finally {
      setUploading(false);
    }
  };

  const clearPdf = () => {
    setPdfFile(null);
    setPdfError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="mx-auto w-full max-w-[680px] px-6 py-12">
      <header className="flex flex-col items-center text-center">
        <img
          src="/logo.jpg"
          alt="FairLens Logo"
          className="mb-5 h-20 w-20 rounded-full object-cover border-2 shadow-lg"
          style={{ borderColor: "var(--border)" }}
        />
        <h1
          className="text-[34px] font-medium leading-none tracking-tight"
          style={{ color: "var(--foreground)" }}
        >
          Fair<span style={{ color: "var(--brand-glow)" }}>Lens</span>
        </h1>
        <p
          className="mt-3 text-[12px] uppercase"
          style={{ color: "#545D74", letterSpacing: "0.08em" }}
        >
          PASTE A REAL CANDIDATE. SEE WHERE BIAS HIDES.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <Chip tone="neutral">gemini 2.5 flash</Chip>
          <Chip tone="neutral">google adk</Chip>
          <Chip tone="neutral">parallel agents</Chip>
        </div>
      </header>

      <div className="my-8 h-px" style={{ background: "var(--border)" }} />

      {/* Input tabs */}
      <div style={{ borderBottom: "1px solid #2A2F3E", display: "flex", gap: 0, marginBottom: 16 }}>
        {(["json", "pdf"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setInputTab(t)}
            style={{
              padding: "10px 20px",
              fontSize: 14,
              cursor: "pointer",
              border: 0,
              borderBottom: `2px solid ${inputTab === t ? "#7C6FFF" : "transparent"}`,
              color: inputTab === t ? "#F0F2F8" : "#545D74",
              background: "transparent",
              fontFamily: "inherit",
            }}
          >
            {t === "json" ? "JSON Profile" : "Upload PDF Resume"}
          </button>
        ))}
      </div>

      {/* JSON tab */}
      {inputTab === "json" && (
        <>
          <p style={{ fontSize: 13, color: "#8891A8", marginBottom: 8, lineHeight: 1.5 }}>
            Fill in the candidate's real details. The more specific you are, the more accurate the
            bias audit will be.
          </p>

          <textarea
            ref={textareaRef}
            value={profile}
            onChange={(e) => handleJsonChange(e.target.value)}
            spellCheck={false}
            className="fl-mono w-full resize-y rounded-lg p-4 text-[13px] leading-relaxed outline-none"
            style={{
              height: 320,
              background: "#0D0F14",
              border: `1px solid ${jsonError ? "#FF4C4C" : "#2A2F3E"}`,
              borderRadius: 8,
              color: "#C8CDD8",
              boxShadow: jsonError ? "0 0 0 3px #FF4C4C22" : "none",
            }}
            onFocus={(e) => {
              if (!jsonError) e.currentTarget.style.borderColor = "#7C6FFF";
              e.currentTarget.style.boxShadow = "0 0 0 3px #7C6FFF22";
            }}
            onBlur={(e) => {
              if (!jsonError) e.currentTarget.style.borderColor = "#2A2F3E";
              e.currentTarget.style.boxShadow = "none";
            }}
          />

          {jsonError && <p style={{ fontSize: 12, color: "#FF4C4C", marginTop: 4 }}>{jsonError}</p>}

          {successMsg && (
            <p style={{ fontSize: 12, color: "#22C55E", marginTop: 4 }}>{successMsg}</p>
          )}

          {/* Collapsible field guide */}
          <FieldGuide />
        </>
      )}

      {/* PDF tab */}
      {inputTab === "pdf" && (
        <>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files[0];
              if (f) handleFileSelect(f);
            }}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? "#7C6FFF" : "#2A2F3E"}`,
              borderRadius: 12,
              background: dragOver ? "#1E2330" : "#161A23",
              height: 180,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              cursor: "pointer",
              transition: "border-color 150ms, background 150ms",
            }}
            onMouseEnter={(e) => {
              if (!pdfFile && !dragOver) {
                e.currentTarget.style.borderColor = "#7C6FFF";
                e.currentTarget.style.background = "#1E2330";
              }
            }}
            onMouseLeave={(e) => {
              if (!pdfFile && !dragOver) {
                e.currentTarget.style.borderColor = "#2A2F3E";
                e.currentTarget.style.background = "#161A23";
              }
            }}
          >
            {!pdfFile ? (
              <>
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#545D74"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <polyline points="19 12 12 19 5 12" />
                </svg>
                <span style={{ fontSize: 14, color: "#8891A8" }}>Drop resume PDF here</span>
                <span style={{ fontSize: 12, color: "#545D74" }}>or click to browse</span>
              </>
            ) : (
              <div
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}
              >
                <div
                  style={{
                    background: "#3D3880",
                    color: "#A89BFF",
                    borderRadius: 20,
                    padding: "4px 12px",
                    fontSize: 12,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span>✓ {pdfFile.name}</span>
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      clearPdf();
                    }}
                    style={{ color: "#8891A8", cursor: "pointer" }}
                  >
                    ×
                  </span>
                </div>
                {uploading && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span
                      className="fl-spinner"
                      style={{
                        width: 14,
                        height: 14,
                        border: "2px solid #7C6FFF",
                        borderTopColor: "transparent",
                        borderRadius: "50%",
                        display: "inline-block",
                      }}
                    />
                    <span style={{ color: "#8891A8", fontSize: 12 }}>Uploading...</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileSelect(f);
            }}
          />

          {pdfError && (
            <p
              style={{
                fontSize: 12,
                color: pdfError.includes("scanned") ? "#FF8C42" : "#FF4C4C",
                marginTop: 8,
                lineHeight: 1.5,
              }}
            >
              {pdfError}
              {pdfError.includes("Try again") && (
                <span
                  onClick={() => pdfFile && uploadPdf(pdfFile)}
                  style={{
                    color: "#7C6FFF",
                    cursor: "pointer",
                    marginLeft: 8,
                    textDecoration: "underline",
                  }}
                >
                  Retry
                </span>
              )}
            </p>
          )}

          <p style={{ fontSize: 11, color: "#545D74", fontStyle: "italic", marginTop: 8 }}>
            PDF text will be extracted and structured automatically. Review the JSON before running
            the panel.
          </p>
        </>
      )}

      <div className="mt-6 grid grid-cols-2 gap-4">
        <div>
          <label className="fl-label-sm mb-2 block">Target level</label>
          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger className="w-full h-10 border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] text-[13px] rounded-lg cursor-pointer focus:ring-1 focus:ring-[var(--brand)]">
              <SelectValue placeholder="Select level" />
            </SelectTrigger>
            <SelectContent className="border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--foreground)]">
              {["L3", "L4", "L5", "L6"].map((l) => (
                <SelectItem
                  key={l}
                  value={l}
                  className="cursor-pointer text-[13px] focus:bg-[var(--brand-dim)] focus:text-[var(--foreground)]"
                >
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="fl-label-sm mb-2 block">Panel mode</label>
          <Select value={mode} onValueChange={setMode}>
            <SelectTrigger className="w-full h-10 border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] text-[13px] rounded-lg cursor-pointer focus:ring-1 focus:ring-[var(--brand)]">
              <SelectValue placeholder="Select mode" />
            </SelectTrigger>
            <SelectContent className="border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--foreground)]">
              {["Balanced", "Technical-heavy", "Culture-heavy"].map((l) => (
                <SelectItem
                  key={l}
                  value={l}
                  className="cursor-pointer text-[13px] focus:bg-[var(--brand-dim)] focus:text-[var(--foreground)]"
                >
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <button
        onClick={handleStart}
        className="mt-8 w-full rounded-lg py-3.5 text-[14px] font-medium transition-all"
        style={{
          background: "var(--brand)",
          color: "white",
          boxShadow: "0 0 0 0 color-mix(in oklab, var(--brand) 50%, transparent)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--brand-glow)";
          e.currentTarget.style.boxShadow =
            "0 0 24px 2px color-mix(in oklab, var(--brand) 40%, transparent)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "var(--brand)";
          e.currentTarget.style.boxShadow =
            "0 0 0 0 color-mix(in oklab, var(--brand) 50%, transparent)";
        }}
      >
        Convene the Panel →
      </button>

      <p className="mt-4 text-center text-[11px]" style={{ color: "var(--text-muted)" }}>
        FairLens surfaces potential bias patterns for reflection. Final hiring decisions remain with
        humans.
      </p>
    </div>
  );
}

function FieldGuide() {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ marginTop: 8 }}>
      <div
        onClick={() => setOpen((p) => !p)}
        style={{ fontSize: 13, color: "#7C6FFF", cursor: "pointer", userSelect: "none" }}
      >
        What should I include? {open ? "↑" : "↓"}
      </div>
      {open && (
        <div
          style={{
            marginTop: 4,
            background: "#161A23",
            border: "1px solid #2A2F3E",
            borderRadius: 8,
            padding: 16,
            animation: "fl-fade-up 200ms ease",
          }}
        >
          <FieldEntry
            name="name"
            desc="Full name or initials — used for reference only, not shared externally."
          />
          <FieldEntry
            name="education"
            desc='Be specific. "State university CS degree", "Self-taught", "Coding bootcamp" — this is where pedigree bias most commonly appears in panel reasoning.'
          />
          <FieldEntry
            name="key_projects"
            desc="This is the most important field. Describe what they actually built, the scale it ran at, the team size they led, and whether other teams depended on it. Vague entries produce vague audits."
          />
          <FieldEntry
            name="interviewer_raw_notes"
            desc={
              'Paste the actual words your interviewers used — not a cleaned-up summary. Raw language is where bias hides. "Didn\'t seem like a fit" is more useful to the auditor than "culture concerns noted."'
            }
          />
        </div>
      )}
    </div>
  );
}

function FieldEntry({ name, desc }: { name: string; desc: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: "#F0F2F8", fontWeight: 500 }}>{name}</div>
      <div style={{ fontSize: 12, color: "#8891A8", marginTop: 2 }}>{desc}</div>
    </div>
  );
}
