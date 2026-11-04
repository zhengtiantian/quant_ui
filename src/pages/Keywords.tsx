import React from "react";
import { decideKeywords, fetchKeywordReview } from "../api/markets";
import type { KeywordDecision, KeywordHistory, KeywordProposal, KeywordReview, KeywordTier } from "../api/markets";
import { cell, ghostButton, iconButton, muted, panel, panelHead, panelTitle, pill, right, th } from "../components/markets/format";

/**
 * Weekly keyword review. Every Saturday quant_data (tools/keyword_refresh.py) reads the week's GDELT
 * headlines and proposes, for each company in the news rules (102 core, 490 universe), names that are
 * not keywords yet: products, brands, services, subsidiaries, executives. Each comes with the local
 * model's verdict and its co-mention share (of all the week's headlines with the term, how many also
 * name the company). Nothing is used until it is decided here:
 *   Add     a keyword: news naming it is collected for the company
 *   Weak    kept on the company's weak-name list (an ordinary word, or too often about something else),
 *           not matched until the SLM pass checks each hit
 *   Reject  never used; a term already in the rules is taken out again
 * Decisions reach the rule files at :55 each hour, 08:55-23:55 (keyword_refresh_apply).
 * History: an added keyword is also searched in past news at the start of the next universe backfill
 * window, from 2021 ("full") or only from the day it was first seen ("first_seen"). Products default to
 * full (no headline names a product before it exists); subsidiaries and executives to first seen, since
 * an acquired company's or a new CEO's older news belongs to someone else.
 */

const TIER_LABEL: Record<KeywordTier, string> = {
  add: "Suggested: add", weak: "Suggested: weak", model_none: "Model: not this company", unjudged: "Not judged",
};
const TIER_COLOR: Record<KeywordTier, string> = { add: "#84d6a3", weak: "#e3b177", model_none: "#7a838e", unjudged: "#99a0a8" };
const DECISION_LABEL: Record<KeywordDecision, string> = { add: "Added", weak: "Weak", reject: "Rejected" };
const DECISION_COLOR: Record<KeywordDecision, string> = { add: "#84d6a3", weak: "#e3b177", reject: "#d88383" };

type StatusFilter = "pending" | "add" | "weak" | "reject" | "all";
type TierFilter = "suggested" | KeywordTier | "all";
type SetFilter = "all" | "core" | "universe";

const store = {
  get: (k: string, d: string) => { try { return localStorage.getItem(k) || d; } catch { return d; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* per-viewer convenience only */ } },
};
const day = (ts: string) => (ts && ts.length >= 8 ? `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}` : "—");
const when = (iso: string | null) => (iso ? iso.replace("T", " ").slice(0, 16) : "");

const select: React.CSSProperties = {
  background: "#23272c", color: "#e6e8ea", border: "1px solid #434b56", borderRadius: 8, padding: "4px 8px", fontSize: 13,
};

const actionButton = (active: boolean, c: string): React.CSSProperties => ({
  ...iconButton, marginLeft: 0, marginRight: 4, color: active ? "#16191d" : c, background: active ? c : "transparent",
  borderColor: `${c}88`, fontWeight: active ? 700 : 500,
});

const Status: React.FC<{ p: KeywordProposal }> = ({ p }) => {
  if (!p.decision) return <span style={muted}>Pending</span>;
  const waiting = p.decision === "reject" ? p.in_rules : !p.in_rules;
  return (
    <span>
      <span style={pill(DECISION_COLOR[p.decision])}>{DECISION_LABEL[p.decision]}</span>
      <span style={{ ...muted, display: "block", marginTop: 3 }}>
        {waiting ? "applies at :55" : p.decision === "reject" ? "not in rules" : `in rules${p.applied_at ? ` since ${when(p.applied_at)}` : ""}`}
      </span>
    </span>
  );
};

type Decide = (ids: string[], d: KeywordDecision | "pending" | "keep", history?: KeywordHistory) => void;

const History: React.FC<{ p: KeywordProposal; busy: boolean; onDecide: Decide }> = ({ p, busy, onDecide }) => {
  const full = p.rescans.find((r) => r.since && r.since <= "2021-12-31");
  const done = p.rescans.length ? p.rescans[p.rescans.length - 1] : null;
  if (p.decision === "weak" || p.decision === "reject") return <span style={muted}>—</span>;
  return (
    <span>
      <select style={{ ...select, fontSize: 12, padding: "2px 6px" }} value={p.history} disabled={busy || !!full}
              title="How far back past news is searched for this keyword once it is added"
              onChange={(e) => onDecide([p.id], "keep", e.target.value as KeywordHistory)}>
        <option value="full">Since 2021</option>
        <option value="first_seen">From first seen</option>
      </select>
      {done ? (
        <span style={{ ...muted, display: "block", marginTop: 3 }}>
          searched from {done.since}: {done.new_rows ?? 0} new
        </span>
      ) : p.decision === "add" ? <span style={{ ...muted, display: "block", marginTop: 3 }}>next backfill window</span> : null}
    </span>
  );
};

