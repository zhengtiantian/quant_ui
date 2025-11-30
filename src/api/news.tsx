export interface NewsArticle {
    id: string;
    title: string;
    description?: string;
    content?: string;
    url: string;
    publishedAt: string;
    source?: { platform: string };
}

export async function fetchNews(): Promise<NewsArticle[]> {
    const res = await fetch("/api/news");
    if (!res.ok) throw new Error("Failed to fetch news");
    return await res.json();
}