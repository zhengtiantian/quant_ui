import React from "react";
import { tr, useLang } from "../../lang";
import {
  fetchResearchHistory,
  fetchResearchRun,
  streamResearch,
} from "../../api/agentResearch";
import type {
  ResearchEvent,
  ResearchRunDetail,
  ResearchRunSummary,
  ResearchSecurityInfo,
  ResearchTraceItem,
} from "../../api/agentResearch";
import { DOWN, UP, ghostButton, muted, pill } from "./format";

const STANCE_META: Record<string, { label: [string, string]; color: string }> = {
  bullish: { label: ["Bullish", "看多"], color: UP },
  bearish: { label: ["Bearish", "看空"], color: DOWN },
  neutral: { label: ["Neutral", "中性"], color: "#e3b177" },
  unknown: { label: ["Summary", "纪要"], color: "#79cde2" },
};

const CONF_META: Record<string, [string, string]> = {
  high: ["High Conf", "高置信"],
  medium: ["Medium Conf", "中置信"],
  low: ["Low Conf", "低置信"],
  unknown: ["Unrated", "未标置信"],
};

interface CachedSessionResult {
  question: string;
  maxSteps: number;
  toolsAvailable: string[];
  model?: string;
  trace: ResearchTraceItem[];
  answer: string;
  stance?: string;
  confidence?: string;
  steps?: number;
  elapsedS?: number;
  toolsUsed?: string[];
  security?: ResearchSecurityInfo;
  note?: string;
}

const defaultPromptFor = (symbol: string | null | undefined, lang: "zh" | "en") => {
  if (symbol && symbol.trim()) {
    const s = symbol.trim().toUpperCase();
    return lang === "zh"
      ? `请对 ${s} 做一次深度投研分析：结合今日操作建议、催化事件、大盘风控天气、量化特征与信号、以及近期新闻情绪，给出多空核心依据与立场。`
      : `Run a deep research analysis on ${s}: inspect daily action, catalysts, market weather, quantitative features, signals, and recent news sentiment. Give key bull/bear reasons and stance.`;
  }
  return lang === "zh"
    ? "请结合当前大盘风控天气、持仓与今日操作建议、以及近期催化事件，总结当前组合的主要机会与风险。"
    : "Review current market weather, portfolio positions, daily actions, and upcoming catalysts to summarize top portfolio opportunities and risks.";
};

export const StockResearchButton: React.FC<{
  symbol: string;
  onOpen: (symbol: string) => void;
  compact?: boolean;
}> = ({ symbol, onOpen, compact }) => {
  const [lang] = useLang();
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen(symbol);
      }}
      title={tr(lang, `Open AI deep research drawer for ${symbol}`, `打开 ${symbol} AI 深度投研抽屉`)}
      style={{
        marginTop: compact ? 0 : 4,
        background: "#1c2a36",
        color: "#79cde2",
        border: "1px solid #35586d",
        borderRadius: 7,
        padding: compact ? "2px 7px" : "3px 8px",
        fontSize: 11.5,
        fontWeight: 600,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
      }}
    >
      🧠 {compact ? "AI" : tr(lang, "AI Research", "AI 深度研究")}
    </button>
  );
};