const Row: React.FC<{ p: KeywordProposal; busy: boolean; onDecide: Decide }> = ({ p, busy, onDecide }) => {
  const [open, setOpen] = React.useState(false);
  const act = (d: KeywordDecision) => onDecide([p.id], p.decision === d ? "pending" : d, p.history);
  return (
    <>
      <tr>
        <td style={cell}>
          <b>{p.term}</b>
          {p.kind && p.kind !== "none" ? <span style={{ ...muted, marginLeft: 6 }}>{p.kind}</span> : null}
          <span style={{ display: "block", marginTop: 3 }}>
            <span style={pill(TIER_COLOR[p.tier])}>{TIER_LABEL[p.tier]}</span>
            {p.ordinary_word ? <span style={{ ...pill("#e3b177"), marginLeft: 4 }}>ordinary word</span> : null}
            {p.caveat ? <span style={{ ...pill("#e3b177"), marginLeft: 4 }} title="Starts with a number, or the model's reason says former / discontinued / category / being acquired">check</span> : null}
          </span>
        </td>
        <td style={{ ...cell, ...right }}>{Math.round(p.co_mention * 100)}%</td>
        <td style={{ ...cell, ...right }} title="Headlines naming the company that contain the term / all headlines of the week that contain it">
          {p.headlines_with_company}/{p.headlines_total}
        </td>
        <td style={{ ...cell, ...right }}>{p.stories}</td>
        <td style={{ ...cell, ...right }}>{p.sites}</td>
        <td style={{ ...cell, whiteSpace: "nowrap" }}>{day(p.first_seen)}</td>
        <td style={{ ...cell, maxWidth: 360 }}>
          <span>{p.reason || "—"}</span>
          <button style={{ ...iconButton, display: "block", marginLeft: 0, marginTop: 4 }} onClick={() => setOpen(!open)}>
            {open ? "Hide headlines" : `Headlines (${p.examples.length})`}
          </button>
        </td>
        <td style={cell}><Status p={p} /></td>
        <td style={cell}><History p={p} busy={busy} onDecide={onDecide} /></td>
        <td style={{ ...cell, whiteSpace: "nowrap" }}>
          <button disabled={busy} style={actionButton(p.decision === "add", DECISION_COLOR.add)} onClick={() => act("add")}>Add</button>
          <button disabled={busy} style={actionButton(p.decision === "weak", DECISION_COLOR.weak)} onClick={() => act("weak")}>Weak</button>
          <button disabled={busy} style={actionButton(p.decision === "reject", DECISION_COLOR.reject)} onClick={() => act("reject")}>Reject</button>
        </td>
      </tr>
      {open ? (
        <tr>
          <td style={{ ...cell, background: "#1d2125" }} colSpan={10}>
            {p.examples.map((e) => (
              <div key={e.url + e.title} style={{ fontSize: 13, margin: "2px 0" }}>
                <span style={{ ...muted, marginRight: 8 }}>{day(e.ts)}</span>
                {e.url ? <a href={e.url} target="_blank" rel="noreferrer">{e.title}</a> : e.title}
              </div>
            ))}
            <div style={{ ...muted, marginTop: 6 }}>
              Seen in week{p.weeks_seen.length > 1 ? "s" : ""} {p.weeks_seen.join(", ")} · id {p.id}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
};

const Keywords: React.FC = () => {
  const [data, setData] = React.useState<KeywordReview | null>(null);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [status, setStatus] = React.useState<StatusFilter>(() => store.get("kw.status", "pending") as StatusFilter);
  const [tier, setTier] = React.useState<TierFilter>(() => store.get("kw.tier", "suggested") as TierFilter);
  const [set, setSet] = React.useState<SetFilter>(() => store.get("kw.set", "all") as SetFilter);
  const [query, setQuery] = React.useState("");

  const load = React.useCallback(() => {
    fetchKeywordReview().then((d) => { setData(d); setError(""); }).catch((e: Error) => setError(e.message));
  }, []);
  React.useEffect(load, [load]);

  const decide = async (ids: string[], d: KeywordDecision | "pending" | "keep", history?: KeywordHistory) => {
    setBusy(true);
    try {
      await decideKeywords(ids, d, history);
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const rows = (data?.proposals || []).filter((p) => {
    if (status === "pending" ? p.decision : status !== "all" && p.decision !== status) return false;
    if (tier === "suggested" ? !(p.tier === "add" || p.tier === "weak") : tier !== "all" && p.tier !== tier) return false;
    if (set !== "all" && p.set !== set) return false;
    const q = query.trim().toLowerCase();
    return !q || p.symbol.toLowerCase().includes(q) || p.term.toLowerCase().includes(q) || (p.name || "").toLowerCase().includes(q);
  });
  const groups: { key: string; items: KeywordProposal[] }[] = [];
  for (const p of rows) {
    const key = `${p.set}:${p.symbol}`;
    const g = groups.find((x) => x.key === key);
    if (g) g.items.push(p);
    else groups.push({ key, items: [p] });
  }
  const all = data?.proposals || [];
  const count = (f: (p: KeywordProposal) => boolean) => all.filter(f).length;
  const latest = data?.runs[0];
  const suggestedAddShown = rows.filter((p) => p.tier === "add" && !p.decision).map((p) => p.id);

  const filterSelect = <T extends string>(value: T, onChange: (v: T) => void, key: string, options: [T, string][]) => (
    <select style={select} value={value} onChange={(e) => { onChange(e.target.value as T); store.set(key, e.target.value); }}>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );

  return (
    <div>
      <div style={panel}>
        <div style={panelHead}>
          <div style={panelTitle}>🔤 Keyword review</div>
          <span style={muted}>
            {latest
              ? `Week of ${latest.week}: ${latest.headlines?.toLocaleString() ?? "—"} headlines read, ${latest.candidates} candidates`
              : "No run yet: the first proposals arrive on Saturday at 08:30"}
          </span>
        </div>
        <div style={{ ...muted, marginBottom: 10, lineHeight: 1.5 }}>
          New names found in the week's headlines for each company, checked by the local model and by co-mention
          (the share of all headlines containing the term that also name the company). <b>Add</b> makes it a keyword,
          {" "}<b>Weak</b> keeps it on the weak-name list without matching it, <b>Reject</b> never uses it (or takes it out again).
          Click the active button again to undo. Decisions reach the rule files at :55 each hour, 08:55–23:55;
          {" "}an added keyword's past news is searched at the start of the next backfill window (History: since 2021 for
          products, from first seen for subsidiaries and executives, whose older news is about someone else).
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 12, fontSize: 13 }}>
          <span>Waiting for review: <b>{count((p) => !p.decision && (p.tier === "add" || p.tier === "weak"))}</b></span>
          <span>Added: <b>{count((p) => p.decision === "add")}</b></span>
          <span>Weak: <b>{count((p) => p.decision === "weak")}</b></span>
          <span>Rejected: <b>{count((p) => p.decision === "reject")}</b></span>
          <span>In rules now: <b>{count((p) => p.in_rules)}</b></span>
          <span style={muted}>Model said not this company: {count((p) => p.tier === "model_none")}</span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {filterSelect(status, setStatus, "kw.status", [["pending", "Not decided"], ["add", "Added"], ["weak", "Weak"], ["reject", "Rejected"], ["all", "Any decision"]])}
          {filterSelect(tier, setTier, "kw.tier", [["suggested", "Suggested (add + weak)"], ["add", "Suggested: add"], ["weak", "Suggested: weak"],
                                                   ["model_none", "Model: not this company"], ["unjudged", "Not judged"], ["all", "Every candidate"]])}
          {filterSelect(set, setSet, "kw.set", [["all", "Core + universe"], ["core", "Core (102)"], ["universe", "Universe (490)"]])}
          <input style={{ ...select, minWidth: 180 }} placeholder="Search symbol, company or term" value={query} onChange={(e) => setQuery(e.target.value)} />
          <button style={ghostButton} onClick={load} disabled={busy}>Refresh</button>
          {suggestedAddShown.length ? (
            <button style={ghostButton} disabled={busy}
                    onClick={() => { if (window.confirm(`Add all ${suggestedAddShown.length} undecided "Suggested: add" terms shown?`)) decide(suggestedAddShown, "add"); }}>
              Add all suggested shown ({suggestedAddShown.length})
            </button>
          ) : null}
          <span style={muted}>{rows.length} shown</span>
        </div>
        {error ? <div style={{ color: "#d88383", marginTop: 10 }}>{error}</div> : null}
      </div>

      {groups.map((g) => {
        const first = g.items[0];
        return (
          <div key={g.key} style={panel}>
            <div style={panelHead}>
              <div style={panelTitle}>{first.symbol} <span style={{ fontWeight: 500 }}>· {first.name}</span>
                <span style={{ ...pill(first.set === "core" ? "#81dad3" : "#a17edd"), marginLeft: 8 }}>{first.set}</span>
              </div>
              <span style={muted}>
                {first.company_headlines.toLocaleString()} headlines named it this week · keywords now: {first.current_keywords.slice(0, 8).join(", ")}
                {first.current_keywords.length > 8 ? ` +${first.current_keywords.length - 8}` : ""}
              </span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr>
                  <th style={th}>Term</th>
                  <th style={{ ...th, ...right }} title="Of all the week's headlines that contain the term, the share that also name the company">Co-mention</th>
                  <th style={{ ...th, ...right }}>Headlines</th>
                  <th style={{ ...th, ...right }} title="Distinct stories (syndicated copies count once)">Stories</th>
                  <th style={{ ...th, ...right }}>Sites</th>
                  <th style={th}>First seen</th>
                  <th style={th}>Model's reason</th>
                  <th style={th}>Status</th>
                  <th style={th} title="How far back past news is searched once the keyword is added">History</th>
                  <th style={th}>Decide</th>
                </tr></thead>
                <tbody>{g.items.map((p) => <Row key={p.id} p={p} busy={busy} onDecide={decide} />)}</tbody>
              </table>
            </div>
          </div>
        );
      })}
      {data && !groups.length ? <div style={{ ...panel, ...muted }}>Nothing matches these filters.</div> : null}
    </div>
  );
};

export default Keywords;
