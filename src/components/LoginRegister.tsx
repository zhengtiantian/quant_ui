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
                    "❌ 登录失败：" +
                    (data.error_description || data.error || `HTTP ${res.status}，未返回 token`)
                );
            }
        } catch (e) {
            alert("❌ 登录失败：" + e);
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
                alert("✅ 注册成功，请登录！");
                setMode("login");
            } else {
                const err = await res.json();
                alert("❌ 注册失败：" + (err.details || err.error || res.statusText));
            }
        } catch (e) {
            alert("❌ 网络错误：" + e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ textAlign: "center", marginTop: "10%" }}>
            <h2>{mode === "login" ? "登录" : "注册"}</h2>

            <input
                style={{ padding: "8px", width: "200px", margin: "5px" }}
                placeholder="用户名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
            />
            <br />

            <input
                type="password"
                style={{ padding: "8px", width: "200px", margin: "5px" }}
                placeholder="密码"
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
                    ? "处理中..."
                    : mode === "login"
                        ? "登录"
                        : "注册"}
            </button>

            <br />
            <a
                href="#"
                onClick={() => setMode(mode === "login" ? "register" : "login")}
                style={{ color: "#007bff" }}
            >
                {mode === "login" ? "没有账号？注册一个" : "已有账号？登录"}
            </a>
        </div>
    );
};

export default LoginRegister;
