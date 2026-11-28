import { hostUrl } from "../auth";

export const AI_HOST_BASE = hostUrl(18000);

export interface PortfolioFinding {
  check: string;
  severity: "high" | "medium" | string;
  symbol?: string | null;
  detail: string;
  value?: number | null;
  limit?: number | null;
}

export interface GroundedEvidence {
  tool?: string;
  field?: string;
  value: number | string;
}

export interface DecisionReviewItem {
  symbol?: string | null;
  action?: string | null;
  ruleReason?: string | null;
  sourceMode?: "real" | "paper" | string;
  verdict: "agree" | "flag" | "skipped" | string;
  confidence: number;
  reasoning: string;
  evidence: GroundedEvidence[];
  notes: string[];
  refPrice?: number | null;
  held?: boolean;
}

export interface PortfolioReviewReport {
  run_id: string;
  mode: string;
  lang: string;
  asOf: string;
  regime: string;
  decisionsReviewed: number;
  verdicts: {
    agree: number;
    flag: number;
    skipped: number;
  };
  findingsCount?: number;
  reviews: DecisionReviewItem[];
  portfolioFindings: PortfolioFinding[];
  hintsRecorded?: number;
  elapsed_s: number;
  error?: string;
}

export interface PortfolioReviewSummary {
  run_id: string;
  mode: string;
  regime: string;
  decisionsReviewed: number;
  verdicts: { agree: number; flag: number; skipped: number };
  findingsCount?: number;
  elapsed_s: number;
  asOf: string;
  hintsRecorded?: number;
}

export async function runPortfolioReview(params: {
  mode: "real" | "paper" | "both";
  max_decisions: number;
  lang: "zh" | "en";
  save_history?: boolean;
  record_hints?: boolean;
}): Promise<PortfolioReviewReport> {
  const res = await fetch(`${AI_HOST_BASE}/api/agent/portfolio`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      save_history: true,
      record_hints: true,
      ...params,
    }),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const data = (await res.json()) as PortfolioReviewReport;
  if (data.error) {
    throw new Error(data.error);
  }
  return data;
}

export async function fetchPortfolioReviewHistory(
  mode?: string,
  limit = 12,
): Promise<PortfolioReviewSummary[]> {
  const q = new URLSearchParams({ limit: String(limit) });
  if (mode) q.set("mode", mode);
  const res = await fetch(`${AI_HOST_BASE}/api/agent/portfolio/history?${q.toString()}`);
  if (!res.ok) return [];
  const data = (await res.json()) as { items?: PortfolioReviewSummary[] };
  return data.items ?? [];
}

export async function fetchPortfolioReviewDetail(
  runId: string,
): Promise<PortfolioReviewReport | null> {
  const res = await fetch(`${AI_HOST_BASE}/api/agent/portfolio/history/${encodeURIComponent(runId)}`);
  if (!res.ok) return null;
  return (await res.json()) as PortfolioReviewReport;
}
