import React from "react";
import WorkflowList from "../components/WorkflowList";

const Dashboard: React.FC = () => {
    const username = localStorage.getItem("username");

    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("username");
        window.location.href = "/";
    };

    return (
        <div style={{ padding: "20px" }}>
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
    <span style={{ marginRight: "15px" }}>
👋 欢迎, {username || "用户"}
    </span>
    <button onClick={handleLogout}>退出登录</button>
        </div>
        </header>

        <main>
        {/* 这里直接展示 WorkflowList */}
        <h3>Workflow List</h3>
    <WorkflowList />
    </main>
    </div>
);
};

export default Dashboard;