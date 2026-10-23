/**
 * Country flag for the global markets panel. Emoji flags are used everywhere except Taiwan:
 * macOS hides the 🇹🇼 emoji when the system region is mainland China (it renders as letters or
 * an empty box), so that one is drawn as an inline SVG instead.
 */
import React from "react";

function taiwanSun(cx: number, cy: number, outer: number, inner: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 24; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / 12) * i - Math.PI / 2;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(3)},${(cy + r * Math.sin(a)).toFixed(3)}`);
  }
  return pts.join(" ");
}

export const TaiwanFlag: React.FC<{ height?: number }> = ({ height = 14 }) => (
  <svg viewBox="0 0 30 20" height={height} style={{ verticalAlign: "-0.15em", borderRadius: 2 }} role="img" aria-label="Taiwan">
    <rect width="30" height="20" fill="#FE0000" />
    <rect width="15" height="10" fill="#000095" />
    <polygon points={taiwanSun(7.5, 5, 3.75, 2.05)} fill="#fff" />
    <circle cx="7.5" cy="5" r="2.05" fill="#000095" />
    <circle cx="7.5" cy="5" r="1.75" fill="#fff" />
  </svg>
);

const Flag: React.FC<{ code: string; emoji: string; size?: number }> = ({ code, emoji, size = 14 }) =>
  code === "TW" ? <TaiwanFlag height={size} /> : <span>{emoji}</span>;

export default Flag;
