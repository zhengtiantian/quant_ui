import React from "react";
import ScriptRunner from "../pages/ScriptRunner";

const Dashboard: React.FC = () => {
    const username = localStorage.getItem("username");

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

            {/* 主体：脚本运行器 */}
            <main>
                <ScriptRunner />
            </main>
        </div>
    );
};

export default Dashboard;