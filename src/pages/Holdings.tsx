import React from "react";
import {
  addWatch,
  deleteTransaction,
  fetchChart,
  fetchPortfolio,
  removeWatch,
  saveTransaction,
  setCash,
} from "../api/markets";
import type { ChartData, Holding, PerStockCatalysts, PortfolioState, Side, Transaction, WatchItem } from "../api/markets";
import AdvisorPanel from "../components/markets/AdvisorPanel";
import CatalystsPanel, { StockCatalystButton } from "../components/markets/CatalystsPanel";
import GlobalMarkets from "../components/markets/GlobalMarkets";
import PriceChart from "../components/markets/PriceChart";
import {
  DOWN, SESSION_COLOR, SESSION_LABEL, UP, cell, color, ghostButton, iconButton, muted, panel, panelHead, panelTitle,
  pct, pill, qty, right, shortName, signed, sub, th, usd,
} from "../components/markets/format";

/**
 * The user's own portfolio (moved from job_agent's dashboard into quant_ai on 2026-10-22).
 *
 * Trades are the source of truth: holdings, both average costs (the user's rule, where a sale
 * leaves the average unchanged, and FIFO, the Irish CGT basis) and P&L are derived server-side
 * from them. Prices come from Nasdaq including pre-market and after hours. The page polls at
 * the pace the server sends (5 s in any session from 10:00 to 22:00 Dublin, otherwise 5 s regular /
 * 30 s pre and after hours, not at all while closed) and only while it is visible; the server answers from stored quotes at once and refreshes them in the
 * background, so "refreshing" means "look again in 2 s".
 */

const PALETTE = ["#0891b2", "#9333ea", "#d97706", "#059669", "#dc2626", "#2563eb", "#db2777", "#65a30d", "#ea580c", "#0d9488"];
const RANGES: [string, string][] = [["1d", "1D (5 min)"], ["1m", "1M"], ["3m", "3M"], ["6m", "6M"], ["1y", "1Y"], ["5y", "5Y"]];
const TX_COLOR: Record<string, string> = { buy: "#15803d", sell: "#b91c1c", dividend: "#0891b2", fee: "#64748b" };

const store = {
  get: (k: string, d: string) => { try { return localStorage.getItem(k) || d; } catch { return d; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* per-viewer convenience only */ } },
};

const newRequestId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
const todayLocal = () => {
  const d = new Date(), p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

// ------------------------------------------------------------------ small pieces

const Kpi: React.FC<{ label: string; main: React.ReactNode; sub?: React.ReactNode; tint?: string }> = ({ label, main, sub: s, tint }) => (
  <div style={{ ...panel, marginBottom: 0, padding: "12px 14px" }}>
    <div style={{ ...muted, textTransform: "uppercase", letterSpacing: "0.04em", fontSize: 11.5 }}>{label}</div>
    <div style={{ fontSize: 22, fontWeight: 800, color: tint, fontVariantNumeric: "tabular-nums", margin: "2px 0" }}>{main}</div>
    {s ? <div style={{ ...muted, lineHeight: 1.5 }}>{s}</div> : null}
  </div>
);

const Tag: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={{ fontSize: 10.5, color: "#475569", background: "#f1f5f9", borderRadius: 4, padding: "0 4px", marginRight: 4 }}>{children}</span>
);

const PriceCell: React.FC<{ q: Holding["quote"] }> = ({ q }) => {
  if (q.price == null && q.pending) return <span style={muted}>⏳ Loading quote…</span>;
  if (q.price == null && /not found/i.test(q.error || "")) return <span style={{ color: DOWN }}>Symbol not found, check the spelling</span>;
  if (q.price == null) return <span style={{ color: DOWN }} title={q.error}>No quote</span>;
  const ext = q.session === "pre" || q.session === "post";
  return (
    <div>
      <b>{usd(q.price)}</b>{" "}
      {q.session ? <span style={pill(SESSION_COLOR[q.session] || "#64748b")}>{SESSION_LABEL[q.session] || q.session}</span> : null}
      {q.stale ? <span style={{ ...pill("#be123c"), marginLeft: 4 }}>Stale quote</span> : null}
      {ext && q.regular_price ? (
        <span style={sub}>Close {usd(q.regular_price)}
          {q.session_change_pct != null ? <> · {SESSION_LABEL[q.session!]} <span style={{ color: color(q.session_change) }}>{pct(q.session_change_pct)}</span></> : null}
        </span>
      ) : null}
    </div>
  );
};

