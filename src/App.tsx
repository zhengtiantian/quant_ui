import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import LoginRegister from "./components/LoginRegister";
import Dashboard from "./pages/Dashboard";
import NewsList from "./components/NewsList";
import { jwtDecode } from "jwt-decode"; // ✅ 改成命名导入以避免报错（兼容大多数 TypeScript 配置）

// ✅ 定义 token payload 类型
interface JwtPayload {
    exp?: number; // 过期时间（秒）
    iat?: number; // 签发时间
    sub?: string; // 用户 ID
    [key: string]: unknown;
}

// ✅ 检查 token 是否过期
const isTokenValid = (token: string | null): boolean => {
    if (!token) return false;
    try {
        const decoded = jwtDecode<JwtPayload>(token);
        const now = Math.floor(Date.now() / 1000);
        return decoded.exp !== undefined && decoded.exp > now;
    } catch {
        return false;
    }
};

const App: React.FC = () => {
    const token = localStorage.getItem("token");
    const isValid = isTokenValid(token);

    // ✅ 如果 token 无效，清理本地存储
    if (!isValid) {
        localStorage.removeItem("token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("username");
    }

    return (
        <Router>
            <Routes>
                {/* 登录页 */}
                <Route
                    path="/"
                    element={isValid ? <Navigate to="/dashboard" replace /> : <LoginRegister />}
                />

                {/* 仪表盘 */}
                <Route
                    path="/dashboard"
                    element={isValid ? <Dashboard /> : <Navigate to="/" replace />}
                />

                {/* 新闻页 */}
                <Route
                    path="/news"
                    element={isValid ? <NewsList /> : <Navigate to="/" replace />}
                />

                {/* 默认兜底路由 */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Router>
    );
};

export default App;