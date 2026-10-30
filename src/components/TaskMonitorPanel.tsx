import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  fetchTaskMonitorStatus,
  fetchTaskLog,
} from "../api/markets";
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
  const [categoryFilter, setCategoryFilter] = useState<string>("全部");
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
        setError("无法获取任务监控状态");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "请求任务监控状态失败");
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
      setLogContent(res.log || res.message || "日志为空");
    } catch (err: unknown) {
      setLogContent(`获取日志失败: ${err instanceof Error ? err.message : String(err)}`);
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
      setLogContent(res.log || res.message || "日志为空");
    } catch (err: unknown) {
      setLogContent(`刷新日志失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLogLoading(false);
    }
  };

  const toggleDagExpanded = (dag_id: string) => {
    setExpandedDags((prev) => ({ ...prev, [dag_id]: !prev[dag_id] }));
  };

  // Categories list
  const categories = ["全部", "量化主管道", "数据采集与匹配", "数据处理与特征", "实时盘中监控", "模型每周训练"];

  const filteredDags = (data?.airflow_dags || []).filter((d) => {
    if (categoryFilter === "全部") return true;
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
          background: "#ffffff",
          borderRadius: "12px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          border: "1px solid #e2e8f0",
        }}
      >
        <div>
          <h2 style={{ margin: "0 0 6px 0", fontSize: "20px", color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
            ⏱️ 全系统定时任务与数据管道中控台
            <span
              style={{
                fontSize: "12px",
                padding: "2px 8px",
                borderRadius: "12px",
                background: data?.summary?.scheduler_running ? "#dcfce7" : "#fee2e2",
                color: data?.summary?.scheduler_running ? "#166534" : "#991b1b",
                fontWeight: "normal",
              }}
            >
              {data?.summary?.scheduler_running ? "Airflow 调度器运行中" : "Airflow 调度器未运行"}
            </span>
          </h2>
          <div style={{ fontSize: "13px", color: "#64748b" }}>
            聚合监控 Airflow 量化与特征主管道、找工中控平台 (http://127.0.0.1:5050/) 及宿主机核心守护进程
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "#475569", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            自动刷新 (10s)
          </label>
          <button
            onClick={() => loadData()}
            disabled={loading}
            style={{
              padding: "6px 14px",
              background: "#2563eb",
              color: "#ffffff",
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
            {loading ? "⏳ 刷新中..." : "🔄 立即刷新"}
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: "12px 16px",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#b91c1c",
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
            background: "#ffffff",
            borderRadius: "10px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          }}
        >
          <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>⚡ 当前正在运行</div>
          <div style={{ fontSize: "24px", fontWeight: "bold", color: (data?.summary?.running_count || 0) > 0 ? "#16a34a" : "#0f172a" }}>
            {data?.summary?.running_count || 0}
            <span style={{ fontSize: "13px", fontWeight: "normal", color: "#64748b", marginLeft: "4px" }}>个任务</span>
          </div>
        </div>

        <div
          style={{
            padding: "16px",
            background: "#ffffff",
            borderRadius: "10px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          }}
        >
          <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>🎯 找工中控服务 (:5050)</div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                display: "inline-block",
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                background: data?.job_agent?.is_online ? "#22c55e" : "#ef4444",
              }}
            />
            <span style={{ fontSize: "18px", fontWeight: "bold", color: "#0f172a" }}>
              {data?.job_agent?.is_online ? "在线运行" : "服务离线"}
            </span>
          </div>
          <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>
            下次运行: {data?.job_agent?.next_run?.countdown || "--"}
          </div>
        </div>

        <div
          style={{
            padding: "16px",
            background: "#ffffff",
            borderRadius: "10px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          }}
        >
          <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>🌊 Airflow 活跃管道</div>
          <div style={{ fontSize: "24px", fontWeight: "bold", color: "#0f172a" }}>
            {data?.summary?.active_dags || 0}
            <span style={{ fontSize: "13px", fontWeight: "normal", color: "#64748b", marginLeft: "4px" }}>
              / {data?.summary?.total_dags || 0} DAGs
            </span>
          </div>
        </div>

        <div
          style={{
            padding: "16px",
            background: "#ffffff",
            borderRadius: "10px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          }}
        >
          <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>✅ 今日执行成功</div>
          <div style={{ fontSize: "24px", fontWeight: "bold", color: "#16a34a" }}>
            {data?.summary?.success_today || 0}
            <span style={{ fontSize: "13px", fontWeight: "normal", color: "#64748b", marginLeft: "4px" }}>次</span>
          </div>
        </div>

        <div
          style={{
            padding: "16px",
            background: "#ffffff",
            borderRadius: "10px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          }}
        >
          <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>❌ 今日执行失败</div>
          <div style={{ fontSize: "24px", fontWeight: "bold", color: (data?.summary?.failed_today || 0) > 0 ? "#dc2626" : "#0f172a" }}>
            {data?.summary?.failed_today || 0}
            <span style={{ fontSize: "13px", fontWeight: "normal", color: "#64748b", marginLeft: "4px" }}>次</span>
          </div>
        </div>
      </div>

      {/* 1. Running Now Section */}
      <div style={{ marginBottom: "28px" }}>
        <h3 style={{ fontSize: "16px", color: "#0f172a", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
          ⚡ 正在运行中的任务 (Running Now)
        </h3>

        {(!data?.running_tasks || data.running_tasks.length === 0) ? (
          <div
            style={{
              padding: "20px",
              background: "#f8fafc",
              border: "1px dashed #cbd5e1",
              borderRadius: "10px",
              textAlign: "center",
              color: "#64748b",
              fontSize: "14px",
            }}
          >
            🎉 当前没有正在运行中的任务，系统待命中。所有定时任务按计划自动触发。
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
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  borderRadius: "8px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span
                    style={{
                      width: "12px",
                      height: "12px",
                      borderRadius: "50%",
                      background: "#22c55e",
                      boxShadow: "0 0 8px #22c55e",
                      display: "inline-block",
                    }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, color: "#166534", fontSize: "14px" }}>{task.name}</div>
                    <div style={{ fontSize: "12px", color: "#4b7c59", marginTop: "2px" }}>
                      已运行: {task.duration_seconds !== null ? `${task.duration_seconds} 秒` : "计算中..."}
                      {task.start_date && ` | 开始于: ${new Date(task.start_date).toLocaleTimeString()}`}
                    </div>
                  </div>
                </div>

                {task.can_view_log && (
                  <button
                    onClick={() =>
                      openLogModal(
                        `实时任务日志: ${task.name}`,
                        task.source,
                        task.dag_id,
                        task.run_id,
                        task.task_id
                      )
                    }
                    style={{
                      padding: "6px 12px",
                      background: "#166534",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "12px",
                      cursor: "pointer",
                    }}
                  >
                    📜 查看实时日志
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. Job Agent Section */}
      <div style={{ marginBottom: "28px" }}>
        <h3 style={{ fontSize: "16px", color: "#0f172a", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
          🎯 找工中控平台 (Job Agent · 5050 端口独立定时服务)
        </h3>

        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "20px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                <span style={{ fontSize: "18px", fontWeight: "bold", color: "#0f172a" }}>
                  {data?.job_agent?.name || "找工平台 (Job Agent)"}
                </span>
                <span
                  style={{
                    fontSize: "12px",
                    padding: "3px 10px",
                    borderRadius: "12px",
                    background: data?.job_agent?.is_online ? "#dcfce7" : "#fee2e2",
                    color: data?.job_agent?.is_online ? "#15803d" : "#b91c1c",
                    fontWeight: 600,
                  }}
                >
                  {data?.job_agent?.is_online ? "🟢 5050 服务在线" : "🔴 离线"}
                </span>
                {data?.job_agent?.is_scraping_now && (
                  <span
                    style={{
                      fontSize: "12px",
                      padding: "3px 10px",
                      borderRadius: "12px",
                      background: "#fef3c7",
                      color: "#b45309",
                      fontWeight: 600,
                    }}
                  >
                    ⚡ 正在全网扫描中
                  </span>
                )}
              </div>

              <div style={{ fontSize: "13px", color: "#475569", lineHeight: "1.6" }}>
                <div>
                  📅 <b>调度机制:</b> {data?.job_agent?.schedule || "每日 11:00 & 16:00 (macOS Launchd)"}
                </div>
                <div>
                  ⏳ <b>下次自动执行:</b>{" "}
                  <span style={{ color: "#2563eb", fontWeight: 600 }}>
                    {data?.job_agent?.next_run?.next_run_display} ({data?.job_agent?.next_run?.countdown})
                  </span>
                </div>
                <div>
                  🕒 <b>上次成功执行:</b> {data?.job_agent?.last_success || "无记录"}
                  {data?.job_agent?.last_full_sweep && ` (全网深度排查: ${data?.job_agent?.last_full_sweep})`}
                </div>
                {data?.job_agent?.report?.exists && (
                  <div style={{ marginTop: "6px", color: "#0f172a", background: "#f8fafc", padding: "8px 12px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                    📑 <b>最新产出报告 (Today_Jobs.md):</b> {data.job_agent.report.summary}
                    <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                      文件大小: {data.job_agent.report.size_kb} KB | 更新时间: {data.job_agent.report.modified_at}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <a
                href="http://127.0.0.1:5050/"
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  padding: "9px 16px",
                  background: "#2563eb",
                  color: "#ffffff",
                  borderRadius: "8px",
                  textDecoration: "none",
                  fontWeight: 600,
                  fontSize: "13px",
                  boxShadow: "0 1px 2px rgba(37,99,235,0.2)",
                }}
              >
                🌐 打开找工平台 (:5050)
              </a>

              <button
                onClick={() =>
                  openLogModal("找工平台 (Job Agent) 爬虫与运行日志", "job_agent", "job_agent")
                }
                style={{
                  padding: "8px 14px",
                  background: "#ffffff",
                  color: "#475569",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  fontSize: "13px",
                  cursor: "pointer",
                  fontWeight: 500,
                }}
              >
                📜 查看爬虫与分析日志
              </button>

              <button
                onClick={() =>
                  openLogModal("找工平台 launchd 调度日志", "job_agent", "launchd")
                }
                style={{
                  padding: "6px 14px",
                  background: "#ffffff",
                  color: "#64748b",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                📄 查看 launchd 日志
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Airflow DAGs Section */}
      <div style={{ marginBottom: "28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "14px" }}>
          <h3 style={{ fontSize: "16px", color: "#0f172a", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
            🌊 Airflow 定时工作流与数据管道 (Airflow Pipelines)
          </h3>

          {/* Category Chips */}
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                style={{
                  padding: "4px 10px",
                  borderRadius: "20px",
                  border: categoryFilter === cat ? "1px solid #2563eb" : "1px solid #cbd5e1",
                  background: categoryFilter === cat ? "#2563eb" : "#ffffff",
                  color: categoryFilter === cat ? "#ffffff" : "#475569",
                  fontSize: "12px",
                  cursor: "pointer",
                  fontWeight: categoryFilter === cat ? 600 : "normal",
                }}
              >
                {cat}
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

            let badgeBg = "#f1f5f9";
            let badgeColor = "#475569";
            let badgeText = "未执行";

            if (dag.is_paused) {
              badgeBg = "#f3f4f6";
              badgeColor = "#6b7280";
              badgeText = "⏸️ 已暂停";
            } else if (state === "success") {
              badgeBg = "#dcfce7";
              badgeColor = "#15803d";
              badgeText = "🟢 成功完成";
            } else if (state === "running") {
              badgeBg = "#fef3c7";
              badgeColor = "#b45309";
              badgeText = "🟡 执行中";
            } else if (state === "failed") {
              badgeBg = "#fee2e2";
              badgeColor = "#b91c1c";
              badgeText = "🔴 执行失败";
            }

            return (
              <div
                key={dag.dag_id}
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "10px",
                  padding: "16px 20px",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                      <span style={{ fontSize: "16px", fontWeight: 600, color: "#0f172a" }}>
                        {dag.name}
                      </span>
                      <span
                        style={{
                          fontSize: "11px",
                          padding: "2px 8px",
                          borderRadius: "6px",
                          background: "#f1f5f9",
                          color: "#475569",
                        }}
                      >
                        {dag.category}
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

                    <div style={{ fontSize: "13px", color: "#64748b", marginBottom: "8px" }}>
                      {dag.description}
                    </div>

                    <div style={{ display: "flex", gap: "18px", flexWrap: "wrap", fontSize: "12px", color: "#475569" }}>
                      <div>
                        ⏱️ <b>调度周期:</b> {dag.schedule_display}
                      </div>
                      {dag.next_run && (
                        <div>
                          ⏳ <b>下次触发:</b> {new Date(dag.next_run).toLocaleString()}
                        </div>
                      )}
                      {lastRun?.start_date && (
                        <div>
                          🕒 <b>上次执行:</b> {new Date(lastRun.start_date).toLocaleString()}
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
                            `Airflow 运行日志: ${dag.name} (${lastRun.run_id})`,
                            "airflow",
                            dag.dag_id,
                            lastRun.run_id
                          )
                        }
                        style={{
                          padding: "6px 12px",
                          background: "#ffffff",
                          color: "#2563eb",
                          border: "1px solid #bfdbfe",
                          borderRadius: "6px",
                          fontSize: "12px",
                          cursor: "pointer",
                          fontWeight: 500,
                        }}
                      >
                        📜 查看日志
                      </button>
                    )}

                    {dag.tasks && dag.tasks.length > 0 && (
                      <button
                        onClick={() => toggleDagExpanded(dag.dag_id)}
                        style={{
                          padding: "6px 12px",
                          background: "#f8fafc",
                          color: "#475569",
                          border: "1px solid #cbd5e1",
                          borderRadius: "6px",
                          fontSize: "12px",
                          cursor: "pointer",
                        }}
                      >
                        {isExpanded ? "收起步骤 ▲" : `展开 ${dag.tasks.length} 个步骤 ▼`}
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                {progress && progress.total > 0 && (
                  <div style={{ marginTop: "12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#64748b", marginBottom: "4px" }}>
                      <span>完成进度: {progress.success} / {progress.total} 步骤 ({progress.percent}%)</span>
                      {progress.running > 0 && <span style={{ color: "#d97706" }}>⚡ {progress.running} 个任务运行中</span>}
                      {progress.failed > 0 && <span style={{ color: "#dc2626" }}>❌ {progress.failed} 个步骤失败</span>}
                    </div>
                    <div
                      style={{
                        width: "100%",
                        height: "6px",
                        background: "#e2e8f0",
                        borderRadius: "3px",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${progress.percent}%`,
                          height: "100%",
                          background: progress.failed > 0 ? "#ef4444" : progress.percent === 100 ? "#22c55e" : "#3b82f6",
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
                      borderTop: "1px solid #f1f5f9",
                      display: "grid",
                      gap: "6px",
                    }}
                  >
                    <div style={{ fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                      执行步骤明细:
                    </div>
                    {dag.tasks.map((task) => (
                      <div
                        key={task.task_id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "6px 12px",
                          background: "#f8fafc",
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
                                  ? "#22c55e"
                                  : task.state === "running"
                                  ? "#f59e0b"
                                  : task.state === "failed"
                                  ? "#ef4444"
                                  : "#94a3b8",
                            }}
                          />
                          <span style={{ fontFamily: "monospace", fontWeight: 500, color: "#1e293b" }}>
                            {task.task_id}
                          </span>
                          <span style={{ color: "#64748b", fontSize: "11px" }}>
                            {task.duration !== null ? `${task.duration}s` : ""}
                          </span>
                        </div>

                        <button
                          onClick={() =>
                            openLogModal(
                              `任务步骤日志: ${dag.dag_id} ➔ ${task.task_id}`,
                              "airflow",
                              dag.dag_id,
                              dag.last_run?.run_id || "",
                              task.task_id
                            )
                          }
                          style={{
                            padding: "3px 8px",
                            background: "#ffffff",
                            color: "#475569",
                            border: "1px solid #cbd5e1",
                            borderRadius: "4px",
                            fontSize: "11px",
                            cursor: "pointer",
                          }}
                        >
                          查看日志
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
        <h3 style={{ fontSize: "16px", color: "#0f172a", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
          🖥️ 核心系统与 AI 守护进程 (Daemons & Infrastructure)
        </h3>

        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            overflow: "hidden",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569" }}>
                <th style={{ padding: "12px 16px" }}>服务名称</th>
                <th style={{ padding: "12px 16px" }}>类型 / 标识</th>
                <th style={{ padding: "12px 16px" }}>端口 / PID</th>
                <th style={{ padding: "12px 16px" }}>运行状态</th>
                <th style={{ padding: "12px 16px" }}>功能说明</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {(data?.system_daemons || []).map((daemon) => {
                const isOnline = daemon.status === "running" || daemon.status === "loaded";
                return (
                  <tr key={daemon.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "12px 16px", fontWeight: 600, color: "#0f172a" }}>
                      {daemon.name}
                    </td>
                    <td style={{ padding: "12px 16px", color: "#64748b" }}>
                      <span style={{ fontSize: "11px", padding: "2px 6px", background: "#f1f5f9", borderRadius: "4px" }}>
                        {daemon.type}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", fontFamily: "monospace", color: "#475569" }}>
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
                          background: isOnline ? "#dcfce7" : "#fee2e2",
                          color: isOnline ? "#15803d" : "#b91c1c",
                        }}
                      >
                        {isOnline ? "🟢 正常运行" : "🔴 停止/异常"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", color: "#64748b", fontSize: "12px" }}>
                      {daemon.description}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      {daemon.log_path ? (
                        <button
                          onClick={() => {
                            let source = "scheduler";
                            if (daemon.id === "job_agent") source = "job_agent";
                            else if (daemon.id === "quant_ai") source = "quant_ai";
                            else if (daemon.id === "disk_watch") source = "disk_watch";
                            openLogModal(`${daemon.name} 日志`, source, daemon.id);
                          }}
                          style={{
                            padding: "4px 10px",
                            background: "#ffffff",
                            border: "1px solid #cbd5e1",
                            borderRadius: "4px",
                            fontSize: "12px",
                            color: "#475569",
                            cursor: "pointer",
                          }}
                        >
                          📜 日志
                        </button>
                      ) : (
                        <span style={{ color: "#94a3b8", fontSize: "11px" }}>--</span>
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
              background: "#0f172a",
              borderRadius: "12px",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
              border: "1px solid #334155",
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
                borderBottom: "1px solid #1e293b",
                background: "#1e293b",
              }}
            >
              <div>
                <div style={{ color: "#f8fafc", fontWeight: 600, fontSize: "15px" }}>
                  {logTitle}
                </div>
                {logMeta?.path && (
                  <div style={{ color: "#94a3b8", fontSize: "11px", marginTop: "2px", fontFamily: "monospace" }}>
                    {logMeta.path} {logMeta.total_lines ? `(共 ${logMeta.total_lines} 行)` : ""}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button
                  onClick={refreshCurrentLog}
                  disabled={logLoading}
                  style={{
                    padding: "5px 12px",
                    background: "#334155",
                    color: "#f8fafc",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "12px",
                    cursor: logLoading ? "not-allowed" : "pointer",
                  }}
                >
                  {logLoading ? "⏳ 刷新中..." : "🔄 刷新"}
                </button>
                <button
                  onClick={() => {
                    if (logContent) {
                      navigator.clipboard.writeText(logContent);
                      alert("日志已复制到剪贴板！");
                    }
                  }}
                  style={{
                    padding: "5px 12px",
                    background: "#334155",
                    color: "#f8fafc",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                >
                  📋 复制
                </button>
                <button
                  onClick={() => setLogModalOpen(false)}
                  style={{
                    padding: "5px 12px",
                    background: "#ef4444",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "12px",
                    cursor: "pointer",
                    fontWeight: "bold",
                  }}
                >
                  ✕ 关闭
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
                color: "#cbd5e1",
                background: "#090d16",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
              }}
            >
              {logLoading ? (
                <div style={{ color: "#94a3b8", textAlign: "center", padding: "40px" }}>
                  ⏳ 正在拉取最新日志输出...
                </div>
              ) : (
                logContent || "暂无日志"
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
