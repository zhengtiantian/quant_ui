import React from "react";
import { fetchAnalysts } from "../../api/markets";
import type { AnalystDetail, AnalystFirm, AnalystSummary } from "../../api/markets";
import { DOWN, FLAT, UP, cell, muted, pct, pill, right, sub, th, usd } from "./format";

/**
 * Wall Street analysts on one stock (quant_ai markets/analysts.py, 2026-11-11).
 *
 * The table cell shows the consensus target, the upside from the live price, the buy / hold / sell
 * split and, when a firm changed its view in the last 7 days, that change. The expanded row lists
 * every firm once, with its newest rating and target: a new change replaces the firm's line, so the
 * view is always the latest. Firms whose newest change is over a year old are greyed and listed last.
 * Data from Yahoo, refreshed every 30-60 minutes on weekdays; the headline under a line is the
 * article in our news store that reported the change, when there is one.
 */

const BUCKET_COLOR: Record<string, string> = { Buy: UP, Hold: FLAT, Sell: DOWN };
const arrow = (d: number) => (d > 0 ? "▲" : d < 0 ? "▼" : "•");
const dirColor = (d: number) => (d > 0 ? UP : d < 0 ? DOWN : FLAT);
const ago = (iso: string) => {
  const days = Math.floor((Date.now() - Date.parse(`${iso}Z`)) / 86400000);
  return days <= 0 ? "today" : days === 1 ? "1 day ago" : days < 60 ? `${days} days ago` : `${Math.round(days / 30)} months ago`;
};

export const AnalystCell: React.FC<{ s?: AnalystSummary; price?: number | null; open: boolean; onToggle: () => void }> = ({
  s, price, open, onToggle,
}) => {
  if (!s) {
    return <button type="button" onClick={onToggle} style={{ ...pill(FLAT), cursor: "pointer", background: "transparent" }}
                   title="Not fetched yet: open to fetch now">Analysts {open ? "▴" : "▾"}</button>;
  }
  const target = s.target_mean ?? s.target_median;
  const upside = target && price ? (target / price - 1) * 100 : null;
  const n = (s.buy ?? 0) + (s.hold ?? 0) + (s.sell ?? 0);
  return (
    <div style={{ minWidth: 120 }}>
      <button type="button" onClick={onToggle} title="Every firm's rating and price target"
              style={{ background: "transparent", border: 0, padding: 0, cursor: "pointer", color: "inherit", textAlign: "left", font: "inherit" }}>
        <b>{target ? usd(target, 0) : "—"}</b>
        {upside != null ? <span style={{ color: upside >= 0 ? UP : DOWN, marginLeft: 4 }}>{pct(upside)}</span> : null}
        <span style={{ ...muted, marginLeft: 4 }}>{open ? "▴" : "▾"}</span>
      </button>
      {n ? (
        <span style={sub} title={`${s.buy} buy · ${s.hold} hold · ${s.sell} sell`}>
          <span style={{ display: "inline-flex", width: 60, height: 6, borderRadius: 3, overflow: "hidden", verticalAlign: "middle", marginRight: 4 }}>
            <i style={{ flex: s.buy ?? 0, background: UP }} /><i style={{ flex: s.hold ?? 0, background: FLAT }} /><i style={{ flex: s.sell ?? 0, background: DOWN }} />
          </span>
          {s.buy}/{s.hold}/{s.sell}
        </span>
      ) : null}
      {s.latest ? (
        <span style={{ ...sub, color: dirColor(s.latest.direction) }} title={s.latest.text}>
          {arrow(s.latest.direction)} {s.latest.firm} · {ago(s.latest.graded_at)}
        </span>
      ) : s.up_30d || s.down_30d ? (
        <span style={sub} title="Changes in the last 30 days">30d: <span style={{ color: UP }}>▲{s.up_30d}</span> <span style={{ color: DOWN }}>▼{s.down_30d}</span></span>
      ) : null}
    </div>
  );
};

