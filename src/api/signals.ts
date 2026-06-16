export interface DailySignal {
    id: string;
    symbol: string;
    tradeDate: string;
    compositeScore: number | null;
    signalRank: number | null;
    signalType: string | null;
    qualityScore: number | null;
    newsBurst20d: number | null;
    earningsBeatSignal: number | null;
    earningsMissSignal: number | null;
    avgSentiment5d: number | null;
    sentimentShift5d: number | null;
    topN: number | null;
    publishedAt: string | null;
    // D-series context
    ahGap: number | null;
    analystBuyRatio: number | null;
    analystBuyRatioChg1m: number | null;
    instHoldingPctChg: number | null;
    retailSentScore: number | null;
    macroRiskOn: number | null;
    macroVix: number | null;
    regimeMult: number | null;
}

export async function fetchLatestSignals(): Promise<DailySignal[]> {
    const res = await fetch("/api/signals/latest");
    if (!res.ok) throw new Error("Failed to fetch signals");
    return await res.json();
}

export async function fetchSignalsByDate(date: string): Promise<DailySignal[]> {
    const res = await fetch(`/api/signals?date=${encodeURIComponent(date)}`);
    if (!res.ok) throw new Error("Failed to fetch signals");
    return await res.json();
}
