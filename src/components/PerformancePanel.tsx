import { useEffect, useMemo, useState } from "react";
import { fetchPerformance } from "../api/performance";
import type { Performance, PerfStats } from "../api/performance";

const pct = (v: number | null | undefined): string =>
    v === null || v === undefined ? "—" : `${(v * 100).toFixed(1)}%`;

const W = 900;
const H = 320;
const PAD = { l: 48, r: 16, t: 16, b: 28 };

function buildPaths(curve: { strategy: number; benchmark: number }[]) {
    if (curve.length === 0) return { strat: "", bench: "", yTicks: [] as { y: number; label: string }[] };
    const all = curve.flatMap((p) => [p.strategy, p.benchmark]).filter((v) => v > 0);
    const lo = Math.log(Math.min(...all));
    const hi = Math.log(Math.max(...all));
    const span = hi - lo || 1;
    const innerW = W - PAD.l - PAD.r;
    const innerH = H - PAD.t - PAD.b;
    const x = (i: number) => PAD.l + (innerW * i) / (curve.length - 1 || 1);
    const y = (v: number) => PAD.t + innerH * (1 - (Math.log(v) - lo) / span);
    const line = (key: "strategy" | "benchmark") =>
        curve.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ");
    // y ticks at a few equity multiples
    const ticks = [Math.min(...all), Math.exp((lo + hi) / 2), Math.max(...all)];
    const yTicks = ticks.map((v) => ({ y: y(v), label: `${v.toFixed(1)}x` }));
    return { strat: line("strategy"), bench: line("benchmark"), yTicks };
}

function StatBlock({ title, color, s }: { title: string; color: string; s?: PerfStats }) {
    if (!s) return null;
    const rows: [string, string, string?][] = [
        ["Total return", pct(s.total_return)],
        ["Annualised", pct(s.ann_return)],
        ["Sharpe", s.sharpe?.toFixed(2) ?? "—"],
        ["Max drawdown", pct(s.max_drawdown)],
        ["Win rate", pct(s.win_rate)],
    ];
    return (
        <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontWeight: 700, color, marginBottom: 6 }}>{title}</div>
            {rows.map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", padding: "2px 0" }}>
                    <span style={{ color: "#57606a" }}>{k}</span>
                    <b>{v}</b>
                </div>
            ))}
        </div>
    );
}

export default function PerformancePanel() {
    const [perf, setPerf] = useState<Performance | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchPerformance()
            .then(setPerf)
            .catch((e) => setError(String(e)))
            .finally(() => setLoading(false));
    }, []);

    const curve = perf?.equity_curve ?? [];
    const paths = useMemo(() => buildPaths(curve), [curve]);

    if (loading) return <p>Loading performance...</p>;
    if (error) return <p style={{ color: "#cf222e" }}>Failed to load: {error}</p>;
    if (!perf || curve.length === 0) return <p style={{ color: "#6e7781" }}>No backtest yet.</p>;

    return (
        <div style={{ padding: "0.5rem" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 12 }}>
                <h2 style={{ margin: 0 }}>Strategy Performance</h2>
                <span style={{ color: "#57606a" }}>
                    {perf.start_date} → {perf.end_date} · {perf.rebalances} rebalances · {perf.hold_days}d hold · top {perf.top_n}
                </span>
            </div>

            <div style={{ display: "flex", gap: 40, marginBottom: 16, maxWidth: 520 }}>
                <StatBlock title="Strategy" color="#1f6feb" s={perf.stats?.strategy} />
                <StatBlock title="SPY (benchmark)" color="#6e7781" s={perf.stats?.benchmark} />
            </div>

            <div style={{ display: "flex", gap: 16, marginBottom: 6, fontSize: "0.85rem" }}>
                <span style={{ color: "#1f6feb" }}>■ Strategy</span>
                <span style={{ color: "#8c959f" }}>■ SPY</span>
                <span style={{ color: "#8c959f" }}>(log scale, growth of $1)</span>
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ background: "#fcfcfd", borderRadius: 8, border: "1px solid #eaeef2" }}>
                {paths.yTicks.map((t, i) => (
                    <g key={i}>
                        <line x1={PAD.l} y1={t.y} x2={W - PAD.r} y2={t.y} stroke="#eaeef2" />
                        <text x={4} y={t.y + 4} fontSize="11" fill="#8c959f">{t.label}</text>
                    </g>
                ))}
                <path d={paths.bench} fill="none" stroke="#8c959f" strokeWidth="1.5" />
                <path d={paths.strat} fill="none" stroke="#1f6feb" strokeWidth="2" />
            </svg>
        </div>
    );
}
