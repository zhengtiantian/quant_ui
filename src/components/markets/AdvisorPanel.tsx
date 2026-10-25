import React from "react";
import { fetchAdvisor, fetchBrief, runBrief } from "../../api/markets";
import type { AdviceOrder, AdvisorReport, AdvisorState, Brief, Holding } from "../../api/markets";
import Markdown from "./Markdown";
import { DOWN, UP, cell, ghostButton, muted, panel, panelHead, panelTitle, pill, right, sub, th, usd } from "./format";

/**
 * The holdings advisor (PROJECT_PLAN Q.5) inside My Holdings: the newest report, the limit orders it
 * recommends and how earlier ones played out. Reports come from quant_ai: a full one every weekday at
 * 13:00 Dublin, and a focused update whenever its 15-minute check finds a reason (a move beyond the
 * stock's own threshold, an advised limit reached, earnings tomorrow or just out, important news).
 * Advice only: nothing here places an order.
 *
 * "New" is per browser: the newest report this viewer has opened is remembered in localStorage.
 */

const store = {
  get: (k: string, d: string) => { try { return localStorage.getItem(k) || d; } catch { return d; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* per-viewer convenience only */ } },
};
const SEEN_KEY = "advisorSeenUntil";
const REASON_LABEL: Record<string, string> = {
  move: "Big move", limit: "Limit reached", earnings_prep: "Earnings tomorrow", earnings_out: "Earnings out", news: "News", manual: "Asked by hand",
};
const STATUS_STYLE: Record<string, string> = { open: "#2563eb", waiting: "#a16207", filled: "#0f766e", scored: "#15803d", expired: "#94a3b8", void: "#94a3b8" };
const when = (ts: number | null) => (ts ? new Date(ts * 1000).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "");

const size = (o: AdviceOrder) =>
  o.pct != null ? `${o.pct}% of position` : o.shares != null ? `${o.shares} sh` : o.amount_usd != null ? usd(o.amount_usd, 0) : "—";

