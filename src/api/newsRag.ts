import { hostUrl } from "../auth";

export const AI_HOST_BASE = hostUrl(18000);

export const F06_THEMES = [
  "ai_capex",
  "export_controls",
  "tariffs_trade",
  "memory_cycle",
  "energy_oil",
  "rates_fed",
  "geopolitics_war",
  "regulation_antitrust",
  "supply_chain",
  "earnings_guidance",
  "mna",
  "product_launch",
  "cyber_outage",
  "fx_macro",
] as const;

export interface NewsRagRequest {
  question: string;
  symbol?: string;
  since?: number;
  until?: number;
  k?: number;
  rerank?: boolean;
  theme?: string;
  impacted_symbol?: string;
}

export interface NewsRagSource {
  id: number;
  mongo_id?: string | null;
  symbol?: string | null;
  date?: string | null;
  title: string;
  url?: string | null;
  event_type?: string | null;
  sentiment?: number | null;
  themes?: string[];
  impacts?: Record<string, number>;
  dense_rank?: number | null;
  sparse_rank?: number | null;
  rrf?: number;
  has_body?: boolean;
  injection_flags?: string[];
}

export interface NewsRagResponse {
  answer?: string;
  refused?: boolean;
  error?: string;
  sources?: NewsRagSource[];
  cited?: number[];
  query_info?: {
    original?: string;
    retrieval_query?: string;
    rewritten?: boolean;
    rewrite_mode?: string;
    inferred_since?: number | null;
  };
  degraded?: Record<string, string>;
  security?: {
    flagged_sources?: number[];
    answer_problems?: string[];
    chars_sanitised?: number;
  };
  retrieval_ms?: number;
  generation_ms?: number;
  legs?: { dense: number; sparse: number; fused: number };
  rerank?: { enabled: boolean; candidates?: number; max_len?: number; ms?: number; error?: string };
}

export async function askNews(req: NewsRagRequest): Promise<NewsRagResponse> {
  const res = await fetch(`${AI_HOST_BASE}/api/ask/news`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
}
