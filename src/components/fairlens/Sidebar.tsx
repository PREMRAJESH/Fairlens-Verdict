import { AGENTS, type AgentKey, type Scenario } from "@/lib/fairlens-data";
import { Chip } from "./primitives";
import type { Runtime } from "@/lib/use-scenario-runtime";

type Status = "waiting" | "running" | "done" | "flagged";

function agentStatus(agent: AgentKey, scenario: Scenario, runtime: Runtime, panelDone: boolean): Status {
  const r = runtime[agent];
  if (r.rendered.length === 0) return "waiting";
  if (!r.done) return "running";
  const flags = r.rendered.filter((c) => c.kind === "flag");
  if (flags.length > 0) return "flagged";
  return panelDone ? "done" : "done";
}

export function FairLensSidebar({
  stage,
  scenario,
  runtime,
  panelDone,
}: {
  stage: "input" | "panel" | "report";
  scenario: Scenario;
  runtime: Runtime;
  panelDone: boolean;
}) {
  return (
    <aside className="hidden w-[260px] shrink-0 border-r p-5 lg:flex lg:flex-col" style={{ borderColor: "var(--border)", background: "color-mix(in oklab, var(--background) 92%, black)" }}>
      <div>
        <div className="text-[16px] font-semibold tracking-tight" style={{ color: "var(--foreground)" }}>
          Fair<span style={{ color: "var(--brand-glow)" }}>Lens</span>
        </div>
        <div className="mt-1 text-[11px]" style={{ color: "var(--text-muted)", letterSpacing: "0.06em" }}>
          5 DAYS OF GEN AI · GOOGLE × KAGGLE
        </div>
      </div>

      <div className="my-5 h-px" style={{ background: "var(--border)" }} />

      <div className="fl-label-sm mb-3">Pipeline</div>
      <div className="flex flex-col gap-2.5">
        {(Object.keys(AGENTS) as AgentKey[]).map((k) => {
          const status = stage === "input" ? "waiting" : agentStatus(k, scenario, runtime, panelDone);
          return <PipelineRow key={k} label={AGENTS[k].name} status={status} />;
        })}

        <div className="my-1.5 h-px" style={{ background: "var(--border)" }} />

        <PipelineRow
          label="Bias Auditor"
          tone="auditor"
          status={
            stage === "input" ? "waiting" :
            !panelDone ? "running" :
            countFlags(runtime, "HIGH") > 0 ? "flagged" : "done"
          }
          flagCount={panelDone ? countFlags(runtime) : 0}
        />
        <PipelineRow
          label="Verdict Synthesizer"
          tone="synth"
          status={stage === "report" ? "done" : panelDone ? "running" : "waiting"}
        />
      </div>

      <div className="mt-auto pt-6">
        <div className="fl-label-sm mb-2">Stack</div>
        <ul className="space-y-1 text-[12px]" style={{ color: "var(--text-secondary)" }}>
          <li>Gemini 2.5 Flash</li>
          <li>Google ADK</li>
          <li>ParallelAgent + SequentialAgent</li>
          <li>FunctionTool: flag_bias()</li>
          <li>Google Search grounding</li>
        </ul>
      </div>
    </aside>
  );
}

function countFlags(runtime: Runtime, severity?: "HIGH" | "MEDIUM" | "LOW") {
  let n = 0;
  for (const k of Object.keys(runtime) as AgentKey[]) {
    for (const c of runtime[k].rendered) {
      if (c.kind === "flag" && (!severity || c.severity === severity)) n++;
    }
  }
  return n;
}

function PipelineRow({
  label,
  status,
  tone = "brand",
  flagCount = 0,
}: {
  label: string;
  status: Status;
  tone?: "brand" | "auditor" | "synth";
  flagCount?: number;
}) {
  let dot: React.ReactNode;
  if (status === "running") {
    dot = (
      <span
        className="fl-dot-pulse h-2 w-2 rounded-full"
        style={{ background: tone === "auditor" ? "var(--auditor)" : tone === "synth" ? "var(--synth)" : "var(--brand)" }}
      />
    );
  } else if (status === "done") {
    dot = <span className="h-2 w-2 rounded-full" style={{ background: "var(--verdict-hire)" }} />;
  } else if (status === "flagged") {
    dot = <span className="h-2 w-2 rounded-full" style={{ background: "var(--flag-high)" }} />;
  } else {
    dot = <span className="h-2 w-2 rounded-full" style={{ background: "var(--text-muted)" }} />;
  }

  const chip =
    status === "running" ? <Chip tone={tone}>running</Chip> :
    status === "done" ? <Chip tone="success">done</Chip> :
    status === "flagged" ? <Chip tone="high">{flagCount > 0 ? `${flagCount} flags` : "flagged"}</Chip> :
    <Chip tone="neutral">waiting</Chip>;

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2.5 text-[12.5px]" style={{ color: "var(--foreground)" }}>
        {dot}
        <span className="truncate">{label}</span>
      </div>
      {chip}
    </div>
  );
}
