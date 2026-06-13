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
