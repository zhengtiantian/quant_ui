/** Asian and European markets: region -> country (foldable card) -> exchange -> indices and stocks. */
import React from "react";
import type { GlobalItem, GlobalState } from "../../api/markets";
import Flag from "./Flag";
import { cell, color, muted, num, panel, panelHead, panelTitle, pill, right } from "./format";

const FOLD_KEY = "globalMarketsFolded";
const loadFolded = (): string[] => {
  try { return JSON.parse(localStorage.getItem(FOLD_KEY) || "[]"); } catch { return []; }
};

const Row: React.FC<{ i: GlobalItem; bold: boolean }> = ({ i, bold }) => (
  <tr title={`${i.full_name || i.name} · ${i.symbol}${i.trade_time ? ` · last ${i.trade_time}` : ""}`}>
    <td style={{ ...cell, padding: "3px 6px", fontWeight: bold ? 600 : 400 }}>{i.name}</td>
    <td style={{ ...cell, ...right, padding: "3px 6px", fontWeight: bold ? 600 : 400 }}>
      {num(i.price)} <span style={{ fontSize: 11, color: "#64748b" }}>{i.currency || ""}</span>
    </td>
    <td style={{ ...cell, ...right, padding: "3px 6px", fontWeight: 600, color: color(i.change_pct) }}>
      {i.change_pct != null ? `${i.change_pct > 0 ? "+" : ""}${i.change_pct.toFixed(2)}%` : "—"}
    </td>
  </tr>
);

const GlobalMarkets: React.FC<{ g: GlobalState | undefined }> = ({ g }) => {
  const [folded, setFolded] = React.useState<string[]>(loadFolded);
  if (!g || !g.regions.length) return null;
  const toggle = (code: string) => {
    const next = folded.includes(code) ? folded.filter((c) => c !== code) : [...folded, code];
    setFolded(next);
    try { localStorage.setItem(FOLD_KEY, JSON.stringify(next)); } catch { /* per-viewer convenience only */ }
  };
  return (
    <div style={panel}>
      <div style={panelHead}>
        <div style={panelTitle}>🌐 Global markets</div>
        <span style={muted}>
          {g.refreshing ? "Updating… " : g.any_open
            ? `Open exchanges refresh every ${g.refresh_seconds} s; closed ones keep their last close`
            : "All these exchanges are closed, showing last closes"} · CNBC, Korean stocks from Naver; may be delayed
        </span>
      </div>
      {g.regions.map((r) => (
        <div key={r.name}>
          <div style={{ fontWeight: 700, margin: "10px 0 8px" }}>{r.name === "Asia" ? "🌏" : "🌍"} {r.name}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))", gap: 12, alignItems: "start" }}>
            {r.countries.map((c) => {
              const isFolded = folded.includes(c.code);
              return (
                <div key={c.code} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "8px 12px", background: "#fff" }}>
                  <div onClick={() => toggle(c.code)} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                       title="Click to fold or unfold">
                    <span style={{ fontSize: 18 }}><Flag code={c.code} emoji={c.flag} size={16} /></span><b>{c.name}</b>
                    {c.open ? <span style={pill("#15803d")}>Open</span> : null}
                    <span style={{ marginLeft: "auto", color: "#94a3b8" }}>{isFolded ? "▸" : "▾"}</span>
                  </div>
                  {isFolded ? null : c.exchanges.map((e) => (
                    <div key={e.code} style={{ marginTop: 8 }}>
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600 }}>
                        <span>{e.name}</span>
                        <span style={pill(e.open ? "#15803d" : "#64748b")}>{e.open ? "Open" : "Closed"}</span>
                        <span style={{ ...muted, fontWeight: 400 }}>local {e.local_time} · hours {e.hours}</span>
                      </div>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <tbody>
                          {e.indices.map((i) => <Row key={i.symbol} i={i} bold />)}
                          {e.stocks.map((i) => <Row key={i.symbol} i={i} bold={false} />)}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default GlobalMarkets;
