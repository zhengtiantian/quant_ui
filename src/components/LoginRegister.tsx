import React, { useState } from "react";
import axios from "axios";

const API_BASE = "http://localhost:8081/api/auth";

const LoginRegister: React.FC = () => {
    const [mode, setMode] = useState<"login" | "register">("login");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        setLoading(true);
        try {
            const res = await axios.post(`${API_BASE}/login`, { username, password });
            localStorage.setItem("token", res.data.access_token);
            localStorage.setItem("username", username);
            alert("✅ 登录成功");
            window.location.href = "/dashboard"; // ✅ 跳转到 Dashboard
        } catch (err) {
            console.error(err);
            alert("❌ 登录失败，请检查账号或密码");
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async () => {
        setLoading(true);
        try {
            await axios.post(`${API_BASE}/register`, { username, password });
            alert("✅ 注册成功，请登录");
            setMode("login");
        } catch (err) {
            console.error(err);
            alert("❌ 注册失败，可能用户已存在");
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