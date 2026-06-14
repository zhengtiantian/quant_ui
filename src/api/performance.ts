export interface EquityPoint {
    date: string;
    strategy: number;
    benchmark: number;
}

export interface PerfStats {
    total_return: number;
    ann_return: number;
    ann_vol: number;
    sharpe: number;
    max_drawdown: number;
    win_rate: number;
    avg_period_return: number;
    num_periods: number;
}

export interface Performance {
    generated_at?: string;
    hold_days?: number;
    top_n?: number;
    rebalances?: number;
    start_date?: string;
    end_date?: string;
    equity_curve?: EquityPoint[];
    stats?: { strategy: PerfStats; benchmark: PerfStats };
}

export async function fetchPerformance(): Promise<Performance> {
    const res = await fetch("/api/performance");
    if (!res.ok) throw new Error("Failed to fetch performance");
    return await res.json();
}

export interface PaperTrade {
    symbol: string;
    entryDate: string;
    exitDate?: string;
    daysHeld?: number;
    exitReturn?: number;
    exitTrigger?: string;
}

export interface PaperPerformance {
    summary?: {
        openCount: number;
        closedCount: number;
        firstEntry?: string;
        realizedAvgReturn: number;
        unrealizedAvgReturn: number;
        winRate: number;
        avgDaysHeld: number;
        cumulativeReturn: number;
    };
    equityCurve?: { exitDate: string; equity: number; tradeReturn: number; symbol: string }[];
    recentTrades?: PaperTrade[];
}

export async function fetchPaperPerformance(): Promise<PaperPerformance> {
    const res = await fetch("/api/paper-performance");
    if (!res.ok) throw new Error("Failed to fetch paper performance");
    return await res.json();
}
