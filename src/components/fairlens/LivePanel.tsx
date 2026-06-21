import { AGENTS, type AgentKey, type Scenario, type TranscriptChunk } from "@/lib/fairlens-data";
import { Chip, InlineFlag, VerdictBadge } from "./primitives";
import { formatElapsed, type Runtime } from "@/lib/use-scenario-runtime";

export function LivePanel({
  scenario,
  runtime,
  elapsedMs,
  allDone,
  onSeeReport,
}: {
  scenario: Scenario;
  runtime: Runtime;
  elapsedMs: number;
  allDone: boolean;
  onSeeReport: () => void;
}) {
  return (
    <div className="flex h-full w-full flex-col">
      {/* status bar */}
      <div
        className="flex items-center justify-between border-b px-6 py-3"
        style={{ borderColor: "var(--border)", background: "color-mix(in oklab, var(--background) 96%, black)" }}
      >
        <div className="flex items-center gap-3 text-[12.5px]" style={{ color: "var(--text-secondary)" }}>
          {!allDone && <span className="fl-dot-pulse h-2 w-2 rounded-full" style={{ background: "var(--brand)" }} />}
          {allDone ? (
            <>
              <span style={{ color: "var(--verdict-hire)" }}>● </span>
              Panel deliberation complete — synthesizer ready
            </>
          ) : (
            <>Panel convened — three agents reasoning in parallel…</>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="fl-mono text-[12.5px]" style={{ color: "var(--text-muted)" }}>{formatElapsed(elapsedMs)}</span>
          {allDone && (
            <button
              onClick={onSeeReport}
              className="rounded-lg px-4 py-2 text-[12.5px] font-medium transition-colors"
              style={{ background: "var(--brand)", color: "white" }}
            >
              See the auditor's report  →
            </button>
          )}
        </div>
      </div>

      {/* three columns */}
      <div className="grid flex-1 grid-cols-1 divide-y md:grid-cols-3 md:divide-x md:divide-y-0" style={{ borderColor: "var(--border)" }}>
        {scenario.scripts.map((s) => (
          <AgentColumn key={s.agent} agent={s.agent} runtime={runtime} rawVerdictWhenDone={s.rawVerdict} />
        ))}
      </div>
    </div>
  );
}

function AgentColumn({
  agent,
  runtime,
  rawVerdictWhenDone,
}: {
  agent: AgentKey;
  runtime: Runtime;
  rawVerdictWhenDone: Scenario["scripts"][number]["rawVerdict"];
}) {
  const meta = AGENTS[agent];
  const r = runtime[agent];
  const rendered = r.rendered;
  const lastIsText = rendered.length > 0 && rendered[rendered.length - 1].kind === "text";

  return (
    <div className="flex h-full min-h-[560px] flex-col">
      {/* sticky header */}
      <div className="sticky top-0 z-10 border-b px-5 py-4" style={{ borderColor: "var(--border)", background: "var(--background)" }}>
        <div className="flex items-center gap-2">
          <Chip tone="brand">{meta.short}</Chip>
          <span className="text-[13px] font-medium" style={{ color: "var(--foreground)" }}>{meta.name}</span>
        </div>
        <div className="mt-1.5 flex items-center gap-2 text-[11.5px]" style={{ color: "var(--text-muted)" }}>
          <span>Gemini 2.5 Flash</span>
          {agent === "technical" && (
            <>
              <span>·</span>
              <span style={{ color: "var(--google)" }}>Google Search active</span>
            </>
          )}
        </div>
      </div>

      {/* transcript */}
      <div className="flex-1 px-5 py-5">
        {rendered.length === 0 ? (
          <div className="flex items-center gap-2 text-[12.5px]" style={{ color: "var(--text-muted)" }}>
            <span className="fl-dot-pulse h-1.5 w-1.5 rounded-full" style={{ background: "var(--brand)" }} />
            queued…
          </div>
        ) : (
          <div className="fl-transcript">
            {rendered.map((c, i) => renderChunk(c, i))}
            {!r.done && lastIsText && <span className="fl-cursor" />}
          </div>
        )}
      </div>

      {/* verdict footer */}
      {r.done && (
        <div className="fl-fade-up border-t px-5 py-4" style={{ borderColor: "var(--border)" }}>
          <div className="fl-label-sm mb-2">Raw verdict</div>
          <VerdictBadge verdict={rawVerdictWhenDone} />
        </div>
      )}
    </div>
  );
}

function renderChunk(chunk: TranscriptChunk, key: number) {
  if (chunk.kind === "text") return <span key={key}>{chunk.text}</span>;
  return (
    <InlineFlag
      key={key}
      severity={chunk.severity}
      biasType={chunk.biasType}
      quote={chunk.quote}
      explain={chunk.explain}
    />
  );
}
