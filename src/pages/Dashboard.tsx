import React from "react";
import StrategyStudio from "./StrategyStudio";
import Holdings from "./Holdings";
import Briefs from "./Briefs";
import SignalsPanel from "../components/SignalsPanel";
import PositionsPanel from "../components/PositionsPanel";
import PerformancePanel from "../components/PerformancePanel";
import TaskMonitorPanel from "../components/TaskMonitorPanel";

const Dashboard: React.FC = () => {
    const username = localStorage.getItem("username");
    type Tab = "signals" | "holdings" | "briefs" | "positions" | "performance" | "strategy" | "tasks";
    const TABS: Tab[] = ["signals", "holdings", "briefs", "positions", "performance", "strategy", "tasks"];
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
                <button onClick={() => setTab("tasks")} style={tab === "tasks" ? { fontWeight: "bold" } : {}}>⏱️ Task Monitor</button>
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
                ) : (
                    <TaskMonitorPanel />
                )}
            </main>
        </div>
    );
};

export default Dashboard;
