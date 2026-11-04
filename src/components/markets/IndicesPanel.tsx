/** Indices and index ETFs the user follows (2026-11-04): moved out of the watchlist into their own module.
 *  The list is picked from the server's catalog and saved there. Quotes (CNBC) arrive with the portfolio state,
 *  so they refresh as often as the holdings (`live`); without it the panel polls every minute itself. */
import React from "react";
import { fetchIndices, setIndexShown } from "../../api/markets";
import type { IndexItem, IndicesState } from "../../api/markets";
import { cell, color, iconButton, muted, num, panel, panelHead, panelTitle, right, signed, sub, th } from "./format";

const IndicesPanel: React.FC<{ live?: IndexItem[] }> = ({ live }) => {
  const [st, setSt] = React.useState<IndicesState | null>(null);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(() => {
    fetchIndices().then((r) => { setSt(r); setError(""); }).catch((e: Error) => setError(e.message));
  }, []);

  const hasLive = live !== undefined;
  React.useEffect(() => {
    load();
    if (hasLive) return undefined;                 // quotes come with the holdings; the catalog once is enough
    const id = window.setInterval(() => { if (document.visibilityState === "visible") load(); }, 60_000);
    return () => window.clearInterval(id);
  }, [load, hasLive]);
  // the portfolio poll's quotes, in the order of the saved list (a just-added one shows from the catalog call)
  const items = st ? st.items.map((i) => (live || []).find((l) => l.symbol === i.symbol) || i) : (live || []);

  const toggle = async (symbol: string, shown: boolean) => {
    setBusy(true);
    try { setSt(await setIndexShown(symbol, shown)); setError(""); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const hidden = (st?.catalog || []).filter((c) => !c.shown);
  const groups = Array.from(new Set(hidden.map((c) => c.group)));

  return (
    <div style={panel}>
      <div style={panelHead}>
        <div style={panelTitle}>📈 Indices · {items.length}</div>
        <span style={muted}>Indices and index ETFs · CNBC, {hasLive ? "refreshed with the holdings" : `every ${st?.refresh_seconds ?? 60} s`}, may be delayed</span>
      </div>
      {error ? <div style={{ ...muted, color: "#e57373" }}>{error}</div> : null}
      {items.length ? (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
            <thead><tr><th style={th}>Index</th><th style={{ ...th, ...right }}>Last</th><th style={{ ...th, ...right }}>Today</th>
              <th style={{ ...th, ...right }}>Prev close</th><th style={th} /></tr></thead>
            <tbody>{items.map((i) => (
              <tr key={i.symbol} title={`${i.full_name || i.name} · ${i.symbol}${i.trade_time ? ` · last ${i.trade_time}` : ""}`}>
                <td style={cell}><b>{i.name}</b><span style={sub}>{i.symbol} · {i.group}</span></td>
                <td style={{ ...cell, ...right }}>{num(i.price)}</td>
                <td style={{ ...cell, ...right, color: color(i.change_pct) }}>
                  <b>{i.change_pct != null ? `${i.change_pct > 0 ? "+" : ""}${i.change_pct.toFixed(2)}%` : "—"}</b>
                  <span style={{ ...sub, color: color(i.change) }}>{i.change != null ? signed(i.change) : ""}</span>
                </td>
                <td style={{ ...cell, ...right }}>{num(i.prev_close)}</td>
                <td style={cell}>
                  <button style={iconButton} disabled={busy} title="Remove from this list" onClick={() => void toggle(i.symbol, false)}>✕</button>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : st ? <div style={muted}>No indices shown. Pick some below.</div> : null}
      {hidden.length ? (
        <div style={{ marginTop: 10 }}>
          <select value="" disabled={busy} onChange={(e) => { if (e.target.value) void toggle(e.target.value, true); }}
                  style={{ padding: "7px 9px", borderRadius: 8, border: "1px solid #4b545f", maxWidth: 420, width: "100%" }}>
            <option value="">+ Add an index…</option>
            {groups.map((g) => (
              <optgroup key={g} label={g}>
                {hidden.filter((c) => c.group === g).map((c) => <option key={c.symbol} value={c.symbol}>{c.name} ({c.symbol})</option>)}
              </optgroup>
            ))}
          </select>
        </div>
      ) : null}
    </div>
  );
};

export default IndicesPanel;