export const ResearchDrawer: React.FC<{
  open: boolean;
  symbol?: string | null;
  onClose: () => void;
}> = ({ open, symbol, onClose }) => {
  const [lang] = useLang();
  const L = React.useCallback((en: string, zh: string) => tr(lang, en, zh), [lang]);
  const keySymbol = symbol ? symbol.trim().toUpperCase() : "__GLOBAL__";

  const cacheRef = React.useRef<Record<string, CachedSessionResult>>({});
  const abortRef = React.useRef<AbortController | null>(null);

  const [question, setQuestion] = React.useState("");
  const [maxSteps, setMaxSteps] = React.useState(5);
  const [running, setRunning] = React.useState(false);
  const [statusText, setStatusText] = React.useState("");
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const [modelName, setModelName] = React.useState<string | undefined>(undefined);
  const [toolsAvailable, setToolsAvailable] = React.useState<string[]>([]);
  const [activeTool, setActiveTool] = React.useState<{ step: number; action: string; args: Record<string, unknown> } | null>(null);
  const [trace, setTrace] = React.useState<ResearchTraceItem[]>([]);
  const [expandedObs, setExpandedObs] = React.useState<Record<number, boolean>>({});

  const [answer, setAnswer] = React.useState("");
  const [stance, setStance] = React.useState<string>("unknown");
  const [confidence, setConfidence] = React.useState<string>("unknown");
  const [elapsedS, setElapsedS] = React.useState<number | undefined>(undefined);
  const [stepsTaken, setStepsTaken] = React.useState<number | undefined>(undefined);
  const [toolsUsed, setToolsUsed] = React.useState<string[]>([]);
  const [security, setSecurity] = React.useState<ResearchSecurityInfo | undefined>(undefined);
  const [runNote, setRunNote] = React.useState<string | undefined>(undefined);

  const [history, setHistory] = React.useState<ResearchRunSummary[]>([]);

  const applyDetail = React.useCallback((d: ResearchRunDetail) => {
    setQuestion(d.question || "");
    setTrace(d.trace || []);
    setAnswer(d.answer || "");
    setStance(d.stance || "unknown");
    setConfidence(d.confidence || "unknown");
    setElapsedS(d.elapsed_s);
    setStepsTaken(d.steps);
    setToolsUsed(d.tools_used || []);
    setSecurity(d.security);
    setRunNote(d.note || undefined);
    setActiveTool(null);
    setErrorMsg(null);
    setStatusText(L("Loaded from history", "已加载历史研究纪要"));
  }, [L]);

  const refreshHistory = React.useCallback(async () => {
    const items = await fetchResearchHistory(symbol ?? undefined, 10);
    setHistory(items);
    return items;
  }, [symbol]);

  const stopRun = React.useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setRunning(false);
    setActiveTool(null);
    setStatusText(L("Stopped by user", "已手动停止"));
  }, [L]);

  const startRun = React.useCallback(async (overrideQuestion?: string) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const qText = (overrideQuestion ?? question).trim() || defaultPromptFor(symbol, lang);
    setQuestion(qText);
    setRunning(true);
    setErrorMsg(null);
    setActiveTool(null);
    setTrace([]);
    setExpandedObs({});
    setAnswer("");
    setStance("unknown");
    setConfidence("unknown");
    setElapsedS(undefined);
    setStepsTaken(undefined);
    setToolsUsed([]);
    setSecurity(undefined);
    setRunNote(undefined);
    setStatusText(L("Connecting to ReAct agent…", "正在连接 ReAct 投研 Agent…"));

    const accTrace: ResearchTraceItem[] = [];
    let avail: string[] = [];
    let mdl: string | undefined;

    try {
      await streamResearch(
        {
          question: qText,
          max_steps: maxSteps,
          symbol: symbol ? symbol.trim().toUpperCase() : null,
          lang,
          scope: symbol ? "stock" : "auto",
          save_history: true,
        },
        (ev: ResearchEvent) => {
          if (ev.type === "run_start") {
            avail = ev.tools_available || [];
            mdl = ev.model;
            setToolsAvailable(avail);
            setModelName(mdl);
            setStatusText(L(`Scope: ${ev.scope} · ${avail.length} tools`, `模式：${ev.scope} · ${avail.length} 个只读工具`));
          } else if (ev.type === "step_start") {
            setActiveTool(null);
            setStatusText(L(`Step ${ev.step}/${ev.max_steps}: Reasoning…`, `第 ${ev.step}/${ev.max_steps} 步：模型规划思考中…`));
          } else if (ev.type === "tool_start") {
            setActiveTool({ step: ev.step, action: ev.action, args: ev.args });
            setStatusText(L(`Step ${ev.step}: Calling ${ev.action}…`, `第 ${ev.step} 步：正在调用 ${ev.action}…`));
          } else if (ev.type === "tool_call") {
            setActiveTool(null);
            const item: ResearchTraceItem = {
              step: ev.step,
              action: ev.action,
              args: ev.args,
              observation: ev.observation,
              duration_ms: ev.duration_ms,
              ok: ev.ok,
              truncated: ev.truncated,
              injection_flags: ev.injection_flags,
            };
            accTrace.push(item);
            setTrace([...accTrace]);
          } else if (ev.type === "final") {
            setActiveTool(null);
            setRunning(false);
            setAnswer(ev.answer || "");
            setStance(ev.stance || "unknown");
            setConfidence(ev.confidence || "unknown");
            setStepsTaken(ev.steps);
            setElapsedS(ev.elapsed_s);
            setToolsUsed(ev.tools_used || []);
            setSecurity(ev.security);
            setRunNote(ev.note);
            setStatusText(L(`Completed in ${ev.elapsed_s}s`, `已完成 · 耗时 ${ev.elapsed_s}s`));
            cacheRef.current[keySymbol] = {
              question: qText,
              maxSteps,
              toolsAvailable: avail,
              model: mdl,
              trace: [...accTrace],
              answer: ev.answer || "",
              stance: ev.stance,
              confidence: ev.confidence,
              steps: ev.steps,
              elapsedS: ev.elapsed_s,
              toolsUsed: ev.tools_used,
              security: ev.security,
              note: ev.note,
            };
            void refreshHistory();
          } else if (ev.type === "error") {
            setActiveTool(null);
            setRunning(false);
            setErrorMsg(ev.error || "Unknown agent error");
            setStatusText(L("Failed", "执行失败"));
          }
        },
        ctrl.signal,
      );
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setRunning(false);
        setActiveTool(null);
        setErrorMsg((e as Error).message || String(e));
        setStatusText(L("Stream error", "流式连接出错"));
      }
    } finally {
      if (abortRef.current === ctrl) {
        abortRef.current = null;
        setRunning(false);
      }
    }
  }, [L, keySymbol, lang, maxSteps, question, refreshHistory, symbol]);

  React.useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      abortRef.current = null;
      setRunning(false);
      return;
    }

    const cached = cacheRef.current[keySymbol];
    if (cached) {
      setQuestion(cached.question);
      setMaxSteps(cached.maxSteps);
      setToolsAvailable(cached.toolsAvailable);
      setModelName(cached.model);
      setTrace(cached.trace);
      setAnswer(cached.answer);
      setStance(cached.stance || "unknown");
      setConfidence(cached.confidence || "unknown");
      setElapsedS(cached.elapsedS);
      setStepsTaken(cached.steps);
      setToolsUsed(cached.toolsUsed || []);
      setSecurity(cached.security);
      setRunNote(cached.note);
      setErrorMsg(null);
      setStatusText(L("Cached session result", "已恢复本次会话研究结果"));
      void refreshHistory();
      return;
    }

    const initialQ = defaultPromptFor(symbol, lang);
    setQuestion(initialQ);
    setTrace([]);
    setAnswer("");
    setErrorMsg(null);

    let cancelled = false;
    void (async () => {
      const items = await refreshHistory();
      if (cancelled) return;
      if (symbol && items.length > 0) {
        const latest = await fetchResearchRun(items[0].run_id);
        if (!cancelled && latest) {
          applyDetail(latest);
          return;
        }
      }
      if (symbol && !cancelled) {
        void startRun(initialQ);
      } else {
        setStatusText(L("Ready — ask a portfolio or market question", "就绪 — 可直接提问组合、大盘风控或个股问题"));
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, keySymbol]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const stanceMeta = STANCE_META[stance] || STANCE_META.unknown;
  const confLabel = (CONF_META[confidence] || CONF_META.unknown)[lang === "zh" ? 1 : 0];
  const presets = symbol
    ? [
        {
          label: L("Full Bull/Bear Check", "全面多空体检"),
          q: defaultPromptFor(symbol, lang),
        },
        {
          label: L("Catalysts & News Risk", "近期催化与新闻风险"),
          q: L(
            `Inspect upcoming catalysts, recent news sentiment, and market weather risks for ${symbol}.`,
            `重点分析 ${symbol} 近期催化事件、新闻情绪变化及大盘环境对它的潜在冲击。`,
          ),
        },
        {
          label: L("Holdings Action & Lots", "操作建议与批次策略"),
          q: L(
            `Check daily action, lot advice, signals, and quant features for ${symbol}. Should I hold, add, or trim?`,
            `查看 ${symbol} 的今日操作建议、批次卖出建议与量化信号，评估当前更适合持有、加仓还是减仓？`,
          ),
        },
      ]
    : [
        {
          label: L("Portfolio Weather & Action", "大盘天气与组合体检"),
          q: defaultPromptFor(null, lang),
        },
        {
          label: L("Upcoming Catalyst Risks", "近期催化风险扫描"),
          q: L(
            "Check upcoming catalysts and recent news across held positions. Which stocks face the highest event risk?",
            "扫描当前持仓的近期催化事件与新闻动态，哪些标的近期事件波动风险最大？",
          ),
        },
        {
          label: L("Pipeline Health Check", "数据流水线健康度"),
          q: L(
            "Check pipeline health and market weather, then summarize any stale feeds or regime constraints.",
            "检查数据流水线健康度（get_pipeline_health）和大盘风控天气，指出是否有异常或延迟数据源。",
          ),
        },
      ];

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(8, 10, 14, 0.62)",
        zIndex: 1200,
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(620px, 95vw)",
          height: "100vh",
          background: "#16191d",
          borderLeft: "1px solid #3c444f",
          display: "flex",
          flexDirection: "column",
          color: "#e2e6eb",
          boxShadow: "-10px 0 32px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid #2e343d",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            background: "#1b2026",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 16, fontWeight: 700 }}>
              🧠 {symbol ? `${symbol} · ${L("AI Deep Research", "AI 深度研究")}` : L("Global AI Research", "全局 AI 投研助手")}
            </span>
            {modelName ? <span style={pill("#79cde2")}>{modelName}</span> : null}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {running ? (
              <button
                type="button"
                onClick={stopRun}
                style={{ ...ghostButton, color: DOWN, borderColor: "#6d3b3b", padding: "4px 10px" }}
              >
                ⏹ {L("Stop", "停止")}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              style={{ ...ghostButton, padding: "4px 10px" }}
              title="Esc"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Prompt & Controls */}
          <div style={{ background: "#1d2229", border: "1px solid #303742", borderRadius: 10, padding: 12 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
              {presets.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  disabled={running}
                  onClick={() => {
                    setQuestion(p.q);
                    void startRun(p.q);
                  }}
                  style={{
                    background: "#252c35",
                    color: "#bfd2e2",
                    border: "1px solid #3a4452",
                    borderRadius: 999,
                    padding: "3px 10px",
                    fontSize: 12,
                    cursor: running ? "not-allowed" : "pointer",
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <textarea
              rows={3}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={L("Ask the ReAct research agent…", "输入你想研究的投研问题…")}
              style={{
                width: "100%",
                boxSizing: "border-box",
                borderRadius: 8,
                border: "1px solid #414a56",
                background: "#13171c",
                color: "#e4e7eb",
                padding: "8px 10px",
                fontSize: 13,
                resize: "vertical",
              }}
            />

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, gap: 10, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#9ba3ac" }}>
                <label>
                  {L("Max steps", "最大步数")}:
                  <select
                    value={maxSteps}
                    disabled={running}
                    onChange={(e) => setMaxSteps(Number(e.target.value))}
                    style={{
                      marginLeft: 6,
                      background: "#13171c",
                      color: "#e4e7eb",
                      border: "1px solid #414a56",
                      borderRadius: 6,
                      padding: "2px 6px",
                    }}
                  >
                    <option value={3}>3</option>
                    <option value={5}>5</option>
                    <option value={6}>6</option>
                  </select>
                </label>
                {toolsAvailable.length ? (
                  <span>· {toolsAvailable.length} {L("tools", "个工具")}</span>
                ) : null}
              </div>

              <button
                type="button"
                disabled={running}
                onClick={() => void startRun()}
                style={{
                  background: running ? "#2d3a46" : "#1f4f63",
                  color: "#e8f6fb",
                  border: "1px solid #458ea9",
                  borderRadius: 8,
                  padding: "6px 14px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: running ? "wait" : "pointer",
                }}
              >
                {running ? L("Researching…", "研究执行中…") : L("▶ Run Research", "▶ 开始研究")}
              </button>
            </div>
          </div>

          {/* Live Status Bar */}
          {statusText ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: running ? "#79cde2" : "#9ba3ac" }}>
              <span>{running ? "⏳" : "●"}</span>
              <span>{statusText}</span>
            </div>
          ) : null}

          {errorMsg ? (
            <div style={{ background: "#392124", border: "1px solid #723b41", color: "#efb4b4", borderRadius: 8, padding: "10px 12px", fontSize: 13 }}>
              ⚠️ {errorMsg}
            </div>
          ) : null}

          {/* Live ReAct Trace */}
          {(trace.length > 0 || activeTool) ? (
            <div style={{ background: "#1b2026", border: "1px solid #2e3540", borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: "#cfd6de" }}>
                🔍 {L("ReAct Tool Trace", "ReAct 工具调用轨迹")} ({trace.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {trace.map((t, idx) => {
                  const isOpen = !!expandedObs[idx];
                  const hasFlags = (t.injection_flags?.length ?? 0) > 0;
                  return (
                    <div
                      key={`${t.step}-${t.action}-${idx}`}
                      style={{
                        background: "#14181d",
                        border: `1px solid ${t.ok === false ? "#6b3838" : "#2c343f"}`,
                        borderRadius: 8,
                        padding: "8px 10px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, flexWrap: "wrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <span style={pill("#79cde2")}>Step {t.step}</span>
                          <code style={{ color: "#e8edf2", fontWeight: 600, fontSize: 12.5 }}>{t.action}</code>
                          <span style={{ ...muted, fontSize: 11.5 }}>{JSON.stringify(t.args)}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5 }}>
                          {hasFlags ? <span style={pill("#e3b177")}>🛡 {t.injection_flags!.join(",")}</span> : null}
                          {t.truncated ? <span style={pill("#9ba3ac")}>truncated</span> : null}
                          <span style={{ color: t.ok === false ? DOWN : UP }}>
                            {t.ok === false ? "err" : "ok"} {t.duration_ms != null ? `${t.duration_ms}ms` : ""}
                          </span>
                          <button
                            type="button"
                            onClick={() => setExpandedObs((m) => ({ ...m, [idx]: !m[idx] }))}
                            style={{ background: "transparent", border: 0, color: "#79cde2", cursor: "pointer", fontSize: 11.5 }}
                          >
                            {isOpen ? L("Hide", "收起") : L("Data", "数据")}
                          </button>
                        </div>
                      </div>
                      {isOpen ? (
                        <pre
                          style={{
                            margin: "8px 0 0",
                            padding: 8,
                            background: "#0f1216",
                            borderRadius: 6,
                            fontSize: 11.5,
                            color: "#b8c0c9",
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                            maxHeight: 200,
                            overflowY: "auto",
                          }}
                        >
                          {t.observation}
                        </pre>
                      ) : null}
                    </div>
                  );
                })}
                {activeTool ? (
                  <div
                    style={{
                      background: "#17222b",
                      border: "1px dashed #458ea9",
                      borderRadius: 8,
                      padding: "8px 10px",
                      fontSize: 12.5,
                      color: "#9fdcf0",
                    }}
                  >
                    ⏳ Step {activeTool.step} · Calling <code>{activeTool.action}</code>{" "}
                    <span style={muted}>{JSON.stringify(activeTool.args)}</span>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Final Answer Card */}
          {answer ? (
            <div style={{ background: "#1b2129", border: "1px solid #354151", borderRadius: 10, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={pill(stanceMeta.color)}>{stanceMeta.label[lang === "zh" ? 1 : 0]}</span>
                  <span style={pill("#9ba3ac")}>{confLabel}</span>
                  {stepsTaken != null ? <span style={muted}>{stepsTaken} {L("steps", "步")}</span> : null}
                  {elapsedS != null ? <span style={muted}>· {elapsedS}s</span> : null}
                  {runNote ? <span style={pill("#e3b177")}>{runNote}</span> : null}
                </div>
              </div>

              {(security?.flagged_tools?.length || security?.answer_problems?.length) ? (
                <div style={{ background: "#3b2f1c", border: "1px solid #755b30", color: "#ebc27d", borderRadius: 7, padding: "6px 10px", fontSize: 12, marginBottom: 10 }}>
                  🛡 {L("Security audit flags", "安全审计提示")}:{" "}
                  {[
                    ...(security.flagged_tools?.map((t) => `tool:${t}`) ?? []),
                    ...(security.answer_problems ?? []),
                  ].join(" · ")}
                </div>
              ) : null}

              <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.65, fontSize: 13.5, color: "#e7eaee" }}>
                {answer}
              </div>

              {toolsUsed.length ? (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12, paddingTop: 10, borderTop: "1px solid #2b323b", alignItems: "center" }}>
                  <span style={{ ...muted, fontSize: 11.5 }}>{L("Grounded tools:", "数据支撑工具：")}</span>
                  {toolsUsed.map((tu) => (
                    <code key={tu} style={{ fontSize: 11.5, background: "#13171c", padding: "2px 6px", borderRadius: 5, color: "#9bd3e4" }}>
                      {tu}
                    </code>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {/* History List */}
          {history.length > 0 ? (
            <div style={{ background: "#1a1f25", border: "1px solid #2b313a", borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8, color: "#b6bec7" }}>
                🕘 {L("Saved Research History", "历史投研记录")} ({history.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {history.map((h) => {
                  const st = STANCE_META[h.stance || "unknown"] || STANCE_META.unknown;
                  return (
                    <button
                      key={h.run_id}
                      type="button"
                      disabled={running}
                      onClick={() => void fetchResearchRun(h.run_id).then((d) => { if (d) applyDetail(d); })}
                      style={{
                        textAlign: "left",
                        background: "#14181d",
                        border: "1px solid #2a313b",
                        borderRadius: 8,
                        padding: "7px 10px",
                        color: "#d4dae0",
                        cursor: running ? "not-allowed" : "pointer",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {h.symbol ? <b>{h.symbol}</b> : null}
                          <span style={pill(st.color)}>{st.label[lang === "zh" ? 1 : 0]}</span>
                          <span style={muted}>{h.elapsed_s}s · {h.tools_used?.length ?? 0} tools</span>
                        </div>
                        <span style={{ ...muted, fontSize: 11 }}>{h.created_at?.slice(0, 16).replace("T", " ")}</span>
                      </div>
                      <div style={{ ...muted, fontSize: 12, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {h.answer_preview || h.question}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
};
