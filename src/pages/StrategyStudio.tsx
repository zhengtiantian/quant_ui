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
  "创建一个RSI均值回归策略：RSI<30买入，RSI>70卖出，日频，美股AAPL和MSFT",
  "创建MACD趋势跟随策略，包含止损2%和止盈5%，回测窗口2年",
  "基于GDELT新闻情绪和20日动量的组合策略，加入仓位限制10%",
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
      message: "你好，我是策略助手。你可以问我：参数怎么调、风控如何加、当前策略如何优化。",
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
      throw new Error("StrategySpec为空，请先生成或粘贴合法JSON。");
    }
    return JSON.parse(strategySpecText) as Record<string, unknown>;
  };

  const parseTasks = (): StrategyTaskCode[] | Record<string, unknown> => {
    if (!taskText.trim()) {
      throw new Error("Tasks为空，请先生成任务代码。");
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
        throw new Error("策略需求不能为空。");
      }

      setAutoStatus("正在生成 StrategySpec...");
      const spec = await generateStrategySpec(finalPrompt, userId);
      setStrategySpecText(pretty(spec));

      setAutoStatus("正在生成 Tasks...");
      const tasks = await generateStrategyTasks(spec);
      setTaskText(pretty(tasks));

      setAutoStatus("正在生成 XML...");
      const xmlRaw = await generateStrategyXml({ strategySpec: spec, tasks });
      const xml = extractXml(xmlRaw);
      setXmlText(xml);

      setAutoStatus("正在保存 Strategy...");
      const saved = await saveStrategy({ strategySpec: spec, tasks, xml, userId });
      setSaveResultText(pretty(saved));

      setAutoStatus("自动生成完成。");
    });
  };

  return (
    <section className="wf-studio">
      <div className="wf-head">
        <h2>Strategy Studio</h2>
        <p>Prompt -&gt; StrategySpec -&gt; Tasks -&gt; XML -&gt; Save</p>
      </div>

      <div className="wf-panel">
        <label htmlFor="wf-prompt">策略需求</label>
        <textarea
          id="wf-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          placeholder="描述你要生成的量化交易策略..."
        />
        <div className="wf-presets">
          {PRESET_PROMPTS.map((item) => (
            <button key={item} type="button" onClick={() => setPrompt(item)}>
              使用示例
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
            {busy === "auto" ? "自动生成中..." : "一键自动生成并保存"}
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
            {busy === "spec" ? "生成中..." : "1. 生成 StrategySpec"}
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
            {busy === "tasks" ? "生成中..." : "2. 生成 Tasks"}
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
            {busy === "xml" ? "生成中..." : "3. 预览 XML"}
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
            {busy === "save" ? "保存中..." : "4. 保存 Strategy"}
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
            placeholder="生成后的StrategySpec会显示在这里"
          />
        </article>
        <article className="wf-card">
          <h3>Tasks (JSON)</h3>
          <textarea
            value={taskText}
            onChange={(e) => setTaskText(e.target.value)}
            rows={14}
            placeholder="生成的Task代码元数据会显示在这里"
          />
        </article>
        <article className="wf-card">
          <h3>Strategy XML</h3>
          <textarea
            value={xmlText}
            onChange={(e) => setXmlText(e.target.value)}
            rows={14}
            placeholder="XML预览内容会显示在这里"
          />
        </article>
        <article className="wf-card">
          <h3>Save Result</h3>
          <textarea
            value={saveResultText}
            onChange={(e) => setSaveResultText(e.target.value)}
            rows={14}
            placeholder="保存结果会显示在这里"
          />
        </article>
      </div>
        <aside className="wf-chat-card">
          <h3>AI 策略助手</h3>
          <div className="wf-chat-list">
            {chatMessages.map((item, idx) => (
              <div key={`${item.role}-${idx}`} className={`wf-chat-bubble wf-chat-${item.role}`}>
                <strong>{item.role === "assistant" ? "AI" : "你"}:</strong> {item.message}
              </div>
            ))}
          </div>
          <div className="wf-chat-input-row">
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              rows={3}
              placeholder="问 AI：请帮我把止损改成 2%，并解释影响"
            />
            <button type="button" disabled={busy === "chat" || !chatInput.trim()} onClick={sendChat}>
              {busy === "chat" ? "发送中..." : "发送"}
            </button>
          </div>
        </aside>
      </div>
    </section>
  );
};

export default StrategyStudio;
