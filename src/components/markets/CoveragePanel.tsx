import React from "react";
import { fetchCoverage } from "../../api/markets";
import type { Coverage, CoverageCore, CoverageFlag } from "../../api/markets";
import { cell, ghostButton, iconButton, muted, panel, panelHead, panelTitle, pill, right, th } from "./format";

/**
 * Daily coverage check (quant_data tools/coverage_watch.py, 09:20 Irish time). For each core company the
 * articles collected and kept in the last 7 days against its usual week (median of the 8 before); every
 * collected article that was not kept is replayed through the production checks, so a rule fault (the
 * mention gate or a prefilter rule rejecting headlines that name the company) shows as such. Universe
 * companies: the last complete month against the 6 before. Alerts count on the tab's badge; notices
 * (a keep rate that fell, mostly the relevance model being stricter) are only listed.
 */

const LEVEL_COLOR: Record<CoverageFlag["level"], string> = { alert: "#d88383", notice: "#e3b177" };
const pctOf = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);
const day = (d: string) => (d && d.length >= 8 ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : d || "—");

const Weeks: React.FC<{ weeks: [number, number][] }> = ({ weeks }) => {
  const max = Math.max(1, ...weeks.map(([c]) => c));
  return (
    <span style={{ display: "inline-flex", alignItems: "flex-end", gap: 2, height: 22 }}
          title={`Collected / kept per week, oldest first: ${weeks.map(([c, k]) => `${c}/${k}`).join(", ")}`}>
      {weeks.map(([c, k], i) => (
        <span key={i} style={{ position: "relative", width: 6, height: Math.max(2, (c / max) * 22), background: "#434b56", borderRadius: 1 }}>
          <span style={{ position: "absolute", bottom: 0, left: 0, width: 6, height: c ? Math.max(1, (k / c) * Math.max(2, (c / max) * 22)) : 0,
                         background: i === weeks.length - 1 ? "#81dad3" : "#6b8f8b", borderRadius: 1 }} />
        </span>
      ))}
    </span>
  );
};

const CoreRow: React.FC<{ sym: string; r: CoverageCore }> = ({ sym, r }) => {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <tr>
        <td style={cell}><b>{sym}</b><span style={{ ...muted, display: "block" }}>{r.name}</span></td>
        <td style={cell}>
          {r.flags.map((f) => (
            <span key={f.code} style={{ display: "block", marginBottom: 3 }}>
              <span style={pill(LEVEL_COLOR[f.level])}>{f.level}</span> <span style={{ fontSize: 13 }}>{f.text}</span>
            </span>
          ))}
        </td>
        <td style={{ ...cell, ...right }}>{r.collected_7d} <span style={muted}>/ {r.usual_collected}</span></td>
        <td style={{ ...cell, ...right }}>{r.kept_7d} <span style={muted}>/ {r.usual_kept}</span></td>
        <td style={{ ...cell, ...right }}>{pctOf(r.keep_rate_7d)} <span style={muted}>/ {pctOf(r.usual_keep_rate)}</span></td>
        <td style={cell}><Weeks weeks={r.weeks} /></td>
        <td style={{ ...cell, maxWidth: 260 }}>
          {Object.entries(r.why).slice(0, 3).map(([k, n]) => <span key={k} style={{ display: "block", fontSize: 12.5 }}>{k}: <b>{n}</b></span>)}
          <button style={{ ...iconButton, marginLeft: 0, marginTop: 4 }} onClick={() => setOpen(!open)}>{open ? "Hide headlines" : "Headlines"}</button>
        </td>
      </tr>
      {open ? (
        <tr>
          <td colSpan={7} style={{ ...cell, background: "#1d2125" }}>
            <div style={{ ...muted, marginBottom: 4 }}>Collected but not kept, with what rejected each on replay</div>
            {(r.lost || []).map((x, i) => (
              <div key={`l${i}`} style={{ fontSize: 13, margin: "2px 0" }}>
                <span style={{ ...muted, marginRight: 8 }}>{day(x.date)}</span>
                <span style={{ ...pill(x.why === "relevance model" ? "#99a0a8" : "#d88383"), marginRight: 6 }}>{x.why}</span>
                {x.url ? <a href={x.url} target="_blank" rel="noreferrer">{x.title}</a> : x.title}
              </div>
            ))}
            <div style={{ ...muted, margin: "8px 0 4px" }}>Kept</div>
            {(r.kept || []).map((x, i) => (
              <div key={`k${i}`} style={{ fontSize: 13, margin: "2px 0" }}>
                <span style={{ ...muted, marginRight: 8 }}>{day(x.date)}</span>
                {x.url ? <a href={x.url} target="_blank" rel="noreferrer">{x.title}</a> : x.title}
              </div>
            ))}
          </td>
        </tr>
      ) : null}
    </>
  );
};

