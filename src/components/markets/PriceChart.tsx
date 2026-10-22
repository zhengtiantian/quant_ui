/**
 * A dependency-free SVG price chart: a thin line by default, candles on request. Intraday
 * candles carry their session, so pre-market and after-hours stretches are shaded.
 */
import React from "react";
import type { Candle } from "../../api/markets";
import { DOWN, UP, num } from "./format";

const W = 760;
const H = 300;
const PAD = { l: 8, r: 58, t: 10, b: 24 };

const label = (t: number | string, intraday: boolean): string => {
  if (typeof t === "string") return t.slice(5);
  // Intraday times are US-Eastern wall-clock encoded as UTC (see markets/portfolio.py).
  const d = new Date(t * 1000);
  return intraday
    ? `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`
    : d.toISOString().slice(5, 10);
};

const PriceChart: React.FC<{ candles: Candle[]; type: "line" | "candle"; prevClose?: number | null; intraday: boolean }> = ({
  candles, type, prevClose, intraday,
}) => {
  const [hover, setHover] = React.useState<number | null>(null);
  if (!candles.length) return <div style={{ padding: 40, color: "#64748b" }}>No data</div>;
  const lows = candles.map((c) => (type === "line" ? c.close : c.low));
  const highs = candles.map((c) => (type === "line" ? c.close : c.high));
  if (prevClose) { lows.push(prevClose); highs.push(prevClose); }
  let lo = Math.min(...lows), hi = Math.max(...highs);
  if (hi - lo < 1e-9) { hi += 1; lo -= 1; }
  const padY = (hi - lo) * 0.06;
  lo -= padY; hi += padY;
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  const step = iw / candles.length;
  const x = (i: number) => PAD.l + step * (i + 0.5);
  const y = (v: number) => PAD.t + (hi - v) / (hi - lo) * ih;
  const first = candles[0].close, last = candles[candles.length - 1].close;
  const lineColor = last >= (prevClose ?? first) ? UP : DOWN;
  const ticks = Array.from({ length: 5 }, (_, i) => lo + (hi - lo) * (i + 0.5) / 5);
  const xTicks = Array.from({ length: 6 }, (_, i) => Math.round((candles.length - 1) * i / 5));

  // Shaded runs of extended-hours candles.
  const shades: [number, number][] = [];
  candles.forEach((c, i) => {
    if (c.session && c.session !== "regular") {
      const lastRun = shades[shades.length - 1];
      if (lastRun && lastRun[1] === i - 1) lastRun[1] = i; else shades.push([i, i]);
    }
  });

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width * W;
    const i = Math.floor((px - PAD.l) / step);
    setHover(i >= 0 && i < candles.length ? i : null);
  };
  const h = hover != null ? candles[hover] : null;

  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" onMouseMove={onMove} onMouseLeave={() => setHover(null)}
           style={{ display: "block", fontFamily: "inherit" }}>
        {shades.map(([a, b]) => (
          <rect key={a} x={PAD.l + step * a} y={PAD.t} width={step * (b - a + 1)} height={ih} fill="#94a3b8" opacity={0.09} />
        ))}
        {ticks.map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="#e2e8f0" strokeWidth={0.6} />
            <text x={W - PAD.r + 6} y={y(v) + 4} fontSize={11} fill="#64748b">{num(v)}</text>
          </g>
        ))}
        {prevClose ? (
          <line x1={PAD.l} x2={W - PAD.r} y1={y(prevClose)} y2={y(prevClose)} stroke="#94a3b8" strokeDasharray="4 4" strokeWidth={0.8} />
        ) : null}
        {xTicks.map((i) => (
          <text key={i} x={x(i)} y={H - 6} fontSize={11} fill="#64748b" textAnchor="middle">{label(candles[i].time, intraday)}</text>
        ))}
        {type === "line" ? (
          <polyline fill="none" stroke={lineColor} strokeWidth={1.3} strokeLinejoin="round"
                    points={candles.map((c, i) => `${x(i)},${y(c.close)}`).join(" ")} />
        ) : (
          candles.map((c, i) => {
            const up = c.close >= c.open, col = up ? UP : DOWN;
            const bw = Math.max(1, step * 0.65);
            return (
              <g key={i}>
                <line x1={x(i)} x2={x(i)} y1={y(c.high)} y2={y(c.low)} stroke={col} strokeWidth={0.8} />
                <rect x={x(i) - bw / 2} width={bw} y={y(Math.max(c.open, c.close))}
                      height={Math.max(0.8, Math.abs(y(c.open) - y(c.close)))} fill={up ? "#fff" : col} stroke={col} strokeWidth={0.8} />
              </g>
            );
          })
        )}
        {h ? <line x1={x(hover!)} x2={x(hover!)} y1={PAD.t} y2={PAD.t + ih} stroke="#334155" strokeWidth={0.5} /> : null}
      </svg>
      {h ? (
        <div style={{ position: "absolute", top: 4, left: 8, fontSize: 12, background: "rgba(255,255,255,0.9)", padding: "2px 8px",
                      borderRadius: 6, border: "1px solid #e2e8f0", fontVariantNumeric: "tabular-nums" }}>
          {label(h.time, intraday)}{intraday && h.session && h.session !== "regular" ? ` · ${h.session === "pre" ? "pre-market" : "after hours"}` : ""}
          {type === "line" ? ` · ${num(h.close)}` : ` · O ${num(h.open)} H ${num(h.high)} L ${num(h.low)} C ${num(h.close)}`}
          {h.partial ? " · today so far" : ""}
        </div>
      ) : null}
    </div>
  );
};

export default PriceChart;
