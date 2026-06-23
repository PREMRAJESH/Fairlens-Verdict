import type { Severity, Verdict } from "@/lib/fairlens-data";

export function Chip({
  children,
  tone = "neutral",
  className = "",
}: {
  children: React.ReactNode;
  tone?:
    | "neutral"
    | "brand"
    | "auditor"
    | "high"
    | "medium"
    | "low"
    | "synth"
    | "google"
    | "success"
    | "error";
  className?: string;
}) {
  const styles: Record<string, React.CSSProperties> = {
    neutral: {
      background: "var(--surface)",
      color: "var(--text-secondary)",
      borderColor: "var(--border)",
    },
    brand: {
      background: "color-mix(in oklab, var(--brand) 18%, var(--surface))",
      color: "var(--brand-glow)",
      borderColor: "color-mix(in oklab, var(--brand) 35%, transparent)",
    },
    auditor: {
      background: "color-mix(in oklab, var(--auditor) 18%, var(--surface))",
      color: "var(--auditor)",
      borderColor: "color-mix(in oklab, var(--auditor) 35%, transparent)",
    },
    high: {
      background: "color-mix(in oklab, var(--flag-high) 15%, var(--surface))",
      color: "var(--flag-high)",
      borderColor: "color-mix(in oklab, var(--flag-high) 35%, transparent)",
    },
    medium: {
      background: "color-mix(in oklab, var(--flag-medium) 15%, var(--surface))",
      color: "var(--flag-medium)",
      borderColor: "color-mix(in oklab, var(--flag-medium) 35%, transparent)",
    },
    low: {
      background: "color-mix(in oklab, var(--flag-low) 15%, var(--surface))",
      color: "var(--flag-low)",
      borderColor: "color-mix(in oklab, var(--flag-low) 35%, transparent)",
    },
    synth: {
      background: "color-mix(in oklab, var(--synth) 15%, var(--surface))",
      color: "var(--synth)",
      borderColor: "color-mix(in oklab, var(--synth) 35%, transparent)",
    },
    google: {
      background: "color-mix(in oklab, var(--google) 15%, var(--surface))",
      color: "var(--google)",
      borderColor: "color-mix(in oklab, var(--google) 35%, transparent)",
    },
    success: {
      background: "color-mix(in oklab, var(--verdict-hire) 18%, var(--surface))",
      color: "var(--verdict-hire)",
      borderColor: "color-mix(in oklab, var(--verdict-hire) 35%, transparent)",
    },
    error: {
      background: "color-mix(in oklab, var(--flag-high) 15%, var(--surface))",
      color: "var(--flag-high)",
      borderColor: "color-mix(in oklab, var(--flag-high) 35%, transparent)",
    },
  };
  return (
    <span className={`fl-chip ${className}`} style={styles[tone]}>
      {children}
    </span>
  );
}

export function severityTone(s: Severity): "high" | "medium" | "low" {
  return s === "HIGH" ? "high" : s === "MEDIUM" ? "medium" : "low";
}

export function InlineFlag({
  severity,
  biasType,
  quote,
  explain,
  correctiveReframe,
  animate = true,
}: {
  severity: Severity;
  biasType: string;
  quote: string;
  explain: string;
  correctiveReframe?: string;
  animate?: boolean;
}) {
  const severityColors: Record<Severity, { bg: string; border: string; text: string }> = {
    HIGH: { bg: "#1A0D0D", border: "#FF4C4C", text: "#FF9090" },
    MEDIUM: { bg: "#1A1108", border: "#FF8C42", text: "#FFAB6B" },
    LOW: { bg: "#1A1808", border: "#F5C842", text: "#F5D878" },
  };
  const c = severityColors[severity];

  return (
    <div
      className={animate ? "fl-flag-in" : ""}
      style={{
        background: c.bg,
        borderLeft: `3px solid ${c.border}`,
        borderRadius: "0 8px 8px 0",
        margin: "8px 0",
        padding: "10px 14px",
        fontSize: "12.5px",
        lineHeight: "1.6",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <span aria-hidden style={{ color: c.text }}>
          ⚑
        </span>
        <Chip tone={severityTone(severity)}>
          {biasType} · {severity}
        </Chip>
      </div>
      <div
        className="fl-mono"
        style={{ color: c.border, fontStyle: "italic", marginBottom: 6, fontSize: "12.5px" }}
      >
        ❝ {quote} ❞
      </div>
      <div style={{ color: c.text, marginBottom: correctiveReframe ? 6 : 0 }}>{explain}</div>
      {correctiveReframe && <div style={{ color: "#22D3B0" }}>→ {correctiveReframe}</div>}
    </div>
  );
}

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const map: Record<Verdict, { label: string; bg: string; fg: string; border: string }> = {
    STRONG_HIRE: {
      label: "Strong Hire",
      bg: "#166534",
      fg: "#22C55E",
      border: "color-mix(in oklab, var(--verdict-hire) 50%, transparent)",
    },
    HIRE: {
      label: "Hire",
      bg: "#166534",
      fg: "#22C55E",
      border: "color-mix(in oklab, var(--verdict-hire) 40%, transparent)",
    },
    LEAN_HIRE: {
      label: "Lean Hire",
      bg: "#14532D",
      fg: "#86EFAC",
      border: "color-mix(in oklab, var(--verdict-hire) 28%, transparent)",
    },
    LEAN_NO_HIRE: {
      label: "Lean No Hire",
      bg: "#450A0A",
      fg: "#FCA5A5",
      border: "color-mix(in oklab, var(--verdict-nohire) 28%, transparent)",
    },
    NO_HIRE: {
      label: "No Hire",
      bg: "#7F1D1D",
      fg: "#FF4C4C",
      border: "color-mix(in oklab, var(--verdict-nohire) 40%, transparent)",
    },
    STRONG_NO_HIRE: {
      label: "Strong No Hire",
      bg: "#991B1B",
      fg: "#FECACA",
      border: "color-mix(in oklab, var(--verdict-nohire) 50%, transparent)",
    },
  };
  const m = map[verdict];
  return (
    <div
      className="fl-mono w-full rounded-lg border px-3 py-2 text-center text-[13px] font-medium tracking-wide"
      style={{ background: m.bg, color: m.fg, borderColor: m.border }}
    >
      {m.label.toUpperCase()}
    </div>
  );
}

export function ConfidenceRing({ value, size = 96 }: { value: number; size?: number }) {
  const stroke = size * 0.06;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - value / 100);
  const color =
    value >= 75 ? "var(--verdict-hire)" : value >= 50 ? "var(--flag-medium)" : "var(--flag-high)";
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--border)"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 800ms cubic-bezier(.2,.8,.2,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="fl-mono text-[22px] font-medium" style={{ color }}>
          {value}
        </span>
      </div>
    </div>
  );
}
