/**
 * The user's portfolio, global markets and daily briefs, served by quant_ai's markets routes
 * on the host (/api/markets/...). Those routes answer only requests from this machine, which
 * the browser is, so no token is attached.
 *
 * Replaces api/holdings.ts (quant_api's Java/MySQL holdings), which is deprecated: the
 * portfolio moved from job_agent's dashboard into quant_ai on 2026-10-22.
 */

export const MARKETS_BASE = "http://localhost:18000/api/markets";

export type Session = "pre" | "regular" | "post" | "closed";
export type Side = "buy" | "sell" | "dividend" | "fee";

export interface Quote {
  symbol?: string;
  name?: string;
  price?: number | null;
  prev_close?: number | null;
  session?: Session;
  regular_price?: number | null;
  session_change?: number | null;
  session_change_pct?: number | null;
  stale?: boolean;
  pending?: boolean;
  error?: string;
  fetched_at?: number;
}

export interface Holding {
  symbol: string;
  quantity: number;
  cost: number;
  avg_cost: number;
  fifo_cost: number;
  fifo_avg_cost: number;
  realized: number;
  fifo_realized: number;
  dividends: number;
  trades: number;
  quote: Quote;
  market_value?: number;
  unrealized?: number;
  unrealized_pct?: number | null;
  fifo_unrealized?: number;
  day_change?: number | null;
  day_change_pct?: number | null;
  day_pnl?: number | null;
  weight?: number | null;
}

export interface WatchItem {
  symbol: string;
  note?: string;
  quote: Quote;
  day_change?: number | null;
  day_change_pct?: number | null;
}

export interface Transaction {
  id: number;
  trade_date: string;
  symbol: string;
  side: Side;
  quantity: number;
  price: number;
  fee: number;
  note?: string;
  budget_sync?: number;
  budget_entry_id?: number | null;
  sale_avg_cost?: number;           // sells: the average cost the sale realised against
  sale_profit?: number;             // sells: (price - that average) x shares - fee
}

export interface Totals {
  market_value: number;
  cost: number;
  day_pnl: number;
  day_pnl_pct: number | null;
  realized: number;
  dividends: number;
  unrealized: number;
  unrealized_pct: number | null;
  fifo_cost: number;
  fifo_unrealized: number;
  fifo_realized: number;
}

export interface GlobalItem {
  symbol: string;
  name: string;
  price?: number;
  change?: number;
  change_pct?: number;
  prev_close?: number;
  currency?: string;
  trade_time?: string;
  full_name?: string;
  fetched_at?: number | null;
}

export interface Exchange {
  code: string;
  name: string;
  open: boolean;
  local_time: string;
  hours: string;
  tz: string;
  indices: GlobalItem[];
  stocks: GlobalItem[];
}

export interface Country {
  code: string;
  name: string;
  flag: string;
  open: boolean;
  exchanges: Exchange[];
}

export interface GlobalState {
  regions: { name: string; countries: Country[] }[];
  any_open: boolean;
  refreshing: boolean;
  refresh_seconds: number | null;
}

export interface PortfolioState {
  transactions: Transaction[];
  holdings: Holding[];
  closed: Holding[];
  watchlist: WatchItem[];
  totals: Totals;
  problems: string[];
  session: Session;
  session_label: string;
  refresh_seconds: number | null;
  watch_refresh_seconds: number | null;
  next_session_in: number | null;
  us_time: string;
  usd_cny: number | null;
  tx_types: Record<Side, string>;
  server_time: number;
  refreshing: boolean;
  global: GlobalState;
  cash: number;
}

export interface Candle {
  time: number | string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  session?: Session;
  partial?: boolean;
}

export interface ChartData {
  symbol: string;
  range: string;
  interval: string;
  candles: Candle[];
  prev_close?: number | null;
  stale?: boolean;
}

export type BriefKind = "asia_europe" | "us" | "outlook" | "flash" | "advisor";

export interface BriefMeta {
  id: number;
  kind: BriefKind;
  session_date: string;
  topic: string;
  status: "running" | "done" | "failed";
  attempts: number;
  trigger: string;
  started_at: number | null;
  finished_at: number | null;
  duration_s: number | null;
  headline_zh: string | null;
  headline_en: string | null;
  error: string | null;
  model: string | null;
  cost_usd: number | null;
}

export interface Prediction {
  id: number;
  brief_id: number;
  kind: BriefKind;
  symbol: string;
  name: string | null;
  exchange: string;
  target_date: string;
  op: ">=" | "<=" | "abs>=" | "abs<=";
  threshold: number;
  confidence: number | null;
  text_zh: string | null;
  text_en: string | null;
  status: "pending" | "hit" | "miss" | "void";
  actual: number | null;
  note: string | null;
}

