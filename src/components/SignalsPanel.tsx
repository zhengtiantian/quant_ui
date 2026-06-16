import { useEffect, useState } from "react";
import { fetchLatestSignals } from "../api/signals";
import type { DailySignal } from "../api/signals";

const fmt = (v: number | null | undefined, digits = 3): string =>
    v === null || v === undefined ? "—" : v.toFixed(digits);

const fmtPct = (v: number | null | undefined): string =>
    v === null || v === undefined ? "—" : `${(v * 100).toFixed(2)}%`;

const signedColor = (v: number | null | undefined): string =>
    v === null || v === undefined ? "#6e7781" : v >= 0 ? "#1a7f37" : "#cf222e";

const typeColor = (t: string | null): string => {
    switch ((t || "").toUpperCase()) {
        case "LONG":
            return "#1a7f37";
        case "SHORT":
            return "#cf222e";
        default:
            return "#6e7781";
    }
};

export default function SignalsPanel() {
    const [signals, setSignals] = useState<DailySignal[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = () => {
        setLoading(true);
        setError(null);
        fetchLatestSignals()
            .then(setSignals)
            .catch((e) => setError(String(e)))
            .finally(() => setLoading(false));
    };

    useEffect(load, []);

    if (loading) return <p>Loading signals...</p>;
    if (error) return <p style={{ color: "#cf222e" }}>Failed to load: {error}</p>;

    const tradeDate = signals[0]?.tradeDate;
    const publishedAt = signals[0]?.publishedAt;
    const regimeMult = signals[0]?.regimeMult;
    const riskOn = signals[0]?.macroRiskOn;

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
            <div
                style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: "16px",
                    marginBottom: "12px",
                }}
            >
                <h2 style={{ margin: 0 }}>Daily Signals</h2>
                {tradeDate && (
                    <span style={{ color: "#57606a" }}>
                        Trade date <b>{tradeDate}</b>
                    </span>
                )}
                {publishedAt && (
                    <span style={{ color: "#8c959f", fontSize: "0.85rem" }}>
                        Generated {new Date(publishedAt).toLocaleString()}
                    </span>
                )}
                {regimeMult != null && (
                    <span
                        style={{
                            color: "#fff",
                            background: riskOn === 1 ? "#1a7f37" : "#9a6700",
                            padding: "2px 10px",
                            borderRadius: "10px",
                            fontSize: "0.8rem",
                        }}
                        title="Macro regime multiplier applied to composite score"
                    >
                        {riskOn === 1 ? "Risk-on" : "Risk-off"} ×{regimeMult.toFixed(2)}
                    </span>
                )}
                <button onClick={load} style={{ marginLeft: "auto" }}>
                    Refresh
                </button>
            </div>

            {signals.length === 0 ? (
                <p style={{ color: "#6e7781" }}>No signals available.</p>
            ) : (
                <table style={{ borderCollapse: "collapse", width: "100%", maxWidth: "900px" }}>
                    <thead>
                        <tr>
                            <th style={th}>#</th>
                            <th style={th}>Symbol</th>
                            <th style={th}>Type</th>
                            <th style={{ ...th, textAlign: "right" }}>Score</th>
                            <th style={{ ...th, textAlign: "right" }}>Quality</th>
                            <th style={{ ...th, textAlign: "right" }}>News burst 20d</th>
                            <th style={{ ...th, textAlign: "center" }}>Earnings</th>
                            <th style={{ ...th, textAlign: "right" }}>AH Gap</th>
                            <th style={{ ...th, textAlign: "right" }}>Analyst Δ1m</th>
                            <th style={{ ...th, textAlign: "right" }}>Inst Δ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {signals.map((s) => (
                            <tr key={s.id}>
                                <td style={{ ...td, color: "#8c959f" }}>{s.signalRank ?? "—"}</td>
                                <td style={{ ...td, fontWeight: 600 }}>{s.symbol}</td>
                                <td style={td}>
                                    <span
                                        style={{
                                            color: "#fff",
                                            background: typeColor(s.signalType),
                                            padding: "2px 8px",
                                            borderRadius: "10px",
                                            fontSize: "0.8rem",
                                        }}
                                    >
                                        {s.signalType || "—"}
                                    </span>
                                </td>
                                <td
                                    style={{
                                        ...td,
                                        textAlign: "right",
                                        fontWeight: 600,
                                        color: (s.compositeScore ?? 0) >= 0 ? "#1a7f37" : "#cf222e",
                                    }}
                                >
                                    {fmt(s.compositeScore, 2)}
                                </td>
                                <td style={{ ...td, textAlign: "right" }}>{fmt(s.qualityScore)}</td>
                                <td style={{ ...td, textAlign: "right" }}>{fmt(s.newsBurst20d)}</td>
                                <td style={{ ...td, textAlign: "center" }}>
                                    {s.earningsBeatSignal ? "📈 beat" : s.earningsMissSignal ? "📉 miss" : "—"}
                                </td>
                                <td style={{ ...td, textAlign: "right", color: signedColor(s.ahGap) }}>
                                    {fmtPct(s.ahGap)}
                                </td>
                                <td style={{ ...td, textAlign: "right", color: signedColor(s.analystBuyRatioChg1m) }}>
                                    {fmtPct(s.analystBuyRatioChg1m)}
                                </td>
                                <td style={{ ...td, textAlign: "right", color: signedColor(s.instHoldingPctChg) }}>
                                    {fmtPct(s.instHoldingPctChg)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}
