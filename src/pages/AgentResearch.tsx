import React from "react";
import {
  streamAgentResearch,
  AgentResearchResponse,
  AgentTraceStep,
} from "../api/agent";

/**
 * ReAct research agent console.
 * Shows the agent's autonomous tool-calling trace (Thought -> Action ->
 * Observation) alongside the final grounded research note.
 */
const AgentResearch: React.FC = () => {
  const [question, setQuestion] = React.useState(
    "Analyze AAPL from news sentiment: bullish or bearish, and how confident?",
  );
  const [loading, setLoading] = React.useState(false);
  const [liveTrace, setLiveTrace] = React.useState<AgentTraceStep[]>([]);
  const [result, setResult] = React.useState<AgentResearchResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async () => {
    if (!question.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setLiveTrace([]);
    const trace: AgentTraceStep[] = [];
    try {
      await streamAgentResearch(question.trim(), (ev) => {
        if (ev.type === "tool_call") {
          trace.push(ev);
          setLiveTrace([...trace]);
        } else if (ev.type === "final") {
          setResult({ ...ev, trace: [...trace] });
        } else {
          setError(ev.error);
        }
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 16 }}>
      <h2 style={{ marginBottom: 4 }}>Research Agent</h2>
      <p style={{ color: "#888", marginTop: 0, fontSize: 14 }}>
        A ReAct tool-calling agent: the LLM autonomously queries platform data
        (news sentiment from 840K+ labeled articles, engineered features), then
        writes a grounded research note. Read-only — it never trades.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          style={{ flex: 1, padding: "10px 12px", fontSize: 14 }}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Ask about a symbol, e.g. 'Compare NVDA and AMD news sentiment'"
          disabled={loading}
        />
        <button onClick={submit} disabled={loading || !question.trim()}>
          {loading ? "Agent working…" : "Run Agent"}
        </button>
      </div>

      {loading && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: "#888", fontSize: 14, marginBottom: 8 }}>
            The agent is deciding which tools to call — typically 20–60s on a
            local model…
          </div>
          {liveTrace.map((t, i) => (
            <div
              key={i}
              style={{
                border: "1px solid #ddd",
                borderRadius: 8,
                padding: "8px 12px",
                marginBottom: 8,
                fontSize: 13,
                fontFamily: "monospace",
              }}
            >
              <strong>
                step {t.step}: {t.action}
              </strong>
              ({JSON.stringify(t.args)}) ✓
            </div>
          ))}
        </div>
      )}

      {error && (
        <div style={{ color: "#c0392b", whiteSpace: "pre-wrap", fontSize: 14 }}>
          {error}
        </div>
      )}

      {result && (
        <>
          <div style={{ fontSize: 13, color: "#888", marginBottom: 12 }}>
            {result.steps} step{result.steps > 1 ? "s" : ""} ·{" "}
            {result.trace.length} tool call
            {result.trace.length === 1 ? "" : "s"} · {result.elapsed_s}s
            {result.note ? ` · ${result.note}` : ""}
          </div>

          {result.trace.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, marginBottom: 8 }}>
                Agent trace (autonomous tool calls)
              </h3>
              {result.trace.map((t, i) => (
                <div
                  key={i}
                  style={{
                    border: "1px solid #ddd",
                    borderRadius: 8,
                    padding: "8px 12px",
                    marginBottom: 8,
                    fontSize: 13,
                    fontFamily: "monospace",
                  }}
                >
                  <div>
                    <strong>
                      step {t.step}: {t.action}
                    </strong>
                    ({JSON.stringify(t.args)})
                  </div>
                  <div style={{ color: "#666", whiteSpace: "pre-wrap" }}>
                    → {t.observation}
                  </div>
                </div>
              ))}
            </div>
          )}

          <h3 style={{ fontSize: 15, marginBottom: 8 }}>Research note</h3>
          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: 8,
              padding: 16,
              whiteSpace: "pre-wrap",
              lineHeight: 1.55,
              fontSize: 14,
            }}
          >
            {result.answer || "(empty answer)"}
          </div>
        </>
      )}
    </div>
  );
};

export default AgentResearch;