// Cash available to invest, entered by hand: the holdings advisor sizes its buy ideas with it.
const CashKpi: React.FC<{ cash: number; onSaved: (s: PortfolioState) => void; onError: (m: string) => void }> = ({ cash, onSaved, onError }) => {
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState(String(cash));
  const save = async () => {
    const v = parseFloat(value);
    if (!(v >= 0)) { onError("Cash must be a number of 0 or more"); return; }
    try { onSaved((await setCash(v)).state); setEditing(false); } catch (e) { onError((e as Error).message); }
  };
  return (
    <Kpi label="Cash available"
         main={editing ? (
           <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
             <input id="cash-input" type="number" step="any" min="0" value={value} autoFocus onChange={(e) => setValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") void save(); if (e.key === "Escape") setEditing(false); }}
                    style={{ width: 130, padding: "4px 8px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 16 }} />
             <button style={{ ...ghostButton, padding: "3px 10px" }} onClick={() => void save()}>Save</button>
           </span>
         ) : <>{usd(cash)} <button style={iconButton} title="Edit" onClick={() => { setValue(String(cash)); setEditing(true); }}>✎</button></>}
         sub="Entered by hand · used by the advisor to size buys" />
  );
};

// ------------------------------------------------------------------ the trade form

interface FormState {
  id?: number; trade_date: string; symbol: string; side: Side; price: string; quantity: string; amount: string;
  fee: string; note: string; entry_mode: "quantity" | "amount";
}

const TradeModal: React.FC<{
  initial: FormState; state: PortfolioState; onClose: () => void; onSaved: (s: PortfolioState, msg: string, err?: boolean) => void;
}> = ({ initial, state, onClose, onSaved }) => {
  const [f, setF] = React.useState<FormState>(initial);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const requestId = React.useRef(newRequestId());      // one id per form instance: a double submit stores one row
  const set = (k: keyof FormState, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));
  const trade = f.side === "buy" || f.side === "sell";
  const byAmount = trade && f.entry_mode === "amount";
  const price = parseFloat(f.price);
  const shares = byAmount ? parseFloat(f.amount) / price : parseFloat(f.quantity);
  const held = state.holdings.find((h) => h.symbol === f.symbol.trim().toUpperCase());
  let preview: React.ReactNode = null;
  if (trade && price > 0 && shares > 0) {
    const profit = f.side === "sell" && held ? shares * (price - held.avg_cost) - (parseFloat(f.fee) || 0) : null;
    preview = (
      <>
        {byAmount ? `≈ ${qty(shares)} shares` : `Total ${usd(shares * price)}`}
        {profit != null ? <> · at avg cost {usd(held!.avg_cost)}, expected profit <b style={{ color: profit >= 0 ? UP : DOWN }}>{signed(profit)}</b></> : null}
      </>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (trade) store.set("pfEntryMode", f.entry_mode);
      const r = await saveTransaction({
        id: f.id ? String(f.id) : "", request_id: f.id ? "" : requestId.current, trade_date: f.trade_date,
        symbol: f.symbol, side: f.side, price: f.price, quantity: f.quantity, amount: f.amount, entry_mode: f.entry_mode,
        fee: f.fee, note: f.note,
      });
      onSaved(r.state, "Saved");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  const field: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 3, fontSize: 13, color: "#334155", marginBottom: 10 };
  const input: React.CSSProperties = { padding: "7px 9px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14 };
  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
         style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.35)", display: "grid", placeItems: "center", zIndex: 50 }}>
      <form onSubmit={submit} style={{ ...panel, width: "min(440px, 92vw)", maxHeight: "92vh", overflow: "auto", marginBottom: 0 }}>
        <div style={{ ...panelHead }}><div style={panelTitle}>{f.id ? "Edit trade" : "Add a trade"}</div>
          <button type="button" style={iconButton} onClick={onClose}>✕</button></div>
        <label style={field}>Date<input style={input} type="date" required value={f.trade_date} onChange={(e) => set("trade_date", e.target.value)} /></label>
        <label style={field}>Symbol<input style={{ ...input, textTransform: "uppercase" }} required placeholder="e.g. NVDA, VOO"
                                          value={f.symbol} onChange={(e) => set("symbol", e.target.value)} /></label>
        <label style={field}>Type
          <select style={input} value={f.side} onChange={(e) => set("side", e.target.value)}>
            {(Object.entries(state.tx_types) as [Side, string][]).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select></label>
        <label style={field}>{trade ? "Price (USD / share)" : "Amount (USD)"}
          <input style={input} type="number" step="any" min="0" required value={f.price} onChange={(e) => set("price", e.target.value)} /></label>
        {trade ? (
          <div style={{ ...field, flexDirection: "row", gap: 14, alignItems: "center" }}>
            <span>Enter by</span>
            <label><input type="radio" checked={f.entry_mode === "quantity"} onChange={() => set("entry_mode", "quantity")} /> Shares</label>
            <label><input type="radio" checked={f.entry_mode === "amount"} onChange={() => set("entry_mode", "amount")} /> Amount spent</label>
          </div>
        ) : null}
        {trade && !byAmount ? (
          <label style={field}>Shares (fractions allowed)
            <input style={input} type="number" step="any" min="0" required value={f.quantity} onChange={(e) => set("quantity", e.target.value)} /></label>
        ) : null}
        {byAmount ? (
          <label style={field}>Amount (USD, excluding fee)
            <input style={input} type="number" step="any" min="0" required value={f.amount} onChange={(e) => set("amount", e.target.value)} /></label>
        ) : null}
        {preview ? <div style={{ ...muted, margin: "-4px 0 10px" }}>{preview}</div> : null}
        <label style={field}>Fee (USD, optional)<input style={input} type="number" step="any" min="0" value={f.fee} onChange={(e) => set("fee", e.target.value)} /></label>
        <label style={field}>Note (optional)<input style={input} value={f.note} onChange={(e) => set("note", e.target.value)} /></label>
        {error ? <div style={{ color: DOWN, fontSize: 13, marginBottom: 8 }}>{error}</div> : null}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" style={ghostButton} onClick={onClose}>Cancel</button>
          <button type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </div>
  );
};

// ------------------------------------------------------------------ the chart

const ChartModal: React.FC<{ symbol: string; state: PortfolioState; onClose: () => void; onOpenEvents: (sym: string) => void }> = ({ symbol, state, onClose, onOpenEvents }) => {
  const [range, setRange] = React.useState(() => store.get("pfChartRange", "6m"));
  const [type, setType] = React.useState<"line" | "candle">(() => (store.get("pfChartType", "line") === "candle" ? "candle" : "line"));
  const [data, setData] = React.useState<ChartData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    let live = true;
    setData(null);
    setError(null);
    fetchChart(symbol, range).then((d) => live && setData(d)).catch((e) => live && setError((e as Error).message));
    return () => { live = false; };
  }, [symbol, range]);
  React.useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);
  const row: Holding | WatchItem | undefined = state.holdings.find((h) => h.symbol === symbol) || state.watchlist.find((w) => w.symbol === symbol);
  const q = row?.quote || {};
  const chg = q.price != null && q.prev_close ? q.price - q.prev_close : null;
  const held = row && "quantity" in row ? (row as Holding) : null;
  const seg = (on: boolean): React.CSSProperties => ({ ...ghostButton, padding: "3px 10px", background: on ? "#0f766e" : "#fff", color: on ? "#fff" : "#0f766e" });
  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
         style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.35)", display: "grid", placeItems: "center", zIndex: 50 }}>
      <div style={{ ...panel, width: "min(860px, 96vw)", marginBottom: 0 }}>
        <div style={panelHead}>
          <div><span style={{ fontSize: 20, fontWeight: 800 }}>{symbol}</span> <span style={muted}>{shortName(q.name)}</span></div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button style={{ ...ghostButton, padding: "3px 10px", fontSize: 12.5, borderRadius: 8 }} onClick={() => { onClose(); onOpenEvents(symbol); }}>🔭 未来事件</button>
            <button style={iconButton} onClick={onClose} title="Close (Esc)">✕</button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap", marginBottom: 8 }}>
          <b style={{ fontSize: 18 }}>{usd(q.price)}</b>
          {chg != null ? <span style={{ color: color(chg) }}>{signed(chg)} ({pct(chg / q.prev_close! * 100)})</span> : null}
          {q.session ? <span style={pill(SESSION_COLOR[q.session])}>{SESSION_LABEL[q.session]}</span> : null}
          {q.regular_price && (q.session === "pre" || q.session === "post") ? <span style={muted}>Close {usd(q.regular_price)}</span> : null}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          {RANGES.map(([k, l]) => <button key={k} style={seg(k === range)} onClick={() => { setRange(k); store.set("pfChartRange", k); }}>{l}</button>)}
          <span style={{ width: 12 }} />
          {(["line", "candle"] as const).map((k) => (
            <button key={k} style={seg(k === type)} onClick={() => { setType(k); store.set("pfChartType", k); }}>{k === "line" ? "Line" : "Candles"}</button>
          ))}
        </div>
        {error ? <div style={{ color: DOWN, padding: 30 }}>{error}</div>
          : !data ? <div style={{ ...muted, padding: 40 }}>⏳ Loading chart…</div>
          : <PriceChart candles={data.candles} type={type} prevClose={range === "1d" ? data.prev_close : null} intraday={range === "1d"} />}
        {data?.stale ? <div style={muted}>Nasdaq did not answer; showing the last stored chart.</div> : null}
        {held ? (
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 8, fontSize: 13.5 }}>
            <span>Shares <b>{qty(held.quantity)}</b></span>
            <span>Avg cost <b>{usd(held.avg_cost)}</b> <span style={muted}>FIFO {usd(held.fifo_avg_cost)}</span></span>
            <span>Market value <b>{usd(held.market_value)}</b></span>
            <span>Unrealised <b style={{ color: color(held.unrealized) }}>{signed(held.unrealized)} {pct(held.unrealized_pct)}</b></span>
          </div>
        ) : <div style={{ ...muted, marginTop: 8 }}>Watchlist, not held</div>}
      </div>
    </div>
  );
};

