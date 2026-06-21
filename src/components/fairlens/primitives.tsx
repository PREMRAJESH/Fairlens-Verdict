import type { AgentKey, Severity, Verdict } from "@/lib/fairlens-data";

// ============ Generic chip ============

export function Chip({
  children,
  tone = "neutral",
  className = "",
}: {
  children: React.ReactNode;
  tone?:
    | "neutral" | "brand" | "auditor"
    | "high" | "medium" | "low"
    | "synth" | "google" | "success";
  className?: string;
}) {
  const styles: Record<string, React.CSSProperties> = {
    neutral: { background: "var(--surface)", color: "var(--text-secondary)", borderColor: "var(--border)" },
    brand:   { background: "color-mix(in oklab, var(--brand) 18%, var(--surface))", color: "var(--brand-glow)", borderColor: "color-mix(in oklab, var(--brand) 35%, transparent)" },
    auditor: { background: "color-mix(in oklab, var(--auditor) 18%, var(--surface))", color: "var(--auditor)", borderColor: "color-mix(in oklab, var(--auditor) 35%, transparent)" },
    high:    { background: "color-mix(in oklab, var(--flag-high) 15%, var(--surface))", color: "var(--flag-high)", borderColor: "color-mix(in oklab, var(--flag-high) 35%, transparent)" },
    medium:  { background: "color-mix(in oklab, var(--flag-medium) 15%, var(--surface))", color: "var(--flag-medium)", borderColor: "color-mix(in oklab, var(--flag-medium) 35%, transparent)" },
    low:     { background: "color-mix(in oklab, var(--flag-low) 15%, var(--surface))", color: "var(--flag-low)", borderColor: "color-mix(in oklab, var(--flag-low) 35%, transparent)" },
    synth:   { background: "color-mix(in oklab, var(--synth) 15%, var(--surface))", color: "var(--synth)", borderColor: "color-mix(in oklab, var(--synth) 35%, transparent)" },
    google:  { background: "color-mix(in oklab, var(--google) 15%, var(--surface))", color: "var(--google)", borderColor: "color-mix(in oklab, var(--google) 35%, transparent)" },
    success: { background: "color-mix(in oklab, var(--verdict-hire) 18%, var(--surface))", color: "var(--verdict-hire)", borderColor: "color-mix(in oklab, var(--verdict-hire) 35%, transparent)" },
  };
  return (
    <span className={`fl-chip ${className}`} style={styles[tone]}>
      {children}
    </span>
  );
}

export function agentTone(agent: AgentKey): "brand" | "auditor" {
  return agent === "technical" || agent === "culture" || agent === "seniority" ? "brand" : "auditor";
}

export function severityTone(s: Severity): "high" | "medium" | "low" {
  return s === "HIGH" ? "high" : s === "MEDIUM" ? "medium" : "low";
}

// ============ Inline bias flag ============

export function InlineFlag({
  severity,
  biasType,
  quote,
  explain,
}: {
  severity: Severity;
  biasType: string;
  quote: string;
  explain: string;
}) {
  const color =
    severity === "HIGH" ? "var(--flag-high)" :
    severity === "MEDIUM" ? "var(--flag-medium)" : "var(--flag-low)";
  const bg = `color-mix(in oklab, ${color} 14%, var(--background))`;
  return (
    <div
      className="fl-flag-in my-2 rounded-r-md border-l-[3px] px-3 py-2 text-[12.5px] leading-relaxed"
      style={{ borderLeftColor: color, background: bg, color: `color-mix(in oklab, ${color} 80%, var(--foreground))` }}
    >
      <div className="mb-1 flex items-center gap-2">
        <span aria-hidden>⚑</span>
        <Chip tone={severityTone(severity)}>{biasType} · {severity}</Chip>
      </div>
      <div className="fl-mono mb-1 italic" style={{ color }}>"{quote}"</div>
      <div style={{ color: "color-mix(in oklab, var(--foreground) 75%, transparent)" }}>
        → {explain}
      </div>
    </div>
  );
}

// ============ Verdict badge ============

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const map: Record<Verdict, { label: string; bg: string; fg: string; border: string }> = {
    STRONG_HIRE:    { label: "Strong Hire",    bg: "color-mix(in oklab, var(--verdict-hire) 28%, var(--background))", fg: "var(--verdict-hire)", border: "color-mix(in oklab, var(--verdict-hire) 50%, transparent)" },
    HIRE:           { label: "Hire",           bg: "color-mix(in oklab, var(--verdict-hire) 20%, var(--background))", fg: "var(--verdict-hire)", border: "color-mix(in oklab, var(--verdict-hire) 40%, transparent)" },
    LEAN_HIRE:      { label: "Lean Hire",      bg: "color-mix(in oklab, var(--verdict-hire) 12%, var(--background))", fg: "var(--verdict-hire)", border: "color-mix(in oklab, var(--verdict-hire) 28%, transparent)" },
    LEAN_NO_HIRE:   { label: "Lean No Hire",   bg: "color-mix(in oklab, var(--verdict-nohire) 12%, var(--background))", fg: "var(--verdict-nohire)", border: "color-mix(in oklab, var(--verdict-nohire) 28%, transparent)" },
    NO_HIRE:        { label: "No Hire",        bg: "color-mix(in oklab, var(--verdict-nohire) 20%, var(--background))", fg: "var(--verdict-nohire)", border: "color-mix(in oklab, var(--verdict-nohire) 40%, transparent)" },
    STRONG_NO_HIRE: { label: "Strong No Hire", bg: "color-mix(in oklab, var(--verdict-nohire) 28%, var(--background))", fg: "var(--verdict-nohire)", border: "color-mix(in oklab, var(--verdict-nohire) 50%, transparent)" },
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

// ============ Confidence ring ============

export function ConfidenceRing({ value, size = 96 }: { value: number; size?: number }) {
  const stroke = size * 0.06;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - value / 100);
  const color =
    value >= 75 ? "var(--verdict-hire)" :
    value >= 50 ? "var(--flag-medium)" : "var(--flag-high)";
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--border)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r}
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
        <span className="fl-mono text-[22px] font-medium" style={{ color }}>{value}</span>
      </div>
    </div>
  );
}
