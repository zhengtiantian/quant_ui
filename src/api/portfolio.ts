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
    const res = await fetch("/api/positions");
    if (!res.ok) throw new Error("Failed to fetch positions");
    return await res.json();
}

export async function fetchAlerts(limit = 20): Promise<Alert[]> {
    const res = await fetch(`/api/alerts?limit=${limit}`);
    if (!res.ok) throw new Error("Failed to fetch alerts");
    return await res.json();
}
