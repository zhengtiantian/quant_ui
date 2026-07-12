import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import LoginRegister from "./components/LoginRegister";
import Dashboard from "./pages/Dashboard";
import NewsList from "./components/NewsList";
import { jwtDecode } from "jwt-decode";

interface JwtPayload {
    exp?: number; // expiry timestamp (seconds)
    iat?: number; // issued-at timestamp
    sub?: string; // user ID
    [key: string]: unknown;
}

// Returns true if the JWT exists and has not expired
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

    // Clear storage if the token is invalid or expired
    if (!isValid) {
        localStorage.removeItem("token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("username");
    }

    return (
        <Router>
            <Routes>
                {/* Login page */}
                <Route
                    path="/"
                    element={isValid ? <Navigate to="/dashboard" replace /> : <LoginRegister />}
                />

                {/* Dashboard */}
                <Route
                    path="/dashboard"
                    element={isValid ? <Dashboard /> : <Navigate to="/" replace />}
                />

                {/* News page */}
                <Route
                    path="/news"
                    element={isValid ? <NewsList /> : <Navigate to="/" replace />}
                />

                {/* Fallback: redirect to root */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Router>
    );
};

export default App;