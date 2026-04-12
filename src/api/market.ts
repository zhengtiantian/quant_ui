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
  const res = await fetch("/api/market/symbols");
  if (!res.ok) throw new Error("Failed to fetch symbols");
  return await res.json();
}

export async function fetchStockChart(symbol: string, range: string): Promise<StockChartResponse> {
  const res = await fetch(`/api/market/stocks/${encodeURIComponent(symbol)}/chart?range=${encodeURIComponent(range)}`);
  if (!res.ok) throw new Error("Failed to fetch stock chart");
  return await res.json();
}

export async function fetchNasdaqHours(): Promise<NasdaqHoursResponse> {
  const res = await fetch("/api/market/nasdaq-hours");
  if (!res.ok) throw new Error("Failed to fetch Nasdaq hours");
  return await res.json();
}
