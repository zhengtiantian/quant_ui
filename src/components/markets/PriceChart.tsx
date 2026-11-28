/**
 * A dependency-free SVG price chart: a thin line by default, candles on request, with the volume of each
 * bar underneath (2026-11-26) on the same time axis. Intraday candles carry their session, so pre-market
 * and after-hours stretches are shaded in both panes.
 */
import React from "react";
import type { Candle } from "../../api/markets";
import { tr, useLang } from "../../lang";
import { DOWN, UP, num, volumeText } from "./format";

const W = 760;
const PAD = { l: 8, r: 58, t: 10, b: 24 };
const PRICE_H = 266;
const GAP = 12;
const VOL_H = 72;
const VOL_TOP = PAD.t + PRICE_H + GAP;
const H = VOL_TOP + VOL_H + PAD.b;
const CLIP = 3;

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
  const [lang] = useLang();
  const [hover, setHover] = React.useState<number | null>(null);
  if (!candles.length) return <div style={{ padding: 40, color: "#99a0a8" }}>No data</div>;
  const lows = candles.map((c) => (type === "line" ? c.close : c.low));
  const highs = candles.map((c) => (type === "line" ? c.close : c.high));
  if (prevClose) { lows.push(prevClose); highs.push(prevClose); }
  let lo = Math.min(...lows), hi = Math.max(...highs);
  if (hi - lo < 1e-9) { hi += 1; lo -= 1; }
  const padY = (hi - lo) * 0.06;
  lo -= padY; hi += padY;
  const iw = W - PAD.l - PAD.r, ih = PRICE_H;
  const step = iw / candles.length;
  const x = (i: number) => PAD.l + step * (i + 0.5);
  const y = (v: number) => PAD.t + (hi - v) / (hi - lo) * ih;
  const first = candles[0].close, last = candles[candles.length - 1].close;
  const lineColor = last >= (prevClose ?? first) ? UP : DOWN;
  const ticks = Array.from({ length: 5 }, (_, i) => lo + (hi - lo) * (i + 0.5) / 5);
  const xTicks = Array.from({ length: 6 }, (_, i) => Math.round((candles.length - 1) * i / 5));
  const bw = Math.max(1, step * 0.65);

  // Volume: bars against the largest in view. One bar more than CLIP times the next (the 16:00 closing
  // auction on the 1D chart) would flatten all the others: the scale then follows the next one and that
  // bar is cut at the top, marked, with its full figure in the tooltip. A bar takes its candle's colour;
  // on the line chart, where no candles are drawn, it is coloured by the close against the bar before.
  const vols = candles.map((c) => c.volume || 0);
  const [top1, top2] = [...vols].sort((a, b) => b - a);
  const maxVol = top2 > 0 && top1 > CLIP * top2 ? top2 * 1.1 : Math.max(0, top1 ?? 0);
  const vy = (v: number) => VOL_TOP + VOL_H - (maxVol > 0 ? Math.min(v, maxVol) / maxVol * VOL_H : 0);
  const barUp = (i: number) => {
    const c = candles[i];
    return type === "candle" || i === 0 ? c.close >= c.open : c.close >= candles[i - 1].close;
  };

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
          <g key={a}>
            <rect x={PAD.l + step * a} y={PAD.t} width={step * (b - a + 1)} height={ih} fill="#7a838e" opacity={0.09} />
            <rect x={PAD.l + step * a} y={VOL_TOP} width={step * (b - a + 1)} height={VOL_H} fill="#7a838e" opacity={0.09} />
          </g>
        ))}
        {ticks.map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="#6c747f" strokeWidth={0.6} />
            <text x={W - PAD.r + 6} y={y(v) + 4} fontSize={11} fill="#99a0a8">{num(v)}</text>
          </g>
        ))}
        {prevClose ? (
          <line x1={PAD.l} x2={W - PAD.r} y1={y(prevClose)} y2={y(prevClose)} stroke="#7a838e" strokeDasharray="4 4" strokeWidth={0.8} />
        ) : null}
        {xTicks.map((i) => (
          <text key={i} x={x(i)} y={H - 6} fontSize={11} fill="#99a0a8" textAnchor="middle">{label(candles[i].time, intraday)}</text>
        ))}
        {type === "line" ? (
          <polyline fill="none" stroke={lineColor} strokeWidth={1.3} strokeLinejoin="round"
                    points={candles.map((c, i) => `${x(i)},${y(c.close)}`).join(" ")} />
        ) : (
          candles.map((c, i) => {
            const up = c.close >= c.open, col = up ? UP : DOWN;
            return (
              <g key={i}>
                <line x1={x(i)} x2={x(i)} y1={y(c.high)} y2={y(c.low)} stroke={col} strokeWidth={0.8} />
                <rect x={x(i) - bw / 2} width={bw} y={y(Math.max(c.open, c.close))}
                      height={Math.max(0.8, Math.abs(y(c.open) - y(c.close)))} fill={up ? "#23272c" : col} stroke={col} strokeWidth={0.8} />
              </g>
            );
          })
        )}

        {/* volume pane */}
        <line x1={PAD.l} x2={W - PAD.r} y1={VOL_TOP + VOL_H} y2={VOL_TOP + VOL_H} stroke="#6c747f" strokeWidth={0.6} />
        <line x1={PAD.l} x2={W - PAD.r} y1={VOL_TOP} y2={VOL_TOP} stroke="#4b545f" strokeWidth={0.5} strokeDasharray="2 3" />
        <text x={W - PAD.r + 6} y={VOL_TOP + 8} fontSize={11} fill="#99a0a8">{volumeText(maxVol)}</text>
        <text x={W - PAD.r + 6} y={VOL_TOP + VOL_H} fontSize={11} fill="#99a0a8">{tr(lang, "Vol", "成交量")}</text>
        {candles.map((c, i) => (c.volume ? (
          <g key={`v${i}`}>
            <rect x={x(i) - bw / 2} width={bw} y={vy(c.volume)} height={Math.max(0.5, VOL_TOP + VOL_H - vy(c.volume))}
                  fill={barUp(i) ? UP : DOWN} opacity={c.partial ? 0.3 : hover === i ? 0.95 : 0.6} />
            {c.volume > maxVol ? <rect x={x(i) - bw / 2 - 1} width={bw + 2} y={VOL_TOP - 3} height={2} fill="#e4e5e7" /> : null}
          </g>
        ) : null))}

        {h ? <line x1={x(hover!)} x2={x(hover!)} y1={PAD.t} y2={VOL_TOP + VOL_H} stroke="#bbc0c5" strokeWidth={0.5} /> : null}
      </svg>
      {h ? (
        <div style={{ position: "absolute", top: 4, left: 8, fontSize: 12, background: "rgba(35,39,44,0.9)", padding: "2px 8px",
                      borderRadius: 6, border: "1px solid #434b56", fontVariantNumeric: "tabular-nums" }}>
          {label(h.time, intraday)}{intraday && h.session && h.session !== "regular" ? ` · ${h.session === "pre" ? "pre-market" : "after hours"}` : ""}
          {type === "line" ? ` · ${num(h.close)}` : ` · O ${num(h.open)} H ${num(h.high)} L ${num(h.low)} C ${num(h.close)}`}
          {` · ${tr(lang, "Vol", "量")} ${volumeText(h.volume)}`}
          {h.partial ? " · today so far" : ""}
        </div>
      ) : null}
    </div>
  );
};

export default PriceChart;
