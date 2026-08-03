import { apiFetch } from "./client";

export interface Position {
    symbol: string;
    entryDate: string;
    entryPrice: number | null;
    entryScore: number | null;
    entryRank: number | null;
    status: "open" | "closed";
    currentPrice: number | null;
    currentReturn: number | null;
    daysHeld: number | null;
    asOfDate?: string | null;
    exitDate?: string | null;
    exitPrice?: number | null;
    exitReturn?: number | null;
    exitTrigger?: string | null;
}

export interface Alert {
    alertDate: string;
    symbol: string;
    alertType: string;
    message: string;
    entryDate: string;
    daysHeld: number | null;
    returnAtAlert: number | null;
}

export async function fetchPositions(): Promise<Position[]> {
    return apiFetch("/api/positions");
}

export async function fetchAlerts(limit = 20): Promise<Alert[]> {
    return apiFetch(`/api/alerts?limit=${limit}`);
}
