import React from "react";
import { fetchBrief, fetchBriefs, fetchMacro, fetchScorecard, runBrief } from "../api/markets";
import type { Brief, BriefMeta, BriefsResponse, MacroState, Prediction, PredictionStats, Scorecard } from "../api/markets";
import Markdown from "../components/markets/Markdown";
import { DOWN, UP, cell, color, ghostButton, muted, num, panel, panelHead, panelTitle, pill, right, th } from "../components/markets/format";

/**
 * Market briefs, written by quant_ai (markets/briefs.py) with Claude Code on the user's
 * subscription, each in Chinese and English:
 *   summaries   Asia & Europe at 14:00 Dublin, US markets after the after-hours session ends;
 *   forward     Week ahead at 13:30 Dublin (earnings, data, scenarios), and a Flash whenever a sector
 *               bellwether moves 5%+ outside regular hours (how the move should travel).
 * Every brief ends with checkable predictions, scored against real closes; the scorecard keeps
 * the track record (hit rate, and the Brier score of the stated confidence).
 */

const KIND_LABEL: Record<string, string> = {
  asia_europe: "🌏 Asia & Europe", us: "🇺🇸 US markets", outlook: "🔭 Week ahead", flash: "⚡ Flash", advisor: "🧭 Holdings advisor",
};
const KIND_GROUP: Record<string, string> = { asia_europe: "Summary", us: "Summary", outlook: "Forward", flash: "Forward", advisor: "Advice" };
const OP_TEXT: Record<string, string> = { ">=": "≥", "<=": "≤", "abs>=": "|move| ≥", "abs<=": "|move| ≤" };
const STATUS_COLOR: Record<string, string> = { hit: "#15803d", miss: "#b91c1c", pending: "#64748b", void: "#94a3b8" };
const store = {
  get: (k: string, d: string) => { try { return localStorage.getItem(k) || d; } catch { return d; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* per-viewer convenience only */ } },
};
const when = (ts: number | null) => (ts ? new Date(ts * 1000).toLocaleString() : "");
const label = (b: BriefMeta) => `${KIND_LABEL[b.kind] || b.kind}${b.topic ? ` · ${b.topic}` : ""}`;
const pctText = (v: number | null) => (v == null ? "—" : `${(v * 100).toFixed(0)}%`);

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

const PredictionRows: React.FC<{ rows: Prediction[]; lang: "zh" | "en"; showBrief?: boolean }> = ({ rows, lang, showBrief }) => (
  <div style={{ overflowX: "auto" }}>
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead><tr>
        <th style={th}>Call</th>{showBrief ? <th style={th}>From</th> : null}<th style={th}>Date</th>
        <th style={th}>Condition</th><th style={{ ...th, ...right }}>Confidence</th><th style={{ ...th, ...right }}>Actual</th><th style={th}>Result</th>
      </tr></thead>
      <tbody>{rows.map((p) => (
        <tr key={p.id}>
          <td style={cell}>{(lang === "zh" ? p.text_zh : p.text_en) || p.text_en || p.text_zh}</td>
          {showBrief ? <td style={{ ...cell, whiteSpace: "nowrap" }}>{KIND_LABEL[p.kind]}</td> : null}
          <td style={{ ...cell, whiteSpace: "nowrap" }}>{p.target_date}</td>
          <td style={{ ...cell, whiteSpace: "nowrap" }}><b>{p.name || p.symbol}</b> {OP_TEXT[p.op]} {p.threshold > 0 && p.op.length === 2 ? "+" : ""}{p.threshold}%</td>
          <td style={{ ...cell, ...right }}>{p.confidence != null ? `${Math.round(p.confidence * 100)}%` : "—"}</td>
          <td style={{ ...cell, ...right, color: color(p.actual) }}>{p.actual != null ? `${p.actual > 0 ? "+" : ""}${p.actual.toFixed(2)}%` : "—"}</td>
          <td style={cell}><span style={pill(STATUS_COLOR[p.status])} title={p.note || ""}>{p.status === "hit" ? "✓ Hit" : p.status === "miss" ? "✗ Miss" : p.status === "void" ? "Void" : "Pending"}</span></td>
        </tr>
      ))}</tbody>
    </table>
  </div>
);

const StatLine: React.FC<{ name: string; s: PredictionStats }> = ({ name, s }) => (
  <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "8px 12px", background: "#fff", minWidth: 170 }}>
    <div style={{ ...muted, fontWeight: 700 }}>{name}</div>
    <div style={{ fontSize: 20, fontWeight: 800, color: s.hit_rate == null ? "#334155" : s.hit_rate >= 0.5 ? UP : DOWN }}>{pctText(s.hit_rate)}</div>
    <div style={muted}>{s.hits}/{s.scored} hit · {s.pending} pending
      {s.brier != null ? <> · Brier <b>{s.brier.toFixed(3)}</b></> : null}
      {s.mean_confidence != null ? <> · avg conf {pctText(s.mean_confidence)}</> : null}</div>
  </div>
);

