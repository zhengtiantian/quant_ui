/** Today's and tomorrow's scheduled tasks in time order, each marked Done / Failed / Running / Not run
 *  (2026-11-04). The days are Dublin days, so the list moves on at local midnight; it refreshes every 30 s. */
import React from "react";
import { fetchTaskSchedule } from "../api/markets";
import type { ScheduleDay, ScheduleRun, ScheduleState, TaskScheduleResponse } from "../api/markets";

const STATE: Record<ScheduleState, { label: string; fg: string; bg: string }> = {
  done: { label: "Done", fg: "#89d2a5", bg: "#24422e" },
  failed: { label: "Failed", fg: "#e88f8f", bg: "#4a2525" },
  running: { label: "Running", fg: "#8fc1ef", bg: "#1f3550" },
  pending: { label: "Not run", fg: "#b8bec5", bg: "#363d46" },
  partial: { label: "In progress", fg: "#e5c07b", bg: "#463a22" },
};
const SOURCE: Record<ScheduleRun["source"], string> = { airflow: "Airflow", job_agent: "launchd", briefs: "quant_ai" };
const FILTER_KEY = "taskSchedule.filter";

const dur = (s?: number | null): string => {
  if (s == null) return "";
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m ${s % 60}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
};
const hhmm = (iso?: string | null): string =>
  iso ? new Date(iso).toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Dublin" }) : "";

const Pill: React.FC<{ state: ScheduleState; overdue?: boolean }> = ({ state, overdue }) => {
  const s = STATE[state];
  return (
    <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 10, background: s.bg, color: s.fg, whiteSpace: "nowrap" }}>
      {s.label}{overdue && state === "pending" ? " · overdue" : ""}
    </span>
  );
};

type LogOpener = (title: string, source: string, target_id?: string, run_id?: string, task_id?: string) => void;

const Detail: React.FC<{ r: ScheduleRun }> = ({ r }) => {
  const bits: string[] = [];
  if (r.started) bits.push(`started ${hhmm(r.started)}`);
  if (r.ended) bits.push(`ended ${hhmm(r.ended)}`);
  if (r.duration_seconds != null) bits.push(dur(r.duration_seconds));
  if (r.tasks_total) bits.push(`${r.tasks_done}/${r.tasks_total} tasks`);
  if (r.after) bits.push(`${r.estimated ? "expected " : ""}after ${r.after}`);
  if (r.manual) bits.push("manual / catch-up run");
  return (
    <span style={{ color: "#99a0a8", fontSize: 12 }}>
      {bits.join(" · ")}
      {r.error ? <span style={{ color: "#e88f8f" }}>{bits.length ? " · " : ""}{r.error}</span> : null}
    </span>
  );
};

