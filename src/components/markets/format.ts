/** Number formatting and shared styles for the portfolio, global markets and briefs pages. */
import type React from "react";

export const UP = "#84d6a3";
export const DOWN = "#d88383";
export const FLAT = "#99a0a8";

export const usd = (v: number | null | undefined, dp = 2): string =>
  v == null || Number.isNaN(v)
    ? "—"
    : `${v < 0 ? "-$" : "$"}${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;
export const signed = (v: number | null | undefined, dp = 2): string =>
  v == null || Number.isNaN(v) ? "—" : `${v > 0 ? "+" : ""}${usd(v, dp)}`;
export const pct = (v: number | null | undefined): string =>
  v == null || Number.isNaN(v) ? "" : `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
export const qty = (v: number): string => v.toLocaleString("en-US", { maximumFractionDigits: 6 });
export const num = (v: number | null | undefined, dp = 2): string =>
  v == null ? "—" : v.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
export const color = (v: number | null | undefined): string =>
  v == null || Math.abs(v) < 1e-9 ? FLAT : v > 0 ? UP : DOWN;
export const shortName = (name?: string): string =>
  (name || "").replace(/ (Common Stock|Class [A-C] .*|Ordinary Shares.*)$/i, "");

export const SESSION_LABEL: Record<string, string> = {
  pre: "Pre-market", regular: "Open", post: "After hours", closed: "Closed",
};
export const SESSION_COLOR: Record<string, string> = {
  pre: "#e3b177", regular: "#84d6a3", post: "#a17edd", closed: "#99a0a8",
};

export const panel: React.CSSProperties = {
  background: "rgba(35,39,44,0.88)", border: "1px solid #434b56", borderRadius: 14,
  padding: "14px 16px", marginBottom: 16, boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
};
export const panelHead: React.CSSProperties = {
  display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 10,
};
export const panelTitle: React.CSSProperties = { fontWeight: 700, fontSize: 16 };
export const muted: React.CSSProperties = { color: "#99a0a8", fontSize: 12.5 };
export const cell: React.CSSProperties = {
  padding: "7px 10px", borderBottom: "1px solid #3e4752", fontVariantNumeric: "tabular-nums", verticalAlign: "top",
};
export const th: React.CSSProperties = {
  ...cell, fontSize: 11.5, color: "#99a0a8", textTransform: "uppercase", letterSpacing: "0.04em",
  borderBottom: "1px solid #434b56", textAlign: "left", fontWeight: 600, whiteSpace: "nowrap",
};
export const right: React.CSSProperties = { textAlign: "right" };
export const sub: React.CSSProperties = { display: "block", fontSize: 11.5, color: "#99a0a8" };
export const ghostButton: React.CSSProperties = {
  background: "#23272c", color: "#81dad3", border: "1px solid #52736e", padding: "0.4em 0.9em", fontSize: 13,
};
export const iconButton: React.CSSProperties = {
  background: "transparent", color: "#aeb4ba", border: "1px solid #434b56", padding: "2px 8px", fontSize: 12,
  marginLeft: 4, borderRadius: 8,
};

export const pill = (c: string): React.CSSProperties => ({
  display: "inline-block", fontSize: 11.5, fontWeight: 600, color: c, border: `1px solid ${c}55`,
  background: `${c}12`, borderRadius: 999, padding: "1px 8px", whiteSpace: "nowrap",
});
