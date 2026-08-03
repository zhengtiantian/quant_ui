import { apiFetch } from "./client";

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
    return apiFetch("/api/news");
}