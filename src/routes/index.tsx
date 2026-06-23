import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FairLensSidebar } from "@/components/fairlens/Sidebar";
import { InputScreen } from "@/components/fairlens/InputScreen";
import { LivePanel } from "@/components/fairlens/LivePanel";
import { ReportScreen } from "@/components/fairlens/ReportScreen";
import { useBackendRuntime } from "@/lib/use-backend-runtime";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FairLens — AI that checks its own blind spots" },
      {
        name: "description",
        content:
          "A multi-agent hiring panel that surfaces bias in real time. Powered by Gemini 2.5 Flash and Google ADK.",
      },
      { property: "og:title", content: "FairLens" },
      {
        property: "og:description",
        content: "A multi-agent hiring panel that surfaces bias in real time.",
      },
    ],
  }),
  component: Index,
});

type Tab = "input" | "panel" | "auditor" | "verdict";

const TABS: { key: Tab; label: string }[] = [
  { key: "input", label: "Input" },
  { key: "panel", label: "Live Panel" },
  { key: "auditor", label: "Auditor Report" },
  { key: "verdict", label: "Final Verdict" },
];

function Index() {
  const [tab, setTab] = useState<Tab>("input");

  const {
    runtime,
    biasFlags,
    auditorSummary,
    finalVerdict,
    elapsedMs,
    error,
    provider,
    agentStatuses,
    sessionId,
    start,
    reset,
  } = useBackendRuntime();

  const handleStart = async (profileJson: Record<string, unknown>, level: string, mode: string) => {
    setTab("panel");
    await start(profileJson, level, mode);
  };

  const handleReset = () => {
    reset();
    setTab("input");
  };

  const handleSeeReport = () => {
    setTab("auditor");
  };

  const canAccessAuditor = auditorSummary !== null || finalVerdict !== null;
  const canAccessVerdict = finalVerdict !== null;

  return (
    <div className="flex min-h-screen w-full" style={{ background: "var(--background)" }}>
      <FairLensSidebar provider={provider} agentStatuses={agentStatuses} biasFlags={biasFlags} />
      <main className="flex min-w-0 flex-1 flex-col">
        {/* Tab bar */}
        <div
          className="flex items-center border-b px-4"
          style={{
            borderColor: "var(--border)",
            background: "color-mix(in oklab, var(--background) 96%, black)",
          }}
        >
          {TABS.map((t) => {
            const disabled =
              (t.key === "auditor" && !canAccessAuditor) ||
              (t.key === "verdict" && !canAccessVerdict);
            return (
              <button
                key={t.key}
                onClick={() => {
                  if (!disabled) setTab(t.key);
                }}
                className="px-5 py-3 text-[13px] font-medium transition-colors"
                style={{
                  color: disabled
                    ? "var(--text-muted)"
                    : tab === t.key
                      ? "var(--brand-glow)"
                      : "var(--text-secondary)",
                  borderBottom: tab === t.key ? "2px solid var(--brand)" : "2px solid transparent",
                  cursor: disabled ? "not-allowed" : "pointer",
                  opacity: disabled ? 0.4 : 1,
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Content area */}
        <div className="flex-1">
          {tab === "input" && <InputScreen onStart={handleStart} />}
          {tab === "panel" && (
            <LivePanel
              runtime={runtime}
              elapsedMs={elapsedMs}
              error={error}
              provider={provider}
              agentStatuses={agentStatuses}
              finalVerdict={finalVerdict}
              onSeeReport={handleSeeReport}
              onBack={handleReset}
            />
          )}
          {(tab === "auditor" || tab === "verdict") && finalVerdict && (
            <ReportScreen
              biasFlags={biasFlags}
              finalVerdict={finalVerdict}
              auditorSummary={auditorSummary}
              sessionId={sessionId}
              onReset={handleReset}
            />
          )}
        </div>
      </main>
    </div>
  );
}
