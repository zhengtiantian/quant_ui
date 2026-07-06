import React, { useMemo, useState } from "react";
import {
  chatStrategy,
  generateStrategySpec,
  generateStrategyTasks,
  generateStrategyXml,
  saveStrategy,
} from "../api/strategy";
import type { StrategyTaskCode } from "../api/strategy";
import "./StrategyStudio.css";

const PRESET_PROMPTS = [
  "Create an RSI mean-reversion strategy: buy when RSI<30, sell when RSI>70, daily frequency, US stocks AAPL and MSFT",
  "Create a MACD trend-following strategy with 2% stop-loss and 5% take-profit, 2-year backtest window",
  "A composite strategy based on GDELT news sentiment and 20-day momentum, with 10% position limit",
];

function pretty(value: unknown) {
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value, null, 2);
}

function extractXml(raw: unknown): string {
  if (typeof raw === "string") {
    return raw;
  }
  if (raw && typeof raw === "object") {
    const candidate = (raw as { xml?: unknown }).xml;
    if (typeof candidate === "string") {
      return candidate;
    }
  }
  return pretty(raw);
}

const StrategyStudio: React.FC = () => {
  const [prompt, setPrompt] = useState(PRESET_PROMPTS[0]);
  const [strategySpecText, setStrategySpecText] = useState("");
  const [taskText, setTaskText] = useState("");
  const [xmlText, setXmlText] = useState("");
  const [saveResultText, setSaveResultText] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant"; message: string }>>([
    {
      role: "assistant",
      message: "Hi, I'm your strategy assistant. Ask me about parameter tuning, risk controls, or how to optimize your current strategy.",
    },
  ]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [autoStatus, setAutoStatus] = useState("");

  const userId = useMemo(() => localStorage.getItem("username") || "local-user", []);

  const withAction = async (name: string, fn: () => Promise<void>) => {
    setBusy(name);
    setError("");
    try {
      await fn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const parseSpec = (): Record<string, unknown> => {
    if (!strategySpecText.trim()) {
      throw new Error("StrategySpec is empty. Generate or paste valid JSON first.");
    }
    return JSON.parse(strategySpecText) as Record<string, unknown>;
  };

  const parseTasks = (): StrategyTaskCode[] | Record<string, unknown> => {
    if (!taskText.trim()) {
      throw new Error("Tasks is empty. Generate tasks first.");
    }
    return JSON.parse(taskText) as StrategyTaskCode[] | Record<string, unknown>;
  };

  const sendChat = async () => {
    const msg = chatInput.trim();
    if (!msg || busy) {
      return;
    }
    setChatMessages((prev) => [...prev, { role: "user", message: msg }]);
    setChatInput("");

    await withAction("chat", async () => {
      let spec: Record<string, unknown> | undefined;
      if (strategySpecText.trim()) {
        try {
          spec = parseSpec();
        } catch {
          spec = undefined;
        }
      }
      const resp = await chatStrategy({ message: msg, userId, strategySpec: spec });
      setChatMessages((prev) => [...prev, { role: "assistant", message: String(resp.message || "") }]);
    });
  };

  const autoGenerateAll = async () => {
    await withAction("auto", async () => {
      const finalPrompt = prompt.trim();
      if (!finalPrompt) {
        throw new Error("Strategy prompt cannot be empty.");
      }

      setAutoStatus("Generating StrategySpec...");
      const spec = await generateStrategySpec(finalPrompt, userId);
      setStrategySpecText(pretty(spec));

      setAutoStatus("Generating Tasks...");
      const tasks = await generateStrategyTasks(spec);
      setTaskText(pretty(tasks));

      setAutoStatus("Generating XML...");
      const xmlRaw = await generateStrategyXml({ strategySpec: spec, tasks });
      const xml = extractXml(xmlRaw);
      setXmlText(xml);

      setAutoStatus("Saving Strategy...");
      const saved = await saveStrategy({ strategySpec: spec, tasks, xml, userId });
      setSaveResultText(pretty(saved));

      setAutoStatus("Auto-generation complete.");
    });
  };

  return (
    <section className="wf-studio">
      <div className="wf-head">
        <h2>Strategy Studio</h2>
        <p>Prompt -&gt; StrategySpec -&gt; Tasks -&gt; XML -&gt; Save</p>
      </div>

      <div className="wf-panel">
        <label htmlFor="wf-prompt">Strategy Prompt</label>
        <textarea
          id="wf-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          placeholder="Describe the quant strategy you want to generate..."
        />
        <div className="wf-presets">
          {PRESET_PROMPTS.map((item) => (
            <button key={item} type="button" onClick={() => setPrompt(item)}>
              Use example
            </button>
          ))}
        </div>
        <div className="wf-actions">
          <button
            type="button"
            className="wf-primary-action"
            disabled={!!busy || !prompt.trim()}
            onClick={autoGenerateAll}
          >
            {busy === "auto" ? "Generating..." : "Auto Generate & Save"}
          </button>
          <button
            type="button"
            disabled={!!busy || !prompt.trim()}
            onClick={() =>
              withAction("spec", async () => {
                const result = await generateStrategySpec(prompt.trim(), userId);
                setStrategySpecText(pretty(result));
              })
            }
          >
            {busy === "spec" ? "Generating..." : "1. Generate StrategySpec"}
          </button>
          <button
            type="button"
            disabled={!!busy || !strategySpecText.trim()}
            onClick={() =>
              withAction("tasks", async () => {
                const spec = parseSpec();
                const tasks = await generateStrategyTasks(spec);
                setTaskText(pretty(tasks));
              })
            }
          >
            {busy === "tasks" ? "Generating..." : "2. Generate Tasks"}
          </button>
          <button
            type="button"
            disabled={!!busy || !strategySpecText.trim() || !taskText.trim()}
            onClick={() =>
              withAction("xml", async () => {
                const spec = parseSpec();
                const tasks = parseTasks();
                const xml = await generateStrategyXml({ strategySpec: spec, tasks });
                setXmlText(extractXml(xml));
              })
            }
          >
            {busy === "xml" ? "Generating..." : "3. Preview XML"}
          </button>
          <button
            type="button"
            disabled={!!busy || !strategySpecText.trim() || !taskText.trim() || !xmlText.trim()}
            onClick={() =>
              withAction("save", async () => {
                const spec = parseSpec();
                const tasks = parseTasks();
                const saved = await saveStrategy({ strategySpec: spec, tasks, xml: xmlText, userId });
                setSaveResultText(pretty(saved));
              })
            }
          >
            {busy === "save" ? "Saving..." : "4. Save Strategy"}
          </button>
        </div>
        {autoStatus && <div className="wf-auto-status">{autoStatus}</div>}
      </div>

      {error && <div className="wf-error">{error}</div>}

      <div className="wf-main-grid">
        <div className="wf-grid">
        <article className="wf-card">
          <h3>StrategySpec (JSON)</h3>
          <textarea
            value={strategySpecText}
            onChange={(e) => setStrategySpecText(e.target.value)}
            rows={14}
            placeholder="Generated StrategySpec will appear here"
          />
        </article>
        <article className="wf-card">
          <h3>Tasks (JSON)</h3>
          <textarea
            value={taskText}
            onChange={(e) => setTaskText(e.target.value)}
            rows={14}
            placeholder="Generated task metadata will appear here"
          />
        </article>
        <article className="wf-card">
          <h3>Strategy XML</h3>
          <textarea
            value={xmlText}
            onChange={(e) => setXmlText(e.target.value)}
            rows={14}
            placeholder="XML preview will appear here"
          />
        </article>
        <article className="wf-card">
          <h3>Save Result</h3>
          <textarea
            value={saveResultText}
            onChange={(e) => setSaveResultText(e.target.value)}
            rows={14}
            placeholder="Save result will appear here"
          />
        </article>
      </div>
        <aside className="wf-chat-card">
          <h3>AI Strategy Assistant</h3>
          <div className="wf-chat-list">
            {chatMessages.map((item, idx) => (
              <div key={`${item.role}-${idx}`} className={`wf-chat-bubble wf-chat-${item.role}`}>
                <strong>{item.role === "assistant" ? "AI" : "You"}:</strong> {item.message}
              </div>
            ))}
          </div>
          <div className="wf-chat-input-row">
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              rows={3}
              placeholder="Ask AI: e.g. Change stop-loss to 2% and explain the impact"
            />
            <button type="button" disabled={busy === "chat" || !chatInput.trim()} onClick={sendChat}>
              {busy === "chat" ? "Sending..." : "Send"}
            </button>
          </div>
        </aside>
      </div>
    </section>
  );
};

export default StrategyStudio;
