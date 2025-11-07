import { useEffect, useState } from "react";

interface Workflow {
    id: string;
    name: string;
    description: string;
}

export default function WorkflowList() {
    const [workflows, setWorkflows] = useState<Workflow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch("/api/workflows")
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
                return res.json();
            })
            .then((data) => {
                setWorkflows(data);
                setLoading(false);
            })
            .catch((err) => {
                console.error("❌ Failed to fetch workflows:", err);
                setError(err.message);
                setLoading(false);
            });
    }, []);

    if (loading) return <p>⏳ 加载中...</p>;
    if (error) return <p>❌ 加载失败：{error}</p>;

    return (
        <div style={{ padding: "2rem", maxWidth: "600px", margin: "0 auto" }}>
    <h1>📊 Workflow 列表</h1>
    <ul style={{ listStyle: "none", padding: 0 }}>
    {workflows.map((wf) => (
        <li
            key={wf.id}
        style={{
        background: "#f9fafb",
            border: "1px solid #ddd",
            marginBottom: "1rem",
            padding: "1rem",
            borderRadius: "8px",
    }}
    >
        <h3>{wf.name}</h3>
        <p>{wf.description}</p>
        </li>
    ))}
    </ul>
    </div>
);
}