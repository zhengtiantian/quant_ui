import React from "react";
import { useLang } from "../../lang";
import type { Bilingual, DevilsAdvocateItem } from "../../api/markets";
import { DOWN, iconButton, muted, pill } from "./format";

/**
 * Q.17.1: the case against adding before averaging down (quant_ai /portfolio/devils-advocate), shown under a
 * holding's Action cell. Written automatically after a drop of 2 x ATR or more, or when the buy gate starts
 * refusing an add, and on demand with the button. A hint only: the action above it is unchanged. All words
 * come from the server in both languages; the language is the dashboard's (lang.tsx: English unless switched).
 */
const head: React.CSSProperties = { color: "#81dad3", marginTop: 6, fontSize: 12 };
const STRENGTH_COLOR = { strong: DOWN, moderate: "#d9b36c", weak: "#99a0a8" } as const;

const DevilsAdvocate: React.FC<{ symbol: string; item?: DevilsAdvocateItem; labels?: Record<string, Bilingual>; onAsk: (symbol: string) => void }> =
  ({ symbol, item, labels, onAsk }) => {
  const [open, setOpen] = React.useState(false);
  const [l] = useLang();
  const t = (k: string, fallback: string) => labels?.[k]?.[l] ?? fallback;
  const busy = item?.status === "queued" || item?.status === "running";
  const ask = <button type="button" style={{ ...iconButton, marginLeft: 0 }} disabled={busy} onClick={() => onAsk(symbol)}
                      title="Claude writes the strongest case against buying more now (about a minute)">
    {item ? t("ask", "Ask again") : t("button", "Case against adding")}</button>;
  if (!item) return <div style={{ marginTop: 4 }} onClick={(e) => e.stopPropagation()}>{ask}</div>;
  if (busy) return <div style={{ ...muted, marginTop: 4 }} onClick={(e) => e.stopPropagation()}>{t("running", "Writing the case against adding…")}</div>;
  const a = item.answer;
  if (!a) {
    return (
      <div style={{ ...muted, marginTop: 4 }} onClick={(e) => e.stopPropagation()}>
        {item.status === "invalid" ? t("invalid", "The answer was set aside") : t("error", "Could not write it")} {ask}
      </div>
    );
  }
  const c = STRENGTH_COLOR[a.strength] ?? "#99a0a8";
  const when = new Date(item.finished_at || item.requested_at).toLocaleString("en-GB", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const src = Object.fromEntries(item.sources.map((s) => [s.id, s]));
  return (
    <div style={{ marginTop: 4 }} onClick={(e) => e.stopPropagation()}>
      <button type="button" onClick={() => setOpen(!open)} title={a.summary[l]}
              style={{ ...pill(c), cursor: "pointer", background: "transparent" }}>
        {t(a.strength, a.strength)} {open ? "▴" : "▾"}</button>
      {open ? (
        <div style={{ ...muted, marginTop: 4, maxWidth: 380, whiteSpace: "normal", lineHeight: 1.45 }}>
          <div style={{ color: "#bbc0c5" }}><b>{a.summary[l]}</b></div>
          <div>{t(item.trigger, item.trigger)} · {when}</div>
          <div style={head}>{t("points", "Against adding now")}</div>
          {a.points.map((p, i) => (
            <div key={i}>{i + 1}. {l === "en" ? p.en : p.zh}
              {p.cites.filter((id) => src[id]?.url).map((id) => (
                <a key={id} href={src[id].url!} target="_blank" rel="noreferrer" style={{ color: "#aeb4ba", marginLeft: 4 }} title={src[id].title}>[{id}]</a>
              ))}</div>
          ))}
          <div style={head}>{t("base_rate", "Base rates")}</div>
          <div>{a.base_rate[l]}</div>
          <div style={head}>{t("would_weaken", "What would weaken this case")}</div>
          <div>{a.would_weaken[l]}</div>
          {item.sources.length ? <div style={head}>{t("sources", "Sources")}</div> : null}
          {item.sources.map((s) => (
            <div key={s.id}>[{s.id}] {s.url ? <a href={s.url} target="_blank" rel="noreferrer" style={{ color: "#aeb4ba" }}>{s.title || s.url}</a> : s.title}</div>
          ))}
          <div style={{ marginTop: 6, opacity: 0.8 }}>{t("hint", "A hint: the action and the advice are unchanged.")}</div>
          <div style={{ marginTop: 4 }}>{ask}</div>
        </div>
      ) : null}
    </div>
  );
};

export default DevilsAdvocate;
