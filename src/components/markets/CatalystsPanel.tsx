import React from "react";
import {
  deleteCatalystHistory,
  fetchCatalysts,
  queryCatalysts,
  triggerCatalystsCollect,
} from "../../api/markets";
import type {
  CatalystEvent,
  CatalystLayer,
  CatalystQueryRecord,
  CatalystsFeedResponse,
  Holding,
  PerStockCatalysts,
  WatchItem,
} from "../../api/markets";
import Markdown from "./Markdown";
import {
  DOWN,
  UP,
  cell,
  color,
  ghostButton,
  iconButton,
  muted,
  panel,
  pct,
  pill,
  shortName,
  sub,
  th,
  usd,
} from "./format";

const store = {
  get: (k: string, d: string) => {
    try {
      return localStorage.getItem(k) || d;
    } catch {
      return d;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* ignore quota / private mode */
    }
  },
};

type ScopeFilter = "all" | "holdings" | "watchlist";
type LayerFilter = "all" | CatalystLayer;
type CategoryFilter = "all" | "earnings" | "catalysts" | "policy" | "macro" | "dividends";

const HORIZONS = [7, 14, 30, 60, 90, 120] as const;

const LAYER_META: Record<CatalystLayer, { zh: string; en: string; short: string; color: string }> = {
  L1_calendar: { zh: "L1 结构化日历", en: "L1 Calendar", short: "L1 日历", color: "#0284c7" },
  L2_extracted: { zh: "L2 新闻/SEC抽取", en: "L2 News/SEC", short: "L2 抽取", color: "#7c3aed" },
  L3_web: { zh: "L3 全网巡检", en: "L3 Web Sweep", short: "L3 全网", color: "#ea580c" },
};

const KIND_META: Record<string, { icon: string; zh: string; en: string; color: string }> = {
  earnings: { icon: "📊", zh: "财报", en: "Earnings", color: "#0f766e" },
  product: { icon: "🚀", zh: "产品/大会", en: "Product / Conf", color: "#7c3aed" },
  corporate: { icon: "🏢", zh: "公司事件", en: "Corporate", color: "#2563eb" },
  policy: { icon: "⚖️", zh: "政策/关税", en: "Policy / Tariff", color: "#dc2626" },
  legal: { icon: "🏛️", zh: "监管/诉讼", en: "Legal / Reg", color: "#b91c1c" },
  analyst: { icon: "🎯", zh: "机构评级", en: "Analyst", color: "#0891b2" },
  macro: { icon: "🏦", zh: "宏观日历", en: "Macro", color: "#b45309" },
  dividend: { icon: "💰", zh: "除息分红", en: "Dividend", color: "#15803d" },
  split: { icon: "✂️", zh: "拆股", en: "Split", color: "#0d9488" },
};

function fmtTimeAgo(ts?: number | null, lang: "zh" | "en" = "zh"): string {
  if (!ts) return lang === "zh" ? "尚未运行" : "Never";
  const sec = Math.max(0, Math.round(Date.now() / 1000 - ts));
  if (sec < 60) return lang === "zh" ? "刚刚" : "just now";
  if (sec < 3600) return lang === "zh" ? `${Math.round(sec / 60)}分钟前` : `${Math.round(sec / 60)}m ago`;
  if (sec < 86400) return lang === "zh" ? `${(sec / 3600).toFixed(1)}小时前` : `${(sec / 3600).toFixed(1)}h ago`;
  return new Date(ts * 1000).toLocaleDateString([], { month: "short", day: "numeric" });
}

function fmtDaysAway(d: number, lang: "zh" | "en"): { text: string; urgent: boolean } {
  if (d <= 0) return { text: lang === "zh" ? "今天" : "Today", urgent: true };
  if (d === 1) return { text: lang === "zh" ? "明天" : "Tomorrow", urgent: true };
  if (d <= 5) return { text: lang === "zh" ? `${d}天后` : `in ${d}d`, urgent: true };
  return { text: lang === "zh" ? `${d}天后` : `in ${d}d`, urgent: false };
}

function matchesCategory(ev: CatalystEvent, cat: CategoryFilter): boolean {
  if (cat === "all") return true;
  if (cat === "earnings") return ev.kind === "earnings";
  if (cat === "catalysts") return ev.kind === "product" || ev.kind === "corporate" || ev.kind === "analyst";
  if (cat === "policy") return ev.kind === "policy" || ev.kind === "legal";
  if (cat === "macro") return ev.kind === "macro";
  if (cat === "dividends") return ev.kind === "dividend" || ev.kind === "split";
  return true;
}

