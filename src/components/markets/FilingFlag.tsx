import React from "react";
import { useLang } from "../../lang";
import type { Bilingual, FilingFlag as Flag } from "../../api/markets";
import { muted, pill } from "./format";

/**
 * Q.17.5: the latest 10-K / 10-Q changed its risk factors more than 80% of filings do (quant_ai
 * /portfolio/filing-changes). A base rate for that kind of filing, not a forecast; the action is unchanged.
 * Words come from the server in both languages; the language is the dashboard's (lang.tsx: English unless switched).
 */

const FilingFlag: React.FC<{ f?: Flag; labels?: Record<string, Bilingual> }> = ({ f, labels }) => {
  const [open, setOpen] = React.useState(false);
  const [l] = useLang();
  if (!f) return null;
  const t = (k: string, fallback: string) => labels?.[k]?.[l] ?? fallback;
  return (
    <div style={{ marginTop: 4 }} onClick={(e) => e.stopPropagation()}>
      <button type="button" onClick={() => setOpen(!open)} title={f.text[l]}
              style={{ ...pill("#d9b36c"), cursor: "pointer", background: "transparent" }}>
        {t("flag", "Risk factors rewritten")} · {f.form} {f.date} {open ? "▴" : "▾"}</button>
      {open ? (
        <div style={{ ...muted, marginTop: 4, maxWidth: 380, whiteSpace: "normal", lineHeight: 1.45 }}>
          <div>{f.direction ? t(f.direction, f.direction) + " · " : ""}{f.text[l]}</div>
          {f.url ? <a href={f.url} target="_blank" rel="noreferrer" style={{ color: "#aeb4ba" }}>{t("filing", "Filing")}</a> : null}
        </div>
      ) : null}
    </div>
  );
};

export default FilingFlag;
