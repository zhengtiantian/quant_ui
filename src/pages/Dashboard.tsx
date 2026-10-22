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

const Dashboard: React.FC = () => {
    const username = localStorage.getItem("username");
    type Tab = "signals" | "holdings" | "briefs" | "positions" | "performance" | "strategy" | "market" | "scripts" | "agent";
    const TABS: Tab[] = ["signals", "holdings", "briefs", "positions", "performance", "strategy", "market", "scripts", "agent"];
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

            <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
                <button onClick={() => setTab("signals")}>Signals</button>
                <button onClick={() => setTab("holdings")}>My Holdings</button>
                <button onClick={() => setTab("briefs")}>Market Briefs</button>
                <button onClick={() => setTab("positions")}>Positions</button>
                <button onClick={() => setTab("performance")}>Performance</button>
                <button onClick={() => setTab("strategy")}>Strategy Studio</button>
                <button onClick={() => setTab("market")}>Market</button>
                <button onClick={() => setTab("scripts")}>Script Runner</button>
                <button onClick={() => setTab("agent")}>AI Agent</button>
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
