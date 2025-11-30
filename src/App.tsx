import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import LoginRegister from "./components/LoginRegister";
import Dashboard from "./pages/Dashboard";
import NewsList from "./components/NewsList";

const App: React.FC = () => {
    const token = localStorage.getItem("token");

    return (
        <Router>
            <Routes>
                {/* 登录页 */}
                <Route path="/" element={token ? <Navigate to="/dashboard" /> : <LoginRegister />} />

                {/* 仪表盘（主界面） */}
                <Route
                    path="/dashboard"
                    element={token ? <Dashboard /> : <Navigate to="/" />}
                />

                {/* 新闻页 */}
                <Route
                    path="/news"
                    element={token ? <NewsList /> : <Navigate to="/" />}
                />

                {/* 默认跳转 */}
                <Route path="*" element={<Navigate to="/" />} />
            </Routes>
        </Router>
    );
};

export default App;