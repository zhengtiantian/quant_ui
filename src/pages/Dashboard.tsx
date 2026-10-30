import React from "react";
import ScriptRunner from "../pages/ScriptRunner";
import StrategyStudio from "./StrategyStudio";
import MarketCharts from "./MarketCharts";
import AgentResearch from "./AgentResearch";
import Holdings from "./Holdings";
import Briefs from "./Briefs";
import SignalsPanel from "../components/SignalsPanel";
import PositionsPanel from "../components/PositionsPanel";
import PerformancePanel from "../components/PerformancePanel";
import TaskMonitorPanel from "../components/TaskMonitorPanel";

const Dashboard: React.FC = () => {
    const username = localStorage.getItem("username");
    type Tab = "signals" | "holdings" | "briefs" | "positions" | "performance" | "strategy" | "market" | "tasks" | "scripts" | "agent";
    const TABS: Tab[] = ["signals", "holdings", "briefs", "positions", "performance", "strategy", "market", "tasks", "scripts", "agent"];
    // ?tab=briefs (the desktop widget links straight to a tab)
    const [tab, setTab] = React.useState<Tab>(() => {
        const wanted = new URLSearchParams(window.location.search).get("tab") as Tab | null;
        return wanted && TABS.includes(wanted) ? wanted : "signals";
    });

    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("username");
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
                    borderBottom: "1px solid #ccc",
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
                <button onClick={() => setTab("signals")} style={tab === "signals" ? { fontWeight: "bold" } : {}}>Signals</button>
                <button onClick={() => setTab("holdings")} style={tab === "holdings" ? { fontWeight: "bold" } : {}}>My Holdings</button>
                <button onClick={() => setTab("briefs")} style={tab === "briefs" ? { fontWeight: "bold" } : {}}>Market Briefs</button>
                <button onClick={() => setTab("positions")} style={tab === "positions" ? { fontWeight: "bold" } : {}}>Positions</button>
                <button onClick={() => setTab("performance")} style={tab === "performance" ? { fontWeight: "bold" } : {}}>Performance</button>
                <button onClick={() => setTab("strategy")} style={tab === "strategy" ? { fontWeight: "bold" } : {}}>Strategy Studio</button>
                <button onClick={() => setTab("market")} style={tab === "market" ? { fontWeight: "bold" } : {}}>Market</button>
                <button
                    onClick={() => setTab("tasks")}
                    style={
                        tab === "tasks"
                            ? { fontWeight: "bold", background: "#2563eb", color: "#ffffff", borderColor: "#2563eb" }
                            : { background: "#eff6ff", color: "#1d4ed8", borderColor: "#bfdbfe" }
                    }
                >
                    ⏱️ Task Monitor
                </button>
                <button onClick={() => setTab("scripts")} style={tab === "scripts" ? { fontWeight: "bold" } : {}}>Script Runner</button>
                <button onClick={() => setTab("agent")} style={tab === "agent" ? { fontWeight: "bold" } : {}}>AI Agent</button>
            </div>

            {/* Main */}
            <main>
                {tab === "signals" ? (
                    <SignalsPanel />
                ) : tab === "holdings" ? (
                    <Holdings />
                ) : tab === "briefs" ? (
                    <Briefs />
                ) : tab === "positions" ? (
                    <PositionsPanel />
                ) : tab === "performance" ? (
                    <PerformancePanel />
                ) : tab === "strategy" ? (
                    <StrategyStudio />
                ) : tab === "market" ? (
                    <MarketCharts />
                ) : tab === "tasks" ? (
                    <TaskMonitorPanel />
                ) : tab === "agent" ? (
                    <AgentResearch />
                ) : (
                    <ScriptRunner />
                )}
            </main>
        </div>
    );
};

export default Dashboard;
