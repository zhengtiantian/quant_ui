import React from "react";
import type { Bilingual, NewsJudgment } from "../../api/markets";
import { DOWN, UP, muted, pill } from "./format";

/**
 * N.6: the newest news-storyline judgment of a stock (quant_ai /portfolio/news-linkage), shown under its
 * Action pill. A hint only: the action above it is unchanged. All words come from the server in both
 * languages; the language is the briefs' (briefLang), which the Action cell's switch also sets.
 */
const lang = (): "zh" | "en" => {
  try { return localStorage.getItem("briefLang") === "en" ? "en" : "zh"; } catch { return "zh"; }
};
const head: React.CSSProperties = { color: "#81dad3", marginTop: 6, fontSize: 12 };

const NewsHint: React.FC<{ j?: NewsJudgment; labels?: Record<string, Bilingual> }> = ({ j, labels }) => {
  const [open, setOpen] = React.useState(false);
  if (!j) return null;
  const l = lang();
  const t = (k: string, fallback: string) => labels?.[k]?.[l] ?? fallback;
  const c = j.direction < 0 ? DOWN : j.direction > 0 ? UP : "#99a0a8";
  const when = new Date(j.at).toLocaleString("en-GB", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  return (
    <div style={{ marginTop: 4 }} onClick={(e) => e.stopPropagation()}>
      <button type="button" onClick={() => setOpen(!open)} title={j.summary[l]}
              style={{ ...pill(c), cursor: "pointer", background: "transparent", fontWeight: j.direction ? 600 : 400 }}>
        {j.label[l]} {open ? "▴" : "▾"}</button>
      {open ? (
        <div style={{ ...muted, marginTop: 4, maxWidth: 380, whiteSpace: "normal", lineHeight: 1.45 }}>
          <div style={{ color: "#bbc0c5" }}><b>{j.summary[l]}</b></div>
          <div>{j.detail[l]} · {t("judged", "Judged")} {when}</div>
          {j.storylines.length ? <div style={head}>{t("storylines", "Storylines")}</div> : null}
          {j.storylines.map((s, i) => <div key={i}>• {s.head} <span style={{ opacity: 0.8 }}>({s.reason[l]}, {s.n24}/24h)</span></div>)}
          {j.chain.length ? <div style={head}>{t("chain", "Why")}</div> : null}
          {j.chain.map((s, i) => <div key={i}>{i + 1}. {s}</div>)}
          {j.watch.length ? <div style={head}>{t("watch", "Watch for")}</div> : null}
          {j.watch.map((s, i) => <div key={i}>• {s}</div>)}
          {j.others.length ? <div style={head}>{t("others", "Other companies")}</div> : null}
          {j.others.map((o, i) => (
            <div key={i}>• <b style={{ color: o.direction < 0 ? DOWN : o.direction > 0 ? UP : undefined }}>{o.symbol} {o.label[l]}</b>: {o.why}</div>
          ))}
          {j.sources.length ? <div style={head}>{t("sources", "Sources")}</div> : null}
          {j.sources.map((s, i) => (
            <div key={i}>• {s.url ? <a href={s.url} target="_blank" rel="noreferrer" style={{ color: "#aeb4ba" }}>{s.title || s.url}</a> : s.title}</div>
          ))}
          <div style={{ marginTop: 6, opacity: 0.8 }}>{t("hint", "A hint from the news alone: the action above is unchanged.")}</div>
        </div>
      ) : null}
    </div>
  );
};

export default NewsHint;