// ------------------------------------------------------------------ the page

const Holdings: React.FC = () => {
  const [s, setS] = React.useState<PortfolioState | null>(null);
  const [loadedAt, setLoadedAt] = React.useState(0);
  const [nextAt, setNextAt] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<{ msg: string; err?: boolean } | null>(null);
  const [form, setForm] = React.useState<FormState | null>(null);
  const [chart, setChart] = React.useState<string | null>(null);
  const [catalystModal, setCatalystModal] = React.useState<string | null>(null);
  const [catalystMap, setCatalystMap] = React.useState<Record<string, PerStockCatalysts>>({});
  const [catalystLang, setCatalystLang] = React.useState<"zh" | "en">("zh");
  const handleCatalystSummary = React.useCallback((m: Record<string, PerStockCatalysts>, l: "zh" | "en") => {
    setCatalystMap(m);
    setCatalystLang(l);
  }, []);
  const [filter, setFilter] = React.useState("");
  const [watchInput, setWatchInput] = React.useState("");
  const [, setTick] = React.useState(0);
  const timer = React.useRef<number | undefined>(undefined);

  const flash = (msg: string, err = false) => {
    setToast({ msg, err });
    window.setTimeout(() => setToast(null), err ? 6000 : 2500);
  };
  const apply = (st: PortfolioState) => { setS(st); setLoadedAt(Date.now()); setError(null); };

  const load = React.useCallback(async (force = false) => {
    try {
      apply(await fetchPortfolio(force));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  // Poll at the session's pace; the global markets keep a minute's pace while any exchange is open.
  React.useEffect(() => {
    if (!s) return;
    window.clearTimeout(timer.current);
    const g = s.global;
    let wait = s.refreshing || g?.refreshing ? 2 : (s.refresh_seconds || s.next_session_in || 3600);
    if (g?.refresh_seconds) wait = Math.min(wait, g.refresh_seconds);
    setNextAt(Date.now() + wait * 1000);
    timer.current = window.setTimeout(() => { if (!document.hidden) void load(); }, Math.min(wait, 86400) * 1000);
    return () => window.clearTimeout(timer.current);
  }, [s, load]);

  React.useEffect(() => {
    const onVis = () => { if (!document.hidden) void load(); };
    document.addEventListener("visibilitychange", onVis);
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => { document.removeEventListener("visibilitychange", onVis); window.clearInterval(id); };
  }, [load]);

  if (!s) return <div style={panel}>{error ? <span style={{ color: DOWN }}>Failed to load: {error}</span> : "⏳ Loading portfolio…"}</div>;

  const t = s.totals;
  const colors = Object.fromEntries(s.holdings.map((h, i) => [h.symbol, PALETTE[i % PALETTE.length]]));
  const cny = (v: number) => (s.usd_cny ? `≈ ¥${Math.round(v * s.usd_cny).toLocaleString()}` : "");
  const realized = t.realized + t.dividends;
  const fetched = Math.max(0, ...s.holdings.map((h) => h.quote?.fetched_at || 0));
  const age = fetched ? Math.max(0, Math.round(s.server_time + (Date.now() - loadedAt) / 1000 - fetched)) : null;
  const nextIn = Math.max(0, Math.round((nextAt - Date.now()) / 1000));
  const nextText = s.refreshing ? "Updating quotes…"
    : s.refresh_seconds ? `${nextIn} s until refresh`
    : s.global?.refresh_seconds ? `US closed · global markets refresh in ${nextIn} s`
    : `Market closed, no refresh; resumes at pre-market in ${Math.floor(nextIn / 3600)} h ${Math.round((nextIn % 3600) / 60)} m`;
  const txs = filter ? s.transactions.filter((x) => x.symbol === filter) : s.transactions;

  const editTx = (tx: Transaction | null, preset = "") => setForm(tx ? {
    id: tx.id, trade_date: tx.trade_date, symbol: tx.symbol, side: tx.side, price: String(tx.price), quantity: tx.quantity ? String(tx.quantity) : "",
    amount: "", fee: tx.fee ? String(tx.fee) : "", note: tx.note || "", entry_mode: "quantity",
  } : {
    trade_date: todayLocal(), symbol: preset || filter, side: "buy", price: "", quantity: "", amount: "", fee: "", note: "",
    entry_mode: store.get("pfEntryMode", "quantity") === "amount" ? "amount" : "quantity",
  });
  const delTx = async (tx: Transaction) => {
    if (!window.confirm(`Delete this trade?\n${tx.trade_date} ${tx.symbol} ${tx.quantity || ""} @ ${tx.price}`)) return;
    try { apply((await deleteTransaction(tx.id)).state); flash("Deleted"); } catch (e) { flash((e as Error).message, true); }
  };
  const watch = async () => {
    const sym = watchInput.trim();
    if (!sym) return;
    try {
      const r = await addWatch(sym);
      apply(r.state); setWatchInput(""); flash(`Added to watchlist: ${r.symbol}`);
      void load();                          // the new symbol's quote is fetched in the background
    } catch (e) { flash((e as Error).message, true); }
  };
  const unwatch = async (sym: string) => {
    try { apply((await removeWatch(sym)).state); } catch (e) { flash((e as Error).message, true); }
  };

  const txTable = (list: Transaction[]) => (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
        <thead><tr>{["Date", "Symbol", "Type", "Qty", "Price / amount", "Total", "Fee", "Avg cost", "Realised", "Note", ""].map((h, i) =>
          <th key={h + i} style={{ ...th, ...(i >= 3 && i <= 8 ? right : {}) }}>{h}</th>)}</tr></thead>
        <tbody>{list.map((x) => {
          const total = x.side === "buy" || x.side === "sell" ? x.quantity * x.price : x.price;
          return (
            <tr key={x.id}>
              <td style={cell}>{x.trade_date}</td><td style={cell}><b>{x.symbol}</b></td>
              <td style={cell}><span style={pill(TX_COLOR[x.side])}>{s.tx_types[x.side] || x.side}</span>
                {x.budget_entry_id ? <span style={{ ...muted, marginLeft: 4 }} title="Profit recorded in the budget stock item">→budget</span> : null}</td>
              <td style={{ ...cell, ...right }}>{x.quantity ? qty(x.quantity) : "—"}</td>
              <td style={{ ...cell, ...right }}>{usd(x.price)}</td><td style={{ ...cell, ...right }}>{usd(total)}</td>
              <td style={{ ...cell, ...right }}>{x.fee ? usd(x.fee) : "—"}</td>
              <td style={{ ...cell, ...right }} title="Average cost at the time of the sale">{x.sale_avg_cost != null ? usd(x.sale_avg_cost) : "—"}</td>
              <td style={{ ...cell, ...right, color: x.sale_profit == null ? undefined : x.sale_profit >= 0 ? UP : DOWN }}>
                {x.sale_profit != null ? signed(x.sale_profit) : "—"}</td>
              <td style={cell}>{x.note}</td>
              <td style={{ ...cell, whiteSpace: "nowrap" }}>
                <button style={iconButton} title="Edit" onClick={() => editTx(x)}>✎</button>
                <button style={iconButton} title="Delete" onClick={() => void delTx(x)}>🗑</button>
              </td>
            </tr>
          );
        })}</tbody>
      </table>
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <span style={pill(SESSION_COLOR[s.session] || "#64748b")}>US market · {SESSION_LABEL[s.session] || s.session}</span>
        <span style={muted}>ET {s.us_time} · {s.refresh_seconds ? (s.watch_refresh_seconds && s.watch_refresh_seconds !== s.refresh_seconds
          ? `Holdings every ${s.refresh_seconds} s, watchlist every ${s.watch_refresh_seconds} s` : `Every ${s.refresh_seconds} s auto-refresh`) : "Closed"}
          {age != null ? ` · Quotes ${age < 60 ? `${age} s` : `${Math.round(age / 60)} min`} ago` : ""} · {nextText}</span>
        <span style={{ ...muted, marginLeft: "auto" }}>Nasdaq quotes incl. pre-market (4:00–9:30 ET) and after hours (16:00–20:00 ET)</span>
        <button style={ghostButton} onClick={() => { void load(true); flash("Refreshing quotes…"); }}>🔄 Refresh</button>
      </div>
      {error ? <div style={{ ...panel, color: DOWN }}>Quote refresh failed: {error}</div> : null}
      {s.problems.length ? <div style={{ ...panel, background: "#fff7ed", color: "#9a3412" }}>⚠️ {s.problems.join(" · ")}</div> : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 16 }}>
        <Kpi label="Market value / cost" main={<>{usd(t.market_value)}<span style={{ fontSize: 14, color: "#64748b", fontWeight: 600 }}> / {usd(t.cost)}</span></>}
             sub={<>{t.cost > 0 ? <>Value is <span style={{ color: color(t.market_value - t.cost) }}>{(t.market_value / t.cost * 100).toFixed(1)}%</span></> : null}
               {cny(t.market_value) ? ` · ${cny(t.market_value)}` : ""}<br />FIFO cost {usd(t.fifo_cost)}</>} />
        <Kpi label="Unrealised P&L" main={signed(t.unrealized)} tint={color(t.unrealized)}
             sub={<><span style={{ color: color(t.unrealized) }}>{pct(t.unrealized_pct)}</span><br />FIFO <span style={{ color: color(t.fifo_unrealized) }}>{signed(t.fifo_unrealized)}</span></>} />
        <Kpi label="Today P&L" main={signed(t.day_pnl)} tint={color(t.day_pnl)}
             sub={<><span style={{ color: color(t.day_pnl) }}>{pct(t.day_pnl_pct)}</span> · vs prev close</>} />
        <CashKpi cash={s.cash ?? 0} onSaved={(st) => { apply(st); flash("Cash saved"); }} onError={(m) => flash(m, true)} />
        {Math.abs(realized) > 1e-9 || Math.abs(t.fifo_realized) > 1e-9 ? (
          <Kpi label="Realised + dividends" main={signed(realized)} tint={color(realized)}
               sub={<>Sales {signed(t.realized)} · dividends {usd(t.dividends)}<br />FIFO sales <span style={{ color: color(t.fifo_realized) }}>{signed(t.fifo_realized)}</span></>} />
        ) : null}
      </div>

      <AdvisorPanel holdings={s.holdings} />

      <CatalystsPanel
        holdings={s.holdings}
        watchlist={s.watchlist}
        modalTarget={catalystModal}
        onChangeModalTarget={setCatalystModal}
        onOpenChart={(sym) => setChart(sym)}
        onSummaryMap={handleCatalystSummary}
      />

      <div style={panel}>
        <div style={panelHead}><div style={panelTitle}>📈 Holdings · {s.holdings.length}</div>
          <span style={muted}>Mine: buys re-average, sales leave the average unchanged. FIFO: a sale takes the oldest shares first (the Irish CGT basis). Click a row for its chart, or click 🔭 事件 for upcoming catalysts</span></div>
        {s.holdings.length ? (
          <>
            <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", marginBottom: 8 }}>
              {s.holdings.filter((h) => h.weight).map((h) => <i key={h.symbol} title={`${h.symbol} ${h.weight!.toFixed(1)}%`} style={{ flex: h.weight!, background: colors[h.symbol] }} />)}
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
                <thead><tr>
                  <th style={th}>Stock</th><th style={th}>Price</th><th style={th}>Today</th><th style={th}>Events</th><th style={{ ...th, ...right }}>Shares</th>
                  <th style={{ ...th, ...right }}>Avg cost (mine / FIFO)</th><th style={{ ...th, ...right }}>Value / weight</th><th style={{ ...th, ...right }}>Unrealised P&L</th>
                </tr></thead>
                <tbody>{s.holdings.map((h) => (
                  <tr key={h.symbol} onClick={() => setChart(h.symbol)} style={{ cursor: "pointer" }} title="Click to see the chart">
                    <td style={cell}><b><i style={{ display: "inline-block", width: 8, height: 8, borderRadius: 4, background: colors[h.symbol], marginRight: 6 }} />{h.symbol}</b>
                      <span style={sub}>{shortName(h.quote?.name)}</span></td>
                    <td style={cell}><PriceCell q={h.quote || {}} /></td>
                    <td style={{ ...cell, color: color(h.day_change) }}><b>{pct(h.day_change_pct) || "—"}</b>
                      <span style={{ ...sub, color: color(h.day_pnl) }}>{h.day_pnl != null ? signed(h.day_pnl) : ""}</span></td>
                    <td style={cell} onClick={(e) => e.stopPropagation()}>
                      <StockCatalystButton symbol={h.symbol} info={catalystMap[h.symbol]} lang={catalystLang} onOpen={setCatalystModal} />
                    </td>
                    <td style={{ ...cell, ...right }}>{qty(h.quantity)}</td>
                    <td style={{ ...cell, ...right }}><Tag>Mine</Tag><b>{usd(h.avg_cost)}</b>
                      <span style={sub}><Tag>FIFO</Tag>{usd(h.fifo_avg_cost)}</span><span style={sub}>Cost {usd(h.cost)}</span></td>
                    <td style={{ ...cell, ...right }}><b>{usd(h.market_value)}</b>
                      {h.weight != null ? <span style={sub}>{h.weight.toFixed(1)}%</span> : null}</td>
                    <td style={{ ...cell, ...right, color: color(h.unrealized) }}><b>{signed(h.unrealized)}</b>
                      <span style={{ ...sub, color: color(h.unrealized) }}>{pct(h.unrealized_pct)}</span>
                      <span style={sub}><Tag>FIFO</Tag><span style={{ color: color(h.fifo_unrealized) }}>{signed(h.fifo_unrealized)}</span></span></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </>
        ) : <div style={muted}>No holdings.</div>}
      </div>

      <div style={panel}>
        <div style={panelHead}><div style={panelTitle}>👀 Watchlist · {s.watchlist.length}</div><span style={muted}>Stocks you follow without holding · click 🔭 事件 to open upcoming catalysts modal</span></div>
        {s.watchlist.length ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
              <thead><tr><th style={th}>Stock</th><th style={th}>Price</th><th style={th}>Today</th><th style={th}>Events</th><th style={{ ...th, ...right }}>Prev close</th><th style={th} /></tr></thead>
              <tbody>{s.watchlist.map((w) => (
                <tr key={w.symbol} onClick={() => setChart(w.symbol)} style={{ cursor: "pointer" }} title="Click to see the chart">
                  <td style={cell}><b>{w.symbol}</b><span style={sub}>{shortName(w.quote?.name)}{w.note ? ` · ${w.note}` : ""}</span></td>
                  <td style={cell}><PriceCell q={w.quote || {}} /></td>
                  <td style={{ ...cell, color: color(w.day_change) }}><b>{pct(w.day_change_pct) || "—"}</b>
                    <span style={{ ...sub, color: color(w.day_change) }}>{w.day_change != null ? signed(w.day_change) : ""}</span></td>
                  <td style={cell} onClick={(e) => e.stopPropagation()}>
                    <StockCatalystButton symbol={w.symbol} info={catalystMap[w.symbol]} lang={catalystLang} onOpen={setCatalystModal} />
                  </td>
                  <td style={{ ...cell, ...right }}>{usd(w.quote?.prev_close)}</td>
                  <td style={{ ...cell, whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}>
                    <button style={iconButton} title="Add a buy" onClick={() => { setFilter(""); editTx(null, w.symbol); }}>+</button>
                    <button style={iconButton} title="Remove from watchlist" onClick={() => void unwatch(w.symbol)}>✕</button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : null}
        <div style={{ display: "flex", gap: 8, marginTop: 10, maxWidth: 420 }}>
          <input value={watchInput} onChange={(e) => setWatchInput(e.target.value)} placeholder="Type a symbol to watch, e.g. AAPL"
                 onKeyDown={(e) => { if (e.key === "Enter") void watch(); }}
                 style={{ flex: 1, padding: "7px 9px", borderRadius: 8, border: "1px solid #cbd5e1", textTransform: "uppercase" }} />
          <button style={ghostButton} onClick={() => void watch()}>+ Add</button>
        </div>
      </div>

      <GlobalMarkets g={s.global} />

      <div style={panel}>
        <div style={panelHead}>
          <div style={panelTitle}>🧾 Transactions {filter
            ? <>· only {filter} <a href="#" onClick={(e) => { e.preventDefault(); setFilter(""); }}>(show all)</a></>
            : `· ${s.transactions.length}`}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ borderRadius: 8, border: "1px solid #cbd5e1", padding: "4px 8px" }}>
              <option value="">All symbols</option>
              {[...new Set(s.transactions.map((x) => x.symbol))].sort().map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
            <button onClick={() => editTx(null)}>+ Add trade</button>
          </div>
        </div>
        {txs.length ? txTable(filter ? txs : txs.slice(0, 8)) : <div style={muted}>No transactions yet.</div>}
        {!filter && txs.length > 8 ? (
          <details style={{ marginTop: 8 }}><summary style={{ cursor: "pointer", ...muted }}>Earlier transactions · {txs.length - 8}</summary>{txTable(txs.slice(8))}</details>
        ) : null}
      </div>

      {s.closed.length ? (
        <details style={panel}>
          <summary style={{ cursor: "pointer", fontWeight: 700 }}>Closed positions · {s.closed.length}</summary>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, marginTop: 8 }}>
            <thead><tr><th style={th}>Stock</th><th style={{ ...th, ...right }}>Realised P&L</th><th style={{ ...th, ...right }}>FIFO basis</th>
              <th style={{ ...th, ...right }}>Dividends</th><th style={{ ...th, ...right }}>Trades</th></tr></thead>
            <tbody>{s.closed.map((p) => (
              <tr key={p.symbol}><td style={cell}><b>{p.symbol}</b></td>
                <td style={{ ...cell, ...right, color: color(p.realized) }}>{signed(p.realized)}</td>
                <td style={{ ...cell, ...right, color: color(p.fifo_realized) }}>{signed(p.fifo_realized)}</td>
                <td style={{ ...cell, ...right }}>{usd(p.dividends)}</td><td style={{ ...cell, ...right }}>{p.trades}</td></tr>
            ))}</tbody>
          </table>
        </details>
      ) : null}

      {form ? <TradeModal initial={form} state={s} onClose={() => setForm(null)}
                          onSaved={(st, msg, err) => { apply(st); setForm(null); flash(msg, err); void load(); }} /> : null}
      {chart ? <ChartModal symbol={chart} state={s} onClose={() => setChart(null)} onOpenEvents={(sym) => setCatalystModal(sym)} /> : null}
      {toast ? (
        <div style={{ position: "fixed", bottom: 20, right: 20, background: toast.err ? "#7f1d1d" : "#0f172a", color: "#fff", padding: "10px 14px",
                      borderRadius: 10, fontSize: 13.5, zIndex: 60, maxWidth: 420 }}>{toast.msg}</div>
      ) : null}
    </div>
  );
};

export default Holdings;
