import React from "react";
import { fetchHintScores, type HintScoresReply, type HintSide } from "../../api/markets";
import { cell, muted, panel, panelHead, panelTitle, right, th } from "./format";

/**
 * Q.17.0: every blocked buy and every case against adding, scored against having bought one unit at that
 * session's close (quant_ai /portfolio/hint-scores). A fall afterwards is a loss avoided, a rise a gain
 * missed; neither is profit. Words come from the server in both languages (briefLang).
 */
const lang = (): "zh" | "en" => {
  try { return localStorage.getItem("briefLang") === "en" ? "en" : "zh"; } catch { return "zh"; }
};
const ORDER = ["add_block", "add_block:falling", "add_block:spacing", "add_block:size", "devils_advocate", "filing_change"];
const HORIZONS = ["5", "20", "60"];

const side = (s: HintSide | undefined) => {
  if (!s || !s.n) return null;
  return (
    <>
      <span title="fell afterwards: loss avoided (average)" style={{ color: "#84d6a3" }}>{s.fell}× −{(s.loss_avoided ?? 0).toFixed(1)}%</span>
      {" · "}
      <span title="rose afterwards: gain missed (average)" style={{ color: "#d88383" }}>{s.rose}× +{(s.gain_missed ?? 0).toFixed(1)}%</span>
    </>
  );
};

const HintScores: React.FC = () => {
  const [r, setR] = React.useState<HintScoresReply | null>(null);
  React.useEffect(() => {
    const get = () => fetchHintScores().then(setR).catch(() => undefined);
    void get();
    const id = window.setInterval(() => { if (!document.hidden) void get(); }, 3600000);
    return () => window.clearInterval(id);
  }, []);
  if (!r || !Object.keys(r.groups).length) return null;
  const l = lang();
  const t = (k: string, fallback: string) => r.labels?.[k]?.[l] ?? fallback;
  const keys = ORDER.filter((k) => r.groups[k]);
  return (
    <div style={panel}>
      <div style={panelHead}><div style={panelTitle}>{t("title", "Blocked buys, scored")}</div><span style={muted}>{t("explain", "")}</span></div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={th} /><th style={{ ...th, ...right }}>{t("fired", "fired")}</th>
            {HORIZONS.map((h) => <th key={h} style={th}>{h} {t("sessions", "sessions")}</th>)}
            <th style={{ ...th, ...right }} title="average of -return after the block over 20 sessions">{t("net", "net for the block")} (20)</th></tr></thead>
          <tbody>{keys.map((k) => {
            const g = r.groups[k];
            const net = g.horizons["20"]?.own?.net;
            return (
              <tr key={k}>
                <td style={cell}>{t(k, k)}<span style={{ ...muted, display: "block" }}>{g.first_day} – {g.last_day}</span></td>
                <td style={{ ...cell, ...right }}>{g.fired}</td>
                {HORIZONS.map((h) => <td key={h} style={cell}>{side(g.horizons[h]?.own) ?? <span style={muted}>{t("unscored", "not scored yet")}</span>}</td>)}
                <td style={{ ...cell, ...right, color: net == null ? undefined : net > 0 ? "#84d6a3" : "#d88383" }}>
                  {net == null ? "—" : `${net > 0 ? "+" : ""}${net.toFixed(2)}%`}</td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
    </div>
  );
};

export default HintScores;
