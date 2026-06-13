import { useEffect, useState } from "react";
import { fetchPositions, fetchAlerts } from "../api/portfolio";
import type { Position, Alert } from "../api/portfolio";

const pct = (v: number | null | undefined): string =>
    v === null || v === undefined ? "—" : `${(v * 100).toFixed(2)}%`;

const retColor = (v: number | null | undefined): string =>
    (v ?? 0) > 0 ? "#1a7f37" : (v ?? 0) < 0 ? "#cf222e" : "#6e7781";

const triggerLabel: Record<string, string> = {
    max_hold: "Max hold",
    score_below_exit: "Score drop",
    earnings_miss: "Earnings miss",
    sentiment_reversal: "Sentiment reversal",
};

export default function PositionsPanel() {
    const [positions, setPositions] = useState<Position[]>([]);
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = () => {
        setLoading(true);
        setError(null);
        Promise.all([fetchPositions(), fetchAlerts(20)])
            .then(([p, a]) => {
                setPositions(p);
                setAlerts(a);
            })
            .catch((e) => setError(String(e)))
            .finally(() => setLoading(false));
    };

    useEffect(load, []);

    if (loading) return <p>Loading portfolio...</p>;
    if (error) return <p style={{ color: "#cf222e" }}>Failed to load: {error}</p>;

    const open = positions.filter((p) => p.status === "open");
    const closed = positions.filter((p) => p.status === "closed");
    const avgOpen =
        open.length > 0
            ? open.reduce((s, p) => s + (p.currentReturn ?? 0), 0) / open.length
            : 0;

    const th: React.CSSProperties = {
        textAlign: "left",
        padding: "8px 12px",
        borderBottom: "2px solid #d0d7de",
        fontSize: "0.85rem",
        color: "#57606a",
        whiteSpace: "nowrap",
    };
    const td: React.CSSProperties = {
        padding: "8px 12px",
        borderBottom: "1px solid #eaeef2",
        fontSize: "0.95rem",
    };

    return (
        <div style={{ padding: "0.5rem" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: "16px", marginBottom: "12px" }}>
                <h2 style={{ margin: 0 }}>Paper Portfolio</h2>
                <span style={{ color: "#57606a" }}>
                    {open.length} open · {closed.length} closed
                </span>
                <span style={{ color: retColor(avgOpen), fontWeight: 600 }}>
                    avg open P/L {pct(avgOpen)}
                </span>
                <button onClick={load} style={{ marginLeft: "auto" }}>
                    Refresh
                </button>
            </div>

            {/* Exit alerts */}
            {alerts.length > 0 && (
                <div
                    style={{
                        background: "#fff8f0",
                        border: "1px solid #ffd8a8",
                        borderRadius: "6px",
                        padding: "10px 14px",
                        marginBottom: "16px",
                    }}
                >
                    <div style={{ fontWeight: 600, marginBottom: "6px" }}>
                        🔔 Exit alerts ({alerts.length})
                    </div>
                    {alerts.slice(0, 6).map((a, i) => (
                        <div key={i} style={{ fontSize: "0.9rem", color: "#57606a", padding: "2px 0" }}>
                            <b>{a.alertDate}</b> · {a.message}
                        </div>
                    ))}
                </div>
            )}

            {open.length === 0 && closed.length === 0 ? (
                <p style={{ color: "#6e7781" }}>No positions yet.</p>
            ) : (
                <table style={{ borderCollapse: "collapse", width: "100%", maxWidth: "960px" }}>
                    <thead>
                        <tr>
                            <th style={th}>Symbol</th>
                            <th style={th}>Status</th>
                            <th style={th}>Entry</th>
                            <th style={{ ...th, textAlign: "right" }}>Entry $</th>
                            <th style={{ ...th, textAlign: "right" }}>Now $</th>
                            <th style={{ ...th, textAlign: "right" }}>Held</th>
                            <th style={{ ...th, textAlign: "right" }}>Return</th>
                            <th style={th}>Exit reason</th>
                        </tr>
                    </thead>
                    <tbody>
                        {positions.map((p, i) => {
                            const ret = p.status === "open" ? p.currentReturn : p.exitReturn;
                            const nowPrice = p.status === "open" ? p.currentPrice : p.exitPrice;
                            return (
                                <tr key={i} style={{ opacity: p.status === "closed" ? 0.6 : 1 }}>
                                    <td style={{ ...td, fontWeight: 600 }}>{p.symbol}</td>
                                    <td style={td}>
                                        <span
                                            style={{
                                                fontSize: "0.78rem",
                                                color: p.status === "open" ? "#1a7f37" : "#6e7781",
                                                border: `1px solid ${p.status === "open" ? "#1a7f37" : "#6e7781"}`,
                                                borderRadius: "10px",
                                                padding: "1px 8px",
                                            }}
                                        >
                                            {p.status}
                                        </span>
                                    </td>
                                    <td style={{ ...td, color: "#57606a" }}>{p.entryDate}</td>
                                    <td style={{ ...td, textAlign: "right" }}>{p.entryPrice ?? "—"}</td>
                                    <td style={{ ...td, textAlign: "right" }}>{nowPrice ?? "—"}</td>
                                    <td style={{ ...td, textAlign: "right" }}>{p.daysHeld ?? "—"}d</td>
                                    <td style={{ ...td, textAlign: "right", fontWeight: 600, color: retColor(ret) }}>
                                        {pct(ret)}
                                    </td>
                                    <td style={{ ...td, color: "#57606a", fontSize: "0.85rem" }}>
                                        {p.exitTrigger ? triggerLabel[p.exitTrigger] || p.exitTrigger : "—"}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}
        </div>
    );
}
