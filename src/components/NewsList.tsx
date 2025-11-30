import { useEffect, useState } from "react";
import { fetchNews } from "../api/news";
import type { NewsArticle } from "../api/news";

export default function NewsList() {
    const [news, setNews] = useState<NewsArticle[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchNews()
            .then(setNews)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <p>Loading news...</p>;

    return (
        <div style={{ padding: "1rem" }}>
            <h2>Latest Market News</h2>
            <ul style={{ listStyle: "none", padding: 0 }}>
                {news.map((n) => (
                    <li
                        key={n.id}
                        style={{
                            marginBottom: "1.5rem",
                            paddingBottom: "1rem",
                            borderBottom: "1px solid #ddd",
                        }}
                    >
                        <a
                            href={n.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: "1.1rem", fontWeight: "bold", color: "#007bff", textDecoration: "none" }}
                        >
                            {n.title}
                        </a>
                        <div style={{ fontSize: "0.9rem", color: "#666", marginTop: "0.2rem" }}>
                            {n.source?.platform || "Unknown"} ·{" "}
                            {new Date(n.publishedAt).toLocaleString()}
                        </div>
                        <p style={{ marginTop: "0.5rem", color: "#333" }}>
                            {n.description || n.content || "No summary available."}
                        </p>
                    </li>
                ))}
            </ul>
        </div>
    );
}