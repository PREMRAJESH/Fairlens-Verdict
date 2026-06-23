import { useRef, useEffect } from "react";
import { AGENTS, type AgentKey, type TranscriptChunk, type AgentStatus } from "@/lib/fairlens-data";
import type { AgentRuntime } from "@/lib/use-backend-runtime";
import { Chip, InlineFlag, VerdictBadge } from "./primitives";
import { formatElapsed } from "@/lib/use-scenario-runtime";

export function LivePanel({
  runtime,
  elapsedMs,
  error,
  provider,
  agentStatuses,
  finalVerdict,
  onSeeReport,
  onBack,
}: {
  runtime: Record<AgentKey, AgentRuntime>;
  elapsedMs: number;
  error: string | null;
  provider: "gemini" | "grok" | null;
  agentStatuses: Record<string, AgentStatus>;
  finalVerdict: unknown;
  onSeeReport: () => void;
  onBack: () => void;
}) {
  return (
    <div className="flex h-full w-full flex-col">
      {/* status bar */}
      <div
        className="flex items-center justify-between border-b px-6 py-3"
        style={{
          borderColor: "var(--border)",
          background: "color-mix(in oklab, var(--background) 96%, black)",
        }}
      >
        <div
          className="flex items-center gap-3 text-[12.5px]"
          style={{ color: "var(--text-secondary)" }}
        >
          {provider && (
            <Chip tone={provider === "gemini" ? "brand" : "medium"}>
              {provider === "gemini" ? "Gemini 2.5 Flash" : "Grok 2"}
            </Chip>
          )}
          {error ? (
            <span style={{ color: "var(--flag-high)" }}>● Pipeline error</span>
          ) : finalVerdict ? (
            <span style={{ color: "var(--verdict-hire)" }}>
              ● Deliberation complete — verdict ready
            </span>
          ) : (
            <>
              <span
                className="fl-dot-pulse h-2 w-2 rounded-full"
                style={{ background: "var(--brand)" }}
              />
              Panel convened — agents deliberating…
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="fl-mono text-[12.5px]" style={{ color: "var(--text-muted)" }}>
            {formatElapsed(elapsedMs)}
          </span>
          {finalVerdict && !error && (
            <button
              onClick={onSeeReport}
              className="fl-pulse-border-anim rounded-lg px-5 py-2.5 text-[13px] font-medium transition-all"
              style={{
                background: "var(--brand)",
                color: "white",
                border: "none",
              }}
            >
              View Final Verdict →
            </button>
          )}
          {error && (
            <button
              onClick={onBack}
              className="rounded-lg px-4 py-2 text-[12.5px] font-medium transition-colors"
              style={{
                background: "var(--surface)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border)",
              }}
            >
              ← Back
            </button>
          )}
        </div>
      </div>

      {error && (
        <div
          className="mx-6 mt-6 rounded-lg border p-4 text-[13px]"
          style={{
            background: "color-mix(in oklab, var(--flag-high) 12%, var(--surface))",
            borderColor: "color-mix(in oklab, var(--flag-high) 35%, transparent)",
            color: "var(--flag-high)",
          }}
        >
          {error}
        </div>
      )}

      {/* three columns */}
      <div
        className="grid flex-1 grid-cols-1 divide-y md:grid-cols-3 md:divide-x md:divide-y-0"
        style={{ borderColor: "var(--border)" }}
      >
        {(Object.keys(AGENTS) as AgentKey[]).map((agent) => (
          <AgentColumn
            key={agent}
            agent={agent}
            runtime={runtime[agent]}
            agentStatus={agentStatuses[AGENTS[agent].backendName]}
          />
        ))}
      </div>
    </div>
  );
}

function AgentColumn({
  agent,
  runtime,
  agentStatus,
}: {
  agent: AgentKey;
  runtime: AgentRuntime;
  agentStatus?: AgentStatus;
}) {
  const meta = AGENTS[agent];
  const rendered = runtime.rendered;
  const lastIsText = rendered.length > 0 && rendered[rendered.length - 1].kind === "text";
  const isRunning = agentStatus === "running";
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [rendered]);

  return (
    <div className="flex h-full min-h-[560px] flex-col">
      {/* sticky header */}
      <div
        className="sticky top-0 z-10 border-b px-5 py-4"
        style={{ borderColor: "var(--border)", background: "var(--background)" }}
      >
        <div className="flex items-center gap-2">
          <Chip tone="brand">{meta.short}</Chip>
          <span className="text-[13px] font-medium" style={{ color: "var(--foreground)" }}>
            {meta.name}
          </span>
        </div>
        <div
          className="mt-1.5 flex items-center gap-2 text-[11.5px]"
          style={{ color: "var(--text-muted)" }}
        >
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
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5">
        {rendered.length === 0 && !runtime.done ? (
          <div
            className="flex items-center gap-2 text-[12.5px]"
            style={{ color: "var(--text-muted)" }}
          >
            <span
              className="fl-dot-pulse h-1.5 w-1.5 rounded-full"
              style={{ background: "var(--brand)" }}
            />
            queued…
          </div>
        ) : (
          <div className="fl-transcript">
            {rendered.map((c, i) => renderChunk(c, i))}
            {isRunning && lastIsText && <span className="fl-cursor" />}
          </div>
        )}
        {rendered.length === 0 && runtime.done && (
          <div className="text-[12.5px]" style={{ color: "var(--text-muted)" }}>
            No transcript
          </div>
        )}
      </div>

      {/* verdict footer */}
      {runtime.done && runtime.verdict && (
        <div className="fl-fade-up border-t px-5 py-4" style={{ borderColor: "var(--border)" }}>
          <div className="fl-label-sm mb-2">Raw verdict</div>
          <VerdictBadge
            verdict={runtime.verdict.position as import("@/lib/fairlens-data").Verdict}
          />
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
      correctiveReframe={chunk.correctiveReframe}
    />
  );
}