function eventMatchesText(ev: CatalystEvent, qLower: string): boolean {
  if (!qLower) return true;
  const hay = [
    ev.symbol,
    ev.name,
    ev.date,
    ev.kind,
    ev.layer,
    ev.title_zh,
    ev.title_en,
    ev.detail_zh,
    ev.detail_en,
    ev.source_title,
    ...(ev.affected_symbols || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(qLower);
}

/** Button rendered on every row in Holdings & Watchlist tables to pop open that stock's catalysts modal. */
export const StockCatalystButton: React.FC<{
  symbol: string;
  info?: PerStockCatalysts;
  lang: "zh" | "en";
  onOpen: (symbol: string) => void;
}> = ({ symbol, info, lang, onOpen }) => {
  const nd = info?.next_direct;
  const dCnt = info?.direct_count ?? 0;
  const sCnt = info?.spillover_count ?? 0;
  const urgent = Boolean(nd && nd.days_away <= 5);

  let badgeLabel = lang === "zh" ? "🔭 未来事件" : "🔭 Events";
  let subHint = "";

  if (info) {
    badgeLabel =
      lang === "zh"
        ? `🔭 事件 (${dCnt}${sCnt ? `+${sCnt}` : ""})`
        : `🔭 Events (${dCnt}${sCnt ? `+${sCnt}` : ""})`;
    if (nd) {
      const rawTitle = (lang === "zh" ? nd.title_zh : nd.title_en) || nd.title_en || nd.title_zh;
      const clean = rawTitle.replace(/^[A-Z0-9.]+\s*[·:-]?\s*/i, "");
      const short = clean.length > 16 ? `${clean.slice(0, 16)}…` : clean;
      subHint = `${nd.date.slice(5)} ${short}${nd.implied_move_pct != null ? ` ±${nd.implied_move_pct.toFixed(1)}%` : ""}`;
    } else if (sCnt > 0) {
      subHint = lang === "zh" ? `${sCnt} 条上下游联动` : `${sCnt} spillover`;
    }
  }

  return (
    <div onClick={(e) => e.stopPropagation()} style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpen(symbol);
        }}
        title={lang === "zh" ? `点击弹窗查看 ${symbol} 的未来三层事件与 AI 分析` : `Open upcoming catalysts modal for ${symbol}`}
        style={{
          background: urgent ? "#fff1f2" : "#f0fdfa",
          color: urgent ? "#be123c" : "#0f766e",
          border: `1px solid ${urgent ? "#fecdd3" : "#99f6e4"}`,
          borderRadius: 8,
          padding: "3px 9px",
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {badgeLabel}
      </button>
      {subHint ? (
        <span
          onClick={(e) => {
            e.stopPropagation();
            onOpen(symbol);
          }}
          style={{
            fontSize: 11,
            color: urgent ? "#be123c" : "#64748b",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {subHint}
        </span>
      ) : null}
    </div>
  );
};

const EventCard: React.FC<{
  ev: CatalystEvent;
  lang: "zh" | "en";
  heldSet: Set<string>;
  onSwitchSymbol?: (sym: string) => void;
}> = ({ ev, lang, heldSet, onSwitchSymbol }) => {
  const km = KIND_META[ev.kind] || KIND_META.corporate;
  const lm = LAYER_META[ev.layer] || LAYER_META.L1_calendar;
  const cd = fmtDaysAway(ev.days_away, lang);
  const title = (lang === "zh" ? ev.title_zh : ev.title_en) || ev.title_en || ev.title_zh;
  const detail = (lang === "zh" ? ev.detail_zh : ev.detail_en) || ev.detail_en || ev.detail_zh;
  const spilloverHeld = (ev.related_holdings || []).filter((s) => s !== ev.symbol);

  return (
    <div
      style={{
        padding: "10px 12px",
        borderRadius: 10,
        border: `1px solid ${cd.urgent && ev.impact_level === "high" ? "#fecdd3" : "#e2e8f0"}`,
        background: cd.urgent && ev.impact_level === "high" ? "#fffafb" : "#ffffff",
        display: "flex",
        flexDirection: "column",
        gap: 5,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span style={{ fontWeight: 700, fontSize: 13, fontVariantNumeric: "tabular-nums", color: "#0f172a" }}>
          {ev.date}
          {ev.date_precision === "approx" ? " ~" : ""}
        </span>
        <span style={pill(cd.urgent ? "#be123c" : "#475569")}>{cd.text}</span>
        <span style={pill(km.color)}>
          {km.icon} {lang === "zh" ? km.zh : km.en}
        </span>
        <span style={pill(lm.color)}>{lm.short}</span>
        {ev.symbol && ev.symbol !== "MACRO" ? (
          <button
            type="button"
            onClick={() => onSwitchSymbol?.(ev.symbol)}
            style={{
              ...iconButton,
              marginLeft: 0,
              fontWeight: 700,
              color: heldSet.has(ev.symbol) ? "#0f766e" : "#1e293b",
              background: heldSet.has(ev.symbol) ? "#f0fdfa" : "#f8fafc",
            }}
          >
            {ev.symbol}
            {heldSet.has(ev.symbol) ? (lang === "zh" ? " · 持仓" : " · Held") : ""}
          </button>
        ) : null}
        {ev.implied_move_pct != null ? (
          <span style={pill("#7c2d12")} title="Options ATM straddle implied move">
            {lang === "zh" ? `期权隐含 ±${ev.implied_move_pct.toFixed(1)}%` : `Implied ±${ev.implied_move_pct.toFixed(1)}%`}
          </span>
        ) : null}
        {ev.estimated_payout_usd != null ? (
          <span style={pill(UP)}>+{usd(ev.estimated_payout_usd)}</span>
        ) : null}
        {ev.source_url ? (
          <a
            href={ev.source_url}
            target="_blank"
            rel="noreferrer"
            style={{ marginLeft: "auto", fontSize: 12, color: "#0284c7", textDecoration: "none" }}
            title={ev.source_title || ev.source_url}
          >
            🔗 {ev.source_title ? ev.source_title.slice(0, 26) : lang === "zh" ? "查看来源" : "Source"} ↗
          </a>
        ) : null}
      </div>

      <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", lineHeight: 1.4 }}>{title}</div>
      {detail && detail !== title ? (
        <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.5 }}>{detail}</div>
      ) : null}

      {spilloverHeld.length > 0 && ev.symbol !== "MACRO" ? (
        <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap", marginTop: 2 }}>
          <span style={{ fontSize: 11.5, color: "#64748b" }}>
            {lang === "zh" ? "传导影响持仓:" : "Impacts holdings:"}
          </span>
          {spilloverHeld.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSwitchSymbol?.(s)}
              style={{
                ...iconButton,
                marginLeft: 0,
                padding: "1px 7px",
                fontSize: 11.5,
                color: "#0f766e",
                borderColor: "#99f6e4",
                background: "#f0fdfa",
              }}
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export interface CatalystsControllerProps {
  holdings: Holding[];
  watchlist: WatchItem[];
  /** null = modal closed; "ALL" = open global overview modal; "<SYMBOL>" = open modal focused on that stock */
  modalTarget: string | null;
  onChangeModalTarget: (target: string | null) => void;
  onOpenChart?: (symbol: string) => void;
  onSummaryMap?: (perStock: Record<string, PerStockCatalysts>, lang: "zh" | "en") => void;
}

const CatalystsPanel: React.FC<CatalystsControllerProps> = ({
  holdings,
  watchlist,
  modalTarget,
  onChangeModalTarget,
  onOpenChart,
  onSummaryMap,
}) => {
  const [lang, setLang] = React.useState<"zh" | "en">(() =>
    store.get("briefLang", "zh") === "en" ? "en" : "zh"
  );
  const [days, setDays] = React.useState<number>(() => Number(store.get("catDaysV2", "90")) || 90);
  const [scope, setScope] = React.useState<ScopeFilter>("all");
  const [layerFilter, setLayerFilter] = React.useState<LayerFilter>("all");
  const [catFilter, setCatFilter] = React.useState<CategoryFilter>("all");

  const [barSearch, setBarSearch] = React.useState("");
  const [modalSearch, setModalSearch] = React.useState("");

  const [feed, setFeed] = React.useState<CatalystsFeedResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [askingMode, setAskingMode] = React.useState<"fast" | "web" | null>(null);
  const [activeQuery, setActiveQuery] = React.useState<CatalystQueryRecord | null>(null);
  const [recentQueries, setRecentQueries] = React.useState<CatalystQueryRecord[]>([]);
  const [queryError, setQueryError] = React.useState<string | null>(null);

  const summaryCbRef = React.useRef(onSummaryMap);
  summaryCbRef.current = onSummaryMap;

  const heldSet = React.useMemo(() => new Set(holdings.map((h) => h.symbol)), [holdings]);
  const watchSet = React.useMemo(() => new Set(watchlist.map((w) => w.symbol)), [watchlist]);

  const loadFeed = React.useCallback(
    async (force = false) => {
      setLoading(true);
      try {
        const res = await fetchCatalysts({ scope: "all", days, force });
        setFeed(res);
        setRecentQueries(res.recent_queries || []);
        setError(null);
        summaryCbRef.current?.(res.per_stock || {}, lang);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [days, lang]
  );

  const portfolioKey = React.useMemo(
    () => `${holdings.map((h) => h.symbol).join(",")}|${watchlist.map((w) => w.symbol).join(",")}`,
    [holdings, watchlist]
  );

  React.useEffect(() => {
    void loadFeed(false);
  }, [loadFeed, portfolioKey]);

  // Poll every 4s while L2 or L3 background collection is running
  const anyRunning = Boolean(
    feed?.collection?.L2_extracted?.running || feed?.collection?.L3_web?.running
  );
  React.useEffect(() => {
    if (!anyRunning) return;
    const id = window.setInterval(() => {
      if (!document.hidden) void loadFeed(false);
    }, 4000);
    return () => window.clearInterval(id);
  }, [anyRunning, loadFeed]);

  // Close modal on Escape & lock background scroll while modal is open
  React.useEffect(() => {
    if (!modalTarget) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onChangeModalTarget(null);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [modalTarget, onChangeModalTarget]);

  // Reset active AI card when switching to a different stock so it stays relevant
  const prevTargetRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (modalTarget && modalTarget !== prevTargetRef.current) {
      setQueryError(null);
      if (modalTarget !== "ALL") {
        setModalSearch("");
        setActiveQuery(null);
      }
    }
    prevTargetRef.current = modalTarget;
  }, [modalTarget]);

  const switchLang = (l: "zh" | "en") => {
    setLang(l);
    store.set("briefLang", l);
    if (feed?.per_stock) summaryCbRef.current?.(feed.per_stock, l);
  };

  const handleCollect = async (which: "l2" | "l3" | "all") => {
    try {
      const res = await triggerCatalystsCollect(which, Math.max(days, 45));
      setFeed((prev) => (prev ? { ...prev, collection: res.layers } : prev));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const activeStockSym = modalTarget && modalTarget !== "ALL" ? modalTarget : null;
  const activeStock: PerStockCatalysts | undefined = activeStockSym
    ? feed?.per_stock?.[activeStockSym]
    : undefined;

  const handleAsk = async (mode: "fast" | "web", overrideQuestion?: string, targetSym?: string | null) => {
    const q = (overrideQuestion ?? modalSearch).trim();
    if (!q || askingMode) return;
    if (overrideQuestion) setModalSearch(overrideQuestion);
    setAskingMode(mode);
    setQueryError(null);
    const symToUse = targetSym !== undefined ? targetSym : activeStockSym;
    try {
      const r = await queryCatalysts({
        question: q,
        scope: symToUse ? "all" : scope,
        days,
        symbols: symToUse ? [symToUse] : undefined,
        mode,
        lang,
      });
      setActiveQuery(r.result);
      setRecentQueries(r.recent_queries || []);
    } catch (e) {
      setQueryError((e as Error).message);
    } finally {
      setAskingMode(null);
    }
  };

  const handleBarSubmit = (askAi: boolean) => {
    const q = barSearch.trim();
    const upper = q.toUpperCase();
    // If user typed an exact symbol (e.g. "TSM" or "NVDA") and didn't click Ask AI, open that stock's modal directly!
    if (!askAi && q && (heldSet.has(upper) || watchSet.has(upper))) {
      setBarSearch("");
      onChangeModalTarget(upper);
      return;
    }
    onChangeModalTarget("ALL");
    if (q) {
      setModalSearch(q);
      setBarSearch("");
      if (askAi) {
        void handleAsk("fast", q, null);
      }
    }
  };

  const handleDeleteQuery = async (id?: number, clearAll = false) => {
    try {
      const r = await deleteCatalystHistory({ id, clear_all: clearAll });
      setRecentQueries(r.recent_queries || []);
      if (clearAll || (id != null && activeQuery?.id === id)) {
        setActiveQuery(null);
      }
    } catch (e) {
      setQueryError((e as Error).message);
    }
  };

  // Smart keyword filtering inside modal (doesn't blank screen when typing a natural language question)
  const qTrim = modalSearch.trim();
  const qLower = qTrim.toLowerCase();

  const filtEvents = React.useCallback(
    (list: CatalystEvent[], kw: string) =>
      list.filter(
        (e) =>
          (layerFilter === "all" || e.layer === layerFilter) &&
          matchesCategory(e, catFilter) &&
          eventMatchesText(e, kw)
      ),
    [layerFilter, catFilter]
  );

  // For single-stock modal
  const stockRawMatches = React.useMemo(() => {
    if (!activeStock || !qLower) return 0;
    return [...activeStock.direct, ...activeStock.spillover, ...activeStock.macro].filter((e) =>
      eventMatchesText(e, qLower)
    ).length;
  }, [activeStock, qLower]);
  const stockKw = qLower && stockRawMatches > 0 ? qLower : "";

  // For ALL overview modal
  const allRawMatches = React.useMemo(() => {
    if (!feed || !qLower) return 0;
    return feed.timeline.filter((e) => eventMatchesText(e, qLower)).length;
  }, [feed, qLower]);
  const allKw = qLower && allRawMatches > 0 ? qLower : "";

  const filteredTimeline = React.useMemo(() => {
    if (!feed) return [];
    return feed.timeline.filter((ev) => {
      if (scope === "holdings") {
        const ok =
          ev.bucket === "held" ||
          (ev.related_holdings && ev.related_holdings.length > 0) ||
          (ev.bucket === "macro" && ev.impact_level === "high");
        if (!ok) return false;
      } else if (scope === "watchlist") {
        const ok =
          ev.bucket === "watchlist" ||
          (ev.affected_symbols || []).some((s) => watchSet.has(s));
        if (!ok) return false;
      }
      if (layerFilter !== "all" && ev.layer !== layerFilter) return false;
      if (!matchesCategory(ev, catFilter)) return false;
      if (allKw && !eventMatchesText(ev, allKw)) return false;
      return true;
    });
  }, [feed, scope, layerFilter, catFilter, allKw, watchSet]);

  const segBtn = (active: boolean, accent = "#0f766e"): React.CSSProperties => ({
    ...ghostButton,
    padding: "3px 9px",
    fontSize: 12,
    borderRadius: 8,
    borderColor: active ? accent : "#cbd5e1",
    background: active ? accent : "#ffffff",
    color: active ? "#ffffff" : "#334155",
    fontWeight: active ? 700 : 500,
    cursor: "pointer",
  });

  const l2 = feed?.collection?.L2_extracted;
  const l3 = feed?.collection?.L3_web;

  const stockDirect = activeStock ? filtEvents(activeStock.direct, stockKw) : [];
  const stockSpill = activeStock ? filtEvents(activeStock.spillover, stockKw) : [];
  const stockMacro = activeStock ? filtEvents(activeStock.macro, stockKw) : [];

  const quickPrompts = activeStockSym
    ? [
        lang === "zh"
          ? `未来 ${days} 天哪些事件最影响 ${activeStockSym}？预期与风险点是什么？`
          : `What upcoming events matter most for ${activeStockSym} in the next ${days} days?`,
        heldSet.has(activeStockSym)
          ? lang === "zh"
            ? `结合上下游财报与行业大会，分析我持仓的 ${activeStockSym} 近期催化与传导影响`
            : `Analyze peer earnings & conference spillover into my held position ${activeStockSym}`
          : lang === "zh"
          ? `观察股 ${activeStockSym} 未来的催化剂会如何联动影响我的持仓？`
          : `How will upcoming catalysts for watchlist stock ${activeStockSym} impact my holdings?`,
      ]
    : [
        lang === "zh"
          ? `未来 ${days} 天最影响我持仓的3个核心催化剂是什么？`
          : `Top 3 catalysts for my holdings in the next ${days} days?`,
        lang === "zh"
          ? "Watchlist 财报与产品大会对 TSM / SKHY / INTC / STX 的供应链传导"
          : "Watchlist earnings & conference spillover to TSM / SKHY / INTC / STX",
        lang === "zh"
          ? "近期美国宏观（大选/CPI/非农/FOMC）与半导体关税监管风险点"
          : "Upcoming macro (Election/CPI/NFP/FOMC) & semiconductor tariff risks",
      ];

  return (
    <>
      {/* Compact 1-Line Search & Modal Launcher Bar on My Holdings Page */}
      <div
        style={{
          ...panel,
          padding: "10px 14px",
          background: "linear-gradient(90deg, #f0fdfa 0%, #ffffff 60%, #f8fafc 100%)",
          borderColor: "#99f6e4",
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontWeight: 800, fontSize: 14.5, color: "#0f172a", whiteSpace: "nowrap" }}>
          🔭 {lang === "zh" ? "未来事件三层雷达" : "3-Layer Catalysts"}
        </span>
        {feed ? (
          <span style={pill("#0f766e")}>
            L1 {feed.summary.l1} · L2 {l2?.stored_count ?? 0} · L3 {l3?.stored_count ?? 0}
          </span>
        ) : null}

        <input
          value={barSearch}
          onChange={(e) => setBarSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleBarSubmit(true);
            }
          }}
          placeholder={
            lang === "zh"
              ? "输入股票代码(如 TSM/NVDA)或问题，弹窗查看未来催化剂（也可直接点击每只股票旁的「🔭 事件」按钮）…"
              : "Type symbol or question to open Catalysts Modal (or click '🔭 Events' on any stock row)…"
          }
          style={{
            flex: "1 1 260px",
            padding: "7px 11px",
            borderRadius: 8,
            border: "1px solid #cbd5e1",
            fontSize: 13,
            background: "#ffffff",
          }}
        />

        <button
          type="button"
          onClick={() => handleBarSubmit(true)}
          style={{
            ...ghostButton,
            padding: "6px 12px",
            borderRadius: 8,
            background: "#0f766e",
            color: "#ffffff",
            borderColor: "#0f766e",
            fontWeight: 700,
            fontSize: 12.5,
          }}
        >
          ⚡ {lang === "zh" ? "AI 搜索问答" : "AI Query"}
        </button>

        <button
          type="button"
          onClick={() => onChangeModalTarget("ALL")}
          style={{
            ...ghostButton,
            padding: "6px 12px",
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 12.5,
          }}
        >
          📅 {lang === "zh" ? "打开全部事件窗" : "All Events Modal"}
        </button>
      </div>

      {/* POP-UP MODAL WINDOW (Closable via ✕ button, Esc key, or clicking backdrop) */}
      {modalTarget ? (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) onChangeModalTarget(null);
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            backdropFilter: "blur(2px)",
            display: "grid",
            placeItems: "center",
            padding: "16px",
            zIndex: 55,
          }}
        >
          <div
            style={{
              ...panel,
              width: "min(940px, 96vw)",
              maxHeight: "90vh",
              marginBottom: 0,
              padding: 0,
              background: "#ffffff",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 20px 45px rgba(15, 23, 42, 0.24)",
            }}
          >
            {/* STICKY MODAL HEADER */}
            <div
              style={{
                padding: "14px 18px 10px",
                borderBottom: "1px solid #e2e8f0",
                background: "#f8fafc",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {activeStockSym ? (
                    <>
                      <span style={{ fontSize: 20, fontWeight: 800, color: "#0f172a" }}>
                        🔭 {activeStockSym}
                      </span>
                      {activeStock ? (
                        <span style={muted}>{shortName(activeStock.name)}</span>
                      ) : null}
                      <span style={pill(heldSet.has(activeStockSym) ? "#0f766e" : "#475569")}>
                        {heldSet.has(activeStockSym)
                          ? lang === "zh"
                            ? `我的持仓${activeStock?.weight_pct != null ? ` · 仓位 ${activeStock.weight_pct.toFixed(1)}%` : ""}`
                            : `Held${activeStock?.weight_pct != null ? ` · ${activeStock.weight_pct.toFixed(1)}%` : ""}`
                          : lang === "zh"
                          ? "观察池 Watchlist"
                          : "Watchlist"}
                      </span>
                      {activeStock?.price != null ? (
                        <span style={{ fontWeight: 700, fontSize: 14, fontVariantNumeric: "tabular-nums" }}>
                          {usd(activeStock.price)}{" "}
                          {activeStock.day_change_pct != null ? (
                            <span style={{ color: color(activeStock.day_change_pct) }}>
                              {pct(activeStock.day_change_pct)}
                            </span>
                          ) : null}
                        </span>
                      ) : null}
                      {onOpenChart ? (
                        <button
                          type="button"
                          onClick={() => {
                            const sym = activeStockSym;
                            onChangeModalTarget(null);
                            onOpenChart(sym);
                          }}
                          style={{ ...iconButton, marginLeft: 2, fontSize: 12 }}
                        >
                          📈 {lang === "zh" ? "K线图" : "Chart"}
                        </button>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>
                        🔭 {lang === "zh" ? "全部持仓与观察池 · 未来事件总览" : "All Holdings & Watchlist · Upcoming Events"}
                      </span>
                      {feed ? (
                        <span style={pill("#0f766e")}>
                          {feed.from.slice(5)} → {feed.to.slice(5)} ({filteredTimeline.length})
                        </span>
                      ) : null}
                    </>
                  )}
                </div>

                {/* Top-Right Controls + Prominent Close Button */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  {HORIZONS.map((h) => (
                    <button
                      key={h}
                      type="button"
                      style={segBtn(days === h, "#0284c7")}
                      onClick={() => {
                        setDays(h);
                        store.set("catDaysV2", String(h));
                      }}
                    >
                      {h}D
                    </button>
                  ))}
                  <button
                    type="button"
                    style={segBtn(lang === "zh")}
                    onClick={() => switchLang(lang === "zh" ? "en" : "zh")}
                  >
                    {lang === "zh" ? "EN" : "中文"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeModalTarget(null)}
                    title="Close (Esc)"
                    style={{
                      background: "#0f172a",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: 8,
                      padding: "5px 12px",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    ✕ {lang === "zh" ? "关闭" : "Close"}
                  </button>
                </div>
              </div>

              {/* Quick Stock Switcher Strip inside Modal */}
              {feed ? (
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
                  <button
                    type="button"
                    onClick={() => onChangeModalTarget("ALL")}
                    style={{
                      ...iconButton,
                      marginLeft: 0,
                      padding: "2px 8px",
                      fontSize: 11.5,
                      fontWeight: 700,
                      background: modalTarget === "ALL" ? "#0f172a" : "#ffffff",
                      color: modalTarget === "ALL" ? "#ffffff" : "#334155",
                    }}
                  >
                    🌐 {lang === "zh" ? "全部时间轴" : "All Timeline"}
                  </button>
                  {feed.symbols_meta.map((m) => {
                    const ps = feed.per_stock[m.symbol];
                    const dCnt = ps?.direct_count ?? 0;
                    const isSel = activeStockSym === m.symbol;
                    const isHeld = m.bucket === "held";
                    return (
                      <button
                        key={m.symbol}
                        type="button"
                        onClick={() => onChangeModalTarget(m.symbol)}
                        style={{
                          ...iconButton,
                          marginLeft: 0,
                          padding: "2px 7px",
                          fontSize: 11.5,
                          fontWeight: isHeld || isSel ? 700 : 500,
                          borderColor: isSel ? "#0f766e" : isHeld ? "#99f6e4" : "#e2e8f0",
                          background: isSel ? "#0f766e" : isHeld ? "#f0fdfa" : "#ffffff",
                          color: isSel ? "#ffffff" : isHeld ? "#0f766e" : "#475569",
                        }}
                      >
                        {isHeld ? "★" : ""}
                        {m.symbol}
                        {dCnt ? `(${dCnt})` : ""}
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {/* Layer + Category Sub-Filter Row */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                {(
                  [
                    ["all", lang === "zh" ? "三层全部" : "All 3 Layers"],
                    ["L1_calendar", lang === "zh" ? "L1 日历" : "L1 Calendar"],
                    ["L2_extracted", lang === "zh" ? "L2 新闻/SEC抽取" : "L2 Extracted"],
                    ["L3_web", lang === "zh" ? "L3 全网巡检" : "L3 Web Sweep"],
                  ] as [LayerFilter, string][]
                ).map(([lk, lbl]) => (
                  <button
                    key={lk}
                    type="button"
                    style={segBtn(
                      layerFilter === lk,
                      lk === "all" ? "#475569" : LAYER_META[lk].color
                    )}
                    onClick={() => setLayerFilter(lk)}
                  >
                    {lbl}
                  </button>
                ))}

                <select
                  value={catFilter}
                  onChange={(e) => setCatFilter(e.target.value as CategoryFilter)}
                  style={{
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    padding: "3px 8px",
                    fontSize: 12,
                    background: "#ffffff",
                  }}
                >
                  <option value="all">{lang === "zh" ? "全部事件类型" : "All Event Types"}</option>
                  <option value="earnings">{lang === "zh" ? "📊 财报与业绩" : "📊 Earnings"}</option>
                  <option value="catalysts">{lang === "zh" ? "🚀 产品/大会/公司" : "🚀 Product & Corp"}</option>
                  <option value="policy">{lang === "zh" ? "⚖️ 政策/关税/监管" : "⚖️ Policy & Legal"}</option>
                  <option value="macro">{lang === "zh" ? "🏦 宏观与央行" : "🏦 Macro & Fed"}</option>
                  <option value="dividends">{lang === "zh" ? "💰 除息与拆股" : "💰 Dividends & Splits"}</option>
                </select>

                {!activeStockSym ? (
                  <select
                    value={scope}
                    onChange={(e) => setScope(e.target.value as ScopeFilter)}
                    style={{
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      padding: "3px 8px",
                      fontSize: 12,
                      background: "#ffffff",
                    }}
                  >
                    <option value="all">{lang === "zh" ? "范围: 持仓 + 观察池" : "Scope: All"}</option>
                    <option value="holdings">{lang === "zh" ? "范围: 仅持仓" : "Scope: Holdings"}</option>
                    <option value="watchlist">{lang === "zh" ? "范围: 仅观察池" : "Scope: Watchlist"}</option>
                  </select>
                ) : null}
              </div>
            </div>

            {/* SCROLLABLE MODAL BODY */}
            <div style={{ padding: "14px 18px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Search & AI Query Box inside Modal */}
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: "#f0fdfa",
                  border: "1px solid #99f6e4",
                }}
              >
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ position: "relative", flex: "1 1 280px", display: "flex", alignItems: "center" }}>
                    <input
                      value={modalSearch}
                      onChange={(e) => setModalSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void handleAsk("fast");
                        }
                      }}
                      placeholder={
                        activeStockSym
                          ? lang === "zh"
                            ? `🔍 筛选 ${activeStockSym} 事件，或提问（如：未来一个月什么事件最影响 ${activeStockSym}？）…`
                            : `🔍 Filter ${activeStockSym} events or ask AI about ${activeStockSym}'s upcoming catalysts…`
                          : lang === "zh"
                          ? "🔍 输入关键词筛选下方时间轴，或输入问题回车让 AI 综合三层事件解答…"
                          : "🔍 Type keyword to filter timeline, or ask AI across all 3 catalyst layers…"
                      }
                      style={{
                        width: "100%",
                        padding: "8px 28px 8px 10px",
                        borderRadius: 8,
                        border: "1px solid #94a3b8",
                        fontSize: 13,
                        background: "#ffffff",
                      }}
                    />
                    {modalSearch ? (
                      <button
                        type="button"
                        onClick={() => setModalSearch("")}
                        style={{
                          position: "absolute",
                          right: 4,
                          background: "transparent",
                          border: "none",
                          color: "#64748b",
                          cursor: "pointer",
                          padding: "2px 6px",
                        }}
                      >
                        ✕
                      </button>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    disabled={!qTrim || askingMode !== null}
                    onClick={() => void handleAsk("fast")}
                    style={{
                      ...ghostButton,
                      background: "#0f766e",
                      color: "#ffffff",
                      borderColor: "#0f766e",
                      fontWeight: 700,
                      borderRadius: 8,
                      padding: "7px 12px",
                      fontSize: 12.5,
                      opacity: !qTrim || askingMode !== null ? 0.65 : 1,
                    }}
                  >
                    {askingMode === "fast"
                      ? lang === "zh"
                        ? "⏳ AI 分析中…"
                        : "⏳ Analyzing…"
                      : lang === "zh"
                      ? "⚡ AI 快速分析"
                      : "⚡ AI Fast Query"}
                  </button>

                  <button
                    type="button"
                    disabled={!qTrim || askingMode !== null}
                    onClick={() => void handleAsk("web")}
                    style={{
                      ...ghostButton,
                      background: "#ffffff",
                      color: "#c2410c",
                      borderColor: "#fdba74",
                      fontWeight: 700,
                      borderRadius: 8,
                      padding: "7px 12px",
                      fontSize: 12.5,
                      opacity: !qTrim || askingMode !== null ? 0.65 : 1,
                    }}
                  >
                    {askingMode === "web"
                      ? lang === "zh"
                        ? "🌐 联网深挖中…"
                        : "🌐 Searching…"
                      : lang === "zh"
                      ? "🌐 联网深挖"
                      : "🌐 Deep Web"}
                  </button>
                </div>

                {/* Preset 1-click questions */}
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 7, alignItems: "center" }}>
                  <span style={{ fontSize: 11.5, color: "#475569", fontWeight: 600 }}>
                    {lang === "zh" ? "一键提问:" : "Quick ask:"}
                  </span>
                  {quickPrompts.map((pText, i) => (
                    <button
                      key={i}
                      type="button"
                      disabled={askingMode !== null}
                      onClick={() => void handleAsk("fast", pText)}
                      style={{
                        background: "#ffffff",
                        border: "1px solid #cbd5e1",
                        borderRadius: 999,
                        padding: "2px 9px",
                        fontSize: 11.5,
                        color: "#334155",
                        cursor: "pointer",
                      }}
                    >
                      {pText}
                    </button>
                  ))}
                </div>

                {/* Recent Query History */}
                {recentQueries.length > 0 ? (
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 6, alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: "#64748b" }}>
                      {lang === "zh" ? "历史记录:" : "History:"}
                    </span>
                    {recentQueries.slice(0, 5).map((rq) => {
                      const isSel = activeQuery?.id === rq.id;
                      return (
                        <span
                          key={rq.id}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 3,
                            background: isSel ? "#ccfbf1" : "#ffffff",
                            border: `1px solid ${isSel ? "#14b8a6" : "#e2e8f0"}`,
                            borderRadius: 999,
                            padding: "1px 8px",
                            fontSize: 11,
                          }}
                        >
                          <span
                            onClick={() => setActiveQuery(isSel ? null : rq)}
                            style={{ cursor: "pointer", color: "#0f172a" }}
                            title={rq.question}
                          >
                            {rq.question.length > 20 ? `${rq.question.slice(0, 20)}…` : rq.question}
                          </span>
                          <span
                            onClick={() => void handleDeleteQuery(rq.id)}
                            style={{ cursor: "pointer", color: "#94a3b8" }}
                          >
                            ×
                          </span>
                        </span>
                      );
                    })}
                  </div>
                ) : null}

                {queryError ? (
                  <div style={{ color: DOWN, fontSize: 12.5, marginTop: 6 }}>⚠️ {queryError}</div>
                ) : null}

                {activeQuery ? (
                  <div
                    style={{
                      marginTop: 8,
                      padding: "10px 12px",
                      borderRadius: 8,
                      background: "#ffffff",
                      border: "1px solid #cbd5e1",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                        <b>🤖 {activeQuery.question}</b>
                        <span style={pill("#0f766e")}>{activeQuery.model || activeQuery.mode}</span>
                        <span style={muted}>{activeQuery.elapsed_s}s</span>
                      </div>
                      <button type="button" style={iconButton} onClick={() => setActiveQuery(null)}>
                        ✕
                      </button>
                    </div>
                    <Markdown text={activeQuery.answer} />
                    {activeQuery.sources && activeQuery.sources.length > 0 ? (
                      <div style={{ marginTop: 8, paddingTop: 6, borderTop: "1px solid #eef2f7", display: "flex", gap: 5, flexWrap: "wrap" }}>
                        {activeQuery.sources.map((src, idx) => (
                          <a
                            key={idx}
                            href={src.url}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              fontSize: 11,
                              color: "#0284c7",
                              background: "#f0f9ff",
                              border: "1px solid #bae6fd",
                              borderRadius: 6,
                              padding: "2px 6px",
                              textDecoration: "none",
                            }}
                          >
                            [{src.id ?? idx + 1}] {src.title.length > 42 ? `${src.title.slice(0, 42)}…` : src.title} ↗
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {error ? (
                <div style={{ color: DOWN, fontSize: 13 }}>⚠️ {error}</div>
              ) : null}

              {!feed && loading ? (
                <div style={{ ...muted, padding: "24px 0", textAlign: "center" }}>
                  ⏳ {lang === "zh" ? "正在加载三层事件数据…" : "Loading 3-layer catalysts…"}
                </div>
              ) : null}

              {/* CASE A: SINGLE STOCK MODAL CONTENT */}
              {feed && activeStockSym ? (
                activeStock ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {/* 1. Direct Events */}
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 14, color: "#0f172a", marginBottom: 8 }}>
                        🎯 {lang === "zh" ? `${activeStockSym} 本公司直接事件 (${stockDirect.length})` : `${activeStockSym} Direct Company Events (${stockDirect.length})`}
                      </div>
                      {stockDirect.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {stockDirect.map((ev) => (
                            <EventCard
                              key={ev.id}
                              ev={ev}
                              lang={lang}
                              heldSet={heldSet}
                              onSwitchSymbol={(sym) => onChangeModalTarget(sym)}
                            />
                          ))}
                        </div>
                      ) : (
                        <div
                          style={{
                            fontSize: 13,
                            color: "#64748b",
                            background: "#f8fafc",
                            borderRadius: 8,
                            padding: "10px 12px",
                            border: "1px dashed #cbd5e1",
                          }}
                        >
                          {lang === "zh"
                            ? `未来 ${days} 天内暂无已披露的 ${activeStockSym} 直接排期（可点击右上角切换至 90D / 120D 查看下季财报，或参考下方上下游联动事件）。`
                            : `No confirmed direct schedule for ${activeStockSym} within ${days}D (switch to 90D/120D at top-right for next earnings, or inspect spillover below).`}
                        </div>
                      )}
                    </div>

                    {/* 2. Supply-Chain & Peer Spillover */}
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 14, color: "#6d28d9", marginBottom: 8 }}>
                        🔗 {lang === "zh" ? `影响 ${activeStockSym} 的上下游与同行传导事件 (${stockSpill.length})` : `Supply-Chain & Peer Spillover Affecting ${activeStockSym} (${stockSpill.length})`}
                      </div>
                      {stockSpill.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {stockSpill.map((ev) => (
                            <EventCard
                              key={ev.id}
                              ev={ev}
                              lang={lang}
                              heldSet={heldSet}
                              onSwitchSymbol={(sym) => onChangeModalTarget(sym)}
                            />
                          ))}
                        </div>
                      ) : (
                        <div style={muted}>
                          {lang === "zh" ? "当前筛选条件下暂无上下游传导事件。" : "No spillover events matching filters."}
                        </div>
                      )}
                    </div>

                    {/* 3. High-Impact Macro */}
                    {stockMacro.length > 0 ? (
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 14, color: "#b45309", marginBottom: 8 }}>
                          🏦 {lang === "zh" ? `重点宏观与政策节点 (${stockMacro.length})` : `Key Macro & Policy Dates (${stockMacro.length})`}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {stockMacro.map((ev) => (
                            <EventCard
                              key={ev.id}
                              ev={ev}
                              lang={lang}
                              heldSet={heldSet}
                              onSwitchSymbol={(sym) => onChangeModalTarget(sym)}
                            />
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div style={muted}>
                    {lang === "zh" ? `未找到 ${activeStockSym} 的数据。` : `No data found for ${activeStockSym}.`}
                  </div>
                )
              ) : null}

              {/* CASE B: ALL STOCKS TIMELINE MODAL CONTENT */}
              {feed && !activeStockSym ? (
                filteredTimeline.length > 0 ? (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr>
                          <th style={th}>{lang === "zh" ? "日期" : "Date"}</th>
                          <th style={th}>{lang === "zh" ? "层级 / 类型" : "Layer"}</th>
                          <th style={th}>{lang === "zh" ? "标的" : "Symbol"}</th>
                          <th style={th}>{lang === "zh" ? "事件与预期" : "Catalyst"}</th>
                          <th style={th}>{lang === "zh" ? "来源" : "Source"}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTimeline.map((ev) => {
                          const km = KIND_META[ev.kind] || KIND_META.corporate;
                          const lm = LAYER_META[ev.layer] || LAYER_META.L1_calendar;
                          const cd = fmtDaysAway(ev.days_away, lang);
                          const title = (lang === "zh" ? ev.title_zh : ev.title_en) || ev.title_en || ev.title_zh;
                          const detail = (lang === "zh" ? ev.detail_zh : ev.detail_en) || ev.detail_en || ev.detail_zh;
                          return (
                            <tr key={ev.id}>
                              <td style={{ ...cell, whiteSpace: "nowrap" }}>
                                <b>{ev.date}</b>
                                <span style={sub}>
                                  <span style={pill(cd.urgent ? "#be123c" : "#64748b")}>{cd.text}</span>
                                </span>
                              </td>
                              <td style={{ ...cell, whiteSpace: "nowrap" }}>
                                <span style={pill(lm.color)}>{lm.short}</span>
                                <span style={{ ...sub, marginTop: 3 }}>
                                  <span style={pill(km.color)}>
                                    {km.icon} {lang === "zh" ? km.zh : km.en}
                                  </span>
                                </span>
                              </td>
                              <td style={cell}>
                                {ev.symbol === "MACRO" ? (
                                  <span style={pill("#b45309")}>MACRO</span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => onChangeModalTarget(ev.symbol)}
                                    style={{
                                      ...iconButton,
                                      marginLeft: 0,
                                      fontWeight: 700,
                                      color: heldSet.has(ev.symbol) ? "#0f766e" : "#0f172a",
                                    }}
                                  >
                                    {ev.symbol}
                                  </button>
                                )}
                                {ev.related_holdings && ev.related_holdings.length > 0 && ev.symbol !== "MACRO" ? (
                                  <span style={sub}>→ {ev.related_holdings.join(", ")}</span>
                                ) : null}
                              </td>
                              <td style={{ ...cell, minWidth: 260 }}>
                                <div style={{ fontWeight: 600 }}>
                                  {title}{" "}
                                  {ev.implied_move_pct != null ? (
                                    <span style={pill("#7c2d12")}>±{ev.implied_move_pct.toFixed(1)}%</span>
                                  ) : null}{" "}
                                  {ev.estimated_payout_usd != null ? (
                                    <span style={pill(UP)}>+{usd(ev.estimated_payout_usd)}</span>
                                  ) : null}
                                </div>
                                {detail && detail !== title ? <span style={sub}>{detail}</span> : null}
                              </td>
                              <td style={{ ...cell, whiteSpace: "nowrap" }}>
                                {ev.source_url ? (
                                  <a
                                    href={ev.source_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{ color: "#0284c7", fontSize: 12, textDecoration: "none" }}
                                  >
                                    {ev.source_title ? ev.source_title.slice(0, 20) : "Link"} ↗
                                  </a>
                                ) : (
                                  <span style={muted}>{ev.source_title || "—"}</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={muted}>
                    {lang === "zh" ? "没有符合当前筛选条件的事件。" : "No events match active filters."}
                  </div>
                )
              ) : null}
            </div>

            {/* MODAL FOOTER: 3-Layer Collection Status & Manual Refresh + Bottom Close Button */}
            <div
              style={{
                padding: "9px 18px",
                borderTop: "1px solid #e2e8f0",
                background: "#f8fafc",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
                fontSize: 12,
              }}
            >
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span style={muted}>
                  L1: <b>{feed?.summary.l1 ?? "—"}</b>
                </span>
                <span style={muted}>
                  L2: <b>{l2?.stored_count ?? 0}</b> ({fmtTimeAgo(l2?.last_finished_at, lang)})
                </span>
                <button
                  type="button"
                  disabled={Boolean(l2?.running)}
                  onClick={() => void handleCollect("l2")}
                  style={{ ...iconButton, marginLeft: 0, fontSize: 11.5, color: "#6d28d9" }}
                >
                  {l2?.running ? "⏳ L2…" : lang === "zh" ? "⚡ 更新L2" : "⚡ Sync L2"}
                </button>
                <span style={muted}>
                  L3: <b>{l3?.stored_count ?? 0}</b> ({fmtTimeAgo(l3?.last_finished_at, lang)})
                </span>
                <button
                  type="button"
                  disabled={Boolean(l3?.running)}
                  onClick={() => void handleCollect("l3")}
                  style={{ ...iconButton, marginLeft: 0, fontSize: 11.5, color: "#c2410c" }}
                >
                  {l3?.running ? "⏳ L3…" : lang === "zh" ? "🌐 更新L3" : "🌐 Sync L3"}
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void loadFeed(true)}
                  style={{ ...iconButton, marginLeft: 0, fontSize: 11.5 }}
                >
                  🔄 {lang === "zh" ? "刷新日历" : "Refresh"}
                </button>
              </div>

              <button
                type="button"
                onClick={() => onChangeModalTarget(null)}
                style={{ ...ghostButton, padding: "4px 12px", borderRadius: 8, fontSize: 12.5 }}
              >
                {lang === "zh" ? "关闭窗口 (Esc)" : "Close (Esc)"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default CatalystsPanel;
