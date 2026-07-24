export interface AgentTraceStep {
  step: number;
  action: string;
  args: Record<string, unknown>;
  observation: string;
}

export interface AgentResearchResponse {
  answer: string;
  steps: number;
  trace: AgentTraceStep[];
  elapsed_s: number;
  note?: string;
  error?: string;
}

const AGENT_BASE = "http://localhost:18000";

export async function runAgentResearch(
  question: string,
  maxSteps = 5,
): Promise<AgentResearchResponse> {
  const resp = await fetch(`${AGENT_BASE}/api/agent/research`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, max_steps: maxSteps }),
  });
  if (!resp.ok) {
    throw new Error(`${resp.status} ${await resp.text()}`);
  }
  return (await resp.json()) as AgentResearchResponse;
}

export type AgentStreamEvent =
  | ({ type: "tool_call" } & AgentTraceStep)
  | { type: "final"; answer: string; steps: number; elapsed_s: number; note?: string }
  | { type: "error"; error: string };

/** Stream the agent run via SSE; invokes onEvent per tool call and final answer. */
export async function streamAgentResearch(
  question: string,
  onEvent: (ev: AgentStreamEvent) => void,
  maxSteps = 5,
): Promise<void> {
  const resp = await fetch(`${AGENT_BASE}/api/agent/research/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, max_steps: maxSteps }),
  });
  if (!resp.ok || !resp.body) {
    throw new Error(`${resp.status} ${await resp.text()}`);
  }
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 2);
      if (chunk.startsWith("data: ")) {
        onEvent(JSON.parse(chunk.slice(6)) as AgentStreamEvent);
      }
    }
  }
}