const FirmRow: React.FC<{ f: AnalystFirm }> = ({ f }) => {
  const change = f.target && f.prior_target ? (f.target / f.prior_target - 1) * 100 : null;
  return (
    <tr style={f.stale ? { opacity: 0.5 } : undefined}>
      <td style={cell}><b>{f.firm}</b><span style={sub}>{ago(f.graded_at)} · {f.graded_at.slice(0, 10)}</span></td>
      <td style={cell}>
        {f.rating_bucket ? <span style={pill(BUCKET_COLOR[f.rating_bucket])}>{f.rating_bucket}</span> : null}
        <span style={{ ...muted, marginLeft: 4 }}>{f.rating || "—"}</span>
      </td>
      <td style={{ ...cell, ...right }}>
        <b>{f.target ? usd(f.target, f.target >= 100 ? 0 : 2) : "—"}</b>
        {f.prior_target && f.prior_target !== f.target ? (
          <span style={sub}>from {usd(f.prior_target, f.prior_target >= 100 ? 0 : 2)}
            {change != null ? <span style={{ color: change >= 0 ? UP : DOWN }}> {pct(change)}</span> : null}</span>
        ) : null}
      </td>
      <td style={{ ...cell, whiteSpace: "normal", minWidth: 260 }}>
        <span style={{ color: dirColor(f.direction) }}>{arrow(f.direction)}</span> {f.text}
        {f.news ? (
          <span style={sub}>
            <a href={f.news.url} target="_blank" rel="noreferrer" style={{ color: "#81dad3" }}>{f.news.title}</a>
            {f.news.source ? <span style={muted}> · {f.news.source}</span> : null}
          </span>
        ) : null}
      </td>
    </tr>
  );
};

/** The expanded row. refreshKey is the summary's fetch time: a new fetch reloads the list. */
export const AnalystsPanel: React.FC<{ symbol: string; price?: number | null; refreshKey?: number | null }> = ({ symbol, price, refreshKey }) => {
  const [data, setData] = React.useState<AnalystDetail | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [showStale, setShowStale] = React.useState(false);
  React.useEffect(() => {
    let live = true;
    fetchAnalysts(symbol).then((d) => { if (live) { setData(d); setError(null); } })
      .catch((e: Error) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [symbol, refreshKey]);

  if (error) return <div style={{ color: DOWN }}>Analysts failed to load: {error}</div>;
  if (!data) return <div style={muted}>⏳ Loading analysts…</div>;
  const s = data.summary as AnalystSummary;
  const current = data.firms.filter((f) => !f.stale);
  const stale = data.firms.filter((f) => f.stale);
  const shown = showStale ? data.firms : current;
  const target = s.target_mean ?? s.target_median;
  return (
    <div style={{ padding: "4px 0 8px" }}>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "baseline", marginBottom: 6 }}>
        <span><span style={muted}>Mean target </span><b>{usd(target, 0)}</b>
          {target && price ? <span style={{ color: target >= price ? UP : DOWN }}> {pct((target / price - 1) * 100)}</span> : null}</span>
        <span><span style={muted}>Median </span>{usd(s.target_median, 0)}</span>
        <span><span style={muted}>Range </span>{usd(s.target_low, 0)} – {usd(s.target_high, 0)}</span>
        <span><span style={muted}>Analysts </span>{s.analysts ?? "—"}
          {s.analysts ? <span style={muted}> ({s.buy} buy · {s.hold} hold · {s.sell} sell)</span> : null}</span>
        <span style={{ ...muted, marginLeft: "auto" }}>
          Yahoo · {s.fetched_at ? `updated ${Math.max(0, Math.round((Date.now() / 1000 - s.fetched_at) / 60))} min ago` : "not fetched yet"}
          {s.error ? <span style={{ color: DOWN }} title={s.error}> · last fetch failed</span> : null}
        </span>
      </div>
      {shown.length ? (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr><th style={th}>Firm</th><th style={th}>Rating</th><th style={{ ...th, ...right }}>Target</th><th style={th}>Latest change</th></tr></thead>
          <tbody>{shown.map((f) => <FirmRow key={f.firm} f={f} />)}</tbody>
        </table>
      ) : <div style={muted}>No firm has covered this stock in the last year.</div>}
      {stale.length ? (
        <button type="button" onClick={() => setShowStale(!showStale)}
                style={{ marginTop: 6, background: "transparent", border: 0, padding: 0, color: "#81dad3", cursor: "pointer", fontSize: 12 }}>
          {showStale ? "Hide" : "Show"} {stale.length} firms with no change in over a year {showStale ? "▴" : "▾"}
        </button>
      ) : null}
    </div>
  );
};
