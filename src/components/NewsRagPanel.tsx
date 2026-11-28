import React from "react";
import { tr, useLang } from "../lang";
import { askNews, F06_THEMES, type NewsRagResponse, type NewsRagSource } from "../api/newsRag";

const QUICK_SYMBOLS = ["INTC", "SKHY", "TSM", "STX", "NVDA", "MU"] as const;

const WINDOWS = [
  { id: "all", en: "All", zh: "全部", days: null },
  { id: "7", en: "7D", zh: "近7天", days: 7 },
  { id: "30", en: "30D", zh: "近30天", days: 30 },
  { id: "90", en: "90D", zh: "近90天", days: 90 },
  { id: "365", en: "1Y", zh: "近1年", days: 365 },
] as const;

function daysAgoInt(days: number): number {
  const d = new Date(Date.now() - days * 86400 * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return Number(`${y}${m}${day}`);
}

const pillStyle: React.CSSProperties = {
  background: "#262b31",
  border: "1px solid #434b56",
  color: "#d0d7de",
  borderRadius: 6,
  padding: "4px 8px",
  fontSize: 12.5,
};

const NewsRagPanel: React.FC = () => {
  const [lang] = useLang();
  const [question, setQuestion] = React.useState("");
  const [symbol, setSymbol] = React.useState("");
  const [impactedSymbol, setImpactedSymbol] = React.useState("");
  const [theme, setTheme] = React.useState("");
  const [windowId, setWindowId] = React.useState<string>("30");
  const [rerank, setRerank] = React.useState(true);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [resp, setResp] = React.useState<NewsRagResponse | null>(null);
  const [activeCite, setActiveCite] = React.useState<number | null>(null);
  const srcRefs = React.useRef<Record<number, HTMLDivElement | null>>({});

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = question.trim();
    if (!q || loading) return;
    setLoading(true);
    setError(null);
    setActiveCite(null);
    try {
      const win = WINDOWS.find((w) => w.id === windowId);
      const res = await askNews({
        question: q,
        symbol: symbol.trim().toUpperCase() || undefined,
        impacted_symbol: impactedSymbol.trim().toUpperCase() || undefined,
        theme: theme || undefined,
        since: win?.days ? daysAgoInt(win.days) : undefined,
        k: 8,
        rerank,
      });
      if (res.error) setError(res.error);
      setResp(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const jumpToCitation = (id: number) => {
    setActiveCite(id);
    srcRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const renderAnswerWithCitations = (text: string, maxId: number) => {
    const parts = text.split(/(\[\d+\])/g);
    return parts.map((part, idx) => {
      const m = part.match(/^\[(\d+)\]$/);
      if (!m) return <React.Fragment key={idx}>{part}</React.Fragment>;
      const id = Number(m[1]);
      if (id < 1 || id > maxId) return <React.Fragment key={idx}>{part}</React.Fragment>;
      return (
        <button
          key={idx}
          type="button"
          onClick={() => jumpToCitation(id)}
          style={{
            background: activeCite === id ? "#3b82f6" : "#262b31",
            color: activeCite === id ? "#fff" : "#7cc4ff",
            border: "1px solid #434b56",
            borderRadius: 4,
            padding: "0 5px",
            margin: "0 2px",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          [{id}]
        </button>
      );
    });
  };

  const sources: NewsRagSource[] = resp?.sources || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 1120 }}>
      <div style={{ background: "#1e2329", border: "1px solid #434b56", borderRadius: 10, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
          <div>
            <strong style={{ fontSize: 16 }}>
              {tr(lang, "News Hybrid RAG Q&A", "新闻混合检索 + 重排问答（/api/ask/news）")}
            </strong>
            <span style={{ marginLeft: 10, fontSize: 12.5, color: "#99a0a8" }}>
              {tr(lang, "Mongo text + Qdrant dense + RRF + bge-reranker-v2-m3 (cited & date-guarded)",
                  "Mongo 全文 + Qdrant 向量 + RRF + Cross-Encoder 重排（强制引用 / 防时间穿越 / 英文自动扩展）")}
            </span>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {QUICK_SYMBOLS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSymbol(symbol === s ? "" : s)}
                style={{
                  ...pillStyle,
                  cursor: "pointer",
                  background: symbol === s ? "#2b4c7e" : "#262b31",
                  borderColor: symbol === s ? "#58a6ff" : "#434b56",
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={tr(
                lang,
                "Ask in Chinese or English (e.g. Why did memory stocks and NVDA sell off recently?)",
                "支持中英文提问（例如：最近30天存储芯片和英伟达抛售的主要原因是什么？）"
              )}
              style={{
                flex: "1 1 420px",
                background: "#16191d",
                border: "1px solid #434b56",
                borderRadius: 8,
                color: "#e6edf3",
                padding: "9px 12px",
                fontSize: 14,
              }}
            />
            <button type="submit" disabled={loading || !question.trim()} style={{ padding: "8px 18px", fontWeight: 700 }}>
              {loading ? tr(lang, "Searching…", "检索回答中…") : tr(lang, "Ask", "提问")}
            </button>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", fontSize: 12.5 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ color: "#99a0a8" }}>{tr(lang, "Symbol", "股票")}</span>
              <input
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="NVDA"
                style={{ ...pillStyle, width: 78, background: "#16191d" }}
              />
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ color: "#99a0a8" }}>{tr(lang, "Impacted Peer", "波及标的")}</span>
              <input
                type="text"
                value={impactedSymbol}
                onChange={(e) => setImpactedSymbol(e.target.value.toUpperCase())}
                placeholder="TSM"
                style={{ ...pillStyle, width: 78, background: "#16191d" }}
              />
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ color: "#99a0a8" }}>{tr(lang, "Theme", "F06 主题")}</span>
              <select value={theme} onChange={(e) => setTheme(e.target.value)} style={{ ...pillStyle, background: "#16191d" }}>
                <option value="">{tr(lang, "All themes", "全部主题")}</option>
                {F06_THEMES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>

            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ color: "#99a0a8" }}>{tr(lang, "Window", "时间窗")}</span>
              {WINDOWS.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setWindowId(w.id)}
                  style={{
                    ...pillStyle,
                    cursor: "pointer",
                    background: windowId === w.id ? "#2b4c7e" : "#262b31",
                    borderColor: windowId === w.id ? "#58a6ff" : "#434b56",
                  }}
                >
                  {tr(lang, w.en, w.zh)}
                </button>
              ))}
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
              <input type="checkbox" checked={rerank} onChange={(e) => setRerank(e.target.checked)} />
              <span>{tr(lang, "Cross-encoder rerank", "Cross-Encoder 重排")}</span>
            </label>
          </div>
        </form>
      </div>

      {error ? (
        <div style={{ background: "#3a1e22", border: "1px solid #d88383", borderRadius: 8, padding: 12, color: "#f7b4b4" }}>
          {error}
        </div>
      ) : null}

      {resp && !error ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ background: "#1e2329", border: "1px solid #434b56", borderRadius: 10, padding: 16 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10, fontSize: 12, color: "#99a0a8" }}>
              <span style={pillStyle}>
                {tr(lang, "Retrieval", "检索")}: {resp.retrieval_ms ?? 0} ms
                {resp.legs ? ` (D:${resp.legs.dense} / S:${resp.legs.sparse})` : ""}
              </span>
              {resp.rerank?.enabled ? (
                <span style={pillStyle}>
                  {tr(lang, "Rerank", "重排")}: {resp.rerank.ms ? `${resp.rerank.ms} ms` : resp.rerank.error || "on"}
                </span>
              ) : null}
              <span style={pillStyle}>{tr(lang, "Generation", "生成")}: {resp.generation_ms ?? 0} ms</span>
              {resp.query_info?.rewritten ? (
                <span style={pillStyle}>
                  {tr(lang, "Query", "检索词")}: <code>{resp.query_info.retrieval_query}</code>
                </span>
              ) : null}
              {resp.query_info?.inferred_since ? (
                <span style={pillStyle}>since≥{resp.query_info.inferred_since}</span>
              ) : null}
              {resp.degraded && Object.keys(resp.degraded).length > 0 ? (
                <span style={{ ...pillStyle, borderColor: "#e3b177", color: "#e3b177" }}>
                  {tr(lang, "Degraded", "降级")}: {Object.keys(resp.degraded).join(", ")}
                </span>
              ) : null}
              {((resp.security?.flagged_sources?.length ?? 0) > 0 || (resp.security?.answer_problems?.length ?? 0) > 0) ? (
                <span
                  title={tr(
                    lang,
                    `Security audit flags: sources=${JSON.stringify(resp.security?.flagged_sources ?? [])}, answer=${JSON.stringify(resp.security?.answer_problems ?? [])}`,
                    `安全审计告警：可疑来源=${JSON.stringify(resp.security?.flagged_sources ?? [])}，回答检查=${JSON.stringify(resp.security?.answer_problems ?? [])}`
                  )}
                  style={{ ...pillStyle, borderColor: "#e3b177", color: "#e3b177" }}
                >
                  ⚠ {tr(lang, "Guardrail", "安全审计")}:
                  {(resp.security?.flagged_sources?.length ?? 0) > 0
                    ? ` [${resp.security?.flagged_sources?.join(",")}]`
                    : ""}
                  {(resp.security?.answer_problems?.length ?? 0) > 0
                    ? ` ${resp.security?.answer_problems?.join(", ")}`
                    : ""}
                </span>
              ) : null}
            </div>

            <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.65, fontSize: 14.5, color: "#e6edf3" }}>
              {renderAnswerWithCitations(resp.answer || "", sources.length)}
            </div>
          </div>

          {sources.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))", gap: 10 }}>
              {sources.map((s) => (
                <div
                  key={s.id}
                  ref={(el) => { srcRefs.current[s.id] = el; }}
                  style={{
                    background: "#1e2329",
                    border: `1px solid ${activeCite === s.id ? "#58a6ff" : "#343b44"}`,
                    borderRadius: 8,
                    padding: 12,
                    fontSize: 12.5,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, color: "#99a0a8" }}>
                    <span>
                      <strong style={{ color: "#7cc4ff" }}>[{s.id}]</strong>{" "}
                      <strong>{s.symbol || "-"}</strong> · {s.date || "-"}
                    </span>
                    <span>
                      {s.sentiment !== null && s.sentiment !== undefined ? `sent ${s.sentiment >= 0 ? "+" : ""}${s.sentiment}` : ""}
                      {s.event_type ? ` · ${s.event_type}` : ""}
                    </span>
                  </div>
                  <div style={{ fontWeight: 600, marginBottom: 6, lineHeight: 1.4 }}>
                    {s.url ? (
                      <a href={s.url} target="_blank" rel="noreferrer" style={{ color: "#e6edf3" }}>{s.title}</a>
                    ) : s.title}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", fontSize: 11.5, color: "#99a0a8" }}>
                    {s.dense_rank ? <span>dense #{s.dense_rank}</span> : null}
                    {s.sparse_rank ? <span>sparse #{s.sparse_rank}</span> : null}
                    {(s.injection_flags?.length ?? 0) > 0 ? (
                      <span
                        title={s.injection_flags?.join(", ")}
                        style={{ background: "#3a2d1b", border: "1px solid #e3b177", color: "#e3b177", padding: "1px 5px", borderRadius: 4 }}
                      >
                        ⚠ {s.injection_flags?.join(", ")}
                      </span>
                    ) : null}
                    {(s.themes || []).map((t) => (
                      <span key={t} style={{ background: "#262b31", padding: "1px 5px", borderRadius: 4 }}>{t}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default NewsRagPanel;
