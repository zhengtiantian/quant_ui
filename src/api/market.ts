import { apiFetch } from "./client";

export interface PricePoint {
  timestamp: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
}

export interface StockChartResponse {
  symbol: string;
  range: string;
  timezoneNote: string;
  marketHoursBeijing: string;
  latestClose: number | null;
  changePct: number | null;
  points: PricePoint[];
}

export interface NasdaqHoursResponse {
  timezone: string;
  daylight_saving: string;
  standard_time: string;
  current_note: string;
}

export async function fetchMarketSymbols(): Promise<string[]> {
  return apiFetch("/api/market/symbols");
}

export async function fetchStockChart(symbol: string, range: string): Promise<StockChartResponse> {
  return apiFetch(`/api/market/stocks/${encodeURIComponent(symbol)}/chart?range=${encodeURIComponent(range)}`);
}

export async function fetchNasdaqHours(): Promise<NasdaqHoursResponse> {
  return apiFetch("/api/market/nasdaq-hours");
}
