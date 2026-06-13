import React from "react";
import ScriptRunner from "../pages/ScriptRunner";
import StrategyStudio from "./StrategyStudio";
import MarketCharts from "./MarketCharts";
import SignalsPanel from "../components/SignalsPanel";
import PositionsPanel from "../components/PositionsPanel";

const Dashboard: React.FC = () => {
    const username = localStorage.getItem("username");
    const [tab, setTab] = React.useState<"signals" | "positions" | "strategy" | "market" | "scripts">("signals");

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
                <button onClick={() => setTab("positions")}>Positions</button>
                <button onClick={() => setTab("strategy")}>Strategy Studio</button>
                <button onClick={() => setTab("market")}>Market</button>
                <button onClick={() => setTab("scripts")}>Script Runner</button>
            </div>

            {/* Main */}
            <main>
                {tab === "signals" ? (
                    <SignalsPanel />
                ) : tab === "positions" ? (
                    <PositionsPanel />
                ) : tab === "strategy" ? (
                    <StrategyStudio />
                ) : tab === "market" ? (
                    <MarketCharts />
                ) : (
                    <ScriptRunner />
                )}
            </main>
        </div>
    );
};

export default Dashboard;
