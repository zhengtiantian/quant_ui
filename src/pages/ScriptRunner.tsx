import React, { useEffect, useState } from "react";

const ScriptRunner: React.FC = () => {
    const [scripts, setScripts] = useState<string[]>([]);
    const [selectedScript, setSelectedScript] = useState<string | null>(null);
    const [logs, setLogs] = useState<string>("");

    // 从 localStorage 获取 token
    const token = localStorage.getItem("token");

    // 通用请求头
    const authHeaders: HeadersInit = {
        Authorization: `Bearer ${token}`,
    };

    // 获取脚本列表
    useEffect(() => {
        fetch("/api/scripts", { headers: authHeaders })
            .then((res) => {
                if (res.status === 401 || res.status === 403) {
                    alert("登录已过期，请重新登录");
                    localStorage.removeItem("token");
                    window.location.href = "/";
                }
                return res.json();
            })
            .then((data) => {
                if (data.scripts) setScripts(data.scripts);
            })
            .catch((err) => console.error("Failed to fetch scripts:", err));
    }, []);

    // 运行脚本并实时读取日志
    const runScript = async (path: string) => {
        setSelectedScript(path);
        setLogs("Running script...\n");

        const response = await fetch(`/api/run/${path}`, { headers: authHeaders });
        const reader = response.body?.getReader();
        if (!reader) return;

        const decoder = new TextDecoder("utf-8");
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            setLogs((prev) => prev + decoder.decode(value));
        }
    };

    // 停止脚本
    const stopScript = async (path: string) => {
        await fetch(`/api/stop/${path}`, {
            method: "POST",
            headers: authHeaders,
        });
        setLogs((prev) => prev + "\n=== Script stopped ===\n");
    };

    return (
        <div style={{ padding: 20 }}>
            <h2>Script Runner</h2>
            <div>
                <h3>Available Scripts:</h3>
                <ul>
                    {scripts.map((script) => (
                        <li key={script} style={{ marginBottom: 8 }}>
                            {script}{" "}
                            <button onClick={() => runScript(script)}>Run</button>{" "}
                            <button onClick={() => stopScript(script)}>Stop</button>
                        </li>
                    ))}
                </ul>
            </div>

            {selectedScript && (
                <div style={{ marginTop: 20 }}>
                    <h3>Logs - {selectedScript}</h3>
                    <pre
                        style={{
                            background: "#000",
                            color: "#0f0",
                            padding: 10,
                            height: "400px",
                            overflowY: "scroll",
                        }}
                    >
                        {logs}
                    </pre>
                </div>
            )}
        </div>
    );
};

export default ScriptRunner;