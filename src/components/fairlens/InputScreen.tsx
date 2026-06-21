import { useState } from "react";
import { SCENARIOS, getScenario, type Scenario } from "@/lib/fairlens-data";
import { Chip } from "./primitives";

export function InputScreen({
  onStart,
}: {
  onStart: (scenario: Scenario, level: string, mode: string) => void;
}) {
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id);
  const scenario = getScenario(scenarioId);
  const [profile, setProfile] = useState(scenario.profileJson);
  const [level, setLevel] = useState<string>(scenario.level);
  const [mode, setMode] = useState<string>(scenario.panelMode);

  const pickScenario = (id: string) => {
    const s = getScenario(id);
    setScenarioId(id);
    setProfile(s.profileJson);
    setLevel(s.level);
    setMode(s.panelMode);
  };

  return (
    <div className="mx-auto w-full max-w-[680px] px-6 py-12">
      <header className="text-center">
        <h1 className="text-[34px] font-medium leading-none tracking-tight" style={{ color: "var(--foreground)" }}>
          Fair<span style={{ color: "var(--brand-glow)" }}>Lens</span>
        </h1>
        <p className="mt-3 text-[12px] uppercase" style={{ color: "var(--text-muted)", letterSpacing: "0.14em" }}>
          AI that checks its own blind spots
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <Chip tone="neutral">gemini 2.5 flash</Chip>
          <Chip tone="neutral">google adk</Chip>
          <Chip tone="neutral">parallel agents</Chip>
        </div>
      </header>

      <div className="my-8 h-px" style={{ background: "var(--border)" }} />

      <div>
        <div className="fl-label-sm mb-3">Load a preset candidate</div>
        <div className="flex flex-wrap gap-2">
          {SCENARIOS.map((s) => {
            const active = s.id === scenarioId;
            return (
              <button
                key={s.id}
                onClick={() => pickScenario(s.id)}
                className="rounded-full px-4 py-2 text-[13px] font-medium transition-colors"
                style={{
                  background: active ? "var(--brand)" : "var(--surface)",
                  color: active ? "white" : "var(--text-secondary)",
                  border: `1px solid ${active ? "var(--brand)" : "var(--border)"}`,
                }}
              >
                {s.name}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-[12px] italic" style={{ color: "var(--text-muted)" }}>
          {scenario.blurb}
        </p>
      </div>

      <div className="mt-8">
        <label className="fl-label-sm mb-2 block">Candidate profile</label>
        <textarea
          value={profile}
          onChange={(e) => setProfile(e.target.value)}
          rows={12}
          spellCheck={false}
          className="fl-mono w-full resize-none rounded-lg p-4 text-[13px] leading-relaxed outline-none"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            color: "var(--foreground)",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "var(--brand)")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
        />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4">
        <div>
          <label className="fl-label-sm mb-2 block">Target level</label>
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="w-full rounded-lg px-3 py-2.5 text-[13px] outline-none"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }}
          >
            {["L3", "L4", "L5", "L6"].map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="fl-label-sm mb-2 block">Panel mode</label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            className="w-full rounded-lg px-3 py-2.5 text-[13px] outline-none"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }}
          >
            {["Balanced", "Technical-heavy", "Culture-heavy"].map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      </div>

      <button
        onClick={() => onStart(scenario, level, mode)}
        className="mt-8 w-full rounded-lg py-3.5 text-[14px] font-medium transition-all"
        style={{
          background: "var(--brand)",
          color: "white",
          boxShadow: "0 0 0 0 color-mix(in oklab, var(--brand) 50%, transparent)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--brand-glow)";
          e.currentTarget.style.boxShadow = "0 0 24px 2px color-mix(in oklab, var(--brand) 40%, transparent)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "var(--brand)";
          e.currentTarget.style.boxShadow = "0 0 0 0 color-mix(in oklab, var(--brand) 50%, transparent)";
        }}
      >
        Convene the Panel  →
      </button>

      <p className="mt-4 text-center text-[11px]" style={{ color: "var(--text-muted)" }}>
        FairLens surfaces potential bias patterns for reflection.
        Final hiring decisions remain with humans.
      </p>
    </div>
  );
}