/** One limit order the holdings advisor recommended, with how it played out (scored from daily bars). */
export interface AdviceOrder {
  id: number;
  brief_id: number;
  symbol: string;
  side: "buy" | "sell";
  tag: "trim" | "rebuy" | "add" | "new" | "stop" | "exit";
  pct: number | null;
  shares: number | null;
  amount_usd: number | null;
  limit_price: number;
  issued_ts: number;
  issued_price: number | null;
  valid_until: string;
  /** waiting: a buy-back that becomes active once its sale (parent_id) fills. */
  status: "open" | "waiting" | "filled" | "scored" | "expired" | "void";
  filled_date: string | null;
  eval_date: string | null;
  eval_close: number | null;
  edge_pct: number | null;
  zh: string | null;
  en: string | null;
  /** The tested plan this order belongs to, and its backtest summary. */
  plan: string | null;
  note: string | null;
  parent_id: number | null;
}

export interface AdvisorReason {
  kind: "move" | "limit" | "earnings_prep" | "earnings_out" | "news" | "manual";
  text: string;
  urgent: boolean;
}

export interface AdvisorReport extends BriefMeta {
  symbol: string | null;          // a focused update's holding; null for the daily report
  urgent: boolean;
  reasons: AdvisorReason[];
}

export interface AdvisorState {
  reports: AdvisorReport[];
  orders: AdviceOrder[];
  scorecard: {
    orders: number; open: number; filled_live: number; finished: number;
    fill_rate: number | null; mean_edge_pct: number | null; win_rate: number | null; recent: AdviceOrder[];
  };
  cash: number;
  running: boolean;
  due_session: string | null;
  schedule: string;
}

export interface Brief extends BriefMeta {
  body_zh: string | null;
  body_en: string | null;
  sources: { title: string; url: string }[];
  predictions: Prediction[];
  orders?: AdviceOrder[];
  context: { symbol: string; name: string; move_pct: number | null; session: string | null } | null;
}

export interface PredictionStats {
  total: number;
  scored: number;
  hits: number;
  pending: number;
  hit_rate: number | null;
  brier: number | null;
  mean_confidence: number | null;
}

export interface Scorecard {
  overall: PredictionStats;
  by_kind: Record<string, PredictionStats>;
  calibration: { range: string; scored: number; hit_rate: number | null }[];
  recent: Prediction[];
}

export interface BriefsResponse {
  briefs: BriefMeta[];
  kinds: Record<string, { title: string; due_session: string | null; running: boolean }>;
  claude_found: boolean;
  flash_threshold: number;
  bellwethers: Record<string, string>;
}

export interface MacroState {
  groups: { name: string; items: GlobalItem[] }[];
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let resp: Response;
  try {
    resp = await fetch(`${MARKETS_BASE}${path}`, init);
  } catch {
    throw new Error("quant_ai is not reachable on localhost:18000");
  }
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok || body.status !== "success") {
    throw new Error(body.message || body.detail || `HTTP ${resp.status}`);
  }
  return body as T;
}

const post = <T>(path: string, payload: unknown) =>
  call<T>(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });

export const fetchPortfolio = (force = false) => call<PortfolioState>(`/portfolio/state${force ? "?force=1" : ""}`);
export const fetchChart = (symbol: string, range: string) =>
  call<ChartData>(`/portfolio/chart?symbol=${encodeURIComponent(symbol)}&range=${range}`);

export interface SaveResult {
  id: number;
  state: PortfolioState;
}
export const saveTransaction = (data: Record<string, string>) => post<SaveResult>("/portfolio/tx/save", { data });
export const deleteTransaction = (id: number) => post<{ state: PortfolioState }>("/portfolio/tx/delete", { id });
export const addWatch = (symbol: string) => post<{ symbol: string; state: PortfolioState }>("/portfolio/watch/add", { symbol });
export const removeWatch = (symbol: string) => post<{ state: PortfolioState }>("/portfolio/watch/remove", { symbol });

export const fetchMacro = () => call<MacroState>("/macro");
export const fetchBriefs = (kind = "") => call<BriefsResponse>(`/briefs${kind ? `?kind=${kind}` : ""}`);
export const fetchBrief = (id: number) => call<{ brief: Brief }>(`/briefs/${id}`).then((r) => r.brief);
export const runBrief = (kind: string, symbol = "") => post<BriefsResponse & { started: boolean }>("/briefs/run", { kind, symbol });
export const fetchScorecard = () => call<Scorecard>("/predictions/scorecard");
export const fetchAdvisor = () => call<AdvisorState>("/advisor");
export const setCash = (cash: number) => post<{ cash: number; state: PortfolioState }>("/portfolio/cash/set", { cash });
