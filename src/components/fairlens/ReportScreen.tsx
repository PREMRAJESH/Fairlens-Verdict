import { AGENTS, type AgentKey, type Scenario, type Severity, type Verdict, verdictIsHire, verdictLabel } from "@/lib/fairlens-data";
import { Chip, ConfidenceRing, VerdictBadge } from "./primitives";
import type { Runtime } from "@/lib/use-scenario-runtime";

type Flag = { agent: AgentKey; severity: Severity; biasType: string; quote: string; explain: string };

function collectFlags(runtime: Runtime): Flag[] {
  const out: Flag[] = [];
  (Object.keys(runtime) as AgentKey[]).forEach((agent) => {
    for (const c of runtime[agent].rendered) {
      if (c.kind === "flag") {
        out.push({ agent, severity: c.severity, biasType: c.biasType, quote: c.quote, explain: c.explain });
      }
    }
  });
  return out;
}

export function ReportScreen({
  scenario,
  runtime,
  onReset,
}: {
  scenario: Scenario;
  runtime: Runtime;
  onReset: () => void;
}) {
  const flags = collectFlags(runtime);
  const byType = flags.reduce<Record<string, number>>((acc, f) => {
    acc[f.biasType] = (acc[f.biasType] ?? 0) + 1;
    return acc;
  }, {});
  const maxBar = Math.max(1, ...Object.values(byType));
  const counts = {
    high: flags.filter((f) => f.severity === "HIGH").length,
    medium: flags.filter((f) => f.severity === "MEDIUM").length,
    low: flags.filter((f) => f.severity === "LOW").length,
  };
  const mostBiased = (Object.keys(runtime) as AgentKey[])
    .map((a) => ({ a, n: runtime[a].rendered.filter((c) => c.kind === "flag").length }))
    .sort((x, y) => y.n - x.n)[0];

  return (
    <div className="mx-auto w-full max-w-[1100px] px-6 py-10">
      {/* ============== AUDITOR REPORT ============== */}
      <section>
        <div className="mb-1 flex items-center gap-2">
          <Chip tone="auditor">BIAS AUDITOR</Chip>
          <span className="fl-label-sm">Report</span>
        </div>
        <h2 className="text-[24px] font-medium tracking-tight" style={{ color: "var(--foreground)" }}>Bias detected</h2>
        <p className="mt-1 text-[13.5px]" style={{ color: "var(--text-secondary)" }}>
          {flags.length} flag{flags.length === 1 ? "" : "s"} across {scenario.scripts.length} agents · panel confidence {scenario.confidence}/100
        </p>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
          {/* Flag cards */}
          <div className="flex flex-col gap-3">
            {flags.length === 0 && (
              <div className="fl-card p-6 text-[13.5px]" style={{ color: "var(--text-secondary)" }}>
                No bias flags raised in this run.
              </div>
            )}
            {flags.map((f, i) => (
              <FlagCard key={i} flag={f} />
            ))}
          </div>

          {/* Summary panel */}
          <aside className="fl-card p-5">
            <div className="flex flex-col items-center pb-4">
              <ConfidenceRing value={scenario.confidence} />
              <div className="fl-label-sm mt-2">Panel confidence</div>
            </div>

            <div className="my-4 h-px" style={{ background: "var(--border)" }} />

            <div className="grid grid-cols-2 gap-2">
              <MetricPill label="Total" value={flags.length} />
              <MetricPill label="High" value={counts.high} tone="high" />
              <MetricPill label="Medium" value={counts.medium} tone="medium" />
              <MetricPill label="Low" value={counts.low} tone="low" />
            </div>

            <div className="my-4 h-px" style={{ background: "var(--border)" }} />

            <div className="fl-label-sm mb-3">Bias types</div>
            <div className="flex flex-col gap-2.5">
              {Object.entries(byType).map(([type, n]) => (
                <div key={type}>
                  <div className="mb-1 flex justify-between text-[12px]" style={{ color: "var(--text-secondary)" }}>
                    <span>{type}</span>
                    <span className="fl-mono">{n}</span>
                  </div>
                  <div className="h-[6px] w-full overflow-hidden rounded-full" style={{ background: "var(--border)" }}>
                    <div className="h-full rounded-full" style={{ width: `${(n / maxBar) * 100}%`, background: "var(--brand)" }} />
                  </div>
                </div>
              ))}
              {Object.keys(byType).length === 0 && (
                <div className="text-[12px]" style={{ color: "var(--text-muted)" }}>None</div>
              )}
            </div>

            {mostBiased && mostBiased.n > 0 && (
              <>
                <div className="my-4 h-px" style={{ background: "var(--border)" }} />
                <div className="fl-label-sm mb-1">Most flagged agent</div>
                <div className="text-[13px]" style={{ color: "var(--flag-high)" }}>
                  {AGENTS[mostBiased.a].name}
                </div>
              </>
            )}
          </aside>
        </div>
      </section>

      <div className="my-12 h-px" style={{ background: "var(--border)" }} />

      {/* ============== VERDICT FLIP ============== */}
      <section>
        <div className="mb-1 flex items-center gap-2">
          <Chip tone="synth">SYNTHESIZER</Chip>
          <span className="fl-label-sm">Final verdict</span>
        </div>
        <h2 className="text-[28px] font-medium tracking-tight" style={{ color: "var(--foreground)" }}>The verdict</h2>
        <p className="mt-1 text-[14px]" style={{ color: "var(--text-secondary)" }}>
          What the panel said. Then what the evidence says.
        </p>

        <VerdictFlip scenario={scenario} flagsRemoved={flags.length} />

        {/* Change explanation */}
        <div className="fl-card mt-8 p-6">
          <div className="fl-label-sm mb-2">What changed</div>
          <p className="text-[14px] leading-relaxed" style={{ color: "color-mix(in oklab, var(--foreground) 88%, transparent)" }}>
            {scenario.changeExplanation}
          </p>
        </div>

        {/* Final recommendation */}
        <div
          className="mt-6 rounded-[12px] border p-6"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border)",
            borderLeftWidth: 4,
            borderLeftColor: "var(--brand)",
          }}
        >
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1">
              <div className="fl-label-sm mb-2">Final recommendation</div>
              <div className="fl-mono text-[26px] font-medium" style={{ color: verdictIsHire(scenario.debiasedVerdict) ? "var(--verdict-hire)" : "var(--verdict-nohire)" }}>
                {verdictLabel(scenario.debiasedVerdict).toUpperCase()}
              </div>
              <div className="mt-1 text-[13px]" style={{ color: "var(--text-secondary)" }}>
                Confidence: <span className="fl-mono">{scenario.confidence}/100</span>
              </div>
              <ul className="mt-4 flex flex-col gap-2 text-[14px]" style={{ color: "color-mix(in oklab, var(--foreground) 88%, transparent)" }}>
                {scenario.finalReasons.map((r, i) => (
                  <li key={i} className="flex gap-2">
                    <span style={{ color: "var(--brand-glow)" }}>•</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
            <ConfidenceRing value={scenario.confidence} size={64} />
          </div>
        </div>

        {/* Export row */}
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            className="rounded-lg px-4 py-2.5 text-[13px] font-medium"
            style={{ background: "var(--surface)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
          >
            Download JSON report
          </button>
          <button
            className="rounded-lg px-4 py-2.5 text-[13px] font-medium"
            style={{ background: "var(--surface)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
          >
            Download PDF report
          </button>
          <button
            onClick={onReset}
            className="rounded-lg px-4 py-2.5 text-[13px] font-medium"
            style={{ background: "var(--brand)", color: "white" }}
          >
            Run another candidate  →
          </button>
        </div>
      </section>
    </div>
  );
}

function FlagCard({ flag }: { flag: Flag }) {
  const color =
    flag.severity === "HIGH" ? "var(--flag-high)" :
    flag.severity === "MEDIUM" ? "var(--flag-medium)" : "var(--flag-low)";
  const tone = flag.severity === "HIGH" ? "high" : flag.severity === "MEDIUM" ? "medium" : "low";
  return (
    <div className="fl-card-elevated fl-fade-up p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Chip tone="brand">{AGENTS[flag.agent].short}</Chip>
        <Chip tone={tone as "high" | "medium" | "low"}>{flag.biasType}</Chip>
        <Chip tone={tone as "high" | "medium" | "low"}>{flag.severity}</Chip>
      </div>
      <div
        className="fl-mono mb-3 rounded-r-md border-l-[3px] px-3.5 py-2.5 text-[14px]"
        style={{ borderLeftColor: color, background: `color-mix(in oklab, ${color} 14%, var(--background))`, color }}
      >
        “{flag.quote}”
      </div>
      <p className="text-[13.5px] leading-relaxed" style={{ color: "color-mix(in oklab, var(--foreground) 85%, transparent)" }}>
        {flag.explain}
      </p>
      <p className="mt-2 text-[13px]" style={{ color: "var(--synth)" }}>
        → Reframe on observable evidence; remove credential and tenure as proxies.
      </p>
    </div>
  );
}

function MetricPill({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "high" | "medium" | "low" }) {
  const color =
    tone === "high" ? "var(--flag-high)" :
    tone === "medium" ? "var(--flag-medium)" :
    tone === "low" ? "var(--flag-low)" : "var(--foreground)";
  return (
    <div className="fl-card flex flex-col items-center px-3 py-3">
      <span className="fl-mono text-[22px] font-medium" style={{ color }}>{value}</span>
      <span className="fl-label-sm mt-0.5">{label}</span>
    </div>
  );
}

function VerdictFlip({ scenario, flagsRemoved }: { scenario: Scenario; flagsRemoved: number }) {
  const changed = scenario.rawVerdict !== scenario.debiasedVerdict;

  return (
    <div className="mt-8 grid grid-cols-1 items-stretch gap-4 md:grid-cols-[1fr_auto_1fr]">
      {/* RAW */}
      <div
        className="fl-slide-from-left flex flex-col items-center justify-center rounded-[12px] border p-6 text-center"
        style={{
          background: "color-mix(in oklab, var(--verdict-nohire) 8%, var(--surface))",
          borderColor: "color-mix(in oklab, var(--verdict-nohire) 25%, var(--border))",
        }}
      >
        <div className="fl-label-sm">Raw panel verdict</div>
        <div className="fl-mono mt-2 text-[36px] font-medium" style={{ color: verdictIsHire(scenario.rawVerdict) ? "var(--verdict-hire)" : "var(--verdict-nohire)" }}>
          {verdictLabel(scenario.rawVerdict).toUpperCase()}
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-1.5">
          {scenario.scripts.map((s) => (
            <PanelChip key={s.agent} agent={s.agent} verdict={s.rawVerdict} />
          ))}
        </div>
      </div>

      {/* ARROW */}
      <div className="flex flex-col items-center justify-center gap-2 px-2 py-4">
        <div
          className={`text-[40px] leading-none ${changed ? "fl-pulse-border" : ""}`}
          style={{ color: "var(--brand-glow)", padding: changed ? "12px 20px" : "0", borderRadius: changed ? 999 : 0, border: changed ? "1px solid var(--brand)" : "none" }}
        >
          →
        </div>
        <div className="fl-mono text-[12px]" style={{ color: "var(--brand-glow)" }}>
          {flagsRemoved} bias flag{flagsRemoved === 1 ? "" : "s"} removed
        </div>
      </div>

      {/* DEBIASED */}
      <div
        className={`fl-slide-from-right flex flex-col items-center justify-center rounded-[12px] border p-6 text-center ${changed ? "fl-pulse-border" : ""}`}
        style={
          changed
            ? {
                background: "color-mix(in oklab, var(--brand) 10%, var(--surface))",
                borderColor: "var(--brand)",
                borderWidth: 2,
              }
            : {
                background: "color-mix(in oklab, var(--verdict-hire) 8%, var(--surface))",
                borderColor: "color-mix(in oklab, var(--verdict-hire) 25%, var(--border))",
              }
        }
      >
        <div className="fl-label-sm">Debiased verdict</div>
        <div className="fl-mono mt-2 text-[36px] font-medium" style={{ color: verdictIsHire(scenario.debiasedVerdict) ? "var(--verdict-hire)" : "var(--verdict-nohire)" }}>
          {verdictLabel(scenario.debiasedVerdict).toUpperCase()}
        </div>
        <p className="mt-3 text-[13px] italic" style={{ color: "var(--text-secondary)" }}>
          {changed
            ? "Removing flagged reasoning changes the outcome."
            : "Panel verdict confirmed — bias found but did not alter outcome."}
        </p>
      </div>
    </div>
  );
}

function PanelChip({ agent, verdict }: { agent: AgentKey; verdict: Verdict }) {
  const tone = verdictIsHire(verdict) ? "success" : "high";
  return <Chip tone={tone as "success" | "high"}>{AGENTS[agent].short}: {verdictLabel(verdict)}</Chip>;
}
