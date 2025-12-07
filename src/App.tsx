import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import LoginRegister from "./components/LoginRegister";
import Dashboard from "./pages/Dashboard";
import NewsList from "./components/NewsList";

const App: React.FC = () => {
    // 判断是否登录（本地 token）
    const token = localStorage.getItem("token");

    return (
        <Router>
            <Routes>
                {/* 登录页 */}
                <Route
                    path="/"
                    element={token ? <Navigate to="/dashboard" replace /> : <LoginRegister />}
                />

                {/* 仪表盘页面 */}
                <Route
                    path="/dashboard"
                    element={token ? <Dashboard /> : <Navigate to="/" replace />}
                />

                {/* 新闻列表页 */}
                <Route
                    path="/news"
                    element={token ? <NewsList /> : <Navigate to="/" replace />}
                />

                {/* 默认兜底路由 */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Router>
    );
};

export default App;