import { hostUrl } from "../auth";
import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  fetchTaskMonitorStatus,
  fetchTaskLog,
} from "../api/markets";
import TaskSchedulePanel from "./TaskSchedulePanel";
import { getLang, tr, useLang } from "../lang";
import type {
  TaskMonitorResponse,
  AirflowDagItem,
  TaskLogResponse,
} from "../api/markets";

export const TaskMonitorPanel: React.FC = () => {
  const [data, setData] = useState<TaskMonitorResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [lang] = useLang();
  const L = (en: string, zh: string) => tr(lang, en, zh);
  // A text the server sends in Chinese with its English beside it ("<field>_en")
  const loc = (zh?: string | null, en?: string | null) => (lang === "zh" ? zh || en : en || zh) || "";
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [expandedDags, setExpandedDags] = useState<Record<string, boolean>>({});

  // Log modal state
  const [logModalOpen, setLogModalOpen] = useState<boolean>(false);
  const [logLoading, setLogLoading] = useState<boolean>(false);
  const [logTitle, setLogTitle] = useState<string>("");
  const [logContent, setLogContent] = useState<string>("");
  const [logMeta, setLogMeta] = useState<TaskLogResponse | null>(null);
  const [currentLogParams, setCurrentLogParams] = useState<{
    source: string;
    target_id?: string;
    run_id?: string;
    task_id?: string;
  } | null>(null);

  const logBottomRef = useRef<HTMLDivElement>(null);

  const loadData = useCallback(async (isPolling = false) => {
    if (!isPolling) setLoading(true);
    try {
      const res = await fetchTaskMonitorStatus();
      if (res && res.status === "success") {
        setData(res);
        setError(null);
      } else {
        setError(tr(getLang(), "Could not load the task monitor", "无法获取任务监控状态"));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : tr(getLang(), "Task monitor request failed", "请求任务监控状态失败"));
    } finally {
      if (!isPolling) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-refresh interval (10 seconds)
  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      loadData(true);
    }, 10000);
    return () => clearInterval(timer);
  }, [autoRefresh, loadData]);

  const openLogModal = async (
    title: string,
    source: string,
    target_id: string = "",
    run_id: string = "",
    task_id: string = ""
  ) => {
    setLogTitle(title);
    setCurrentLogParams({ source, target_id, run_id, task_id });
    setLogModalOpen(true);
    setLogLoading(true);
    setLogContent("");

    try {
      const res = await fetchTaskLog(source, target_id, run_id, task_id, 250);
      setLogMeta(res);
      setLogContent(res.log || res.message || L("The log is empty", "日志为空"));
    } catch (err: unknown) {
      setLogContent(`${L("Could not load the log", "获取日志失败")}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLogLoading(false);
    }
  };

  const refreshCurrentLog = async () => {
    if (!currentLogParams) return;
    setLogLoading(true);
    try {
      const res = await fetchTaskLog(
        currentLogParams.source,
        currentLogParams.target_id || "",
        currentLogParams.run_id || "",
        currentLogParams.task_id || "",
        250
      );
      setLogMeta(res);
      setLogContent(res.log || res.message || L("The log is empty", "日志为空"));
    } catch (err: unknown) {
      setLogContent(`${L("Could not refresh the log", "刷新日志失败")}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLogLoading(false);
    }
  };

  const toggleDagExpanded = (dag_id: string) => {
    setExpandedDags((prev) => ({ ...prev, [dag_id]: !prev[dag_id] }));
  };

  // Categories list
  // The filter's categories come from the server in order (key = the Chinese name, as on each DAG)
  const categories = [{ zh: "all", en: "all" }, ...(data?.categories || [])];

  const filteredDags = (data?.airflow_dags || []).filter((d) => {
    if (categoryFilter === "all") return true;
    return d.category === categoryFilter;
  });

  return (
    <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "8px 0" }}>
      {/* Header Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          marginBottom: "20px",
          padding: "16px 20px",
          background: "#23272c",
          borderRadius: "12px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          border: "1px solid #434b56",
        }}
      >
        <div>
          <h2 style={{ margin: "0 0 6px 0", fontSize: "20px", color: "#d6d9dc", display: "flex", alignItems: "center", gap: "8px" }}>
            ⏱️ {L("Scheduled tasks & data pipelines", "全系统定时任务与数据管道中控台")}
            <span
              style={{
                fontSize: "12px",
                padding: "2px 8px",
                borderRadius: "12px",
                background: data?.summary?.scheduler_running ? "#24422e" : "#402121",
                color: data?.summary?.scheduler_running ? "#89d2a5" : "#d58585",
                fontWeight: "normal",
              }}
            >
              {data?.summary?.scheduler_running ? L("Airflow scheduler running", "Airflow 调度器运行中") : L("Airflow scheduler not running", "Airflow 调度器未运行")}
            </span>
          </h2>
          <div style={{ fontSize: "13px", color: "#99a0a8" }}>
            {L("Airflow pipelines, the Job Agent board (http://127.0.0.1:5050/) and the host's core services in one place", "聚合监控 Airflow 量化与特征主管道、找工中控平台 (http://127.0.0.1:5050/) 及宿主机核心守护进程")}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "#aeb4ba", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            {L("Auto refresh (10s)", "自动刷新 (10s)")}
          </label>
          <button
            onClick={() => loadData()}
            disabled={loading}
            style={{
              padding: "6px 14px",
              background: "#354975",
              color: "#e4e5e7",
              border: "none",
              borderRadius: "6px",
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: 500,
              fontSize: "13px",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            {loading ? L("⏳ Refreshing…", "⏳ 刷新中...") : L("🔄 Refresh now", "🔄 立即刷新")}
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: "12px 16px",
            background: "#391f1f",
            border: "1px solid #6d3030",
            color: "#d88383",
            borderRadius: "8px",
            marginBottom: "16px",
            fontSize: "14px",
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* Top Metric Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "14px",
          marginBottom: "24px",
        }}
      >
        <div
          style={{
            padding: "16px",
            background: "#23272c",
            borderRadius: "10px",
            border: "1px solid #434b56",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          }}
        >
          <div style={{ fontSize: "12px", color: "#99a0a8", marginBottom: "4px" }}>{L("⚡ Running now", "⚡ 当前正在运行")}</div>
          <div style={{ fontSize: "24px", fontWeight: "bold", color: (data?.summary?.running_count || 0) > 0 ? "#82d9a2" : "#d6d9dc" }}>
            {data?.summary?.running_count || 0}
            <span style={{ fontSize: "13px", fontWeight: "normal", color: "#99a0a8", marginLeft: "4px" }}>{L("tasks", "个任务")}</span>
          </div>
        </div>

        <div
          style={{
            padding: "16px",
            background: "#23272c",
            borderRadius: "10px",
            border: "1px solid #434b56",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          }}
        >
          <div style={{ fontSize: "12px", color: "#99a0a8", marginBottom: "4px" }}>{L("🎯 Job Agent service (:5050)", "🎯 找工中控服务 (:5050)")}</div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                display: "inline-block",
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                background: data?.job_agent?.is_online ? "#3d7552" : "#dc7979",
              }}
            />
            <span style={{ fontSize: "18px", fontWeight: "bold", color: "#d6d9dc" }}>
              {data?.job_agent?.is_online ? L("Online", "在线运行") : L("Offline", "服务离线")}
            </span>
          </div>
          <div style={{ fontSize: "11px", color: "#99a0a8", marginTop: "4px" }}>
            {L("Next run", "下次运行")}: {loc(data?.job_agent?.next_run?.countdown, data?.job_agent?.next_run?.countdown_en) || "--"}
          </div>
        </div>

        <div
          style={{
            padding: "16px",
            background: "#23272c",
            borderRadius: "10px",
            border: "1px solid #434b56",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          }}
        >
          <div style={{ fontSize: "12px", color: "#99a0a8", marginBottom: "4px" }}>{L("🌊 Active Airflow pipelines", "🌊 Airflow 活跃管道")}</div>
          <div style={{ fontSize: "24px", fontWeight: "bold", color: "#d6d9dc" }}>
            {data?.summary?.active_dags || 0}
            <span style={{ fontSize: "13px", fontWeight: "normal", color: "#99a0a8", marginLeft: "4px" }}>
              / {data?.summary?.total_dags || 0} DAGs
            </span>
          </div>
        </div>

        <div
          style={{
            padding: "16px",
            background: "#23272c",
            borderRadius: "10px",
            border: "1px solid #434b56",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          }}
        >
          <div style={{ fontSize: "12px", color: "#99a0a8", marginBottom: "4px" }}>{L("✅ Succeeded today", "✅ 今日执行成功")}</div>
          <div style={{ fontSize: "24px", fontWeight: "bold", color: "#82d9a2" }}>
            {data?.summary?.success_today || 0}
            <span style={{ fontSize: "13px", fontWeight: "normal", color: "#99a0a8", marginLeft: "4px" }}>{L("runs", "次")}</span>
          </div>
        </div>

        <div
          style={{
            padding: "16px",
            background: "#23272c",
            borderRadius: "10px",
            border: "1px solid #434b56",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          }}
        >
          <div style={{ fontSize: "12px", color: "#99a0a8", marginBottom: "4px" }}>{L("❌ Failed today", "❌ 今日执行失败")}</div>
          <div style={{ fontSize: "24px", fontWeight: "bold", color: (data?.summary?.failed_today || 0) > 0 ? "#d78484" : "#d6d9dc" }}>
            {data?.summary?.failed_today || 0}
            <span style={{ fontSize: "13px", fontWeight: "normal", color: "#99a0a8", marginLeft: "4px" }}>{L("runs", "次")}</span>
          </div>
        </div>
      </div>

      {/* 0. Today and tomorrow, in time order (2026-11-04) */}
      <TaskSchedulePanel openLog={(title, source, target_id, run_id, task_id) => void openLogModal(title, source, target_id, run_id, task_id)} />

      {/* 1. Running Now Section */}
      <div style={{ marginBottom: "28px" }}>
        <h3 style={{ fontSize: "16px", color: "#d6d9dc", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
          {L("⚡ Running now", "⚡ 正在运行中的任务 (Running Now)")}
        </h3>

        {(!data?.running_tasks || data.running_tasks.length === 0) ? (
          <div
            style={{
              padding: "20px",
              background: "#252a30",
              border: "1px dashed #4b545f",
              borderRadius: "10px",
              textAlign: "center",
              color: "#99a0a8",
              fontSize: "14px",
            }}
          >
            {L("🎉 Nothing is running. Every scheduled task starts on its own timetable.", "🎉 当前没有正在运行中的任务，系统待命中。所有定时任务按计划自动触发。")}
          </div>
        ) : (
          <div style={{ display: "grid", gap: "10px" }}>
            {data.running_tasks.map((task, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "14px 18px",
                  background: "#213928",
                  border: "1px solid #396e4b",
                  borderRadius: "8px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span
                    style={{
                      width: "12px",
                      height: "12px",
                      borderRadius: "50%",
                      background: "#3d7552",
                      boxShadow: "0 0 8px #85d6a3",
                      display: "inline-block",
                    }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, color: "#89d2a5", fontSize: "14px" }}>{loc(task.name, task.name_en)}</div>
                    <div style={{ fontSize: "12px", color: "#a6acb3", marginTop: "2px" }}>
                      {L("Running for", "已运行")}: {task.duration_seconds !== null ? `${task.duration_seconds} ${L("s", "秒")}` : L("measuring…", "计算中...")}
                      {task.start_date && ` | ${L("started", "开始于")}: ${new Date(task.start_date).toLocaleTimeString()}`}
                    </div>
                  </div>
                </div>

                {task.can_view_log && (
                  <button
                    onClick={() =>
                      openLogModal(
                        `${L("Live task log", "实时任务日志")}: ${loc(task.name, task.name_en)}`,
                        task.source,
                        task.dag_id,
                        task.run_id,
                        task.task_id
                      )
                    }
                    style={{
                      padding: "6px 12px",
                      background: "#356e4b",
                      color: "#e4e5e7",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "12px",
                      cursor: "pointer",
                    }}
                  >
                    {L("📜 Live log", "📜 查看实时日志")}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. Job Agent Section */}
      <div style={{ marginBottom: "28px" }}>
        <h3 style={{ fontSize: "16px", color: "#d6d9dc", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
          {L("🎯 Job Agent (:5050 job board, scheduled by Airflow)", "🎯 找工中控平台 (Job Agent · :5050 多国求职看板 & Airflow 统一调度)")}
        </h3>

        <div
          style={{
            background: "#23272c",
            border: "1px solid #434b56",
            borderRadius: "12px",
            padding: "20px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                <span style={{ fontSize: "18px", fontWeight: "bold", color: "#d6d9dc" }}>
                  {loc(data?.job_agent?.name, data?.job_agent?.name_en) || "Job Agent"}
                </span>
                <span
                  style={{
                    fontSize: "12px",
                    padding: "3px 10px",
                    borderRadius: "12px",
                    background: data?.job_agent?.is_online ? "#24422e" : "#402121",
                    color: data?.job_agent?.is_online ? "#84d6a3" : "#d88383",
                    fontWeight: 600,
                  }}
                >
                  {data?.job_agent?.is_online ? L("🟢 5050 online", "🟢 5050 服务在线") : L("🔴 Offline", "🔴 离线")}
                </span>
                {data?.job_agent?.is_scraping_now && (
                  <span
                    style={{
                      fontSize: "12px",
                      padding: "3px 10px",
                      borderRadius: "12px",
                      background: "#6f5902",
                      color: "#e1a67a",
                      fontWeight: 600,
                    }}
                  >
                    {L("⚡ Scanning now", "⚡ 正在全网扫描中")}
                  </span>
                )}
              </div>

              <div style={{ fontSize: "13px", color: "#aeb4ba", lineHeight: "1.6" }}>
                <div>
                  📅 <b>{L("Schedule", "调度机制")}:</b> {loc(data?.job_agent?.schedule, data?.job_agent?.schedule_en) || L("Daily 11:00 & 16:00 Dublin time (Airflow)", "每日 11:00 & 16:00 都柏林时间 (Airflow 统一调度)")}
                </div>
                {data?.job_agent?.regions_summary && (
                  <div>
                    🌍 <b>{L("Open jobs by region", "覆盖板块与待投池")}:</b>{" "}
                    <span style={{ color: "#d6d9dc" }}>{loc(data.job_agent.regions_summary, data.job_agent.regions_summary_en)}</span>
                  </div>
                )}
                <div>
                  ⏳ <b>{L("Next run", "下次自动执行")}:</b>{" "}
                  <span style={{ color: "#7e9cdd", fontWeight: 600 }}>
                    {data?.job_agent?.next_run?.next_run_display} ({loc(data?.job_agent?.next_run?.countdown, data?.job_agent?.next_run?.countdown_en)})
                  </span>
                </div>
                <div>
                  🕒 <b>{L("Last success", "上次成功执行")}:</b> {data?.job_agent?.last_success || L("none yet", "无记录")}
                  {data?.job_agent?.last_full_sweep && ` (${L("last full sweep", "全网深度排查")}: ${data?.job_agent?.last_full_sweep})`}
                </div>
                {data?.job_agent?.report?.exists && (
                  <div style={{ marginTop: "6px", color: "#d6d9dc", background: "#252a30", padding: "8px 12px", borderRadius: "6px", border: "1px solid #434b56" }}>
                    📑 <b>{L("Latest report", "最新产出报告")} (Today_Jobs.md):</b> {loc(data.job_agent.report.summary, data.job_agent.report.summary_en)}
                    <div style={{ fontSize: "11px", color: "#99a0a8", marginTop: "2px" }}>
                      {L("Size", "文件大小")}: {data.job_agent.report.size_kb} KB | {L("updated", "更新时间")}: {data.job_agent.report.modified_at}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <a
                href={`${hostUrl(5050)}/`}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  padding: "9px 16px",
                  background: "#354975",
                  color: "#e4e5e7",
                  borderRadius: "8px",
                  textDecoration: "none",
                  fontWeight: 600,
                  fontSize: "13px",
                  boxShadow: "0 1px 2px rgba(37,99,235,0.2)",
                }}
              >
                {L("🌐 Open Job Agent (:5050)", "🌐 打开找工平台 (:5050)")}
              </a>

              <button
                onClick={() =>
                  openLogModal(L("Job Agent scrape & run log", "找工平台 (Job Agent) 爬虫与运行日志"), "job_agent", "job_agent")
                }
                style={{
                  padding: "8px 14px",
                  background: "#23272c",
                  color: "#aeb4ba",
                  border: "1px solid #4b545f",
                  borderRadius: "8px",
                  fontSize: "13px",
                  cursor: "pointer",
                  fontWeight: 500,
                }}
              >
                {L("📜 Scrape & analysis log", "📜 查看爬虫与分析日志")}
              </button>

              <button
                onClick={() =>
                  openLogModal(L("Job Agent :5050 web log", "找工平台 5050 Web 服务日志"), "job_agent", "web")
                }
                style={{
                  padding: "6px 14px",
                  background: "#23272c",
                  color: "#99a0a8",
                  border: "1px solid #4b545f",
                  borderRadius: "8px",
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                {L("📄 5050 web log", "📄 查看 5050 Web 日志")}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Airflow DAGs Section */}
      <div style={{ marginBottom: "28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "14px" }}>
          <h3 style={{ fontSize: "16px", color: "#d6d9dc", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
            {L("🌊 Airflow pipelines", "🌊 Airflow 定时工作流与数据管道 (Airflow Pipelines)")}
          </h3>

          {/* Category Chips */}
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {categories.map((cat) => (
              <button
                key={cat.zh}
                onClick={() => setCategoryFilter(cat.zh)}
                style={{
                  padding: "4px 10px",
                  borderRadius: "20px",
                  border: categoryFilter === cat.zh ? "1px solid #7e9cdd" : "1px solid #424549",
                  background: categoryFilter === cat.zh ? "#7e9cdd" : "#23272c",
                  color: categoryFilter === cat.zh ? "#23272c" : "#aeb4ba",
                  fontSize: "12px",
                  cursor: "pointer",
                  fontWeight: categoryFilter === cat.zh ? 600 : "normal",
                }}
              >
                {cat.zh === "all" ? L("All", "全部") : loc(cat.zh, cat.en)}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gap: "14px" }}>
          {filteredDags.map((dag: AirflowDagItem) => {
            const isExpanded = !!expandedDags[dag.dag_id];
            const lastRun = dag.last_run;
            const state = lastRun?.state || (dag.is_paused ? "paused" : "idle");
            const progress = lastRun?.progress;

            let badgeBg = "#272e34";
            let badgeColor = "#aeb4ba";
            let badgeText = L("⚪ Ready", "⚪ 待触发 / 就绪");

            if (dag.is_paused) {
              badgeBg = "#282d33";
              badgeColor = "#9aa1a9";
              badgeText = L("⏸️ Paused", "⏸️ 已暂停");
            } else if (state === "success") {
              badgeBg = "#24422e";
              badgeColor = "#84d6a3";
              badgeText = L("🟢 Succeeded", "🟢 成功完成");
            } else if (state === "running") {
              badgeBg = "#6f5902";
              badgeColor = "#e1a67a";
              badgeText = L("🟡 Running", "🟡 执行中");
            } else if (state === "failed") {
              badgeBg = "#402121";
              badgeColor = "#d88383";
              badgeText = L("🔴 Failed", "🔴 执行失败");
            }

            return (
              <div
                key={dag.dag_id}
                style={{
                  background: "#23272c",
                  border: "1px solid #434b56",
                  borderRadius: "10px",
                  padding: "16px 20px",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                      <span style={{ fontSize: "16px", fontWeight: 600, color: "#d6d9dc" }}>
                        {loc(dag.name, dag.name_en)}
                      </span>
                      <span
                        style={{
                          fontSize: "11px",
                          padding: "2px 8px",
                          borderRadius: "6px",
                          background: "#272e34",
                          color: "#aeb4ba",
                        }}
                      >
                        {loc(dag.category, dag.category_en)}
                      </span>
                      <span
                        style={{
                          fontSize: "12px",
                          padding: "2px 8px",
                          borderRadius: "12px",
                          background: badgeBg,
                          color: badgeColor,
                          fontWeight: 600,
                        }}
                      >
                        {badgeText}
                      </span>
                    </div>

                    <div style={{ fontSize: "13px", color: "#99a0a8", marginBottom: "8px" }}>
                      {loc(dag.description, dag.description_en)}
                    </div>

                    <div style={{ display: "flex", gap: "18px", flexWrap: "wrap", fontSize: "12px", color: "#aeb4ba" }}>
                      <div>
                        ⏱️ <b>{L("Schedule", "调度周期")}:</b> {loc(dag.schedule_display, dag.schedule_display_en)}
                      </div>
                      {dag.next_run && (
                        <div>
                          ⏳ <b>{L("Next run", "下次触发")}:</b> {new Date(dag.next_run).toLocaleString()}
                        </div>
                      )}
                      {lastRun?.start_date && (
                        <div>
                          🕒 <b>{L("Last run", "上次执行")}:</b> {new Date(lastRun.start_date).toLocaleString()}
                          {lastRun.duration_seconds !== null && ` (${lastRun.duration_seconds}s)`}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {lastRun && (
                      <button
                        onClick={() =>
                          openLogModal(
                            `${L("Airflow run log", "Airflow 运行日志")}: ${loc(dag.name, dag.name_en)} (${lastRun.run_id})`,
                            "airflow",
                            dag.dag_id,
                            lastRun.run_id
                          )
                        }
                        style={{
                          padding: "6px 12px",
                          background: "#23272c",
                          color: "#7e9cdd",
                          border: "1px solid #324d70",
                          borderRadius: "6px",
                          fontSize: "12px",
                          cursor: "pointer",
                          fontWeight: 500,
                        }}
                      >
                        {L("📜 Log", "📜 查看日志")}
                      </button>
                    )}

                    {dag.tasks && dag.tasks.length > 0 && (
                      <button
                        onClick={() => toggleDagExpanded(dag.dag_id)}
                        style={{
                          padding: "6px 12px",
                          background: "#252a30",
                          color: "#aeb4ba",
                          border: "1px solid #4b545f",
                          borderRadius: "6px",
                          fontSize: "12px",
                          cursor: "pointer",
                        }}
                      >
                        {isExpanded ? L("Hide steps ▲", "收起步骤 ▲") : L(`Show ${dag.tasks.length} steps ▼`, `展开 ${dag.tasks.length} 个步骤 ▼`)}
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                {progress && progress.total > 0 && (
                  <div style={{ marginTop: "12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#99a0a8", marginBottom: "4px" }}>
                      <span>{L("Progress", "完成进度")}: {progress.success} / {progress.total} {L("steps", "步骤")} ({progress.percent}%)</span>
                      {progress.running > 0 && <span style={{ color: "#e3b177" }}>⚡ {L(`${progress.running} running`, `${progress.running} 个任务运行中`)}</span>}
                      {progress.failed > 0 && <span style={{ color: "#d78484" }}>❌ {L(`${progress.failed} failed`, `${progress.failed} 个步骤失败`)}</span>}
                    </div>
                    <div
                      style={{
                        width: "100%",
                        height: "6px",
                        background: "#2f343b",
                        borderRadius: "3px",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${progress.percent}%`,
                          height: "100%",
                          background: progress.failed > 0 ? "#703333" : progress.percent === 100 ? "#85d6a3" : "#769ee1",
                          transition: "width 0.3s ease",
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Expanded Task Instances List */}
                {isExpanded && dag.tasks && (
                  <div
                    style={{
                      marginTop: "14px",
                      paddingTop: "14px",
                      borderTop: "1px solid #3b4752",
                      display: "grid",
                      gap: "6px",
                    }}
                  >
                    <div style={{ fontSize: "12px", fontWeight: 600, color: "#aeb4ba", marginBottom: "4px" }}>
                      {L("Steps", "执行步骤明细")}:
                    </div>
                    {dag.tasks.map((task) => (
                      <div
                        key={task.task_id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "6px 12px",
                          background: "#252a30",
                          borderRadius: "6px",
                          fontSize: "12px",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span
                            style={{
                              width: "8px",
                              height: "8px",
                              borderRadius: "50%",
                              background:
                                task.state === "success"
                                  ? "#85d6a3"
                                  : task.state === "running"
                                  ? "#e2bb79"
                                  : task.state === "failed"
                                  ? "#dc7979"
                                  : "#7a838e",
                            }}
                          />
                          <span style={{ fontFamily: "monospace", fontWeight: 500, color: "#cbcfd3" }}>
                            {task.task_id}
                          </span>
                          <span style={{ color: "#99a0a8", fontSize: "11px" }}>
                            {task.duration !== null ? `${task.duration}s` : ""}
                          </span>
                        </div>

                        <button
                          onClick={() =>
                            openLogModal(
                              `${L("Step log", "任务步骤日志")}: ${dag.dag_id} ➔ ${task.task_id}`,
                              "airflow",
                              dag.dag_id,
                              dag.last_run?.run_id || "",
                              task.task_id
                            )
                          }
                          style={{
                            padding: "3px 8px",
                            background: "#23272c",
                            color: "#aeb4ba",
                            border: "1px solid #4b545f",
                            borderRadius: "4px",
                            fontSize: "11px",
                            cursor: "pointer",
                          }}
                        >
                          {L("Log", "查看日志")}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. System & AI Background Daemons */}
      <div style={{ marginBottom: "28px" }}>
        <h3 style={{ fontSize: "16px", color: "#d6d9dc", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
          {L("🖥️ Core services & infrastructure", "🖥️ 核心系统与 AI 守护进程 (Daemons & Infrastructure)")}
        </h3>

        <div
          style={{
            background: "#23272c",
            border: "1px solid #434b56",
            borderRadius: "12px",
            overflow: "hidden",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#252a30", borderBottom: "1px solid #434b56", color: "#aeb4ba" }}>
                <th style={{ padding: "12px 16px" }}>{L("Service", "服务名称")}</th>
                <th style={{ padding: "12px 16px" }}>{L("Type / label", "类型 / 标识")}</th>
                <th style={{ padding: "12px 16px" }}>{L("Port / PID", "端口 / PID")}</th>
                <th style={{ padding: "12px 16px" }}>{L("Status", "运行状态")}</th>
                <th style={{ padding: "12px 16px" }}>{L("What it does", "功能说明")}</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>{L("Actions", "操作")}</th>
              </tr>
            </thead>
            <tbody>
              {(data?.system_daemons || []).map((daemon) => {
                const isOnline = daemon.status === "running" || daemon.status === "loaded";
                return (
                  <tr key={daemon.id} style={{ borderBottom: "1px solid #3b4752" }}>
                    <td style={{ padding: "12px 16px", fontWeight: 600, color: "#d6d9dc" }}>
                      {loc(daemon.name, daemon.name_en)}
                    </td>
                    <td style={{ padding: "12px 16px", color: "#99a0a8" }}>
                      <span style={{ fontSize: "11px", padding: "2px 6px", background: "#272e34", borderRadius: "4px" }}>
                        {loc(daemon.type, daemon.type_en)}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", fontFamily: "monospace", color: "#aeb4ba" }}>
                      {daemon.port ? `:${daemon.port}` : "--"}
                      {daemon.pid && ` (PID: ${daemon.pid})`}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span
                        style={{
                          fontSize: "11px",
                          padding: "2px 8px",
                          borderRadius: "10px",
                          fontWeight: 600,
                          background: isOnline ? "#24422e" : "#402121",
                          color: isOnline ? "#84d6a3" : "#d88383",
                        }}
                      >
                        {isOnline ? L("🟢 Running", "🟢 正常运行") : L("🔴 Stopped", "🔴 停止/异常")}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", color: "#99a0a8", fontSize: "12px" }}>
                      {loc(daemon.description, daemon.description_en)}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      {daemon.log_path ? (
                        <button
                          onClick={() => {
                            let source = "scheduler";
                            if (daemon.id === "job_agent") source = "job_agent";
                            else if (daemon.id === "quant_ai") source = "quant_ai";
                            else if (daemon.id === "disk_watch") source = "disk_watch";
                            openLogModal(`${loc(daemon.name, daemon.name_en)} ${L("log", "日志")}`, source, daemon.id);
                          }}
                          style={{
                            padding: "4px 10px",
                            background: "#23272c",
                            border: "1px solid #4b545f",
                            borderRadius: "4px",
                            fontSize: "12px",
                            color: "#aeb4ba",
                            cursor: "pointer",
                          }}
                        >
                          {L("📜 Log", "📜 日志")}
                        </button>
                      ) : (
                        <span style={{ color: "#7a838e", fontSize: "11px" }}>--</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Live Log Viewer Modal */}
      {logModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
            padding: "20px",
          }}
        >
          <div
            style={{
              width: "90%",
              maxWidth: "1000px",
              height: "85%",
              background: "#343a42",
              borderRadius: "12px",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
              border: "1px solid #515b67",
              overflow: "hidden",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "14px 20px",
                borderBottom: "1px solid #515b67",
                background: "#343a42",
              }}
            >
              <div>
                <div style={{ color: "#e4e5e7", fontWeight: 600, fontSize: "15px" }}>
                  {logTitle}
                </div>
                {logMeta?.path && (
                  <div style={{ color: "#7a838e", fontSize: "11px", marginTop: "2px", fontFamily: "monospace" }}>
                    {logMeta.path} {logMeta.total_lines ? L(`(${logMeta.total_lines} lines)`, `(共 ${logMeta.total_lines} 行)`) : ""}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button
                  onClick={refreshCurrentLog}
                  disabled={logLoading}
                  style={{
                    padding: "5px 12px",
                    background: "#343a42",
                    color: "#e4e5e7",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "12px",
                    cursor: logLoading ? "not-allowed" : "pointer",
                  }}
                >
                  {logLoading ? L("⏳ Refreshing…", "⏳ 刷新中...") : L("🔄 Refresh", "🔄 刷新")}
                </button>
                <button
                  onClick={() => {
                    if (logContent) {
                      navigator.clipboard.writeText(logContent);
                      alert(L("Log copied to the clipboard", "日志已复制到剪贴板！"));
                    }
                  }}
                  style={{
                    padding: "5px 12px",
                    background: "#343a42",
                    color: "#e4e5e7",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                >
                  {L("📋 Copy", "📋 复制")}
                </button>
                <button
                  onClick={() => setLogModalOpen(false)}
                  style={{
                    padding: "5px 12px",
                    background: "#703333",
                    color: "#e4e5e7",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "12px",
                    cursor: "pointer",
                    fontWeight: "bold",
                  }}
                >
                  {L("✕ Close", "✕ 关闭")}
                </button>
              </div>
            </div>

            {/* Modal Log Body */}
            <div
              style={{
                flex: 1,
                padding: "16px 20px",
                overflowY: "auto",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                fontSize: "12px",
                lineHeight: "1.5",
                color: "#6c757f",
                background: "#343a42",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
              }}
            >
              {logLoading ? (
                <div style={{ color: "#7a838e", textAlign: "center", padding: "40px" }}>
                  {L("⏳ Loading the latest log…", "⏳ 正在拉取最新日志输出...")}
                </div>
              ) : (
                logContent || L("No log yet", "暂无日志")
              )}
              <div ref={logBottomRef} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskMonitorPanel;
