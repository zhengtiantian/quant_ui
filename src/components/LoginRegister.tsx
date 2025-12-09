import React, { useState, useEffect } from "react";

const KEYCLOAK_TOKEN_URL =
    "http://localhost:8080/realms/quant/protocol/openid-connect/token"; // ✅ Keycloak realm token endpoint
const CLIENT_ID = "quant-ui"; // ✅ 对应 Keycloak clientId

const LoginRegister: React.FC = () => {
    const [mode, setMode] = useState<"login" | "register">("login");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    // === ✅ 自动刷新 token ===
    useEffect(() => {
        const refreshInterval = setInterval(async () => {
            const refresh_token = localStorage.getItem("refresh_token");
            if (!refresh_token) return;

            try {
                const params = new URLSearchParams();
                params.append("grant_type", "refresh_token");
                params.append("client_id", CLIENT_ID);
                params.append("refresh_token", refresh_token);

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
                    console.log("🔁 Token refreshed successfully");
                }
            } catch (err) {
                console.warn("❌ Token refresh failed:", err);
                alert("登录已过期，请重新登录");
                localStorage.clear();
                window.location.href = "/";
            }
        }, 4 * 60 * 1000); // 每4分钟刷新一次

        return () => clearInterval(refreshInterval);
    }, []);

    // === ✅ 登录逻辑 ===
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

            if (!res.ok) throw new Error("Login failed");
            const data = await res.json();

            if (data.access_token) {
                localStorage.setItem("token", data.access_token);
                localStorage.setItem("refresh_token", data.refresh_token);
                localStorage.setItem("username", username);

                alert("✅ 登录成功");
                window.location.href = "/dashboard";
            } else {
                alert("❌ 登录失败：未返回 token");
            }
        } catch (err) {
            console.error(err);
            alert("❌ 登录失败，请检查账号或密码");
        } finally {
            setLoading(false);
        }
    };

    // === 注册逻辑（可选） ===
    const handleRegister = async () => {
        alert("⚠️ 注册请联系管理员或使用 Keycloak Admin Console。");
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