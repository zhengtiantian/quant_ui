import React, { useState, useEffect } from "react";

const KEYCLOAK_TOKEN_URL = "http://localhost:8080/realms/quant/protocol/openid-connect/token";
const CLIENT_ID = "quant-ui";

const LoginRegister: React.FC = () => {
    const [mode, setMode] = useState<"login" | "register">("login");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    // === 自动刷新 token ===
    useEffect(() => {
        const refresh = async () => {
            const refresh_token = localStorage.getItem("refresh_token");
            if (!refresh_token) return;

            const params = new URLSearchParams();
            params.append("grant_type", "refresh_token");
            params.append("client_id", CLIENT_ID);
            params.append("refresh_token", refresh_token);

            try {
                const res = await fetch(KEYCLOAK_TOKEN_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: params,
                });

                if (!res.ok) throw new Error("Refresh failed");
                const data = await res.json();

                if (data.access_token) {
                    localStorage.setItem("token", data.access_token);
                    localStorage.setItem("refresh_token", data.refresh_token);
                    console.log("🔁 Token refreshed");
                }
            } catch (e) {
                console.warn("Token refresh failed:", e);
                // 静默登出而非 alert 循环
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
            const params = new URLSearchParams();
            params.append("grant_type", "password");
            params.append("client_id", CLIENT_ID);
            params.append("username", username);
            params.append("password", password);

            const res = await fetch(KEYCLOAK_TOKEN_URL, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: params,
            });

            const data = await res.json();
            if (data.access_token) {
                localStorage.setItem("token", data.access_token);
                localStorage.setItem("refresh_token", data.refresh_token);
                localStorage.setItem("username", username);
                window.location.replace("/dashboard");
            } else {
                alert("登录失败：" + (data.error_description || "未返回 token"));
            }
        } catch (e) {
            console.error("Login error:", e);
            alert("登录失败，请检查账号或密码");
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = () => {
        alert("⚠️ 注册请联系管理员或使用 Keycloak 控制台。");
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
                {loading ? "处理中..." : mode === "login" ? "登录" : "注册"}
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