const ScorecardPanel: React.FC<{ card: Scorecard | null; lang: "zh" | "en" }> = ({ card, lang }) => {
  const [open, setOpen] = React.useState(false);
  if (!card) return null;
  return (
    <div style={panel}>
      <div style={panelHead}>
        <div style={panelTitle}>🎯 Prediction scorecard</div>
        <span style={muted}>Every brief ends with checkable calls, scored against the real close after the market shuts. Brier score: 0 is perfect, 0.25 is what always saying 50% earns.</span>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <StatLine name="All briefs" s={card.overall} />
        {Object.entries(card.by_kind).map(([k, s]) => <StatLine key={k} name={KIND_LABEL[k] || k} s={s} />)}
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "8px 12px", background: "#fff" }}>
          <div style={{ ...muted, fontWeight: 700 }}>Calibration (stated confidence → hit rate)</div>
          {card.calibration.map((b) => (
            <div key={b.range} style={{ fontSize: 12.5, fontVariantNumeric: "tabular-nums" }}>{b.range}: <b>{pctText(b.hit_rate)}</b> <span style={muted}>({b.scored})</span></div>
          ))}
        </div>
      </div>
      {card.recent.length ? (
        <details style={{ marginTop: 10 }} open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
          <summary style={{ cursor: "pointer", ...muted }}>Recent calls · {card.recent.length}</summary>
          <PredictionRows rows={card.recent} lang={lang} showBrief />
        </details>
      ) : <div style={{ ...muted, marginTop: 8 }}>No calls yet.</div>}
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
  const [card, setCard] = React.useState<Scorecard | null>(null);
  const [flashSymbol, setFlashSymbol] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      const r = await fetchBriefs(kind);
      setList(r);
      setError(null);
      setSelected((cur) => cur ?? r.briefs.find((b) => b.status === "done")?.id ?? r.briefs[0]?.id ?? null);
      fetchScorecard().then(setCard).catch(() => setCard(null));
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

  const generate = async (k: string, symbol = "") => {
    const what = k === "flash" ? `a flash brief on ${symbol}` : `the ${KIND_LABEL[k]} brief`;
    if (!window.confirm(`Write ${what} now? It uses your Claude subscription quota and takes a few minutes.`)) return;
    try {
      const r = await runBrief(k, symbol);
      setList((cur) => (cur ? { ...cur, kinds: r.kinds } : cur));
      if (!r.started) setError("That brief is already being written");
      window.setTimeout(() => void load(), 1500);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const body = brief ? (lang === "zh" ? brief.body_zh : brief.body_en) : null;
  const bw = list ? Object.keys(list.bellwethers) : [];
  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <b style={{ fontSize: 18, marginRight: 8 }}>📰 Market briefs</b>
        <span style={muted}>Week ahead 13:30 · Asia & Europe 14:00 Dublin · US after 20:00 New York · weekdays ·
          ⚡ Flash when a bellwether moves {list?.flash_threshold ?? 5}%+ outside regular hours</span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["outlook", "asia_europe", "us"].map((k) => (
            <button key={k} style={ghostButton} disabled={list?.kinds[k]?.running} onClick={() => void generate(k)}>
              {list?.kinds[k]?.running ? "Writing…" : `${KIND_LABEL[k]} now`}
            </button>
          ))}
          <input list="bellwethers" value={flashSymbol} onChange={(e) => setFlashSymbol(e.target.value.toUpperCase())} placeholder="LRCX"
                 style={{ width: 80, padding: "4px 8px", borderRadius: 8, border: "1px solid #cbd5e1", textTransform: "uppercase" }} />
          <datalist id="bellwethers">{bw.map((s) => <option key={s} value={s}>{list?.bellwethers[s]}</option>)}</datalist>
          <button style={ghostButton} disabled={!flashSymbol.trim() || list?.kinds.flash?.running} onClick={() => void generate("flash", flashSymbol.trim())}>
            {list?.kinds.flash?.running ? "Writing…" : "⚡ Flash now"}
          </button>
        </span>
      </div>
      {error ? <div style={{ ...panel, color: DOWN }}>{error}</div> : null}
      {list && !list.claude_found ? <div style={{ ...panel, color: DOWN }}>The claude CLI was not found on this Mac; briefs cannot be written.</div> : null}

      <ScorecardPanel card={card} lang={lang} />

      <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 300px) 1fr", gap: 16, alignItems: "start" }}>
        <div style={{ ...panel, padding: 10 }}>
          <select value={kind} onChange={(e) => { setKind(e.target.value); setSelected(null); }}
                  style={{ width: "100%", marginBottom: 8, borderRadius: 8, border: "1px solid #cbd5e1", padding: "5px 8px" }}>
            <option value="">All briefs</option>
            {Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{KIND_GROUP[k]} · {l}</option>)}
          </select>
          {!list ? <div style={muted}>Loading…</div> : !list.briefs.length ? <div style={muted}>No briefs yet.</div> : list.briefs.map((b) => (
            <div key={b.id} onClick={() => setSelected(b.id)}
                 style={{ padding: "8px 8px", borderRadius: 8, cursor: "pointer", marginBottom: 2, background: b.id === selected ? "#ecfdf5" : "transparent" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 6, fontSize: 12.5 }}>
                <b>{b.session_date}</b><span>{label(b)}</span>
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
                  <div style={{ ...muted }}>{KIND_GROUP[brief.kind]} · {label(brief)} · {brief.session_date}
                    {brief.context?.move_pct != null ? <> · trigger <b style={{ color: color(brief.context.move_pct) }}>{brief.context.move_pct > 0 ? "+" : ""}{brief.context.move_pct}%</b>{brief.context.session ? ` ${brief.context.session}` : ""}</> : null}</div>
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
              {brief.predictions?.length ? (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>🎯 Predictions in this brief</div>
                  <PredictionRows rows={brief.predictions} lang={lang} />
                </div>
              ) : null}
              {brief.sources.length ? (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>Sources</div>
                  <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>
                    {brief.sources.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.title}</a></li>)}
                  </ol>
                </div>
              ) : null}
              <div style={{ ...muted, marginTop: 12 }}>
                {brief.trigger === "manual" ? <span style={pill("#7c3aed")}>Manual</span> : <span style={pill("#0f766e")}>{brief.kind === "flash" ? "Triggered" : "Scheduled"}</span>}{" "}
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
