/** The Volume column of the holdings and watchlist tables (2026-11-21): shares traded in a day, the last
 *  month (21 sessions) and the last year (252 sessions). "Day" is today so far once the regular session has
 *  traded, else the latest session; it is marked when it is 1.5x the month's average session or more. */
import React from "react";
import type { Quote, VolumeStats } from "../../api/markets";
import { tr, useLang } from "../../lang";
import { cell, right, sub } from "./format";

const BUSY = 1.5;

const volumeText = (v?: number | null): string => {
  if (v == null || !Number.isFinite(v)) return "—";
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return String(Math.round(v));
};

const VolumeCell: React.FC<{ q?: Quote; v?: VolumeStats }> = ({ q, v }) => {
  const [lang] = useLang();
  const L = (en: string, zh: string) => tr(lang, en, zh);
  // The quote's volume is today's only once today's regular session has traded.
  const today = q && (q.session === "regular" || q.session === "post") && q.volume ? q.volume : null;
  const day = today ?? v?.last_volume ?? null;
  const ratio = day != null && v?.month.avg ? day / v.month.avg : null;
  const busy = ratio != null && ratio >= BUSY;
  const title = v
    ? [
        today != null ? L(`Day: today so far ${volumeText(today)}`, `日：今天截至目前 ${volumeText(today)}`)
          : L(`Day: ${v.last_date}`, `日：${v.last_date}`),
        ratio != null ? L(`${ratio.toFixed(2)}x the month's average session`, `是近一个月日均的 ${ratio.toFixed(2)} 倍`) : "",
        L(`Month: ${v.month.sessions} sessions from ${v.month.from}, ${volumeText(v.month.avg)} a day`,
          `月：${v.month.from} 起 ${v.month.sessions} 个交易日，日均 ${volumeText(v.month.avg)}`),
        L(`Year: ${v.year.sessions} sessions from ${v.year.from}, ${volumeText(v.year.avg)} a day`,
          `年：${v.year.from} 起 ${v.year.sessions} 个交易日，日均 ${volumeText(v.year.avg)}`),
        v.stale ? L("The latest fetch failed: last good figures", "最近一次没取到，沿用上次数据") : "",
      ].filter(Boolean).join("\n")
    : L("Volume figures not in yet", "成交量数据还没算好");
  // Two lines: the day (with its multiple of the month's average when busy), then month · year.
  // A young listing's shorter windows are marked "*" and spelled out on hover.
  const short = v && (v.month.sessions < 21 || v.year.sessions < 252) ? "*" : "";
  return (
    <td style={{ ...cell, ...right, whiteSpace: "nowrap" }} title={title}>
      <b style={busy ? { color: "#e3b177" } : undefined}>{L("D", "日")} {volumeText(day)}</b>
      {busy ? <span style={{ color: "#e3b177", fontSize: 11.5, marginLeft: 4 }}>{ratio!.toFixed(1)}×</span> : null}
      <span style={sub}>{L("M", "月")} {volumeText(v?.month.total)} · {L("Y", "年")} {volumeText(v?.year.total)}{short}</span>
    </td>
  );
};

export default VolumeCell;