const OrdersTable: React.FC<{ orders: AdviceOrder[]; holdings: Holding[]; lang: "zh" | "en"; scored?: boolean }> = ({ orders, holdings, lang, scored }) => {
  const price = (sym: string) => holdings.find((h) => h.symbol === sym)?.quote?.price ?? null;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead><tr>
          <th style={th}>Order</th><th style={{ ...th, ...right }}>Limit</th><th style={{ ...th, ...right }}>{scored ? "Result" : "Now"}</th>
          <th style={th}>Size</th><th style={th}>Valid until</th><th style={th}>Status</th><th style={th}>Why</th>
        </tr></thead>
        <tbody>{orders.map((o) => {
          const now = price(o.symbol);
          const gap = now && o.limit_price ? (o.limit_price / now - 1) * 100 : null;
          return (
            <tr key={o.id}>
              <td style={{ ...cell, whiteSpace: "nowrap" }}>
                <span style={pill(o.side === "sell" ? DOWN : UP)}>{o.side.toUpperCase()}</span> <b>{o.symbol}</b>
                <span style={sub}>#{o.id} · {o.tag}</span>
              </td>
              <td style={{ ...cell, ...right }}><b>{usd(o.limit_price)}</b></td>
              <td style={{ ...cell, ...right }}>
                {scored
                  ? (o.edge_pct != null ? <b style={{ color: o.edge_pct >= 0 ? UP : DOWN }}>{o.edge_pct >= 0 ? "+" : ""}{o.edge_pct.toFixed(1)}%</b> : "—")
                  : now != null ? <>{usd(now)}{gap != null ? <span style={sub}>{gap >= 0 ? "+" : ""}{gap.toFixed(1)}% away</span> : null}</> : "—"}
              </td>
              <td style={cell}>{size(o)}</td>
              <td style={{ ...cell, whiteSpace: "nowrap" }}>{o.valid_until}</td>
              <td style={cell}><span style={pill(STATUS_STYLE[o.status] || "#64748b")}>{o.status}</span>
                {o.status === "waiting" && o.parent_id ? <span style={sub}>after #{o.parent_id} fills</span> : null}
                {o.status === "void" && o.parent_id ? <span style={sub}>#{o.parent_id} never filled</span> : null}
                {o.filled_date ? <span style={sub}>reached {o.filled_date}</span> : null}</td>
              <td style={{ ...cell, minWidth: 220 }}>{(lang === "zh" ? o.zh : o.en) || o.en || o.zh}
                {o.note ? <span style={sub}>{o.note}</span> : null}</td>
            </tr>
          );
        })}</tbody>
      </table>
    </div>
  );
};

const AdvisorPanel: React.FC<{ holdings: Holding[] }> = ({ holdings }) => {
  const [state, setState] = React.useState<AdvisorState | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<number | null>(null);
  const [brief, setBrief] = React.useState<Brief | null>(null);
  const [lang, setLang] = React.useState<"zh" | "en">(() => (store.get("briefLang", "zh") === "en" ? "en" : "zh"));
  const [seenUntil, setSeenUntil] = React.useState(() => Number(store.get(SEEN_KEY, "0")));
  const [asking, setAsking] = React.useState(false);

  const load = React.useCallback(async () => {
    try { setState(await fetchAdvisor()); setError(null); } catch (e) { setError((e as Error).message); }
  }, []);
  React.useEffect(() => {
    void load();
    const id = window.setInterval(() => { if (!document.hidden) void load(); }, 60_000);
    return () => window.clearInterval(id);
  }, [load]);

  const done = (state?.reports || []).filter((r) => r.status === "done");
  const shown = selected ?? done[0]?.id ?? null;
  React.useEffect(() => {
    if (shown == null) { setBrief(null); return; }
    let live = true;
    fetchBrief(shown).then((b) => live && setBrief(b)).catch((e) => live && setError((e as Error).message));
    return () => { live = false; };
  }, [shown, state?.reports?.[0]?.finished_at]);

  // Opening a report marks it, and everything older, as seen.
  React.useEffect(() => {
    const r = done.find((x) => x.id === shown);
    if (r?.finished_at && r.finished_at > seenUntil) { setSeenUntil(r.finished_at); store.set(SEEN_KEY, String(r.finished_at)); }
  }, [shown, done, seenUntil]);

  const ask = async () => {
    setAsking(true);
    try { await runBrief("advisor"); await load(); } catch (e) { setError((e as Error).message); } finally { setAsking(false); }
  };

  const unseen = done.filter((r) => (r.finished_at || 0) > seenUntil);
  const urgent = unseen.filter((r) => r.urgent);
  const meta = done.find((r) => r.id === shown);
  const body = brief ? (lang === "zh" ? brief.body_zh : brief.body_en) : null;
  const card = state?.scorecard;
  const running = !!state?.running || (state?.reports || []).some((r) => r.status === "running");

  return (
    <div style={{ ...panel, borderColor: urgent.length ? "#fca5a5" : undefined }}>
      <div style={panelHead}>
        <div style={panelTitle}>🧭 Holdings advisor
          {unseen.length ? <span style={{ ...pill(urgent.length ? DOWN : "#2563eb"), marginLeft: 8 }}>{unseen.length} new</span> : null}
        </div>
        <span style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <span style={muted}>Full report weekdays 13:00 Dublin · updates when something moves · advice only</span>
          {(["zh", "en"] as const).map((l) => (
            <button key={l} onClick={() => { setLang(l); store.set("briefLang", l); }}
                    style={{ ...ghostButton, padding: "3px 10px", background: lang === l ? "#0f766e" : "#fff", color: lang === l ? "#fff" : "#0f766e" }}>
              {l === "zh" ? "中文" : "English"}</button>
          ))}
          <button style={ghostButton} disabled={asking || !!running} onClick={() => void ask()}>{running ? "Writing…" : "Run now"}</button>
        </span>
      </div>

      {error ? <div style={{ color: DOWN, fontSize: 13, marginBottom: 8 }}>{error}</div> : null}
      {urgent.length ? (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", borderRadius: 8, padding: "8px 12px", marginBottom: 10, fontSize: 13.5 }}>
          ⚠️ Urgent: {urgent.map((r) => (
            <a key={r.id} href="#" style={{ color: "#991b1b", fontWeight: 700, marginRight: 10 }} onClick={(e) => { e.preventDefault(); setSelected(r.id); }}>
              {r.symbol || "All"} · {r.reasons.map((x) => REASON_LABEL[x.kind] || x.kind).join(", ")} ({when(r.finished_at)})</a>
          ))}
        </div>
      ) : null}

      {!state ? <div style={muted}>⏳ Loading advice…</div>
        : !done.length ? <div style={muted}>No report yet. The first full report is written at 13:00 Dublin on the next weekday, or press Run now.</div>
        : (
          <>
            {meta ? (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 15.5 }}>{lang === "zh" ? meta.headline_zh : meta.headline_en}</div>
                <div style={muted}>{meta.symbol ? `Update on ${meta.symbol}` : "Full report"} · {when(meta.finished_at)}
                  {meta.reasons.length ? ` · ${meta.reasons.map((x) => x.text).join(" · ")}` : ""}</div>
              </div>
            ) : null}

            {state.orders.length ? (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 700, margin: "6px 0" }}>Orders in play · {state.orders.length}</div>
                <OrdersTable orders={state.orders} holdings={holdings} lang={lang} />
              </div>
            ) : <div style={{ ...muted, marginBottom: 10 }}>No open orders: the latest advice is to wait.</div>}

            <details open={unseen.length > 0}>
              <summary style={{ cursor: "pointer", fontWeight: 700 }}>Report</summary>
              <div style={{ marginTop: 6 }}>{body ? <Markdown text={body} /> : <span style={muted}>⏳ Loading report…</span>}</div>
              {brief?.sources?.length ? (
                <div style={{ ...muted, marginTop: 6 }}>Sources: {brief.sources.slice(0, 12).map((x, i) =>
                  <a key={i} href={x.url} target="_blank" rel="noreferrer" style={{ marginRight: 8 }}>{x.title}</a>)}</div>
              ) : null}
            </details>

            <details style={{ marginTop: 8 }}>
              <summary style={{ cursor: "pointer", ...muted }}>Earlier reports · {done.length}</summary>
              <div style={{ display: "grid", gap: 4, marginTop: 6 }}>
                {done.map((r: AdvisorReport) => (
                  <a key={r.id} href="#" onClick={(e) => { e.preventDefault(); setSelected(r.id); }}
                     style={{ fontSize: 13, fontWeight: r.id === shown ? 700 : 400, color: r.urgent ? DOWN : undefined }}>
                    {when(r.finished_at)} · {r.symbol || "Full report"} · {lang === "zh" ? r.headline_zh : r.headline_en}
                    {(r.finished_at || 0) > seenUntil ? " ●" : ""}
                  </a>
                ))}
              </div>
            </details>

            {card && card.recent.some((o) => o.status === "scored" || o.status === "expired") ? (
              <details style={{ marginTop: 8 }}>
                <summary style={{ cursor: "pointer", ...muted }}>
                  Track record · {card.finished} finished · reached {card.fill_rate != null ? `${Math.round(card.fill_rate * 100)}%` : "—"} ·
                  {" "}acting beat waiting {card.win_rate != null ? `${Math.round(card.win_rate * 100)}%` : "—"} of the time ·
                  {" "}mean {card.mean_edge_pct != null ? `${card.mean_edge_pct >= 0 ? "+" : ""}${card.mean_edge_pct}%` : "—"}
                </summary>
                <OrdersTable orders={card.recent.filter((o) => o.status === "scored" || o.status === "expired")} holdings={holdings} lang={lang} scored />
              </details>
            ) : null}
          </>
        )}
    </div>
  );
};

export default AdvisorPanel;
