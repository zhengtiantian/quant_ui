import React from "react";
import { tr, useLang } from "../../lang";
import {
  fetchPortfolioReviewDetail,
  fetchPortfolioReviewHistory,
  runPortfolioReview,
} from "../../api/portfolioReview";
import type {
  PortfolioReviewReport,
  PortfolioReviewSummary,
} from "../../api/portfolioReview";
import { DOWN, UP, ghostButton, muted, pill } from "./format";

const VERDICT_META: Record<string, { label: [string, string]; color: string }> = {
  agree: { label: ["Agree", "同意规则"], color: UP },
  flag: { label: ["Flag", "存疑标红"], color: "#e3b177" },
  skipped: { label: ["Skipped", "已跳过"], color: "#99a0a8" },
};

export const PortfolioReviewDrawer: React.FC<{
  open: boolean;
  onClose: () => void;
}> = ({ open, onClose }) => {
  const [lang] = useLang();
  const L = React.useCallback((en: string, zh: string) => tr(lang, en, zh), [lang]);

  const [mode, setMode] = React.useState<"real" | "paper" | "both">("real");
  const [maxDecisions, setMaxDecisions] = React.useState(5);
  const [running, setRunning] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [report, setReport] = React.useState<PortfolioReviewReport | null>(null);
  const [history, setHistory] = React.useState<PortfolioReviewSummary[]>([]);
  const [expandedEv, setExpandedEv] = React.useState<Record<number, boolean>>({});

  const loadHistory = React.useCallback(async () => {
    const items = await fetchPortfolioReviewHistory(undefined, 10);
    setHistory(items);
    return items;
  }, []);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      const items = await loadHistory();
      if (!cancelled && !report && items.length > 0) {
        const latest = await fetchPortfolioReviewDetail(items[0].run_id);
        if (!cancelled && latest) setReport(latest);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, loadHistory, report]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const handleRun = async () => {
    setRunning(true);
    setErrorMsg(null);
    setExpandedEv({});
    try {
      const res = await runPortfolioReview({
        mode,
        max_decisions: maxDecisions,
        lang,
        save_history: true,
        record_hints: true,
      });
      setReport(res);
      void loadHistory();
    } catch (e) {
      setErrorMsg((e as Error).message || String(e));
    } finally {
      setRunning(false);
    }
  };

  if (!open) return null;

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
          width: "min(640px, 95vw)",
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
            background: "#1b2026",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 16, fontWeight: 700 }}>
              🛡️ {L("Portfolio Review Agent (3-Gate)", "组合复核 Agent（三道门控）")}
            </span>
            {report?.regime ? <span style={pill("#79cde2")}>{report.regime}</span> : null}
          </div>
          <button type="button" onClick={onClose} style={{ ...ghostButton, padding: "4px 10px" }} title="Esc">
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Controls */}
          <div style={{ background: "#1d2229", border: "1px solid #303742", borderRadius: 10, padding: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(
                  [
                    ["real", L("Real Holdings", "真实持仓")],
                    ["paper", L("Paper", "模拟盘")],
                    ["both", L("Both", "全部")],
                  ] as const
                ).map(([m, label]) => (
                  <button
                    key={m}
                    type="button"
                    disabled={running}
                    onClick={() => setMode(m)}
                    style={{
                      background: mode === m ? "#1f4f63" : "#252c35",
                      color: mode === m ? "#e8f6fb" : "#aeb6bf",
                      border: `1px solid ${mode === m ? "#458ea9" : "#3a4452"}`,
                      borderRadius: 999,
                      padding: "4px 11px",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: running ? "not-allowed" : "pointer",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <label style={{ fontSize: 12.5, color: "#9ba3ac" }}>
                  {L("Max", "最多")}:
                  <select
                    value={maxDecisions}
                    disabled={running}
                    onChange={(e) => setMaxDecisions(Number(e.target.value))}
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
                    <option value={8}>8</option>
                  </select>
                </label>

                <button
                  type="button"
                  disabled={running}
                  onClick={() => void handleRun()}
                  style={{
                    background: running ? "#2d3a46" : "#244c3b",
                    color: "#e6faef",
                    border: "1px solid #4b8f71",
                    borderRadius: 8,
                    padding: "6px 14px",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: running ? "wait" : "pointer",
                  }}
                >
                  {running ? L("Reviewing…", "复核中…") : L("▶ Run Review", "▶ 开始组合复核")}
                </button>
              </div>
            </div>
            <div style={{ ...muted, fontSize: 12, marginTop: 8 }}>
              {L(
                "Code computes arithmetic risk limits; LLM reviews news/catalysts and must pass Schema + per-tool Grounding + Business gates.",
                "代码负责确定性仓位/风控算账；LLM 结合新闻与催化剂给出第二意见，并强制过 Schema + 分工具数值溯源 + 业务规则三道门控。",
              )}
            </div>
          </div>

          {errorMsg ? (
            <div style={{ background: "#392124", border: "1px solid #723b41", color: "#efb4b4", borderRadius: 8, padding: "10px 12px", fontSize: 13 }}>
              ⚠️ {errorMsg}
            </div>
          ) : null}

          {report ? (
            <>
              {/* Summary Bar */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", fontSize: 12.5 }}>
                <span style={pill("#79cde2")}>{report.mode}</span>
                <span style={pill(UP)}>
                  {L("Agree", "同意")}: {report.verdicts?.agree ?? 0}
                </span>
                <span style={pill("#e3b177")}>
                  {L("Flag", "存疑")}: {report.verdicts?.flag ?? 0}
                </span>
                <span style={pill("#99a0a8")}>
                  {L("Skipped", "跳过")}: {report.verdicts?.skipped ?? 0}
                </span>
                {report.hintsRecorded ? (
                  <span style={pill("#b07fdc")}>
                    hint_log +{report.hintsRecorded}
                  </span>
                ) : null}
                <span style={{ ...muted, marginLeft: "auto" }}>
                  {report.elapsed_s}s · {report.asOf?.slice(0, 19).replace("T", " ")}
                </span>
              </div>

              {/* Deterministic Findings */}
              <div style={{ background: "#1b2026", border: "1px solid #2e3540", borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: "#cfd6de" }}>
                  📐 {L("Deterministic Risk Checks (Zero LLM)", "确定性风控检查（代码算账，不经 LLM）")} ({report.portfolioFindings?.length ?? 0})
                </div>
                {report.portfolioFindings?.length ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {report.portfolioFindings.map((f, idx) => (
                      <div
                        key={`${f.check}-${f.symbol || idx}`}
                        style={{
                          background: "#14181d",
                          border: `1px solid ${f.severity === "high" ? "#6d3b3b" : "#4b412c"}`,
                          borderRadius: 8,
                          padding: "8px 10px",
                          fontSize: 12.5,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={pill(f.severity === "high" ? DOWN : "#e3b177")}>{f.severity}</span>
                          <code>{f.check}</code>
                          {f.symbol ? <b>{f.symbol}</b> : null}
                        </div>
                        <div style={{ color: "#cfd5dc", marginTop: 4 }}>{f.detail}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={muted}>{L("No arithmetic risk breaches triggered.", "当前未触发确定性风控告警。")}</div>
                )}
              </div>

              {/* Per-Decision LLM Reviews */}
              <div style={{ background: "#1b2026", border: "1px solid #2e3540", borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: "#cfd6de" }}>
                  ⚖️ {L("Grounded Second Opinions", "逐条 Grounding 复核意见")} ({report.reviews?.length ?? 0})
                </div>
                {report.reviews?.length ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {report.reviews.map((r, idx) => {
                      const vm = VERDICT_META[r.verdict] || VERDICT_META.skipped;
                      const showEv = !!expandedEv[idx];
                      return (
                        <div
                          key={`${r.symbol}-${idx}`}
                          style={{
                            background: "#14181d",
                            border: `1px solid ${r.verdict === "flag" ? "#7b5e34" : "#2c343f"}`,
                            borderRadius: 8,
                            padding: 10,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <b style={{ fontSize: 14 }}>{r.symbol || "—"}</b>
                              <span style={pill("#79cde2")}>{r.action || "review"}</span>
                              <span style={pill(vm.color)}>{vm.label[lang === "zh" ? 1 : 0]}</span>
                              <span style={muted}>{Math.round((r.confidence || 0) * 100)}%</span>
                            </div>
                            {r.evidence?.length ? (
                              <button
                                type="button"
                                onClick={() => setExpandedEv((m) => ({ ...m, [idx]: !m[idx] }))}
                                style={{ background: "transparent", border: 0, color: "#79cde2", cursor: "pointer", fontSize: 12 }}
                              >
                                {showEv ? L("Hide evidence", "收起溯源") : L(`Evidence (${r.evidence.length})`, `溯源依据 (${r.evidence.length})`)}
                              </button>
                            ) : null}
                          </div>

                          {r.ruleReason ? (
                            <div style={{ ...muted, fontSize: 12, marginTop: 4 }}>
                              {L("Rule trigger:", "规则触发：")} {r.ruleReason}
                            </div>
                          ) : null}

                          {r.reasoning ? (
                            <div style={{ color: "#e6eaef", fontSize: 13, lineHeight: 1.55, marginTop: 6 }}>
                              {r.reasoning}
                            </div>
                          ) : null}

                          {r.notes?.length ? (
                            <div style={{ color: "#e3b177", fontSize: 11.5, marginTop: 6 }}>
                              ⚠ {r.notes.join(" · ")}
                            </div>
                          ) : null}

                          {showEv && r.evidence?.length ? (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8, paddingTop: 8, borderTop: "1px solid #262c35" }}>
                              {r.evidence.map((ev, eidx) => (
                                <span
                                  key={eidx}
                                  style={{
                                    background: "#0f1216",
                                    border: "1px solid #303844",
                                    borderRadius: 6,
                                    padding: "2px 8px",
                                    fontSize: 11.5,
                                    color: "#9bd3e4",
                                  }}
                                >
                                  <code>{ev.tool || "tool"}.{ev.field || "val"}</code> = <b>{String(ev.value)}</b>
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={muted}>{L("No pending decisions to review.", "暂无需要复核的决策项。")}</div>
                )}
              </div>
            </>
          ) : null}

          {/* History */}
          {history.length > 0 ? (
            <div style={{ background: "#1a1f25", border: "1px solid #2b313a", borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8, color: "#b6bec7" }}>
                🕘 {L("Review History", "历史复核记录")} ({history.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {history.map((h) => (
                  <button
                    key={h.run_id}
                    type="button"
                    disabled={running}
                    onClick={() => void fetchPortfolioReviewDetail(h.run_id).then((d) => { if (d) setReport(d); })}
                    style={{
                      textAlign: "left",
                      background: "#14181d",
                      border: "1px solid #2a313b",
                      borderRadius: 8,
                      padding: "7px 10px",
                      color: "#d4dae0",
                      cursor: running ? "not-allowed" : "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 12,
                    }}
                  >
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span style={pill("#79cde2")}>{h.mode}</span>
                      <span>
                        {h.decisionsReviewed} items · agree {h.verdicts?.agree ?? 0} / flag {h.verdicts?.flag ?? 0}
                      </span>
                    </div>
                    <span style={{ ...muted, fontSize: 11 }}>{h.asOf?.slice(0, 16).replace("T", " ")}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
};
