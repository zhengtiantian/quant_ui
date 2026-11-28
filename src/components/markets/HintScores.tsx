import React from "react";
import { tr, useLang } from "../../lang";
import { fetchHintScores, type HintScoresReply, type HintSide } from "../../api/markets";
import { cell, muted, panel, panelHead, panelTitle, pill, right, th } from "./format";

/**
 * Q.17.0 / F14: every blocked buy and every case against adding, scored against having bought
 * one unit at that session's close (quant_ai /portfolio/hint-scores).
 */
const PREFERRED_ORDER = [
  "add_block",
  "add_block:falling",
  "add_block:spacing",
  "add_block:size",
  "add_block:market_panic",
  "devils_advocate",
  "devils_advocate:strong",
  "devils_advocate:moderate",
  "devils_advocate:weak",
  "portfolio_review_flag",
  "filing_change",
];
const HORIZONS = ["5", "20", "60"];

const side = (s: HintSide | undefined) => {
  if (!s || !s.n) return null;
  return (
    <>
      <span title="fell afterwards: loss avoided (average)" style={{ color: "#84d6a3" }}>
        {s.fell}× −{(s.loss_avoided ?? 0).toFixed(1)}%
      </span>
      {" · "}
      <span title="rose afterwards: gain missed (average)" style={{ color: "#d88383" }}>
        {s.rose}× +{(s.gain_missed ?? 0).toFixed(1)}%
      </span>
    </>
  );
};

const HintScores: React.FC = () => {
  const [r, setR] = React.useState<HintScoresReply | null>(null);
  const [heldOnly, setHeldOnly] = React.useState(false);
  const [metric, setMetric] = React.useState<"own" | "vs_spy">("own");
  const [l] = useLang();

  React.useEffect(() => {
    const get = () => fetchHintScores(heldOnly).then(setR).catch(() => undefined);
    void get();
    const id = window.setInterval(() => {
      if (!document.hidden) void get();
    }, 3600000);
    return () => window.clearInterval(id);
  }, [heldOnly]);

  if (!r || (!heldOnly && !Object.keys(r.groups).length)) return null;
  const t = (k: string, fallback: string) => r.labels?.[k]?.[l] ?? fallback;

  const groupKeys = Object.keys(r.groups);
  const keys = [
    ...PREFERRED_ORDER.filter((k) => r.groups[k]),
    ...groupKeys.filter((k) => !PREFERRED_ORDER.includes(k)).sort(),
  ];

  const toggleBtn = (active: boolean): React.CSSProperties => ({
    background: active ? "#1f4f63" : "#22272e",
    color: active ? "#e8f6fb" : "#aeb4ba",
    border: `1px solid ${active ? "#458ea9" : "#3b424d"}`,
    borderRadius: 999,
    padding: "2px 9px",
    fontSize: 11.5,
    fontWeight: 600,
    cursor: "pointer",
  });

  return (
    <div style={panel}>
      <div style={{ ...panelHead, alignItems: "flex-start" }}>
        <div>
          <div style={panelTitle}>{t("title", "Blocked buys, scored")}</div>
          <span style={muted}>{t("explain", "")}</span>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" onClick={() => setHeldOnly(false)} style={toggleBtn(!heldOnly)}>
            {t("all_rows", tr(l, "All", "全部"))}
          </button>
          <button type="button" onClick={() => setHeldOnly(true)} style={toggleBtn(heldOnly)}>
            {t("held_only", tr(l, "Held only", "仅持仓"))}
          </button>
          <span style={{ width: 1, height: 14, background: "#3a424d", margin: "0 2px" }} />
          <button type="button" onClick={() => setMetric("own")} style={toggleBtn(metric === "own")}>
            {t("metric_own", tr(l, "Absolute", "绝对收益"))}
          </button>
          <button type="button" onClick={() => setMetric("vs_spy")} style={toggleBtn(metric === "vs_spy")}>
            {t("metric_spy", tr(l, "vs SPY", "相对 SPY"))}
          </button>
        </div>
      </div>

      {keys.length === 0 ? (
        <div style={muted}>{tr(l, "No held-stock blocks recorded yet.", "暂无已持仓标的的拦截记录。")}</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th} />
                <th style={{ ...th, ...right }}>{t("fired", "fired")}</th>
                {HORIZONS.map((h) => (
                  <th key={h} style={th}>
                    {h} {t("sessions", "sessions")}
                  </th>
                ))}
                <th style={{ ...th, ...right }} title="average of -return after the block (20d preferred, falls back to 5d)">
                  {t("net", "net for the block")}
                </th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => {
                const g = r.groups[k];
                const net20 = g.horizons["20"]?.[metric]?.net;
                const net5 = g.horizons["5"]?.[metric]?.net;
                const net = net20 ?? net5;
                const netH = net20 != null ? "20d" : net5 != null ? "5d" : null;
                return (
                  <tr key={k}>
                    <td style={cell}>
                      {t(k, k)}
                      <span style={{ ...muted, display: "block" }}>
                        {g.first_day} – {g.last_day}
                      </span>
                    </td>
                    <td style={{ ...cell, ...right }}>{g.fired}</td>
                    {HORIZONS.map((h) => (
                      <td key={h} style={cell}>
                        {side(g.horizons[h]?.[metric]) ?? <span style={muted}>{t("unscored", "not scored yet")}</span>}
                      </td>
                    ))}
                    <td
                      style={{
                        ...cell,
                        ...right,
                        color: net == null ? undefined : net > 0 ? "#84d6a3" : "#d88383",
                      }}
                    >
                      {net == null ? (
                        "—"
                      ) : (
                        <>
                          {net > 0 ? "+" : ""}
                          {net.toFixed(2)}%{" "}
                          {netH ? <span style={{ ...pill("#99a0a8"), fontSize: 10.5, marginLeft: 4 }}>{netH}</span> : null}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default HintScores;
