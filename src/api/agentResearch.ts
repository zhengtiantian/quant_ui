import { hostUrl } from "../auth";

export const AI_HOST_BASE = hostUrl(18000);

export interface ResearchRequest {
  question?: string;
  max_steps?: number;
  symbol?: string | null;
  lang?: "zh" | "en";
  scope?: "auto" | "stock" | "portfolio" | "all";
  save_history?: boolean;
}

export interface ResearchSecurityInfo {
  flagged_tools?: string[];
  answer_problems?: string[];
}

export interface ResearchTraceItem {
  step: number;
  action: string;
  args: Record<string, unknown>;
  observation: string;
  duration_ms?: number;
  ok?: boolean;
  truncated?: boolean;
  injection_flags?: string[];
}

export type ResearchEvent =
  | {
      type: "run_start";
      symbol?: string | null;
      scope: string;
      tools_available: string[];
      max_steps: number;
      model?: string;
    }
  | {
      type: "step_start";
      step: number;
      max_steps: number;
    }
  | {
      type: "tool_start";
      step: number;
      action: string;
      args: Record<string, unknown>;
    }
  | ({
      type: "tool_call";
    } & ResearchTraceItem)
  | {
      type: "final";
      run_id?: string;
      symbol?: string | null;
      scope?: string;
      answer: string;
      stance?: "bullish" | "bearish" | "neutral" | "unknown";
      confidence?: "high" | "medium" | "low" | "unknown";
      steps: number;
      elapsed_s: number;
      tools_used?: string[];
      security?: ResearchSecurityInfo;
      note?: string;
    }
  | {
      type: "error";
      error: string;
    };

export interface ResearchRunSummary {
  run_id: string;
  symbol?: string | null;
  scope?: string;
  question: string;
  stance?: "bullish" | "bearish" | "neutral" | "unknown";
  confidence?: "high" | "medium" | "low" | "unknown";
  steps: number;
  elapsed_s: number;
  tools_used?: string[];
  created_at: string;
  answer_preview?: string;
  note?: string | null;
}

export interface ResearchRunDetail extends ResearchRunSummary {
  answer: string;
  trace?: ResearchTraceItem[];
  security?: ResearchSecurityInfo;
  lang?: string;
}

export async function streamResearch(
  req: ResearchRequest,
  onEvent: (ev: ResearchEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${AI_HOST_BASE}/api/agent/research/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}${txt ? `: ${txt.slice(0, 160)}` : ""}`);
  }
  if (!res.body) {
    throw new Error("Streaming response body unavailable");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  const emitChunk = (rawLine: string) => {
    const line = rawLine.trim();
    if (!line.startsWith("data:")) return;
    const jsonPart = line.slice(5).trim();
    if (!jsonPart) return;
    try {
      const ev = JSON.parse(jsonPart) as ResearchEvent;
      onEvent(ev);
    } catch {
      // Ignore partial or malformed keep-alive chunk
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      for (const line of frame.split(/\r?\n/)) {
        emitChunk(line);
      }
    }
  }
  const tail = buffer + decoder.decode();
  if (tail.trim()) {
    for (const line of tail.split(/\r?\n/)) {
      emitChunk(line);
    }
  }
}

export async function fetchResearchHistory(
  symbol?: string | null,
  limit = 15,
): Promise<ResearchRunSummary[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (symbol && symbol.trim()) {
    params.set("symbol", symbol.trim().toUpperCase());
  }
  const res = await fetch(`${AI_HOST_BASE}/api/agent/research/history?${params.toString()}`);
  if (!res.ok) return [];
  const data = (await res.json()) as { items?: ResearchRunSummary[] };
  return data.items ?? [];
}

export async function fetchResearchRun(runId: string): Promise<ResearchRunDetail | null> {
  const res = await fetch(`${AI_HOST_BASE}/api/agent/research/history/${encodeURIComponent(runId)}`);
  if (!res.ok) return null;
  return (await res.json()) as ResearchRunDetail;
}
