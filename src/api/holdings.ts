/**
 * The user's own portfolio: a hand-maintained transaction log, a cash balance, and the
 * holdings derived from them with live prices.
 *
 * Distinct from api/portfolio.ts, which serves the rule-generated paper positions.
 */

import { apiFetch } from "./client";

export type TradeSide = "BUY" | "SELL";

export interface Holding {
    symbol: string;
    quantity: number;
    avgCost: number;
    price: number;
    costBasis: number;
    marketValue: number;
    unrealisedPnl: number;
    unrealisedPnlPct: number;
    realisedPnl: number;
    dayChangePct: number;
    weightPct: number;
    tradeCount: number;
    quoteSource: string;
    warning?: string;
}

export interface HoldingTotals {
    holdingsValue: number;
    cash: number;
    totalValue: number;
    costBasis: number;
    unrealisedPnl: number;
    unrealisedPnlPct: number;
    realisedPnl: number;
    feesPaid: number;
    openPositions: number;
}

export interface HoldingsResponse {
    holdings: Holding[];
    totals: HoldingTotals;
    currency: string;
    marketOpen: boolean;
    asOf: string;
}

export interface Transaction {
    id: string;
    symbol: string;
    side: TradeSide;
    quantity: number;
    price: number;
    tradeDate: string;
    fee: number;
    note: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface TransactionInput {
    symbol: string;
    side: TradeSide;
    quantity: number;
    price: number;
    tradeDate: string;
    fee?: number;
    note?: string;
}

export interface Cash {
    amount: number;
    currency: string;
    updatedAt: string | null;
}

/** Surfaces the API's own message so a rejected trade explains itself. */
export async function fetchHoldings(): Promise<HoldingsResponse> {
    return apiFetch<HoldingsResponse>("/api/portfolio/holdings");
}

export async function fetchTransactions(symbol?: string): Promise<Transaction[]> {
    const q = symbol ? `?symbol=${encodeURIComponent(symbol)}` : "";
    return apiFetch<Transaction[]>(`/api/portfolio/transactions${q}`);
}

export async function addTransaction(input: TransactionInput): Promise<Transaction> {
    return apiFetch<Transaction>("/api/portfolio/transactions", {
        method: "POST",
        body: JSON.stringify(input),
    });
}

export async function updateTransaction(
    id: string,
    patch: Partial<TransactionInput>,
): Promise<Transaction> {
    return apiFetch<Transaction>(`/api/portfolio/transactions/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
    });
}

export async function deleteTransaction(id: string): Promise<void> {
    await apiFetch<void>(`/api/portfolio/transactions/${id}`, { method: "DELETE" });
}

export async function fetchCash(): Promise<Cash> {
    return apiFetch<Cash>("/api/portfolio/cash");
}

export async function setCash(amount: number, currency = "USD"): Promise<Cash> {
    return apiFetch<Cash>("/api/portfolio/cash", {
        method: "PUT",
        body: JSON.stringify({ amount, currency }),
    });
}
