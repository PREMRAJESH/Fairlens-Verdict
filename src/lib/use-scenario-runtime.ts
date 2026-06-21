import { useEffect, useRef, useState } from "react";
import type { AgentKey, Scenario, TranscriptChunk } from "@/lib/fairlens-data";

export type AgentRuntime = {
  // Rendered chunks. The last text chunk may be a partial slice of the source.
  rendered: TranscriptChunk[];
  done: boolean;
};

export type Runtime = Record<AgentKey, AgentRuntime>;

const emptyRuntime = (): Runtime => ({
  technical: { rendered: [], done: false },
  culture:   { rendered: [], done: false },
  seniority: { rendered: [], done: false },
});

const CHARS_PER_TICK = 14;
const TICK_MS = 22;
const PAUSE_BEFORE_FLAG_MS = 360;
const PAUSE_AFTER_FLAG_MS = 120;

export function useScenarioRuntime(scenario: Scenario, running: boolean) {
  const [runtime, setRuntime] = useState<Runtime>(emptyRuntime);
  const [allDone, setAllDone] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAt = useRef<number>(0);

  useEffect(() => {
    setRuntime(emptyRuntime());
    setAllDone(false);
    setElapsedMs(0);
  }, [scenario.id, running]);

  useEffect(() => {
    if (!running || allDone) return;
    startedAt.current = performance.now();
    const id = window.setInterval(() => {
      setElapsedMs(performance.now() - startedAt.current);
    }, 150);
    return () => window.clearInterval(id);
  }, [running, allDone, scenario.id]);

  useEffect(() => {
    if (!running) return;
    let cancelled = false;
    const timers: number[] = [];
    const sched = (fn: () => void, ms: number) => {
      const id = window.setTimeout(fn, ms);
      timers.push(id);
    };

    let finishedAgents = 0;
    const agentFinished = (agent: AgentKey) => {
      setRuntime((r) => ({ ...r, [agent]: { ...r[agent], done: true } }));
      finishedAgents++;
      if (finishedAgents === scenario.scripts.length) setAllDone(true);
    };

    scenario.scripts.forEach((script, agentIdx) => {
      const startDelay = agentIdx * 220;

      const advance = (chunkIdx: number, offset: number) => {
        if (cancelled) return;
        const chunk = script.chunks[chunkIdx];
        if (!chunk) {
          agentFinished(script.agent);
          return;
        }

        if (chunk.kind === "flag") {
          sched(() => {
            if (cancelled) return;
            setRuntime((r) => ({
              ...r,
              [script.agent]: {
                ...r[script.agent],
                rendered: [...r[script.agent].rendered, chunk],
              },
            }));
            sched(() => advance(chunkIdx + 1, 0), PAUSE_AFTER_FLAG_MS);
          }, PAUSE_BEFORE_FLAG_MS);
          return;
        }

        // text chunk — stream char-by-char by replacing or appending the partial.
        const nextOffset = Math.min(chunk.text.length, offset + CHARS_PER_TICK);
        const partial = chunk.text.slice(0, nextOffset);

        setRuntime((r) => {
          const cur = r[script.agent];
          const rendered = [...cur.rendered];
          if (offset === 0) {
            rendered.push({ kind: "text", text: partial });
          } else {
            rendered[rendered.length - 1] = { kind: "text", text: partial };
          }
          return { ...r, [script.agent]: { ...cur, rendered } };
        });

        if (nextOffset >= chunk.text.length) {
          sched(() => advance(chunkIdx + 1, 0), 60);
        } else {
          sched(() => advance(chunkIdx, nextOffset), TICK_MS);
        }
      };

      sched(() => advance(0, 0), startDelay);
    });

    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [running, scenario.id]);

  return { runtime, allDone, elapsedMs };
}

export function formatElapsed(ms: number) {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
