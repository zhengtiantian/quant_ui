import React, { useState, useEffect } from "react";

const API_BASE = "/api/auth";
const KEYCLOAK_TOKEN_URL = `${window.location.protocol}//${window.location.hostname}:18082/realms/quant/protocol/openid-connect/token`;

const LoginRegister: React.FC = () => {
    const [mode, setMode] = useState<"login" | "register">("login");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    // === 自动刷新 token（保持登录） ===
    useEffect(() => {
        const refresh = async () => {
            const refresh_token = localStorage.getItem("refresh_token");
            if (!refresh_token) return;

            const params = new URLSearchParams();
            params.append("grant_type", "refresh_token");
            params.append("client_id", "quant-ui");
            params.append("refresh_token", refresh_token);

            try {
                const res = await fetch(KEYCLOAK_TOKEN_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: params,
                });
                if (!res.ok) throw new Error("refresh failed");
                const data = await res.json();
                localStorage.setItem("token", data.access_token);
                localStorage.setItem("refresh_token", data.refresh_token);
                console.log("🔁 token refreshed");
            } catch (e) {
                console.warn("refresh failed", e);
                localStorage.clear();
                window.location.replace("/");
            }
        };
        const interval = setInterval(refresh, 4 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    // === 登录 ===
    const handleLogin = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
            });
            const data = await res.json().catch(() => ({}));

            if (res.ok && data.access_token) {
                localStorage.setItem("token", data.access_token);
                localStorage.setItem("refresh_token", data.refresh_token);
                localStorage.setItem("username", username);
                window.location.replace("/dashboard");
            } else {
                alert(
                    "Login failed: " +
                    (data.error_description || data.error || `HTTP ${res.status}, no token returned`)
                );
            }
        } catch (e) {
            alert("Login failed: " + e);
        } finally {
            setLoading(false);
        }
    };

    // === 注册 ===
    const handleRegister = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
            });

            if (res.ok) {
                alert("Registration successful! Please sign in.");
                setMode("login");
            } else {
                const err = await res.json();
                alert("Registration failed: " + (err.details || err.error || res.statusText));
            }
        } catch (e) {
            alert("Network error: " + e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ textAlign: "center", marginTop: "10%" }}>
            <h2>{mode === "login" ? "Sign In" : "Sign Up"}</h2>

            <input
                style={{ padding: "8px", width: "200px", margin: "5px" }}
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
            />
            <br />

            <input
                type="password"
                style={{ padding: "8px", width: "200px", margin: "5px" }}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
            />
            <br />

            <button
                style={{ padding: "8px 16px", margin: "10px" }}
                disabled={loading}
                onClick={mode === "login" ? handleLogin : handleRegister}
            >
                {loading
                    ? "Processing..."
                    : mode === "login"
                        ? "Sign In"
                        : "Sign Up"}
            </button>

            <br />
            <a
                href="#"
                onClick={() => setMode(mode === "login" ? "register" : "login")}
                style={{ color: "#007bff" }}
            >
                {mode === "login" ? "No account? Sign up" : "Already have an account? Sign in"}
            </a>
        </div>
    );
};

export default LoginRegister;
