import React from "react";
import ScriptRunner from "../pages/ScriptRunner";
import StrategyStudio from "./StrategyStudio";

const Dashboard: React.FC = () => {
    const username = localStorage.getItem("username");
    const [tab, setTab] = React.useState<"strategy" | "scripts">("strategy");

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
                    <span style={{ marginRight: "15px" }}>👋 欢迎, {username || "用户"}</span>
                    <button onClick={handleLogout}>退出登录</button>
                </div>
            </header>

            <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
                <button onClick={() => setTab("strategy")}>Strategy Studio</button>
                <button onClick={() => setTab("scripts")}>Script Runner</button>
            </div>

            {/* 主体 */}
            <main>
                {tab === "strategy" ? <StrategyStudio /> : <ScriptRunner />}
            </main>
        </div>
    );
};

export default Dashboard;
