import React, { useState } from "react";

const KEYCLOAK_TOKEN_URL =
    "http://localhost:8080/realms/quant/protocol/openid-connect/token"; // ✅ 替换成你的 realm 名

const CLIENT_ID = "quant-ui"; // ✅ 对应 Keycloak 里配置的前端 clientId

const LoginRegister: React.FC = () => {
    const [mode, setMode] = useState<"login" | "register">("login");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    // === ✅ Keycloak 登录逻辑 ===
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
                // ✅ 存储 token
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

    // === 可选注册逻辑（用 Keycloak Admin API 或后端代理） ===
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