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

export type LotOrderStatus = "open" | "partial" | "closed";

export interface LotAllocationInput {
  buy_id: number;
  quantity: number;
}

export interface BuyOrderMatchSlice {
  sell_id: number;
  trade_date: string;
  quantity: number;
  sell_price: number;
  pnl: number;
  explicit: boolean;
}

export interface BuyOrderLot {
  id: number;
  trade_date: string;
  symbol: string;
  quantity: number;
  price: number;
  fee: number;
  unit_cost: number;
  note: string;
  open_qty: number;
  closed_qty: number;
  status: LotOrderStatus;
  realized_pnl: number;
  matches: BuyOrderMatchSlice[];
  fifo_open_qty: number;
  fifo_closed_qty: number;
  fifo_status: LotOrderStatus;
  fifo_realized_pnl: number;
  live_price?: number | null;
  price_diff_pct?: number | null;
  open_market_value?: number;
  open_cost?: number;
  open_pnl?: number;
  open_pnl_pct?: number | null;
}

export interface MatchedBuyLotSlice {
  buy_id: number;
  buy_date: string;
  buy_price: number;
  unit_cost: number;
  quantity: number;
  pnl: number;
  explicit: boolean;
}

export interface SellOrderRecord {
  id: number;
  trade_date: string;
  symbol: string;
  quantity: number;
  price: number;
  fee: number;
  note: string;
  avg_cost: number;
  profit: number;
  fifo_profit: number;
  swing_unit_cost: number;
  swing_profit: number;
  lot_allocations: LotAllocationInput[] | null;
  matched_lots: MatchedBuyLotSlice[];
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
  buy_orders?: BuyOrderLot[];
  sell_orders?: SellOrderRecord[];
  swing_realized?: number;
  open_lots_cost?: number;
  open_lots_avg?: number | null;
  open_lots_unrealized?: number;
  breakeven_price?: number | null;
  raw_breakeven_price?: number | null;
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
  sale_fifo_profit?: number;
  sale_swing_cost?: number;
  sale_swing_profit?: number;
  lot_allocations?: LotAllocationInput[] | null;
  matched_lots?: MatchedBuyLotSlice[];
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
export const saveTransaction = (data: Record<string, unknown>) => post<SaveResult>("/portfolio/tx/save", { data });
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
// ------------------------------------------------------------------ 3-Layer Upcoming Catalysts & Query

export type CatalystLayer = "L1_calendar" | "L2_extracted" | "L3_web";
export type CatalystKind =
  | "earnings"
  | "dividend"
  | "split"
  | "macro"
  | "product"
  | "policy"
  | "legal"
  | "corporate"
  | "analyst";
export type CatalystBucket = "held" | "watchlist" | "macro" | "bellwether";

export interface CatalystSymbolMeta {
  symbol: string;
  name: string;
  bucket: "held" | "watchlist";
  quantity: number;
  weight_pct: number | null;
  unrealized_pct: number | null;
  price: number | null;
  day_change_pct: number | null;
}

export interface CatalystEvent {
  id: string;
  layer: CatalystLayer;
  kind: CatalystKind;
  bucket: CatalystBucket;
  symbol: string;
  listed_as?: string;
  name: string;
  country?: string;
  flag?: string;
  date: string;
  date_precision: "exact" | "approx" | string;
  date_label?: string;
  days_away: number;
  when?: string;
  eps_forecast?: number | null;
  revenue_forecast?: number | null;
  forecast_currency?: string;
  implied_move_pct?: number | null;
  estimates?: number | null;
  fiscal_quarter?: string;
  amount?: number | null;
  pay_date?: string | null;
  currency?: string;
  estimated_payout_usd?: number | null;
  ratio?: string;
  gmt?: string;
  consensus?: string;
  previous?: string;
  weight_pct?: number | null;
  affected_symbols: string[];
  related_holdings: string[];
  impact_level: "high" | "medium" | "low";
  title_zh: string;
  title_en: string;
  detail_zh: string;
  detail_en: string;
  source_title: string;
  source_url: string;
}

export interface PerStockCatalysts extends CatalystSymbolMeta {
  direct_count: number;
  spillover_count: number;
  macro_count: number;
  total_count: number;
  next_direct: CatalystEvent | null;
  direct: CatalystEvent[];
  spillover: CatalystEvent[];
  macro: CatalystEvent[];
}

export interface CollectionLayerStatus {
  layer?: string;
  status?: string;
  last_started_at?: number | null;
  last_finished_at?: number | null;
  items_saved?: number | null;
  error?: string | null;
  running: boolean;
  stored_count: number;
  claude_available?: boolean;
}

export interface CatalystQuerySource {
  id?: number;
  symbol?: string;
  date?: string;
  title: string;
  url: string;
}

export interface CatalystQueryRecord {
  id: number;
  created_at: number;
  question: string;
  scope: string;
  days: number;
  symbols: string[];
  mode: "fast" | "web";
  lang: "zh" | "en";
  answer: string;
  sources: CatalystQuerySource[];
  model: string | null;
  elapsed_s: number;
}

export interface CatalystsFeedResponse {
  from: string;
  to: string;
  days: number;
  scope: string;
  symbols_meta: CatalystSymbolMeta[];
  per_stock: Record<string, PerStockCatalysts>;
  collection: {
    L2_extracted: CollectionLayerStatus;
    L3_web: CollectionLayerStatus;
  };
  summary: {
    total: number;
    l1: number;
    l2: number;
    l3: number;
    earnings: number;
    macro: number;
    dividends: number;
    catalysts: number;
    held_events: number;
    watch_events: number;
    next_held: CatalystEvent | null;
    next_watch: CatalystEvent | null;
  };
  timeline: CatalystEvent[];
  data_gaps: string[];
  recent_queries: CatalystQueryRecord[];
}

export const fetchCatalysts = (opts?: {
  scope?: string;
  days?: number;
  symbols?: string[];
  bellwethers?: boolean;
  force?: boolean;
}) => {
  const qs = new URLSearchParams();
  if (opts?.scope) qs.set("scope", opts.scope);
  if (opts?.days) qs.set("days", String(opts.days));
  if (opts?.symbols?.length) qs.set("symbols", opts.symbols.join(","));
  if (opts?.bellwethers === false) qs.set("bellwethers", "0");
  if (opts?.force) qs.set("force", "1");
  const q = qs.toString();
  return call<CatalystsFeedResponse>(`/catalysts${q ? `?${q}` : ""}`);
};

export const triggerCatalystsCollect = (layer: "l2" | "l3" | "all" = "l2", days = 45) =>
  post<{ started: string[]; layers: CatalystsFeedResponse["collection"] }>("/catalysts/collect", { layer, days });

export const queryCatalysts = (payload: {
  question: string;
  scope?: string;
  days?: number;
  symbols?: string[];
  mode?: "fast" | "web";
  lang?: "zh" | "en";
}) => post<{ result: CatalystQueryRecord; recent_queries: CatalystQueryRecord[] }>("/catalysts/query", payload);

export const deleteCatalystHistory = (payload: { id?: number; clear_all?: boolean }) =>
  post<{ recent_queries: CatalystQueryRecord[] }>("/catalysts/history/delete", payload);

// ---------------- Q.10 Lot- & Inventory-Aware Swing / Dip Guardrail ----------------

export interface LotAdviceStats {
  bars: number;
  atr14: number | null;
  atr14_pct: number | null;
  rsi14: number | null;
  sma20: number | null;
  drop_1d_pct: number | null;
  drop_1d_atr: number | null;
  drop_3d_pct: number | null;
  drop_3d_atr: number | null;
  stabilized: boolean;
}

export interface LotAdviceCatalyst {
  date: string;
  days_away: number;
  title: string;
  category: string;
  impact: string;
  bucket: string;
}

export interface DipGuardrail {
  verdict: "green" | "amber" | "red";
  headline_zh: string;
  reasons_zh: string[];
  min_spacing_atr: number;
  anchor_lot_id: number | null;
  anchor_cost: number | null;
  latest_lot_id: number | null;
  latest_cost: number | null;
  evaluated_buy_price: number | null;
  spacing_vs_lowest_atr: number | null;
  suggested_buy_limit: number | null;
  recent_pair_tight: {
    lot_a_id: number;
    lot_a_cost: number;
    lot_b_id: number;
    lot_b_cost: number;
    gap_usd: number;
    gap_atr: number | null;
  } | null;
}

export interface LotExitPlan {
  buy_id: number;
  trade_date: string;
  unit_cost: number;
  open_qty: number;
  open_pnl: number | null;
  open_pnl_pct: number | null;
  pnl_atr: number | null;
  tp1_price: number | null;
  tp1_gain_usd: number | null;
  tp2_price: number | null;
  tp2_gain_usd: number | null;
  trail_stop_price: number | null;
  recommended_price: number | null;
  status_code: "hit_tp2" | "hit_tp1" | "green_hold" | "underwater_swing" | "deep_hold";
  advice_zh: string;
}

export interface LotAdviceResponse {
  status: string;
  symbol: string;
  generated_at: string;
  live_price: number | null;
  cash: number;
  symbol_weight_pct: number;
  semi_cluster_weight_pct: number;
  is_semi_cluster: boolean;
  stats: LotAdviceStats;
  empirical_oos: {
    universe_stocks: number;
    oos_years: string;
    oos_2atr_drop_events: number;
    follow_through_1atr_3d_pct: number;
    follow_through_15atr_3d_pct: number;
    immediate_tp15_hit_pct: number;
    immediate_tp15_mean_pct: number;
    spaced_15atr_fill_pct: number;
    spaced_15atr_tp20_hit_pct: number;
    spaced_15atr_mean_pct: number;
  };
  catalysts_7d: LotAdviceCatalyst[];
  has_binary_7d: boolean;
  dip_guardrail: DipGuardrail;
  lot_exit_plans: LotExitPlan[];
}

export const fetchLotAdvice = (symbol: string, buyPrice?: number | string | null) => {
  const qs = new URLSearchParams({ symbol });
  if (buyPrice !== undefined && buyPrice !== null && String(buyPrice).trim() !== "") {
    const n = Number(buyPrice);
    if (Number.isFinite(n) && n > 0) {
      qs.set("buy_price", String(n));
    }
  }
  return call<LotAdviceResponse>(`/portfolio/lot-advice?${qs.toString()}`);
};

export interface TaskMonitorSummary {
  running_count: number;
  success_today: number;
  failed_today: number;
  total_dags: number;
  active_dags: number;
  job_agent_online: boolean;
  scheduler_running: boolean;
}

export interface RunningTaskItem {
  source: string;
  dag_id: string;
  task_id: string;
  run_id: string;
  name: string;
  state: string;
  start_date: string | null;
  duration_seconds: number | null;
  can_view_log: boolean;
}

export interface JobAgentInfo {
  name: string;
  url: string;
  port: number;
  is_online: boolean;
  is_scraping_now: boolean;
  schedule: string;
  next_run: {
    next_run_iso: string;
    next_run_display: string;
    countdown: string;
  };
  last_success?: string | null;
  last_full_sweep?: string | null;
  launchd_status: string;
  report?: {
    exists: boolean;
    path: string;
    modified_at: string;
    size_kb: number;
    summary: string;
  };
  has_log: boolean;
}

export interface AirflowTaskInstanceItem {
  task_id: string;
  state: string;
  start_date: string | null;
  end_date: string | null;
  duration: number | null;
}

export interface AirflowDagItem {
  dag_id: string;
  name: string;
  category: string;
  description: string;
  is_paused: boolean;
  schedule: string;
  schedule_display: string;
  next_run: string | null;
  last_run: {
    run_id: string;
    state: string;
    start_date: string | null;
    end_date: string | null;
    duration_seconds: number | null;
    progress: {
      total: number;
      success: number;
      running: number;
      failed: number;
      percent: number;
    };
  } | null;
  tasks: AirflowTaskInstanceItem[];
}

export interface SystemDaemonItem {
  id: string;
  name: string;
  type: string;
  label: string;
  port: number | null;
  is_port_open: boolean | null;
  pid: number | null;
  status: string;
  description: string;
  log_path: string | null;
}

export interface TaskMonitorResponse {
  status: string;
  timestamp: string;
  summary: TaskMonitorSummary;
  running_tasks: RunningTaskItem[];
  job_agent: JobAgentInfo;
  airflow_dags: AirflowDagItem[];
  system_daemons: SystemDaemonItem[];
}

export interface TaskLogResponse {
  status: string;
  source: string;
  target_id: string;
  run_id?: string | null;
  task_id?: string | null;
  path?: string;
  total_lines?: number;
  lines_returned?: number;
  log?: string;
  message?: string;
}

export const fetchTaskMonitorStatus = () => {
  return call<TaskMonitorResponse>("/tasks/monitor");
};

export const fetchTaskLog = (
  source: string,
  target_id: string = "",
  run_id: string = "",
  task_id: string = "",
  lines: number = 200
) => {
  const qs = new URLSearchParams({
    source,
    target_id,
    run_id,
    task_id,
    lines: String(lines),
  });
  return call<TaskLogResponse>(`/tasks/log?${qs.toString()}`);
};
