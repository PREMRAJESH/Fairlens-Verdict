import { useEffect, useState } from "react";
import type { AgentKey, Scenario, TranscriptChunk } from "@/lib/fairlens-data";
import { AGENTS } from "@/lib/fairlens-data";

type AgentRuntime = {
  rendered: TranscriptChunk[];
  done: boolean;
};

type Runtime = Record<AgentKey, AgentRuntime>;

const emptyRuntime = (): Runtime => ({
  technical: { rendered: [], done: false },
  culture:   { rendered: [], done: false },
  seniority: { rendered: [], done: false },
});

// Characters per "token" tick. Lower = slower.
const CHARS_PER_TICK = 14;
const TICK_MS = 24;
const PAUSE_BEFORE_FLAG_MS = 320;
const PAUSE_BEFORE_NEXT_CHUNK_MS = 90;

export function useScenarioRuntime(scenario: Scenario, running: boolean) {
  const [runtime, setRuntime] = useState<Runtime>(emptyRuntime);
  const [allDone, setAllDone] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);

  // reset on scenario change
  useEffect(() => {
    setRuntime(emptyRuntime());
    setAllDone(false);
    setElapsedMs(0);
  }, [scenario.id, running]);

  // elapsed timer
  useEffect(() => {
    if (!running || allDone) return;
    const start = performance.now();
    const id = window.setInterval(() => setElapsedMs(performance.now() - start), 200);
    return () => window.clearInterval(id);
  }, [running, allDone, scenario.id]);

  // streaming engine — one parallel runner per agent
  useEffect(() => {
    if (!running) return;
    let cancelled = false;
    const timeouts: number[] = [];
    const schedule = (fn: () => void, ms: number) => {
      const id = window.setTimeout(fn, ms);
      timeouts.push(id);
    };

    let finished = 0;
    const onAgentFinished = () => {
      finished++;
      if (finished === scenario.scripts.length) setAllDone(true);
    };

    scenario.scripts.forEach((script, agentIndex) => {
      // Stagger the agents a touch so the columns don't feel mechanical.
      const startDelay = agentIndex * 220;

      const runChunk = (chunkIndex: number, charOffset: number) => {
        if (cancelled) return;
        const chunk = script.chunks[chunkIndex];

        if (!chunk) {
          setRuntime((r) => ({ ...r, [script.agent]: { ...r[script.agent], done: true } }));
          onAgentFinished();
          return;
        }

        if (chunk.kind === "flag") {
          schedule(() => {
            if (cancelled) return;
            setRuntime((r) => ({
              ...r,
              [script.agent]: {
                ...r[script.agent],
                rendered: [...r[script.agent].rendered, chunk],
              },
            }));
            schedule(() => runChunk(chunkIndex + 1, 0), PAUSE_BEFORE_NEXT_CHUNK_MS);
          }, PAUSE_BEFORE_FLAG_MS);
          return;
        }

        // text chunk — stream characters
        const nextOffset = Math.min(chunk.text.length, charOffset + CHARS_PER_TICK);
        const partial = chunk.text.slice(0, nextOffset);

        setRuntime((r) => {
          const cur = r[script.agent];
          const rendered = [...cur.rendered];
          // replace or append the partial text chunk
          const last = rendered[rendered.length - 1];
          if (last && last.kind === "text" && rendered.length - 1 === chunkIndex - chunkCountUpTo(script.chunks, chunkIndex)) {
            // fallthrough — we'll use a simpler model below
          }
          // simpler: maintain a "current text chunk index" via comparing length
          const finalizedCount = countFinalized(cur.rendered, script.chunks);
          if (finalizedCount === chunkIndex) {
            // we're streaming this chunk — replace trailing partial
            if (last && last.kind === "text" && !isFinalizedText(last, script.chunks, chunkIndex)) {
              rendered[rendered.length - 1] = { kind: "text", text: partial };
            } else {
              rendered.push({ kind: "text", text: partial });
            }
          }
          return { ...r, [script.agent]: { ...cur, rendered } };
        });

        if (nextOffset >= chunk.text.length) {
          // mark this text chunk as finalized by appending nothing extra; advance
          schedule(() => runChunk(chunkIndex + 1, 0), PAUSE_BEFORE_NEXT_CHUNK_MS);
        } else {
          schedule(() => runChunk(chunkIndex, nextOffset), TICK_MS);
        }
      };

      schedule(() => runChunk(0, 0), startDelay);
    });

    return () => {
      cancelled = true;
      timeouts.forEach((id) => window.clearTimeout(id));
    };
  }, [running, scenario.id]);

  return { runtime, allDone, elapsedMs };
}

// --- tiny helpers for the streaming reducer ---
function chunkCountUpTo(_chunks: TranscriptChunk[], i: number) { return i; }
function countFinalized(rendered: TranscriptChunk[], _all: TranscriptChunk[]) {
  // Count all chunks except the last text chunk if it's still being streamed.
  // We treat the last one as "in flight" only when it's the most recent push.
  return Math.max(0, rendered.length - 1);
}
function isFinalizedText(_last: TranscriptChunk, _all: TranscriptChunk[], _i: number) {
  return false;
}

export function agentChip(agent: AgentKey) {
  return AGENTS[agent].short;
}
