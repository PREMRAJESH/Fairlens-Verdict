import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FairLensSidebar } from "@/components/fairlens/Sidebar";
import { InputScreen } from "@/components/fairlens/InputScreen";
import { LivePanel } from "@/components/fairlens/LivePanel";
import { ReportScreen } from "@/components/fairlens/ReportScreen";
import { SCENARIOS, type Scenario } from "@/lib/fairlens-data";
import { useScenarioRuntime } from "@/lib/use-scenario-runtime";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FairLens — AI that checks its own blind spots" },
      { name: "description", content: "A multi-agent hiring panel that surfaces bias in real time. Powered by Gemini 2.5 Flash and Google ADK." },
      { property: "og:title", content: "FairLens" },
      { property: "og:description", content: "A multi-agent hiring panel that surfaces bias in real time." },
    ],
  }),
  component: Index,
});

type Stage = "input" | "panel" | "report";

function Index() {
  const [stage, setStage] = useState<Stage>("input");
  const [scenario, setScenario] = useState<Scenario>(SCENARIOS[0]);
  const [running, setRunning] = useState(false);

  const { runtime, allDone, elapsedMs } = useScenarioRuntime(scenario, running);

  const start = (s: Scenario) => {
    setScenario(s);
    setRunning(true);
    setStage("panel");
  };

  const reset = () => {
    setRunning(false);
    setStage("input");
  };

  return (
    <div className="flex min-h-screen w-full" style={{ background: "var(--background)" }}>
      <FairLensSidebar
        stage={stage}
        scenario={scenario}
        runtime={runtime}
        panelDone={allDone}
      />
      <main className="min-w-0 flex-1">
        {stage === "input" && <InputScreen onStart={start} />}
        {stage === "panel" && (
          <LivePanel
            scenario={scenario}
            runtime={runtime}
            elapsedMs={elapsedMs}
            allDone={allDone}
            onSeeReport={() => setStage("report")}
          />
        )}
        {stage === "report" && (
          <ReportScreen scenario={scenario} runtime={runtime} onReset={reset} />
        )}
      </main>
    </div>
  );
}
