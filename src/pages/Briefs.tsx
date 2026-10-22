import React from "react";
import { fetchBrief, fetchBriefs, fetchMacro, runBrief } from "../api/markets";
import type { Brief, BriefsResponse, MacroState } from "../api/markets";
import Markdown from "../components/markets/Markdown";
import { DOWN, color, ghostButton, muted, num, panel, panelHead, panelTitle, pill } from "../components/markets/format";

/**
 * Daily market briefs, written by quant_ai (markets/briefs.py) with Claude Code on the user's
 * subscription: Asia & Europe at 14:00 Dublin, US markets after the after-hours session ends.
 * Each brief exists in Chinese and English; the language choice is remembered per browser.
 */

const KIND_LABEL: Record<string, string> = { asia_europe: "🌏 Asia & Europe", us: "🇺🇸 US markets" };
const store = {
  get: (k: string, d: string) => { try { return localStorage.getItem(k) || d; } catch { return d; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* per-viewer convenience only */ } },
};
const when = (ts: number | null) => (ts ? new Date(ts * 1000).toLocaleString() : "");

const MacroBoard: React.FC<{ m: MacroState | null }> = ({ m }) => {
  if (!m) return null;
  return (
    <div style={panel}>
      <div style={panelHead}><div style={panelTitle}>📊 Macro board</div><span style={muted}>CNBC, refreshed when this page loads</span></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 10 }}>
        {m.groups.map((g) => (
          <div key={g.name} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "8px 10px", background: "#fff" }}>
            <div style={{ ...muted, fontWeight: 700, marginBottom: 4 }}>{g.name}</div>
            {g.items.map((i) => (
              <div key={i.symbol} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, gap: 8, fontVariantNumeric: "tabular-nums" }}>
                <span>{i.name}</span>
                <span>{num(i.price, i.price != null && i.price < 10 ? 3 : 2)}{" "}
                  <b style={{ color: color(i.change_pct) }}>{i.change_pct != null ? `${i.change_pct > 0 ? "+" : ""}${i.change_pct.toFixed(2)}%` : ""}</b></span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

const Briefs: React.FC = () => {
  const [list, setList] = React.useState<BriefsResponse | null>(null);
  const [selected, setSelected] = React.useState<number | null>(null);
  const [brief, setBrief] = React.useState<Brief | null>(null);
  const [lang, setLang] = React.useState<"zh" | "en">(() => (store.get("briefLang", "zh") === "en" ? "en" : "zh"));
  const [kind, setKind] = React.useState("");
  const [macro, setMacro] = React.useState<MacroState | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      const r = await fetchBriefs(kind);
      setList(r);
      setError(null);
      setSelected((cur) => cur ?? r.briefs.find((b) => b.status === "done")?.id ?? r.briefs[0]?.id ?? null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [kind]);

  React.useEffect(() => { void load(); }, [load]);
  React.useEffect(() => { fetchMacro().then(setMacro).catch(() => setMacro(null)); }, []);
  React.useEffect(() => {
    if (selected == null) { setBrief(null); return; }
    fetchBrief(selected).then(setBrief).catch((e) => setError((e as Error).message));
  }, [selected, list]);
  // While a brief is being written, look again every 10 s.
  const running = !!list && (Object.values(list.kinds).some((k) => k.running) || list.briefs.some((b) => b.status === "running"));
  React.useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => void load(), 10000);
    return () => window.clearInterval(id);
  }, [running, load]);

  const generate = async (k: string) => {
    if (!window.confirm(`Write the ${KIND_LABEL[k]} brief now? It uses your Claude subscription quota and takes a few minutes.`)) return;
    try {
      const r = await runBrief(k);
      setList((cur) => (cur ? { ...cur, kinds: r.kinds } : cur));
      if (!r.started) setError("That brief is already being written");
      window.setTimeout(() => void load(), 1500);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const body = brief ? (lang === "zh" ? brief.body_zh : brief.body_en) : null;
  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <b style={{ fontSize: 18, marginRight: 8 }}>📰 Market briefs</b>
        <span style={muted}>Asia & Europe at 14:00 Dublin · US after 20:00 New York · weekdays · written by Claude with web search</span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {Object.keys(KIND_LABEL).map((k) => (
            <button key={k} style={ghostButton} disabled={list?.kinds[k]?.running} onClick={() => void generate(k)}>
              {list?.kinds[k]?.running ? "Writing…" : `Generate ${KIND_LABEL[k]} now`}
            </button>
          ))}
        </span>
      </div>
      {error ? <div style={{ ...panel, color: DOWN }}>{error}</div> : null}
      {list && !list.claude_found ? <div style={{ ...panel, color: DOWN }}>The claude CLI was not found on this Mac; briefs cannot be written.</div> : null}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 300px) 1fr", gap: 16, alignItems: "start" }}>
        <div style={{ ...panel, padding: 10 }}>
          <select value={kind} onChange={(e) => { setKind(e.target.value); setSelected(null); }}
                  style={{ width: "100%", marginBottom: 8, borderRadius: 8, border: "1px solid #cbd5e1", padding: "5px 8px" }}>
            <option value="">All briefs</option>
            <option value="asia_europe">Asia & Europe</option>
            <option value="us">US markets</option>
          </select>
          {!list ? <div style={muted}>Loading…</div> : !list.briefs.length ? <div style={muted}>No briefs yet.</div> : list.briefs.map((b) => (
            <div key={b.id} onClick={() => setSelected(b.id)}
                 style={{ padding: "8px 8px", borderRadius: 8, cursor: "pointer", marginBottom: 2, background: b.id === selected ? "#ecfdf5" : "transparent" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 6, fontSize: 12.5 }}>
                <b>{b.session_date}</b><span>{KIND_LABEL[b.kind]}</span>
              </div>
              <div style={{ fontSize: 13, color: b.status === "failed" ? DOWN : "#334155", marginTop: 2 }}>
                {b.status === "running" ? "⏳ Writing…" : b.status === "failed" ? `Failed (${b.attempts}×)` : (lang === "zh" ? b.headline_zh : b.headline_en)}
              </div>
            </div>
          ))}
        </div>

        <div style={panel}>
          {!brief ? <div style={muted}>Pick a brief.</div> : (
            <>
              <div style={panelHead}>
                <div>
                  <div style={{ ...muted }}>{KIND_LABEL[brief.kind]} · {brief.session_date}</div>
                  <div style={{ fontSize: 19, fontWeight: 800, marginTop: 2 }}>
                    {brief.status === "done" ? (lang === "zh" ? brief.headline_zh : brief.headline_en) : brief.status === "running" ? "⏳ Writing…" : "Failed"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  {(["zh", "en"] as const).map((l) => (
                    <button key={l} onClick={() => { setLang(l); store.set("briefLang", l); }}
                            style={{ ...ghostButton, padding: "3px 10px", background: lang === l ? "#0f766e" : "#fff", color: lang === l ? "#fff" : "#0f766e" }}>
                      {l === "zh" ? "ZH" : "EN"}
                    </button>
                  ))}
                </div>
              </div>
              {brief.status === "failed" ? <div style={{ color: DOWN, fontSize: 13.5 }}>{brief.error}</div> : null}
              {body ? <Markdown text={body} /> : null}
              {brief.sources.length ? (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>Sources</div>
                  <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>
                    {brief.sources.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.title}</a></li>)}
                  </ol>
                </div>
              ) : null}
              <div style={{ ...muted, marginTop: 12 }}>
                {brief.trigger === "manual" ? <span style={pill("#7c3aed")}>Manual</span> : <span style={pill("#0f766e")}>Scheduled</span>}{" "}
                Written {when(brief.finished_at)}{brief.duration_s ? ` in ${Math.round(brief.duration_s)} s` : ""}
                {brief.model ? ` · ${brief.model}` : ""}{brief.cost_usd ? ` · ≈ $${brief.cost_usd.toFixed(2)} at API prices (subscription)` : ""}
                {" "}· numbers from a snapshot taken when it was written; reasons from the cited sources. Not investment advice.
              </div>
            </>
          )}
        </div>
      </div>
      <MacroBoard m={macro} />
    </div>
  );
};

export default Briefs;