const Row: React.FC<{ r: ScheduleRun; openLog: LogOpener }> = ({ r, openLog }) => {
  const [open, setOpen] = React.useState(false);
  const canLog = r.source === "job_agent" || (r.source === "airflow" && r.run_id && r.log_task_id);
  const log = () => r.source === "job_agent"
    ? openLog(`${r.name} log`, "job_agent", "job_agent")
    : openLog(`${r.name} · ${r.log_task_id}`, "airflow", r.dag_id || r.key, r.run_id || "", r.log_task_id || "");
  return (
    <>
      <tr style={{ borderBottom: "1px solid #3a414b" }}>
        <td style={{ padding: "7px 8px", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", color: "#d6d9dc" }}>
          {r.estimated ? "~" : ""}{r.time}
        </td>
        <td style={{ padding: "7px 8px" }}>
          <div style={{ color: "#d6d9dc", fontWeight: 600 }}>
            {r.group ? (
              <button onClick={() => setOpen(!open)} style={{ background: "none", border: "none", color: "inherit", font: "inherit", cursor: "pointer", padding: 0 }}>
                {open ? "▾" : "▸"} {r.name} <span style={{ color: "#99a0a8", fontWeight: 400 }}>· {r.runs?.length} runs</span>
              </button>
            ) : r.name}
          </div>
          {r.group && r.counts ? (
            <span style={{ color: "#99a0a8", fontSize: 12 }}>
              {r.counts.done} done · {r.counts.failed} failed · {r.counts.running} running · {r.counts.pending} not run
            </span>
          ) : <Detail r={r} />}
        </td>
        <td style={{ padding: "7px 8px", color: "#99a0a8", fontSize: 12 }}>{SOURCE[r.source]}</td>
        <td style={{ padding: "7px 8px" }}><Pill state={r.state} overdue={r.overdue} /></td>
        <td style={{ padding: "7px 8px", textAlign: "right" }}>
          {!r.group && canLog ? (
            <button onClick={log} style={{ fontSize: 12, background: "#2f3640", color: "#c9ced4", border: "1px solid #4b545f", borderRadius: 6, padding: "2px 8px", cursor: "pointer" }}>
              Log
            </button>
          ) : null}
        </td>
      </tr>
      {r.group && open ? r.runs?.map((x) => (
        <tr key={x.at} style={{ background: "#232930" }}>
          <td style={{ padding: "4px 8px 4px 22px", fontSize: 12.5, color: "#c9ced4", fontVariantNumeric: "tabular-nums" }}>{x.time}</td>
          <td style={{ padding: "4px 8px" }}><Detail r={x} /></td>
          <td />
          <td style={{ padding: "4px 8px" }}><Pill state={x.state} overdue={x.overdue} /></td>
          <td style={{ padding: "4px 8px", textAlign: "right" }}>
            {x.run_id && x.log_task_id ? (
              <button onClick={() => openLog(`${x.name} ${x.time} · ${x.log_task_id}`, "airflow", x.dag_id || x.key, x.run_id || "", x.log_task_id || "")}
                      style={{ fontSize: 11.5, background: "#2f3640", color: "#c9ced4", border: "1px solid #4b545f", borderRadius: 6, padding: "1px 7px", cursor: "pointer" }}>
                Log
              </button>
            ) : null}
          </td>
        </tr>
      )) : null}
    </>
  );
};

const DayTable: React.FC<{ d: ScheduleDay; filter: string; openLog: LogOpener }> = ({ d, filter, openLog }) => {
  const items = d.items.filter((r) => filter === "all" || r.state === filter
    || (r.group && (r.runs || []).some((x) => x.state === filter)));
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, margin: "4px 0 8px" }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: "#d6d9dc" }}>{d.label}</span>
        <span style={{ color: "#99a0a8", fontSize: 12.5 }}>
          {d.weekday} {d.date} · {d.counts.done} done · {d.counts.failed} failed · {d.counts.running} running · {d.counts.pending} not run
        </span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
          <thead>
            <tr style={{ color: "#99a0a8", fontSize: 12, textAlign: "left", borderBottom: "1px solid #4b545f" }}>
              <th style={{ padding: "4px 8px", width: 90 }}>Time</th><th style={{ padding: "4px 8px" }}>Task</th>
              <th style={{ padding: "4px 8px", width: 80 }}>Runner</th><th style={{ padding: "4px 8px", width: 130 }}>State</th>
              <th style={{ padding: "4px 8px", width: 60 }} />
            </tr>
          </thead>
          <tbody>
            {items.length ? items.map((r) => <Row key={`${r.source}-${r.key}-${r.at}`} r={r} openLog={openLog} />)
              : <tr><td colSpan={5} style={{ padding: 10, color: "#99a0a8" }}>Nothing in this state.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const TaskSchedulePanel: React.FC<{ openLog: LogOpener }> = ({ openLog }) => {
  const [data, setData] = React.useState<TaskScheduleResponse | null>(null);
  const [error, setError] = React.useState("");
  const [filter, setFilter] = React.useState<string>(() => {
    try { return localStorage.getItem(FILTER_KEY) || "all"; } catch { return "all"; }
  });

  const load = React.useCallback(() => {
    fetchTaskSchedule().then((r) => { setData(r); setError(""); }).catch((e: Error) => setError(e.message));
  }, []);
  React.useEffect(() => {
    load();
    const id = window.setInterval(() => { if (document.visibilityState === "visible") load(); }, 30_000);
    return () => window.clearInterval(id);
  }, [load]);

  const pick = (f: string) => {
    setFilter(f);
    try { localStorage.setItem(FILTER_KEY, f); } catch { /* per-viewer convenience only */ }
  };

  return (
    <div style={{ marginBottom: 28, background: "#2a3038", border: "1px solid #434b56", borderRadius: 10, padding: "14px 16px" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
        <h3 style={{ fontSize: 16, color: "#d6d9dc", margin: 0 }}>🗓️ Today &amp; tomorrow</h3>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(["all", "done", "failed", "running", "pending"] as const).map((f) => (
            <button key={f} onClick={() => pick(f)}
                    style={{ fontSize: 12, padding: "3px 10px", borderRadius: 12, cursor: "pointer",
                             border: `1px solid ${filter === f ? "#8fc1ef" : "#4b545f"}`,
                             background: filter === f ? "#1f3550" : "transparent", color: "#c9ced4" }}>
              {f === "all" ? "All" : STATE[f].label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ color: "#99a0a8", fontSize: 12, marginBottom: 10 }}>
        Every scheduled run, Dublin time; the list moves on at midnight. Refreshes every 30 s.
        {data?.errors.length ? <span style={{ color: "#e88f8f" }}> · {data.errors.join("; ")}</span> : null}
      </div>
      {error ? <div style={{ color: "#e88f8f", fontSize: 13 }}>{error}</div> : null}
      {data?.days.map((d) => <DayTable key={d.date} d={d} filter={filter} openLog={openLog} />)}
    </div>
  );
};

export default TaskSchedulePanel;
