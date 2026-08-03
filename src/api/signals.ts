import { apiFetch } from "./client";

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
    return apiFetch("/api/signals/latest");
}

export async function fetchSignalsByDate(date: string): Promise<DailySignal[]> {
    return apiFetch(`/api/signals?date=${encodeURIComponent(date)}`);
}
