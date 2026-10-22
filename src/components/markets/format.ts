/** Number formatting and shared styles for the portfolio, global markets and briefs pages. */
import type React from "react";

export const UP = "#15803d";
export const DOWN = "#b91c1c";
export const FLAT = "#64748b";

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
  pre: "#d97706", regular: "#15803d", post: "#7c3aed", closed: "#64748b",
};

export const panel: React.CSSProperties = {
  background: "rgba(255,255,255,0.85)", border: "1px solid #e2e8f0", borderRadius: 14,
  padding: "14px 16px", marginBottom: 16, boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
};
export const panelHead: React.CSSProperties = {
  display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 10,
};
export const panelTitle: React.CSSProperties = { fontWeight: 700, fontSize: 16 };
export const muted: React.CSSProperties = { color: "#64748b", fontSize: 12.5 };
export const cell: React.CSSProperties = {
  padding: "7px 10px", borderBottom: "1px solid #eef2f7", fontVariantNumeric: "tabular-nums", verticalAlign: "top",
};
export const th: React.CSSProperties = {
  ...cell, fontSize: 11.5, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em",
  borderBottom: "1px solid #e2e8f0", textAlign: "left", fontWeight: 600, whiteSpace: "nowrap",
};
export const right: React.CSSProperties = { textAlign: "right" };
export const sub: React.CSSProperties = { display: "block", fontSize: 11.5, color: "#64748b" };
export const ghostButton: React.CSSProperties = {
  background: "#fff", color: "#0f766e", border: "1px solid #99d5cc", padding: "0.4em 0.9em", fontSize: 13,
};
export const iconButton: React.CSSProperties = {
  background: "transparent", color: "#475569", border: "1px solid #e2e8f0", padding: "2px 8px", fontSize: 12,
  marginLeft: 4, borderRadius: 8,
};

export const pill = (c: string): React.CSSProperties => ({
  display: "inline-block", fontSize: 11.5, fontWeight: 600, color: c, border: `1px solid ${c}55`,
  background: `${c}12`, borderRadius: 999, padding: "1px 8px", whiteSpace: "nowrap",
});
