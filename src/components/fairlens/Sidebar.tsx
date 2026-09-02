import { ALL_AGENTS, type BiasFlag, type AgentStatus } from "@/lib/fairlens-data";
import { Chip } from "./primitives";

export function FairLensSidebar({
  provider,
  agentStatuses,
  biasFlags,
}: {
  provider: "gemini" | "grok" | "groq" | null;
  agentStatuses: Record<string, AgentStatus>;
  biasFlags: BiasFlag[];
}) {
  const totalFlags = biasFlags.length;

  return (
    <aside
      className="hidden w-[260px] shrink-0 border-r p-5 lg:flex lg:flex-col"
      style={{
        borderColor: "var(--border)",
        background: "color-mix(in oklab, var(--background) 92%, black)",
      }}
    >
      <div className="flex items-center gap-3">
        <img
          src="/logo.jpg"
          alt="FairLens Logo"
          className="h-10 w-10 rounded-full object-cover border"
          style={{ borderColor: "var(--border)" }}
        />
        <div>
          <div
            className="text-[16px] font-semibold tracking-tight leading-none"
            style={{ color: "var(--foreground)" }}
          >
            Fair<span style={{ color: "var(--brand-glow)" }}>Lens</span>
          </div>
          <div
            className="mt-1 text-[9px]"
            style={{ color: "var(--text-muted)", letterSpacing: "0.05em" }}
          >
            5 DAYS OF GEN AI · GOOGLE × KAGGLE
          </div>
        </div>
      </div>

      <div className="my-5 h-px" style={{ background: "var(--border)" }} />

      {provider && (
        <div className="mb-4">
          <div className="fl-label-sm mb-2">Provider</div>
          <Chip tone={provider === "gemini" ? "brand" : "medium"}>
            {provider === "gemini" ? "Gemini 2.5 Flash" : "Grok 2"}
          </Chip>
        </div>
      )}

      <div className="fl-label-sm mb-3">Pipeline</div>
      <div className="flex flex-col gap-2.5">
        {ALL_AGENTS.map((a) => (
          <PipelineRow
            key={a.key}
            label={a.label}
            tone={a.tone as "brand" | "auditor" | "synth"}
            status={agentStatuses[a.backendName] ?? "waiting"}
            flagCount={a.backendName === "BiasAuditor" ? totalFlags : 0}
          />
        ))}
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

function PipelineRow({
  label,
  status,
  tone = "brand",
  flagCount = 0,
}: {
  label: string;
  status: AgentStatus;
  tone?: "brand" | "auditor" | "synth";
  flagCount?: number;
}) {
  let dot: React.ReactNode;
  if (status === "running") {
    dot = (
      <span
        className="fl-dot-pulse h-2 w-2 rounded-full"
        style={{
          background:
            tone === "auditor"
              ? "var(--auditor)"
              : tone === "synth"
                ? "var(--synth)"
                : "var(--brand)",
        }}
      />
    );
  } else if (status === "done") {
    dot = <span className="h-2 w-2 rounded-full" style={{ background: "var(--verdict-hire)" }} />;
  } else if (status === "flagged") {
    dot = <span className="h-2 w-2 rounded-full" style={{ background: "var(--flag-high)" }} />;
  } else if (status === "error") {
    dot = <span className="h-2 w-2 rounded-full" style={{ background: "var(--flag-high)" }} />;
  } else {
    dot = <span className="h-2 w-2 rounded-full" style={{ background: "var(--text-muted)" }} />;
  }

  const chip =
    status === "running" ? (
      <Chip tone={tone}>RUNNING</Chip>
    ) : status === "done" ? (
      <Chip tone="success">DONE</Chip>
    ) : status === "flagged" ? (
      <Chip tone="high">{flagCount > 0 ? `${flagCount} FLAGS` : "FLAGGED"}</Chip>
    ) : status === "error" ? (
      <Chip tone="error">ERROR</Chip>
    ) : (
      <Chip tone="neutral">WAITING</Chip>
    );

  return (
    <div className="flex items-center justify-between gap-2">
      <div
        className="flex items-center gap-2.5 text-[12.5px]"
        style={{ color: "var(--foreground)" }}
      >
        {dot}
        <span className="truncate">{label}</span>
      </div>
      {chip}
    </div>
  );
}