const CoveragePanel: React.FC = () => {
  const [cov, setCov] = React.useState<Coverage | null>(null);
  const [error, setError] = React.useState("");
  const [showUniverse, setShowUniverse] = React.useState(false);
  const load = React.useCallback(() => {
    fetchCoverage().then((c) => { setCov(c); setError(""); }).catch((e: Error) => setError(e.message));
  }, []);
  React.useEffect(load, [load]);

  const flagged = (cov?.core_flagged || []).filter((s) => cov?.core?.[s]);
  const alerts = new Set(cov?.core_alerts || []);
  const ordered = [...flagged].sort((a, b) => Number(alerts.has(b)) - Number(alerts.has(a)) || a.localeCompare(b));
  const uni = Object.entries(cov?.universe || {});

  return (
    <div style={panel}>
      <div style={panelHead}>
        <div style={panelTitle}>📉 Coverage watch</div>
        <span style={muted}>
          {cov?.asof
            ? `Week ${cov.window?.[0]} – ${cov.window?.[1]} · core: ${alerts.size} alert${alerts.size === 1 ? "" : "s"}, ${flagged.length - alerts.size} notice${flagged.length - alerts.size === 1 ? "" : "s"} of ${Object.keys(cov.core || {}).length} · universe: ${uni.length} of ${cov.universe_checked ?? 0} with a month missing`
            : "No check yet: the first runs at 09:20"}
        </span>
      </div>
      <div style={{ ...muted, marginBottom: 10, lineHeight: 1.5 }}>
        Each core company's articles collected and kept in the last 7 days against its usual week (the median of the 8 before).
        Every article collected but not kept is replayed through the production checks: a <b>rule</b> (the mention gate, a prefilter rule)
        rejecting headlines that name the company is a fault to fix; the <b>relevance model</b> rejecting them is a judgement.
        Alerts: kept or collected below half, nothing kept, a rule fault. Notices: only the keep rate fell.
      </div>
      {error ? <div style={{ color: "#d88383", marginBottom: 8 }}>{error}</div> : null}
      {ordered.length ? (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr>
              <th style={th}>Company</th>
              <th style={th}>What changed</th>
              <th style={{ ...th, ...right }} title="Last 7 days / usual week">Collected</th>
              <th style={{ ...th, ...right }} title="Last 7 days / usual week">Kept</th>
              <th style={{ ...th, ...right }} title="Last 7 days / usual">Keep rate</th>
              <th style={th} title="Collected (grey) and kept (teal) per week, oldest first">9 weeks</th>
              <th style={th}>Why not kept</th>
            </tr></thead>
            <tbody>{ordered.map((s) => <CoreRow key={s} sym={s} r={cov!.core![s]} />)}</tbody>
          </table>
        </div>
      ) : cov?.asof ? <div style={muted}>No core company out of line this week.</div> : null}
      {uni.length ? (
        <div style={{ marginTop: 10 }}>
          <button style={ghostButton} onClick={() => setShowUniverse(!showUniverse)}>
            {showUniverse ? "Hide" : "Show"} universe companies with a month missing ({uni.length})
          </button>
          {showUniverse ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              {uni.map(([s, r]) => (
                <span key={s} style={{ ...pill("#a17edd"), fontWeight: 500 }} title={`${r.name}: ${r.months.join(", ")} a month, oldest first`}>
                  {s} · {r.month}: {r.last_month} (usually {r.usual_month})
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default CoveragePanel;
