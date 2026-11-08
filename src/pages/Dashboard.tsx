import React from "react";
import Holdings from "./Holdings";
import Briefs from "./Briefs";
import Keywords from "./Keywords";
import QuantModelPanel from "../components/QuantModelPanel";
import PositionsPanel from "../components/PositionsPanel";
import TaskMonitorPanel from "../components/TaskMonitorPanel";
import { hostUrl, signOut, useSession } from "../auth";

// The Jobs / Budget / Time dashboard (job_agent, kept running by launchd on :5050) shown inside this
// one: its own page in embed mode, which drops its module switch and uses this palette.
const AGENT_URL = (import.meta.env.VITE_JOB_AGENT_URL as string | undefined) ?? hostUrl(5050);
type AgentModule = "jobs" | "budget" | "time";
const AGENT_TABS: { id: AgentModule; label: string }[] = [
    { id: "jobs", label: "🎯 Jobs" },
    { id: "budget", label: "💰 Budget" },
    { id: "time", label: "⏱ Time" },
];

const tabStyle = (active: boolean): React.CSSProperties =>
    active ? {} : { background: "#262b31", borderColor: "#434b56", color: "#aeb4ba", fontWeight: 600 };

const Dashboard: React.FC = () => {
    const username = localStorage.getItem("username");
    type Tab = "quant" | "holdings" | "briefs" | "positions" | "tasks" | "keywords" | AgentModule;
    const TABS: Tab[] = ["quant", "holdings", "briefs", "positions", "tasks", "keywords", "jobs", "budget", "time"];
    // Tabs merged into Quant Model (2026-11-08); old ?tab= links still land there.
    const LEGACY: Record<string, Tab> = { signals: "quant", performance: "quant", strategy: "quant" };
    // ?tab=briefs (the desktop widget links straight to a tab)
    const [tab, setTab] = React.useState<Tab>(() => {
        const raw = new URLSearchParams(window.location.search).get("tab") ?? "";
        const wanted = (LEGACY[raw] ?? raw) as Tab;
        return TABS.includes(wanted) ? wanted : "quant";
    });
    // An agent tab's frame is loaded on first visit and kept, so switching back does not reload it.
    const [visited, setVisited] = React.useState<Set<AgentModule>>(() => new Set());
    React.useEffect(() => {
        if (AGENT_TABS.some((t) => t.id === tab)) setVisited((v) => (v.has(tab as AgentModule) ? v : new Set(v).add(tab as AgentModule)));
    }, [tab]);
    const isAgent = AGENT_TABS.some((t) => t.id === tab);

    const ready = useSession();

    const handleLogout = () => {
        signOut();
        window.location.href = "/";
    };

    return (
        <div style={{ padding: "20px" }}>
            {/* Header */}
            <header
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderBottom: "1px solid #4f5864",
                    paddingBottom: "10px",
                    marginBottom: "20px",
                }}
            >
                <h2>Quant Dashboard</h2>
                <div>
                    <span style={{ marginRight: "15px" }}>👋 Welcome, {username || "User"}</span>
                    <button onClick={handleLogout}>Logout</button>
                </div>
            </header>

            <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
                <button onClick={() => setTab("quant")} style={tabStyle(tab === "quant")}>Quant Model</button>
                <button onClick={() => setTab("holdings")} style={tabStyle(tab === "holdings")}>My Holdings</button>
                <button onClick={() => setTab("briefs")} style={tabStyle(tab === "briefs")}>Market Briefs</button>
                <button onClick={() => setTab("positions")} style={tabStyle(tab === "positions")}>Positions</button>
                <button onClick={() => setTab("tasks")} style={tabStyle(tab === "tasks")}>⏱️ Task Monitor</button>
                <button onClick={() => setTab("keywords")} style={tabStyle(tab === "keywords")}>🔤 Keywords</button>
                <span style={{ width: 1, background: "#434b56", margin: "0 4px" }} />
                {AGENT_TABS.map((t) => (
                    <button key={t.id} onClick={() => setTab(t.id)} style={tabStyle(tab === t.id)}>{t.label}</button>
                ))}
            </div>

            {/* Main */}
            <main>
                {!ready ? <div style={{ color: "#99a0a8" }}>Signing in…</div> : null}
                {ready && AGENT_TABS.filter((t) => visited.has(t.id)).map((t) => (
                    <iframe
                        key={t.id}
                        title={t.label}
                        src={`${AGENT_URL}/?embed=1&module=${t.id}`}
                        style={{ display: tab === t.id ? "block" : "none", width: "100%", height: "calc(100vh - 150px)",
                                 border: "1px solid #434b56", borderRadius: 12, background: "#16191d" }}
                    />
                ))}
                {!ready || isAgent ? null : tab === "quant" ? (
                    <QuantModelPanel />
                ) : tab === "holdings" ? (
                    <Holdings />
                ) : tab === "briefs" ? (
                    <Briefs />
                ) : tab === "positions" ? (
                    <PositionsPanel />
                ) : tab === "keywords" ? (
                    <Keywords />
                ) : (
                    <TaskMonitorPanel />
                )}
            </main>
        </div>
    );
};

export default Dashboard;
