/**
 * The user's own portfolio: a hand-maintained transaction log, a cash balance, and the
 * holdings derived from them with live prices.
 *
 * Distinct from api/portfolio.ts, which serves the rule-generated paper positions.
 */

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
async function unwrap<T>(res: Response, fallback: string): Promise<T> {
    if (res.ok) {
        return (await res.json()) as T;
    }
    let message = fallback;
    try {
        const body = await res.json();
        message = body.message || body.error || fallback;
    } catch {
        // Non-JSON error body — keep the fallback.
    }
    throw new Error(message);
}

export async function fetchHoldings(): Promise<HoldingsResponse> {
    return unwrap(await fetch("/api/portfolio/holdings"), "Failed to load holdings");
}

export async function fetchTransactions(symbol?: string): Promise<Transaction[]> {
    const q = symbol ? `?symbol=${encodeURIComponent(symbol)}` : "";
    return unwrap(await fetch(`/api/portfolio/transactions${q}`), "Failed to load transactions");
}

export async function addTransaction(input: TransactionInput): Promise<Transaction> {
    const res = await fetch("/api/portfolio/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    return unwrap(res, "Failed to add transaction");
}

export async function updateTransaction(
    id: string,
    patch: Partial<TransactionInput>,
): Promise<Transaction> {
    const res = await fetch(`/api/portfolio/transactions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
    });
    return unwrap(res, "Failed to update transaction");
}

export async function deleteTransaction(id: string): Promise<void> {
    const res = await fetch(`/api/portfolio/transactions/${id}`, { method: "DELETE" });
    if (!res.ok && res.status !== 204) {
        throw new Error("Failed to delete transaction");
    }
}

export async function fetchCash(): Promise<Cash> {
    return unwrap(await fetch("/api/portfolio/cash"), "Failed to load cash balance");
}

export async function setCash(amount: number, currency = "USD"): Promise<Cash> {
    const res = await fetch("/api/portfolio/cash", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, currency }),
    });
    return unwrap(res, "Failed to update cash balance");
}
