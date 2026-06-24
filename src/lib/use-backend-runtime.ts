import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AgentKey,
  AgentStatus,
  BiasFlag,
  TranscriptChunk,
  AuditorSummaryData,
  FinalVerdictData,
  BackendAgentName,
} from "@/lib/fairlens-data";
import { AGENT_BACKEND_TO_FRONTEND } from "@/lib/fairlens-data";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

export type AgentRuntime = {
  rendered: TranscriptChunk[];
  done: boolean;
  verdict?: { position: string; justification: string };
};

const emptyRuntime: Record<AgentKey, AgentRuntime> = {
  technical: { rendered: [], done: false },
  culture: { rendered: [], done: false },
  seniority: { rendered: [], done: false },
};

const initialAgentStatuses: Record<string, AgentStatus> = {
  TechnicalInterviewer: "waiting",
  CultureFitAssessor: "waiting",
  SeniorityAssessor: "waiting",
  BiasAuditor: "waiting",
  VerdictSynthesizer: "waiting",
};

export function useBackendRuntime() {
  const [runtime, setRuntime] = useState<Record<AgentKey, AgentRuntime>>(emptyRuntime);
  const [biasFlags, setBiasFlags] = useState<BiasFlag[]>([]);
  const [auditorSummary, setAuditorSummary] = useState<AuditorSummaryData | null>(null);
  const [finalVerdict, setFinalVerdict] = useState<FinalVerdictData | null>(null);
  const [allDone, setAllDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [running, setRunning] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [provider, setProvider] = useState<"gemini" | "grok" | "groq" | null>(null);
  const [agentStatuses, setAgentStatuses] =
    useState<Record<string, AgentStatus>>(initialAgentStatuses);
  const [agentsWithHighFlags, setAgentsWithHighFlags] = useState<Set<string>>(new Set());

  const abortRef = useRef<AbortController | null>(null);
  const startedAtRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const runningRef = useRef(false);

  useEffect(() => {
    runningRef.current = running;
    if (!running) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    startedAtRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startedAtRef.current);
    }, 150);
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [running]);

  const handleEvent = useCallback((eventType: string, data: Record<string, unknown>) => {
    switch (eventType) {
      case "pipeline_start": {
        const p = data.provider as string;
        if (p === "gemini" || p === "grok" || p === "groq") {
          setProvider(p);
        }
        break;
      }
      case "agent_start": {
        const agentName = data.agent as string;
        if (agentName) {
          setAgentStatuses((prev) => ({ ...prev, [agentName]: "running" }));
        }
        break;
      }
      case "transcript_chunk": {
        const panelAgents = [
          "TechnicalInterviewer",
          "CultureFitAssessor",
          "SeniorityAssessor",
        ];
        if (!panelAgents.includes(data.agent as string)) {
          break;
        }
        const agent = AGENT_BACKEND_TO_FRONTEND[data.agent as BackendAgentName];
        if (!agent) break;
        setRuntime((prev) => {
          const cur = prev[agent];
          const chunks = [...cur.rendered];
          const last = chunks[chunks.length - 1];
          if (last?.kind === "text") {
            chunks[chunks.length - 1] = { kind: "text", text: last.text + (data.text as string) };
          } else {
            chunks.push({ kind: "text", text: data.text as string });
          }
          return { ...prev, [agent]: { ...cur, rendered: chunks } };
        });
        break;
      }
      case "agent_verdict": {
        const agent = AGENT_BACKEND_TO_FRONTEND[data.agent as BackendAgentName];
        if (!agent) break;
        setRuntime((prev) => ({
          ...prev,
          [agent]: {
            ...prev[agent],
            verdict: {
              position: data.position as string,
              justification: (data.justification as string) ?? "",
            },
          },
        }));
        break;
      }
      case "agent_done": {
        const agentName = data.agent as string;
        if (agentName) {
          setAgentStatuses((prev) => ({ ...prev, [agentName]: "done" }));
        }
        const agent = AGENT_BACKEND_TO_FRONTEND[agentName as BackendAgentName];
        if (agent) {
          setRuntime((prev) => ({
            ...prev,
            [agent]: { ...prev[agent], done: true },
          }));
        }
        break;
      }
      case "bias_flag": {
        const flag: BiasFlag = {
          agent_name: (data.agent_name as string) ?? "",
          bias_type: (data.bias_type as string) ?? "",
          quote: (data.quote as string) ?? "",
          severity: (data.severity as "HIGH" | "MEDIUM" | "LOW") ?? "LOW",
          explanation: (data.explanation as string) ?? "",
          corrective_reframe: (data.corrective_reframe as string) ?? "",
        };
        setBiasFlags((prev) => [...prev, flag]);

        if (flag.severity === "HIGH" && flag.agent_name) {
          setAgentsWithHighFlags((prev) => {
            const next = new Set(prev);
            next.add(flag.agent_name);
            return next;
          });
          setAgentStatuses((prev) => {
            if (prev[flag.agent_name] === "running" || prev[flag.agent_name] === "done") {
              return { ...prev, [flag.agent_name]: "flagged" };
            }
            return prev;
          });
        }

        const agent = AGENT_BACKEND_TO_FRONTEND[data.agent_name as BackendAgentName];
        if (agent) {
          const chunk: TranscriptChunk = {
            kind: "flag",
            severity: flag.severity,
            biasType: flag.bias_type,
            quote: flag.quote,
            explain: flag.explanation,
            correctiveReframe: flag.corrective_reframe,
          };
          setRuntime((prev) => {
            const cur = prev[agent];
            const idx = findInsertIndex(cur.rendered, flag.quote);
            const chunks = [...cur.rendered];
            chunks.splice(idx, 0, chunk);
            return { ...prev, [agent]: { ...cur, rendered: chunks } };
          });
        }
        break;
      }
      case "auditor_summary": {
        setAuditorSummary(data as unknown as AuditorSummaryData);
        setAgentStatuses((prev) => ({ ...prev, BiasAuditor: "done" }));
        break;
      }
      case "final_verdict": {
        setFinalVerdict(data as unknown as FinalVerdictData);
        setAgentStatuses((prev) => ({ ...prev, VerdictSynthesizer: "done" }));
        break;
      }
      case "error": {
        const msg = (data.message as string) ?? "Unknown pipeline error";
        const agent = data.agent as string | undefined;
        setError(msg);
        if (agent) {
          setAgentStatuses((prev) => ({ ...prev, [agent]: "error" }));
        }
        break;
      }
      case "done":
        setAllDone(true);
        break;
    }
  }, []);

  const start = useCallback(
    async (candidateJson: Record<string, unknown>, level: string, mode: string) => {
      if (runningRef.current) return;

      setRuntime(emptyRuntime);
      setBiasFlags([]);
      setAuditorSummary(null);
      setFinalVerdict(null);
      setAllDone(false);
      setError(null);
      setElapsedMs(0);
      setProvider(null);
      setAgentStatuses(initialAgentStatuses);
      setAgentsWithHighFlags(new Set());

      const sid = crypto.randomUUID();
      setSessionId(sid);
      setRunning(true);

      const body = {
        session_id: sid,
        candidate: candidateJson,
        target_level: level,
        panel_mode: mode,
      };

      const abort = new AbortController();
      abortRef.current = abort;

      try {
        const response = await fetch(`${BACKEND_URL}/run`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: abort.signal,
        });

        if (!response.ok) {
          if (response.status === 409) {
            setError("A session is already running. Please wait for it to complete.");
          } else {
            const text = await response.text().catch(() => "");
            setError(`Backend error (${response.status}): ${text || response.statusText}`);
          }
          setRunning(false);
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) {
          setError("No response body from backend");
          setRunning(false);
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          let currentEvent = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              currentEvent = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              const dataStr = line.slice(6);
              try {
                const data = JSON.parse(dataStr);
                handleEvent(currentEvent || data.type, data);
              } catch {
                // skip unparseable lines
              }
            } else if (line.trim() === "") {
              // empty line — reset after dispatch
              currentEvent = "";
            }
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error) {
          if (err.name === "AbortError") {
            // intentional abort
          } else if (
            err.message.toLowerCase().includes("failed to fetch") ||
            err.message.toLowerCase().includes("networkerror") ||
            err.message.toLowerCase().includes("network error") ||
            err.message.toLowerCase().includes("err_connection")
          ) {
            setError(
              "Cannot connect to FairLens backend at localhost:8000. Make sure the Python server is running: cd fairlens_backend && uvicorn main:app --reload",
            );
          } else {
            setError(err.message);
          }
        }
      } finally {
        setRunning(false);
        abortRef.current = null;
      }
    },
    [handleEvent],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setRunning(false);
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setRunning(false);
    setRuntime(emptyRuntime);
    setBiasFlags([]);
    setAuditorSummary(null);
    setFinalVerdict(null);
    setAllDone(false);
    setError(null);
    setElapsedMs(0);
    setSessionId(null);
    setProvider(null);
    setAgentStatuses(initialAgentStatuses);
    setAgentsWithHighFlags(new Set());
  }, []);

  return {
    runtime,
    biasFlags,
    auditorSummary,
    finalVerdict,
    allDone,
    elapsedMs,
    error,
    running,
    sessionId,
    provider,
    agentStatuses,
    agentsWithHighFlags,
    start,
    stop,
    reset,
  };
}

function findInsertIndex(chunks: TranscriptChunk[], quote: string): number {
  let charCount = 0;
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    if (c.kind === "text") {
      const idx = c.text.indexOf(quote);
      if (idx !== -1) {
        return i + 1;
      }
      charCount += c.text.length;
    } else {
      charCount += 50;
    }
  }
  return chunks.length;
}
