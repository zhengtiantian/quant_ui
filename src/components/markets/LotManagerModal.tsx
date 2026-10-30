import React from "react";
import { deleteTransaction, fetchLotAdvice, saveTransaction } from "../../api/markets";
import type {
  BuyOrderLot,
  Holding,
  LotAdviceResponse,
  LotAllocationInput,
  LotExitPlan,
  LotOrderStatus,
  PortfolioState,
  SellOrderRecord,
} from "../../api/markets";
import {
  DOWN,
  SESSION_COLOR,
  SESSION_LABEL,
  UP,
  cell,
  color,
  ghostButton,
  iconButton,
  muted,
  panel,
  pct,
  pill,
  qty,
  right,
  shortName,
  signed,
  sub,
  th,
  usd,
} from "./format";

const newRequestId = () =>
  crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const todayLocal = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const exactQtyStr = (n: number) => String(Number(n.toFixed(8)));

const STATUS_META: Record<LotOrderStatus, { label: string; color: string; bg: string; border: string }> = {
  open: { label: "🟢 持仓中", color: "#15803d", bg: "#f0fdf4", border: "#bbf7d0" },
  partial: { label: "🟡 部分平仓", color: "#b45309", bg: "#fffbeb", border: "#fde68a" },
  closed: { label: "⚪ 已结清", color: "#64748b", bg: "#f8fafc", border: "#cbd5e1" },
};

const StatusBadge: React.FC<{ status: LotOrderStatus }> = ({ status }) => {
  const m = STATUS_META[status] || STATUS_META.open;
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 11.5,
        fontWeight: 700,
        color: m.color,
        background: m.bg,
        border: `1px solid ${m.border}`,
        borderRadius: 999,
        padding: "1px 8px",
        whiteSpace: "nowrap",
      }}
    >
      {m.label}
    </span>
  );
};

/** Button rendered on every row in the Holdings table to open that stock's order/lot manager modal. */
export const StockLotButton: React.FC<{
  holding: Holding;
  onOpen: (symbol: string) => void;
}> = ({ holding, onOpen }) => {
  const orders = holding.buy_orders || [];
  const active = orders.filter((b) => b.status !== "closed");
  const profitable = active.filter((b) => (b.open_pnl ?? 0) > 0.01);
  const profSum = profitable.reduce((acc, b) => acc + (b.open_pnl ?? 0), 0);
  const lowest = active.length
    ? active.reduce((minB, b) => (b.unit_cost < minB.unit_cost ? b : minB), active[0])
    : null;

  const hasProf = profitable.length > 0;
  const label =
    orders.length > active.length
      ? `📦 批次 (${active.length}/${orders.length})`
      : `📦 批次 (${active.length}笔)`;

  let hint = "";
  if (hasProf) {
    hint = `🟢 ${profitable.length}笔浮盈 ${signed(profSum)}`;
  } else if (lowest) {
    hint = `最低 ${usd(lowest.unit_cost)}${lowest.open_pnl_pct != null ? ` (${pct(lowest.open_pnl_pct)})` : ""}`;
  }

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpen(holding.symbol);
        }}
        title={`打开 ${holding.symbol} 的订单状态与波段选批平仓窗口`}
        style={{
          background: hasProf ? "#f0fdf4" : "#eef2ff",
          color: hasProf ? "#15803d" : "#4338ca",
          border: `1px solid ${hasProf ? "#86efac" : "#c7d2fe"}`,
          borderRadius: 8,
          padding: "3px 9px",
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </button>
      {hint ? (
        <span
          onClick={(e) => {
            e.stopPropagation();
            onOpen(holding.symbol);
          }}
          style={{
            fontSize: 11,
            color: hasProf ? "#15803d" : "#64748b",
            fontWeight: hasProf ? 600 : 400,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {hint}
        </span>
      ) : null}
    </div>
  );
};

export interface LotManagerModalProps {
  symbol: string;
  state: PortfolioState;
  onClose: () => void;
  onSaved: (state: PortfolioState, msg: string) => void;
  onOpenChart?: (symbol: string) => void;
}

const LotManagerModal: React.FC<LotManagerModalProps> = ({
  symbol,
  state,
  onClose,
  onSaved,
  onOpenChart,
}) => {
  const holding: Holding | undefined =
    state.holdings.find((h) => h.symbol === symbol) || state.closed.find((c) => c.symbol === symbol);
  const livePrice = holding?.quote?.price ?? null;

  const [tab, setTab] = React.useState<"list" | "buy" | "sell">("list");
  const [statusFilter, setStatusFilter] = React.useState<"all" | "active" | "profitable" | "closed">("all");
  const [sortBy, setSortBy] = React.useState<"date_desc" | "cost_asc">("date_desc");
  const [basisView, setBasisView] = React.useState<"swing" | "fifo">("swing");

  const [busy, setBusy] = React.useState(false);
  const [errMsg, setErrMsg] = React.useState<string | null>(null);
  const [okMsg, setOkMsg] = React.useState<string | null>(null);

  // Buy form state (new buy or edit buy)
  const [editBuyId, setEditBuyId] = React.useState<number | null>(null);
  const [buyDate, setBuyDate] = React.useState(todayLocal);
  const [buyPrice, setBuyPrice] = React.useState(() => (livePrice != null ? String(livePrice) : ""));
  const [buyMode, setBuyMode] = React.useState<"quantity" | "amount">("quantity");
  const [buyQty, setBuyQty] = React.useState("");
  const [buyAmount, setBuyAmount] = React.useState("");
  const [buyFee, setBuyFee] = React.useState("");
  const [buyNote, setBuyNote] = React.useState("");
  const buyReqId = React.useRef(newRequestId());

  // Sell form state (new sell or edit sell + lot allocations)
  const [editSellId, setEditSellId] = React.useState<number | null>(null);
  const [sellDate, setSellDate] = React.useState(todayLocal);
  const [sellPrice, setSellPrice] = React.useState(() => (livePrice != null ? String(livePrice) : ""));
  const [sellFee, setSellFee] = React.useState("");
  const [sellNote, setSellNote] = React.useState("");
  const [allocMap, setAllocMap] = React.useState<Record<number, string>>({});
  const [quickQty, setQuickQty] = React.useState("");
  const sellReqId = React.useRef(newRequestId());

  // Q.10 Inventory- & Lot-Aware Swing / Dip Guardrail state
  const [lotAdvice, setLotAdvice] = React.useState<LotAdviceResponse | null>(null);
  const [lotAdviceLoading, setLotAdviceLoading] = React.useState(false);

  const evalBuyParam = tab === "buy" && editBuyId == null ? buyPrice : undefined;

  React.useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(
      () => {
        setLotAdviceLoading(true);
        fetchLotAdvice(symbol, evalBuyParam)
          .then((res) => {
            if (!cancelled) setLotAdvice(res);
          })
          .catch(() => {
            // non-blocking advisory
          })
          .finally(() => {
            if (!cancelled) setLotAdviceLoading(false);
          });
      },
      tab === "buy" ? 200 : 0,
    );
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [symbol, evalBuyParam, tab, state.holdings]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const flashOk = (m: string) => {
    setOkMsg(m);
    window.setTimeout(() => setOkMsg((cur) => (cur === m ? null : cur)), 3500);
  };

  if (!holding) {
    return (
      <div
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15,23,42,0.45)",
          display: "grid",
          placeItems: "center",
          zIndex: 55,
        }}
      >
        <div style={{ ...panel, width: "min(480px, 94vw)", marginBottom: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <b>{symbol}</b>
            <button type="button" style={iconButton} onClick={onClose}>
              ✕
            </button>
          </div>
          <div style={{ ...muted, marginTop: 12 }}>未找到该股票的持仓或历史交易记录。</div>
        </div>
      </div>
    );
  }

  const buyOrders: BuyOrderLot[] = holding.buy_orders || [];
  const sellOrders: SellOrderRecord[] = [...(holding.sell_orders || [])].sort((a, b) =>
    a.trade_date === b.trade_date ? b.id - a.id : b.trade_date.localeCompare(a.trade_date),
  );

  const openCount = buyOrders.filter((b) => b.status === "open").length;
  const partialCount = buyOrders.filter((b) => b.status === "partial").length;
  const closedCount = buyOrders.filter((b) => b.status === "closed").length;
  const activeOrders = buyOrders.filter((b) => b.status !== "closed");
  const profitableOrders = activeOrders.filter((b) => (b.open_pnl ?? 0) > 0.01);
  const profitableSum = profitableOrders.reduce((acc, b) => acc + (b.open_pnl ?? 0), 0);

  // Editing sell lookup (so shares currently closed by editSellId become available to re-allocate)
  const editingSellObj = editSellId != null ? sellOrders.find((s) => s.id === editSellId) || null : null;
  const editingTakenByBuyId: Record<number, number> = {};
  if (editingSellObj) {
    for (const m of editingSellObj.matched_lots) {
      editingTakenByBuyId[m.buy_id] = (editingTakenByBuyId[m.buy_id] || 0) + m.quantity;
    }
  }

  const openNewBuyTab = () => {
    setErrMsg(null);
    setEditBuyId(null);
    setBuyDate(todayLocal());
    setBuyPrice(livePrice != null ? String(livePrice) : "");
    setBuyMode("quantity");
    setBuyQty("");
    setBuyAmount("");
    setBuyFee("");
    setBuyNote("");
    buyReqId.current = newRequestId();
    setTab("buy");
  };

  const openEditBuyTab = (b: BuyOrderLot) => {
    setErrMsg(null);
    setEditBuyId(b.id);
    setBuyDate(b.trade_date);
    setBuyPrice(String(b.price));
    setBuyMode("quantity");
    setBuyQty(exactQtyStr(b.quantity));
    setBuyAmount("");
    setBuyFee(b.fee ? String(b.fee) : "");
    setBuyNote(b.note || "");
    setTab("buy");
  };

  const exitPlanByBuyId: Record<number, LotExitPlan> = {};
  for (const pl of lotAdvice?.lot_exit_plans || []) {
    exitPlanByBuyId[pl.buy_id] = pl;
  }

  const openNewSellTab = (preselectBuy?: BuyOrderLot, targetSellPrice?: number | null) => {
    setErrMsg(null);
    setEditSellId(null);
    const today = todayLocal();
    setSellDate(today);
    if (targetSellPrice != null && targetSellPrice > 0) {
      setSellPrice(String(targetSellPrice));
    } else {
      setSellPrice(livePrice != null ? String(livePrice) : preselectBuy ? String(preselectBuy.price) : "");
    }
    setSellFee("");
    setSellNote("");
    setQuickQty("");
    sellReqId.current = newRequestId();
    if (preselectBuy && preselectBuy.open_qty > 1e-8) {
      setAllocMap({ [preselectBuy.id]: exactQtyStr(preselectBuy.open_qty) });
    } else {
      setAllocMap({});
    }
    setTab("sell");
  };

  const openEditSellTab = (s: SellOrderRecord) => {
    setErrMsg(null);
    setEditSellId(s.id);
    setSellDate(s.trade_date);
    setSellPrice(String(s.price));
    setSellFee(s.fee ? String(s.fee) : "");
    setSellNote(s.note || "");
    setQuickQty(exactQtyStr(s.quantity));
    const nextMap: Record<number, string> = {};
    for (const m of s.matched_lots) {
      nextMap[m.buy_id] = exactQtyStr(m.quantity);
    }
    setAllocMap(nextMap);
    setTab("sell");
  };

  const handleDeleteOrder = async (id: number, desc: string) => {
    if (!window.confirm(`确认删除这笔记录吗？\n${desc}`)) return;
    setBusy(true);
    setErrMsg(null);
    try {
      const r = await deleteTransaction(id);
      onSaved(r.state, `已删除记录 #${id}`);
      flashOk(`已删除记录 #${id}`);
    } catch (e) {
      setErrMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // ---------------- Buy form calculations & submit ----------------
  const bPriceNum = parseFloat(buyPrice);
  const bFeeNum = parseFloat(buyFee) || 0;
  const bSharesNum =
    buyMode === "amount"
      ? bPriceNum > 0
        ? (parseFloat(buyAmount) || 0) / bPriceNum
        : 0
      : parseFloat(buyQty) || 0;
  const bOutlay = bSharesNum > 0 && bPriceNum > 0 ? bSharesNum * bPriceNum + bFeeNum : 0;
  const newMineAvgAfterBuy =
    editBuyId == null && bSharesNum > 0 && bPriceNum > 0
      ? (holding.cost + bOutlay) / (holding.quantity + bSharesNum)
      : null;

  const submitBuy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErrMsg(null);
    try {
      const r = await saveTransaction({
        id: editBuyId ? String(editBuyId) : "",
        request_id: editBuyId ? "" : buyReqId.current,
        trade_date: buyDate,
        symbol,
        side: "buy",
        price: buyPrice,
        quantity: buyQty,
        amount: buyAmount,
        entry_mode: buyMode,
        fee: buyFee,
        note: buyNote,
      });
      buyReqId.current = newRequestId();
      const msg = editBuyId ? `已更新买入批次 #${editBuyId}` : `已新增 ${symbol} 买入批次`;
      onSaved(r.state, msg);
      flashOk(msg);
      setEditBuyId(null);
      setTab("list");
    } catch (err) {
      setErrMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // ---------------- Sell form calculations & auto-pickers ----------------
  const selectableLots = buyOrders
    .map((b) => {
      const restored = editingTakenByBuyId[b.id] || 0;
      const avail = Number((b.open_qty + restored).toFixed(8));
      const dateOk =
        editSellId != null
          ? b.trade_date < sellDate || (b.trade_date === sellDate && b.id < editSellId)
          : b.trade_date <= sellDate;
      return { lot: b, avail, dateOk };
    })
    .filter((x) => x.avail > 1e-8 && x.dateOk);

  const sPriceNum = parseFloat(sellPrice);
  const sFeeNum = parseFloat(sellFee) || 0;

  const selectedEntries: { lot: BuyOrderLot; avail: number; take: number }[] = [];
  for (const item of selectableLots) {
    const raw = allocMap[item.lot.id];
    const v = raw != null && raw !== "" ? parseFloat(raw) : 0;
    if (v > 1e-8) {
      selectedEntries.push({ ...item, take: v });
    }
  }

  const totalSelectedQty = Number(selectedEntries.reduce((s, x) => s + x.take, 0).toFixed(8));
  const selectedMatchedCost = selectedEntries.reduce((s, x) => s + x.take * x.lot.unit_cost, 0);
  const weightedSelectedCost = totalSelectedQty > 1e-8 ? selectedMatchedCost / totalSelectedQty : null;
  const estSwingProfit =
    totalSelectedQty > 1e-8 && sPriceNum > 0
      ? totalSelectedQty * sPriceNum - sFeeNum - selectedMatchedCost
      : null;
  const estSwingPct =
    estSwingProfit != null && selectedMatchedCost > 1e-8 ? (estSwingProfit / selectedMatchedCost) * 100 : null;
  const estAvgProfit =
    totalSelectedQty > 1e-8 && sPriceNum > 0 && holding.avg_cost
      ? totalSelectedQty * (sPriceNum - holding.avg_cost) - sFeeNum
      : null;

  // Net breakeven preview after this new sale
  let nextBreakeven: number | null = null;
  let remSharesAfterSell = holding.quantity;
  if (editSellId == null && totalSelectedQty > 1e-8 && sPriceNum > 0) {
    remSharesAfterSell = Math.max(0, holding.quantity - totalSelectedQty);
    const curNetCash = (holding.raw_breakeven_price ?? holding.avg_cost ?? 0) * holding.quantity;
    const afterNetCash = curNetCash - (totalSelectedQty * sPriceNum - sFeeNum);
    nextBreakeven = remSharesAfterSell > 1e-8 ? Math.max(0, afterNetCash / remSharesAfterSell) : null;
  }

  const toggleLotCheck = (buyId: number, avail: number, checked: boolean) => {
    setAllocMap((prev) => {
      const next = { ...prev };
      if (checked) {
        next[buyId] = exactQtyStr(avail);
      } else {
        delete next[buyId];
      }
      return next;
    });
  };

  const setLotShareInput = (buyId: number, val: string) => {
    setAllocMap((prev) => ({ ...prev, [buyId]: val }));
  };

  const applyStrategy = (mode: "profitable" | "lowest" | "lifo" | "fifo") => {
    if (!selectableLots.length) return;
    if (mode === "profitable") {
      if (!(sPriceNum > 0)) {
        setErrMsg("请先填写卖出价格，以便筛选在该卖价下盈利的批次");
        return;
      }
      const next: Record<number, string> = {};
      for (const x of selectableLots) {
        if (sPriceNum > x.lot.unit_cost + 1e-6) {
          next[x.lot.id] = exactQtyStr(x.avail);
        }
      }
      setAllocMap(next);
      return;
    }

    const ordered = [...selectableLots];
    if (mode === "lowest") {
      ordered.sort((a, b) => a.lot.unit_cost - b.lot.unit_cost || b.lot.id - a.lot.id);
    } else if (mode === "lifo") {
      ordered.sort((a, b) =>
        a.lot.trade_date === b.lot.trade_date ? b.lot.id - a.lot.id : b.lot.trade_date.localeCompare(a.lot.trade_date),
      );
    } else {
      ordered.sort((a, b) =>
        a.lot.trade_date === b.lot.trade_date ? a.lot.id - b.lot.id : a.lot.trade_date.localeCompare(b.lot.trade_date),
      );
    }

    const qCustom = parseFloat(quickQty);
    let target = qCustom > 0 ? qCustom : totalSelectedQty > 0 ? totalSelectedQty : ordered[0].avail;
    const next: Record<number, string> = {};
    for (const x of ordered) {
      if (target <= 1e-8) break;
      const take = Math.min(x.avail, target);
      next[x.lot.id] = exactQtyStr(take);
      target -= take;
    }
    setAllocMap(next);
  };

  const submitSell = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (selectedEntries.length === 0 || totalSelectedQty <= 1e-8) {
      setErrMsg("请在下方勾选至少一笔要平仓的买入订单，并确认平仓股数大于 0");
      return;
    }
    for (const x of selectedEntries) {
      if (x.take > x.avail + 1e-6) {
        setErrMsg(`批次 #${x.lot.id} 平仓股数 (${qty(x.take)}) 超过了该笔剩余可卖股数 (${qty(x.avail)})`);
        return;
      }
    }
    setBusy(true);
    setErrMsg(null);
    try {
      const allocations: LotAllocationInput[] = selectedEntries.map((x) => ({
        buy_id: x.lot.id,
        quantity: Number(x.take.toFixed(8)),
      }));
      const r = await saveTransaction({
        id: editSellId ? String(editSellId) : "",
        request_id: editSellId ? "" : sellReqId.current,
        trade_date: sellDate,
        symbol,
        side: "sell",
        entry_mode: "lots",
        quantity: exactQtyStr(totalSelectedQty),
        price: sellPrice,
        fee: sellFee,
        note: sellNote,
        lot_allocations: allocations,
      });
      sellReqId.current = newRequestId();
      const msg = editSellId
        ? `已更新卖出 #${editSellId} 的批次配对`
        : `已卖出 ${qty(totalSelectedQty)} 股 ${symbol} (平掉 ${allocations.length} 笔批次)`;
      onSaved(r.state, msg);
      flashOk(msg);
      setEditSellId(null);
      setAllocMap({});
      setTab("list");
    } catch (err) {
      setErrMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // ---------------- Filtered & sorted buy orders for List tab ----------------
  const displayedBuyOrders = buyOrders
    .filter((b) => {
      const st = basisView === "swing" ? b.status : b.fifo_status;
      const oq = basisView === "swing" ? b.open_qty : b.fifo_open_qty;
      if (statusFilter === "active") return st !== "closed";
      if (statusFilter === "closed") return st === "closed";
      if (statusFilter === "profitable") {
        return oq > 1e-8 && livePrice != null && livePrice > b.unit_cost + 1e-6;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "cost_asc") {
        return a.unit_cost - b.unit_cost || b.id - a.id;
      }
      return a.trade_date === b.trade_date ? b.id - a.id : b.trade_date.localeCompare(a.trade_date);
    });

  const q = holding.quote || {};
  const chg = q.price != null && q.prev_close ? q.price - q.prev_close : null;

  const tabBtn = (active: boolean, accent = "#0f766e"): React.CSSProperties => ({
    ...ghostButton,
    padding: "6px 13px",
    borderRadius: 9,
    fontWeight: 700,
    fontSize: 13,
    background: active ? accent : "#fff",
    color: active ? "#fff" : accent,
    border: `1px solid ${active ? accent : "#cbd5e1"}`,
    cursor: "pointer",
  });

  const chipBtn = (active = false): React.CSSProperties => ({
    background: active ? "#0f172a" : "#f8fafc",
    color: active ? "#fff" : "#334155",
    border: `1px solid ${active ? "#0f172a" : "#cbd5e1"}`,
    borderRadius: 999,
    padding: "3px 10px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  });

  const inputStyle: React.CSSProperties = {
    padding: "6px 9px",
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    fontSize: 13.5,
    background: "#fff",
    color: "#0f172a",
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.45)",
        display: "grid",
        placeItems: "center",
        zIndex: 55,
        padding: "12px",
      }}
    >
      <div
        style={{
          ...panel,
          width: "min(960px, 97vw)",
          maxHeight: "92vh",
          overflowY: "auto",
          marginBottom: 0,
          background: "#ffffff",
          padding: "16px 18px",
        }}
      >
        {/* Top Modal Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
            borderBottom: "1px solid #e2e8f0",
            paddingBottom: 10,
            marginBottom: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: "#0f172a" }}>📦 {symbol} 批次与波段订单簿</span>
            <span style={muted}>{shortName(q.name)}</span>
            {q.price != null ? <b style={{ fontSize: 17 }}>{usd(q.price)}</b> : null}
            {chg != null && q.prev_close ? (
              <span style={{ color: color(chg), fontSize: 13, fontWeight: 600 }}>
                {signed(chg)} ({pct((chg / q.prev_close) * 100)})
              </span>
            ) : null}
            {q.session ? <span style={pill(SESSION_COLOR[q.session] || "#64748b")}>{SESSION_LABEL[q.session]}</span> : null}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {onOpenChart ? (
              <button
                type="button"
                style={{ ...ghostButton, padding: "4px 10px", fontSize: 12.5, borderRadius: 8 }}
                onClick={() => {
                  onClose();
                  onOpenChart(symbol);
                }}
              >
                📈 K线图
              </button>
            ) : null}
            <button
              type="button"
              style={{ ...iconButton, fontSize: 14, padding: "4px 10px" }}
              onClick={onClose}
              title="关闭 (Esc)"
            >
              ✕ 关闭
            </button>
          </div>
        </div>

        {/* 4 Summary Mini KPIs */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(205px, 1fr))",
            gap: 10,
            marginBottom: 12,
          }}
        >
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "9px 12px" }}>
            <div style={{ fontSize: 11.5, color: "#64748b" }}>当前总持仓 / 批次状态</div>
            <div style={{ fontSize: 17, fontWeight: 800, margin: "2px 0", fontVariantNumeric: "tabular-nums" }}>
              {qty(holding.quantity)} 股
            </div>
            <div style={{ fontSize: 11.5, color: "#475569" }}>
              🟢 {openCount} 持仓 · 🟡 {partialCount} 部分平 · ⚪ {closedCount} 结清
            </div>
          </div>

          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "9px 12px" }}>
            <div
              style={{ fontSize: 11.5, color: "#64748b" }}
              title="未平批次均价 = 当前未结清批次的加权买入价；净回本价 = (累计买入总额 - 累计卖出回笼 - 分红) ÷ 当前剩余股数"
            >
              未平批次均价 / 真实净回本价
            </div>
            <div style={{ fontSize: 17, fontWeight: 800, margin: "2px 0", fontVariantNumeric: "tabular-nums" }}>
              {usd(holding.open_lots_avg)}
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "#64748b" }}>
                {" "}
                / 回本{" "}
                {holding.raw_breakeven_price != null && holding.raw_breakeven_price <= 0
                  ? "$0 (纯利润仓)"
                  : usd(holding.breakeven_price)}
              </span>
            </div>
            <div style={{ fontSize: 11.5, color: "#475569" }}>每做一笔盈利波段都会拉低真实净回本价</div>
          </div>

          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "9px 12px" }}>
            <div style={{ fontSize: 11.5, color: "#64748b" }}>波段已结清盈亏 (按选定批次)</div>
            <div
              style={{
                fontSize: 17,
                fontWeight: 800,
                margin: "2px 0",
                color: color(holding.swing_realized ?? 0),
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {signed(holding.swing_realized ?? 0)}
            </div>
            <div style={{ fontSize: 11.5, color: profitableOrders.length > 0 ? UP : "#64748b" }}>
              {profitableOrders.length > 0
                ? `🟢 当前有 ${profitableOrders.length} 笔浮盈 (${signed(profitableSum)})`
                : "当前暂无单笔浮盈批次"}
            </div>
          </div>

          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "9px 12px" }}>
            <div style={{ fontSize: 11.5, color: "#64748b" }}>主表总成本 (保持不变)</div>
            <div style={{ fontSize: 17, fontWeight: 800, margin: "2px 0", fontVariantNumeric: "tabular-nums" }}>
              Mine {usd(holding.avg_cost)}
            </div>
            <div style={{ fontSize: 11.5, color: "#475569" }}>
              税法 FIFO {usd(holding.fifo_avg_cost)} · 选批卖出不影响总成本
            </div>
          </div>
        </div>

        {/* Action Mode Tabs */}
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
            marginBottom: 12,
          }}
        >
          <button
            type="button"
            style={tabBtn(tab === "list", "#0f172a")}
            onClick={() => {
              setErrMsg(null);
              setTab("list");
            }}
          >
            📋 订单与状态明细 ({buyOrders.length})
          </button>
          <button type="button" style={tabBtn(tab === "buy", "#15803d")} onClick={openNewBuyTab}>
            {tab === "buy" && editBuyId ? `✎ 编辑买入 #${editBuyId}` : "➕ 记一笔买入 (Buy)"}
          </button>
          <button
            type="button"
            style={tabBtn(tab === "sell", "#b91c1c")}
            onClick={() => openNewSellTab()}
            disabled={activeOrders.length === 0 && editSellId == null}
          >
            {tab === "sell" && editSellId ? `🎯 改配卖出 #${editSellId}` : "💰 选批次卖出 (Sell)"}
          </button>

          {okMsg ? (
            <span
              style={{
                marginLeft: "auto",
                fontSize: 12.5,
                fontWeight: 700,
                color: "#15803d",
                background: "#f0fdf4",
                border: "1px solid #86efac",
                borderRadius: 8,
                padding: "4px 10px",
              }}
            >
              ✓ {okMsg}
            </span>
          ) : null}
        </div>

        {lotAdvice && lotAdvice.stats.atr14 != null ? (
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              padding: "7px 12px",
              marginBottom: 12,
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 8,
              fontSize: 12.2,
              color: "#334155",
            }}
          >
            <span style={{ fontWeight: 700, color: "#0f172a" }}>⚡ 波段风控引擎</span>
            <span style={pill("#0f766e")}>
              ATR(14) {usd(lotAdvice.stats.atr14)}{" "}
              {lotAdvice.stats.atr14_pct != null ? `(${lotAdvice.stats.atr14_pct.toFixed(1)}%)` : ""}
            </span>
            {lotAdvice.stats.rsi14 != null ? (
              <span
                style={pill(
                  lotAdvice.stats.rsi14 < 30 ? "#b45309" : lotAdvice.stats.rsi14 > 70 ? "#be123c" : "#475569",
                )}
              >
                RSI(14) {lotAdvice.stats.rsi14.toFixed(1)}
                {lotAdvice.stats.rsi14 < 30 ? " · 超卖" : lotAdvice.stats.rsi14 > 70 ? " · 超买" : ""}
              </span>
            ) : null}
            <span style={pill(lotAdvice.stats.stabilized ? "#15803d" : "#b91c1c")}>
              {lotAdvice.stats.stabilized ? "🟢 日线已企稳" : "🟠 急跌未企稳"}
              {lotAdvice.stats.drop_3d_pct != null ? ` (3日 ${pct(lotAdvice.stats.drop_3d_pct)})` : ""}
            </span>
            {lotAdvice.catalysts_7d.length > 0 ? (
              <span
                style={pill(lotAdvice.has_binary_7d ? "#7c3aed" : "#0369a1")}
                title={lotAdvice.catalysts_7d.map((c) => `${c.date.slice(5)} ${c.title}`).join(" | ")}
              >
                🔭 7日内 {lotAdvice.catalysts_7d.length} 个事件：
                {lotAdvice.catalysts_7d
                  .slice(0, 2)
                  .map((c) => `${c.date.slice(5)} ${c.title.slice(0, 14)}`)
                  .join(" · ")}
              </span>
            ) : null}
            {lotAdvice.is_semi_cluster ? (
              <span style={{ marginLeft: "auto", fontSize: 11.5, color: "#64748b" }}>
                芯片/存储总仓位 <b>{lotAdvice.semi_cluster_weight_pct.toFixed(1)}%</b> ({symbol}{" "}
                {lotAdvice.symbol_weight_pct.toFixed(1)}%)
              </span>
            ) : null}
          </div>
        ) : null}

        {errMsg ? (
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: DOWN,
              borderRadius: 10,
              padding: "8px 12px",
              fontSize: 13,
              marginBottom: 12,
            }}
          >
            ⚠️ {errMsg}
          </div>
        ) : null}

        {/* ================= TAB 2: BUY FORM ================= */}
        {tab === "buy" ? (
          <form
            onSubmit={submitBuy}
            style={{
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: 12,
              padding: "14px 16px",
              marginBottom: 12,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <b style={{ fontSize: 15, color: "#14532d" }}>
                {editBuyId ? `✎ 修改买入批次 #${editBuyId} (${symbol})` : `➕ 新增 ${symbol} 买入批次 (创建后状态为 🟢 持仓中)`}
              </b>
              <button type="button" style={chipBtn(false)} onClick={() => setTab("list")}>
                返回列表
              </button>
            </div>

            {/* Q.10 Dip-Entry Guardrail Card */}
            {editBuyId == null && lotAdvice ? (() => {
              const dg = lotAdvice.dip_guardrail;
              const palette =
                dg.verdict === "green"
                  ? { bg: "#ecfdf5", border: "#6ee7b7", fg: "#065f46" }
                  : dg.verdict === "amber"
                    ? { bg: "#fffbeb", border: "#fcd34d", fg: "#92400e" }
                    : { bg: "#fef2f2", border: "#fca5a5", fg: "#991b1b" };
              return (
                <div
                  style={{
                    background: palette.bg,
                    border: `1px solid ${palette.border}`,
                    borderRadius: 10,
                    padding: "10px 12px",
                    marginBottom: 12,
                    fontSize: 12.6,
                    color: "#1e293b",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 8,
                      marginBottom: dg.reasons_zh.length > 0 ? 6 : 0,
                    }}
                  >
                    <b style={{ color: palette.fg, fontSize: 13.5 }}>
                      {dg.headline_zh}
                      {lotAdviceLoading ? " (重算中…)" : ""}
                    </b>
                    {dg.suggested_buy_limit != null ? (
                      <button
                        type="button"
                        onClick={() => setBuyPrice(String(dg.suggested_buy_limit))}
                        style={{
                          background: "#0f172a",
                          color: "#fff",
                          border: "none",
                          borderRadius: 7,
                          padding: "4px 10px",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        🎯 填入建议挂单价 {usd(dg.suggested_buy_limit)}
                      </button>
                    ) : null}
                  </div>
                  {dg.reasons_zh.length > 0 ? (
                    <ul style={{ margin: "4px 0 6px 18px", padding: 0, lineHeight: 1.55 }}>
                      {dg.reasons_zh.map((r, idx) => (
                        <li key={idx}>{r}</li>
                      ))}
                    </ul>
                  ) : null}
                  <div style={{ fontSize: 11.5, color: "#64748b" }}>
                    📊 样本外基准（{lotAdvice.empirical_oos.universe_stocks}股 {lotAdvice.empirical_oos.oos_years} 共{" "}
                    {lotAdvice.empirical_oos.oos_2atr_drop_events} 次 ≥2×ATR 急跌）：隔日直接抄底均值{" "}
                    <b>+{lotAdvice.empirical_oos.immediate_tp15_mean_pct}%</b> vs 拉开 1.5×ATR 挂单波段均值{" "}
                    <b style={{ color: "#15803d" }}>+{lotAdvice.empirical_oos.spaced_15atr_mean_pct}%</b>
                  </div>
                </div>
              );
            })() : null}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(175px, 1fr))",
                gap: 10,
                marginBottom: 10,
              }}
            >
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5, color: "#334155" }}>
                交易日期
                <input
                  style={inputStyle}
                  type="date"
                  required
                  value={buyDate}
                  onChange={(e) => setBuyDate(e.target.value)}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5, color: "#334155" }}>
                <span>
                  买入单价 (USD/股){" "}
                  {livePrice != null ? (
                    <button
                      type="button"
                      onClick={() => setBuyPrice(String(livePrice))}
                      style={{
                        border: "none",
                        background: "transparent",
                        color: "#0f766e",
                        fontSize: 11.5,
                        cursor: "pointer",
                        padding: 0,
                        textDecoration: "underline",
                      }}
                    >
                      填入现价 {usd(livePrice)}
                    </button>
                  ) : null}
                </span>
                <input
                  style={inputStyle}
                  type="number"
                  step="any"
                  min="0"
                  required
                  placeholder="例如 65.75"
                  value={buyPrice}
                  onChange={(e) => setBuyPrice(e.target.value)}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5, color: "#334155" }}>
                录入方式
                <select
                  style={inputStyle}
                  value={buyMode}
                  onChange={(e) => setBuyMode(e.target.value === "amount" ? "amount" : "quantity")}
                >
                  <option value="quantity">按股数 (Shares)</option>
                  <option value="amount">按投入金额 (USD Amount)</option>
                </select>
              </label>

              {buyMode === "quantity" ? (
                <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5, color: "#334155" }}>
                  买入股数 (支持碎股)
                  <input
                    style={inputStyle}
                    type="number"
                    step="any"
                    min="0"
                    required
                    placeholder="例如 20"
                    value={buyQty}
                    onChange={(e) => setBuyQty(e.target.value)}
                  />
                </label>
              ) : (
                <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5, color: "#334155" }}>
                  投入金额 (USD, 不含手续费)
                  <input
                    style={inputStyle}
                    type="number"
                    step="any"
                    min="0"
                    required
                    placeholder="例如 1000"
                    value={buyAmount}
                    onChange={(e) => setBuyAmount(e.target.value)}
                  />
                </label>
              )}

              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5, color: "#334155" }}>
                手续费 (USD, 可选)
                <input
                  style={inputStyle}
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0"
                  value={buyFee}
                  onChange={(e) => setBuyFee(e.target.value)}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5, color: "#334155" }}>
                备注 (可选)
                <input
                  style={inputStyle}
                  placeholder="如：大选前分批加仓 / 波段仓"
                  value={buyNote}
                  onChange={(e) => setBuyNote(e.target.value)}
                />
              </label>
            </div>

            {bSharesNum > 0 && bPriceNum > 0 ? (
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #bbf7d0",
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontSize: 13,
                  marginBottom: 10,
                }}
              >
                本次买入约 <b>{qty(bSharesNum)} 股</b> · 合计支出 <b>{usd(bOutlay)}</b>
                {newMineAvgAfterBuy != null ? (
                  <>
                    {" "}
                    · 买后总账面均价 (Mine): {usd(holding.avg_cost)} → <b>{usd(newMineAvgAfterBuy)}</b>
                  </>
                ) : null}
              </div>
            ) : null}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" style={ghostButton} onClick={() => setTab("list")}>
                取消
              </button>
              <button
                type="submit"
                disabled={busy}
                style={{
                  background: "#15803d",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "7px 16px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {busy ? "保存中…" : editBuyId ? "保存买入修改" : "确认记录买入批次"}
              </button>
            </div>
          </form>
        ) : null}

        {/* ================= TAB 3: SELL WITH LOT SELECTION ================= */}
        {tab === "sell" ? (
          <form
            onSubmit={submitSell}
            style={{
              background: "#fffafb",
              border: "1px solid #fecdd3",
              borderRadius: 12,
              padding: "14px 16px",
              marginBottom: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 8,
                marginBottom: 10,
              }}
            >
              <div>
                <b style={{ fontSize: 15, color: "#881337" }}>
                  {editSellId
                    ? `🎯 修改卖出单 #${editSellId} 对应的买入批次 (${symbol})`
                    : `💰 选择要平仓的 ${symbol} 买入批次 (可勾选多笔、可填部分股数)`}
                </b>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                  你也可以先修改上方「卖出单价」(例如填 85) 来实时测算平掉某几笔波段仓能赚多少，确认后再提交。
                </div>
              </div>
              <button
                type="button"
                style={chipBtn(false)}
                onClick={() => {
                  setEditSellId(null);
                  setTab("list");
                }}
              >
                返回列表
              </button>
            </div>

            {/* Sell price / date / fee / note inputs */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(175px, 1fr))",
                gap: 10,
                marginBottom: 12,
              }}
            >
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5, color: "#334155" }}>
                卖出日期
                <input
                  style={inputStyle}
                  type="date"
                  required
                  value={sellDate}
                  onChange={(e) => setSellDate(e.target.value)}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5, color: "#334155" }}>
                <span style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                  <span>卖出单价 (USD/股)</span>
                  {livePrice != null ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setSellPrice(String(livePrice))}
                        style={{
                          border: "none",
                          background: "transparent",
                          color: "#0f766e",
                          fontSize: 11,
                          cursor: "pointer",
                          padding: 0,
                          textDecoration: "underline",
                        }}
                      >
                        现价 {usd(livePrice)}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSellPrice((livePrice * 1.1).toFixed(2))}
                        style={{
                          border: "none",
                          background: "transparent",
                          color: "#4338ca",
                          fontSize: 11,
                          cursor: "pointer",
                          padding: 0,
                          textDecoration: "underline",
                        }}
                      >
                        +10%测算
                      </button>
                    </>
                  ) : null}
                </span>
                <input
                  style={inputStyle}
                  type="number"
                  step="any"
                  min="0"
                  required
                  placeholder="例如 85.00"
                  value={sellPrice}
                  onChange={(e) => setSellPrice(e.target.value)}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5, color: "#334155" }}>
                手续费 (USD, 可选)
                <input
                  style={inputStyle}
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0"
                  value={sellFee}
                  onChange={(e) => setSellFee(e.target.value)}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5, color: "#334155" }}>
                备注 (可选)
                <input
                  style={inputStyle}
                  placeholder="如：波段止盈平仓"
                  value={sellNote}
                  onChange={(e) => setSellNote(e.target.value)}
                />
              </label>
            </div>

            {/* Quick selection helpers */}
            <div
              style={{
                display: "flex",
                gap: 6,
                alignItems: "center",
                flexWrap: "wrap",
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                padding: "8px 10px",
                marginBottom: 10,
              }}
            >
              <span style={{ fontSize: 12, color: "#475569", fontWeight: 600 }}>快捷选批：</span>
              <button type="button" style={chipBtn(false)} onClick={() => applyStrategy("profitable")}>
                ✨ 全选该卖价下盈利批次
              </button>
              <span style={{ color: "#cbd5e1" }}>|</span>
              <input
                type="number"
                step="any"
                min="0"
                placeholder="按股数自动分配 (可选)"
                value={quickQty}
                onChange={(e) => setQuickQty(e.target.value)}
                style={{ ...inputStyle, width: 150, padding: "4px 8px", fontSize: 12 }}
              />
              <button type="button" style={chipBtn(false)} onClick={() => applyStrategy("lowest")}>
                ⚡ 最低成本优先
              </button>
              <button type="button" style={chipBtn(false)} onClick={() => applyStrategy("lifo")}>
                ⚡ 最近买入 (LIFO)
              </button>
              <button type="button" style={chipBtn(false)} onClick={() => applyStrategy("fifo")}>
                ⚡ 最早买入 (FIFO)
              </button>
              <button
                type="button"
                style={{ ...chipBtn(false), marginLeft: "auto" }}
                onClick={() => setAllocMap({})}
              >
                🧹 清空重选
              </button>
            </div>

            {/* Selectable Open Buy Orders Table */}
            <div style={{ overflowX: "auto", background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={th}>选择</th>
                    <th style={th}>批次 / 买入日</th>
                    <th style={th}>当前状态</th>
                    <th style={{ ...th, ...right }}>买入成本价</th>
                    <th style={{ ...th, ...right }}>可平股数</th>
                    <th style={{ ...th, ...right }}>
                      按卖价 {sPriceNum > 0 ? usd(sPriceNum) : "—"} 测算盈亏
                    </th>
                    <th style={{ ...th, ...right }}>本次平仓股数</th>
                  </tr>
                </thead>
                <tbody>
                  {selectableLots.map(({ lot, avail }) => {
                    const rawVal = allocMap[lot.id] ?? "";
                    const takeVal = rawVal !== "" ? parseFloat(rawVal) : 0;
                    const checked = takeVal > 1e-8;
                    const diffPerShare = sPriceNum > 0 ? sPriceNum - lot.unit_cost : null;
                    const diffPct =
                      diffPerShare != null && lot.unit_cost > 0 ? (diffPerShare / lot.unit_cost) * 100 : null;
                    const rowPnl =
                      diffPerShare != null ? (checked ? takeVal : avail) * diffPerShare : null;
                    const remAfter = Math.max(0, avail - (checked ? takeVal : 0));

                    return (
                      <tr
                        key={lot.id}
                        style={{
                          background: checked ? "#fff1f2" : diffPerShare != null && diffPerShare > 0 ? "#f0fdf455" : undefined,
                        }}
                      >
                        <td style={cell}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => toggleLotCheck(lot.id, avail, e.target.checked)}
                            style={{ width: 16, height: 16, cursor: "pointer" }}
                          />
                        </td>
                        <td style={cell}>
                          <b>#{lot.id}</b> · {lot.trade_date}
                          {lot.note ? <span style={sub}>{lot.note}</span> : null}
                        </td>
                        <td style={cell}>
                          <StatusBadge status={lot.open_qty + (editingTakenByBuyId[lot.id] || 0) < lot.quantity - 1e-7 ? "partial" : "open"} />
                        </td>
                        <td style={{ ...cell, ...right }}>
                          <b>{usd(lot.unit_cost)}</b>
                          {exitPlanByBuyId[lot.id]?.tp1_price != null ? (
                            <span style={sub}>
                              TP1 {usd(exitPlanByBuyId[lot.id].tp1_price!)}{" "}
                              <button
                                type="button"
                                onClick={() => setSellPrice(String(exitPlanByBuyId[lot.id].tp1_price!))}
                                style={{
                                  border: "none",
                                  background: "none",
                                  color: "#0f766e",
                                  cursor: "pointer",
                                  padding: 0,
                                  fontSize: 11,
                                  textDecoration: "underline",
                                }}
                                title="将该笔 +1.5×ATR 波段目标价填入上方卖出单价"
                              >
                                填入
                              </button>
                            </span>
                          ) : null}
                        </td>
                        <td style={{ ...cell, ...right }}>
                          <b>{qty(avail)}</b>
                          <span style={sub}>原买 {qty(lot.quantity)}</span>
                        </td>
                        <td style={{ ...cell, ...right, color: color(rowPnl) }}>
                          {rowPnl != null ? (
                            <>
                              <b>
                                {checked ? signed(rowPnl) : `全平 ${signed(rowPnl)}`}
                              </b>
                              <span style={{ ...sub, color: color(diffPct) }}>
                                {pct(diffPct)} ({signed(diffPerShare)}/股)
                              </span>
                            </>
                          ) : (
                            <span style={muted}>填卖价后显示</span>
                          )}
                        </td>
                        <td style={{ ...cell, ...right, whiteSpace: "nowrap" }}>
                          <div style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                            <input
                              type="number"
                              step="any"
                              min="0"
                              max={avail}
                              placeholder="0"
                              value={rawVal}
                              onChange={(e) => setLotShareInput(lot.id, e.target.value)}
                              style={{ ...inputStyle, width: 96, textAlign: "right", padding: "4px 7px" }}
                            />
                            <button
                              type="button"
                              style={{ ...chipBtn(false), padding: "3px 7px", fontSize: 11 }}
                              onClick={() => setLotShareInput(lot.id, exactQtyStr(avail))}
                            >
                              全平
                            </button>
                            <button
                              type="button"
                              style={{ ...chipBtn(false), padding: "3px 7px", fontSize: 11 }}
                              onClick={() => setLotShareInput(lot.id, exactQtyStr(avail / 2))}
                            >
                              半仓
                            </button>
                          </div>
                          {checked ? (
                            <span style={sub}>
                              {remAfter <= 1e-7 ? "卖后 → ⚪ 已结清" : `卖后 → 🟡 剩 ${qty(remAfter)} 股`}
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                  {selectableLots.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ ...cell, textAlign: "center", color: "#64748b", padding: 20 }}>
                        该卖出日期 ({sellDate}) 之前没有可平仓的买入批次。
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            {/* Live Settlement Preview Banner */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #fda4af",
                borderRadius: 10,
                padding: "10px 14px",
                marginTop: 10,
                marginBottom: 10,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <div style={{ fontSize: 13, lineHeight: 1.65 }}>
                <div>
                  已勾选 <b>{selectedEntries.length}</b> 笔批次 · 合计卖出{" "}
                  <b>{qty(totalSelectedQty)} 股</b>
                  {weightedSelectedCost != null ? (
                    <> · 所选批次加权买入成本 <b>{usd(weightedSelectedCost)}</b></>
                  ) : null}
                  {sPriceNum > 0 && totalSelectedQty > 0 ? (
                    <> · 净回笼资金 <b>{usd(totalSelectedQty * sPriceNum - sFeeNum)}</b></>
                  ) : null}
                </div>
                {estSwingProfit != null ? (
                  <div>
                    🎯 <b>本单对应批次波段盈亏：</b>
                    <span
                      style={{
                        fontSize: 15.5,
                        fontWeight: 800,
                        color: estSwingProfit >= 0 ? UP : DOWN,
                      }}
                    >
                      {signed(estSwingProfit)} ({pct(estSwingPct)})
                    </span>
                    {estAvgProfit != null ? (
                      <span style={{ color: "#64748b", fontSize: 12, marginLeft: 10 }}>
                        [参考：主表总均价 {usd(holding.avg_cost)} 口径记账 {signed(estAvgProfit)}，主表总成本维持不变]
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <div style={muted}>勾选上方批次并填写卖出单价后，这里会实时显示波段盈亏与新回本价。</div>
                )}
                {nextBreakeven !== null || (editSellId == null && totalSelectedQty > 0 && remSharesAfterSell <= 1e-8) ? (
                  <div style={{ fontSize: 12, color: "#475569" }}>
                    卖后剩余 <b>{qty(remSharesAfterSell)} 股</b>
                    {remSharesAfterSell > 1e-8 && nextBreakeven != null ? (
                      <>
                        {" "}
                        · 真实净回本价变化：{usd(holding.breakeven_price)} → <b>{usd(nextBreakeven)}</b>
                      </>
                    ) : (
                      " · 全部清仓结清"
                    )}
                  </div>
                ) : null}
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  style={ghostButton}
                  onClick={() => {
                    setEditSellId(null);
                    setTab("list");
                  }}
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={busy || totalSelectedQty <= 1e-8 || !(sPriceNum > 0)}
                  style={{
                    background: totalSelectedQty > 1e-8 && sPriceNum > 0 ? "#b91c1c" : "#94a3b8",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "8px 16px",
                    fontWeight: 700,
                    cursor: totalSelectedQty > 1e-8 && sPriceNum > 0 ? "pointer" : "not-allowed",
                  }}
                >
                  {busy
                    ? "提交中…"
                    : editSellId
                      ? `保存批次配对 (${qty(totalSelectedQty)} 股)`
                      : `确认卖出 ${qty(totalSelectedQty)} 股`}
                </button>
              </div>
            </div>
          </form>
        ) : null}

        {/* ================= TAB 1: ORDERS & STATUS LIST ================= */}
        {tab === "list" ? (
          <div>
            {/* Filter & View Bar */}
            <div
              style={{
                display: "flex",
                gap: 6,
                alignItems: "center",
                flexWrap: "wrap",
                marginBottom: 10,
              }}
            >
              <button
                type="button"
                style={chipBtn(statusFilter === "all")}
                onClick={() => setStatusFilter("all")}
              >
                全部买入 ({buyOrders.length})
              </button>
              <button
                type="button"
                style={chipBtn(statusFilter === "active")}
                onClick={() => setStatusFilter("active")}
              >
                🟢 未结清 ({activeOrders.length})
              </button>
              <button
                type="button"
                style={chipBtn(statusFilter === "profitable")}
                onClick={() => setStatusFilter("profitable")}
              >
                ✨ 当前浮盈 ({profitableOrders.length})
              </button>
              <button
                type="button"
                style={chipBtn(statusFilter === "closed")}
                onClick={() => setStatusFilter("closed")}
              >
                ⚪ 已结清 ({closedCount})
              </button>

              <span style={{ width: 8 }} />
              <button
                type="button"
                style={chipBtn(sortBy === "date_desc")}
                onClick={() => setSortBy(sortBy === "date_desc" ? "cost_asc" : "date_desc")}
                title="点击切换排序方式"
              >
                {sortBy === "date_desc" ? "排序: 最新买入优先 ⇅" : "排序: 最低成本优先 ⇅"}
              </button>

              <div style={{ marginLeft: "auto", display: "inline-flex", gap: 4 }}>
                <button
                  type="button"
                  style={chipBtn(basisView === "swing")}
                  onClick={() => setBasisView("swing")}
                  title="按你手动指定的波段平仓配对显示每笔状态"
                >
                  🎯 波段配对状态
                </button>
                <button
                  type="button"
                  style={chipBtn(basisView === "fifo")}
                  onClick={() => setBasisView("fifo")}
                  title="查看严格按爱尔兰税法 FIFO (先进先出) 抵消时每笔订单的状态"
                >
                  🧾 税法 FIFO 状态
                </button>
              </div>
            </div>

            {/* Buy Orders Table */}
            <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 10 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.2 }}>
                <thead>
                  <tr>
                    <th style={th}>订单 / 买入日期</th>
                    <th style={th}>状态</th>
                    <th style={{ ...th, ...right }}>买入成本价</th>
                    <th style={{ ...th, ...right }}>剩余 / 买入股数</th>
                    <th style={{ ...th, ...right }}>单笔独立浮盈亏 (按现价)</th>
                    <th style={{ ...th, ...right }}>波段目标 (ATR)</th>
                    <th style={{ ...th, ...right }}>已结清波段盈亏</th>
                    <th style={{ ...th, ...right }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedBuyOrders.map((b) => {
                    const st = basisView === "swing" ? b.status : b.fifo_status;
                    const oq = basisView === "swing" ? b.open_qty : b.fifo_open_qty;
                    const cq = basisView === "swing" ? b.closed_qty : b.fifo_closed_qty;
                    const rpnl = basisView === "swing" ? b.realized_pnl : b.fifo_realized_pnl;
                    const openPnl =
                      oq > 1e-8 && livePrice != null ? oq * (livePrice - b.unit_cost) : null;
                    const openPct =
                      openPnl != null && b.unit_cost > 0 ? ((livePrice! - b.unit_cost) / b.unit_cost) * 100 : null;
                    const isProf = openPnl != null && openPnl > 0.01;

                    return (
                      <tr
                        key={b.id}
                        style={{
                          opacity: st === "closed" ? 0.68 : 1,
                          background: isProf ? "#f0fdf466" : undefined,
                        }}
                      >
                        <td style={cell}>
                          <b>#{b.id}</b> · {b.trade_date}
                          {b.note ? <span style={sub}>{b.note}</span> : null}
                        </td>
                        <td style={cell}>
                          <StatusBadge status={st} />
                          {st === "partial" ? (
                            <span style={sub}>已平 {qty(cq)} 股</span>
                          ) : null}
                        </td>
                        <td style={{ ...cell, ...right }}>
                          <b>{usd(b.unit_cost)}</b>
                          {b.fee > 0 ? <span style={sub}>含费 {usd(b.fee)}</span> : null}
                        </td>
                        <td style={{ ...cell, ...right }}>
                          <b>{qty(oq)}</b> <span style={{ color: "#64748b" }}>/ {qty(b.quantity)}</span>
                          {oq > 1e-8 ? <span style={sub}>成本 {usd(oq * b.unit_cost)}</span> : null}
                        </td>
                        <td style={{ ...cell, ...right, color: color(openPnl) }}>
                          {openPnl != null ? (
                            <>
                              <b>{signed(openPnl)}</b>
                              <span style={{ ...sub, color: color(openPct) }}>
                                {pct(openPct)} {isProf ? "· ✨ 可止盈" : ""}
                              </span>
                            </>
                          ) : (
                            <span style={muted}>—</span>
                          )}
                        </td>
                        <td style={{ ...cell, ...right }}>
                          {(() => {
                            const pl = oq > 1e-8 ? exitPlanByBuyId[b.id] : undefined;
                            if (!pl || pl.tp1_price == null) return <span style={muted}>—</span>;
                            const hit = pl.status_code === "hit_tp1" || pl.status_code === "hit_tp2";
                            return (
                              <div title={pl.advice_zh}>
                                <span
                                  style={{
                                    fontWeight: 700,
                                    color: hit ? "#15803d" : "#0f766e",
                                    fontVariantNumeric: "tabular-nums",
                                  }}
                                >
                                  TP1 {usd(pl.tp1_price)}
                                </span>
                                {pl.tp1_gain_usd != null ? (
                                  <span style={{ fontSize: 11.5, color: "#15803d", marginLeft: 4 }}>
                                    (+{usd(pl.tp1_gain_usd)})
                                  </span>
                                ) : null}
                                <span style={sub}>
                                  TP2 {pl.tp2_price != null ? usd(pl.tp2_price) : "—"}
                                  {pl.trail_stop_price != null ? ` · 🛡 保护 ${usd(pl.trail_stop_price)}` : ""}
                                </span>
                              </div>
                            );
                          })()}
                        </td>
                        <td style={{ ...cell, ...right, color: cq > 1e-8 ? color(rpnl) : undefined }}>
                          {cq > 1e-8 ? (
                            <>
                              <b>{signed(rpnl)}</b>
                              {basisView === "swing" && b.matches.length > 0 ? (
                                <span style={sub}>
                                  {b.matches
                                    .map((m) => `${m.trade_date.slice(5)} @${usd(m.sell_price)}×${qty(m.quantity)}`)
                                    .join(" · ")}
                                </span>
                              ) : null}
                            </>
                          ) : (
                            <span style={muted}>—</span>
                          )}
                        </td>
                        <td style={{ ...cell, ...right, whiteSpace: "nowrap" }}>
                          {b.open_qty > 1e-8 && exitPlanByBuyId[b.id]?.recommended_price != null ? (
                            <button
                              type="button"
                              onClick={() => openNewSellTab(b, exitPlanByBuyId[b.id].recommended_price)}
                              style={{
                                background: "#f0fdfa",
                                color: "#0f766e",
                                border: "1px solid #99f6e4",
                                borderRadius: 7,
                                padding: "2px 7px",
                                fontSize: 11.5,
                                fontWeight: 700,
                                cursor: "pointer",
                                marginRight: 4,
                              }}
                              title={`按本批波段目标价 ${usd(exitPlanByBuyId[b.id].recommended_price!)} 测算独立平仓盈亏`}
                            >
                              🎯 目标测算
                            </button>
                          ) : null}
                          {b.open_qty > 1e-8 ? (
                            <button
                              type="button"
                              onClick={() => openNewSellTab(b)}
                              style={{
                                background: isProf ? "#15803d" : "#fff1f2",
                                color: isProf ? "#fff" : "#be123c",
                                border: `1px solid ${isProf ? "#15803d" : "#fecdd3"}`,
                                borderRadius: 7,
                                padding: "2px 8px",
                                fontSize: 11.5,
                                fontWeight: 700,
                                cursor: "pointer",
                                marginRight: 4,
                              }}
                              title="直接进入卖出页并默认勾选此笔批次（按现价）"
                            >
                              平这笔
                            </button>
                          ) : null}
                          <button
                            type="button"
                            style={iconButton}
                            title="编辑这笔买入"
                            onClick={() => openEditBuyTab(b)}
                          >
                            ✎
                          </button>
                          <button
                            type="button"
                            style={iconButton}
                            title="删除这笔买入"
                            onClick={() =>
                              void handleDeleteOrder(
                                b.id,
                                `#${b.id} ${b.trade_date} 买入 ${qty(b.quantity)} 股 ${symbol} @ ${usd(b.price)}`,
                              )
                            }
                          >
                            🗑
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {displayedBuyOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ ...cell, textAlign: "center", color: "#64748b", padding: 20 }}>
                        当前筛选条件下没有匹配的买入订单。
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            {/* Sell History & Matched Lots Section */}
            {sellOrders.length > 0 ? (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 6, color: "#334155" }}>
                  📤 已卖出记录与平仓配对明细 ({sellOrders.length})
                </div>
                <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 10 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.8 }}>
                    <thead>
                      <tr>
                        <th style={th}>卖出单 / 日期</th>
                        <th style={{ ...th, ...right }}>卖出股数 / 成交价</th>
                        <th style={th}>平掉的买入批次</th>
                        <th style={{ ...th, ...right }}>波段盈亏</th>
                        <th style={{ ...th, ...right }}>总均价口径</th>
                        <th style={{ ...th, ...right }}>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sellOrders.map((s) => (
                        <tr key={s.id}>
                          <td style={cell}>
                            <b>#{s.id}</b> · {s.trade_date}
                            {s.note ? <span style={sub}>{s.note}</span> : null}
                          </td>
                          <td style={{ ...cell, ...right }}>
                            <b>{qty(s.quantity)}</b> @ {usd(s.price)}
                            <span style={sub}>回笼 {usd(s.quantity * s.price - s.fee)}</span>
                          </td>
                          <td style={cell}>
                            <span
                              style={{
                                ...pill(s.lot_allocations ? "#7c3aed" : "#64748b"),
                                marginRight: 6,
                              }}
                            >
                              {s.lot_allocations ? "🎯 手动选批" : "⚙️ 默认FIFO"}
                            </span>
                            <span style={{ fontSize: 12, color: "#334155" }}>
                              {s.matched_lots
                                .map((m) => `#${m.buy_id} (${usd(m.unit_cost)}×${qty(m.quantity)}股)`)
                                .join(" + ")}
                            </span>
                          </td>
                          <td style={{ ...cell, ...right, color: color(s.swing_profit) }}>
                            <b>{signed(s.swing_profit)}</b>
                            <span style={sub}>对应成本 {usd(s.swing_unit_cost)}</span>
                          </td>
                          <td style={{ ...cell, ...right, color: color(s.profit) }}>
                            {signed(s.profit)}
                            <span style={sub}>均价 {usd(s.avg_cost)}</span>
                          </td>
                          <td style={{ ...cell, ...right, whiteSpace: "nowrap" }}>
                            <button
                              type="button"
                              onClick={() => openEditSellTab(s)}
                              style={{
                                ...chipBtn(false),
                                padding: "2px 8px",
                                fontSize: 11.5,
                                marginRight: 4,
                              }}
                              title="重新指定这笔卖出平掉哪几笔买入订单"
                            >
                              🎯 改配批次
                            </button>
                            <button
                              type="button"
                              style={iconButton}
                              title="删除这笔卖出 (释放已平仓批次)"
                              onClick={() =>
                                void handleDeleteOrder(
                                  s.id,
                                  `#${s.id} ${s.trade_date} 卖出 ${qty(s.quantity)} 股 ${symbol} @ ${usd(s.price)}`,
                                )
                              }
                            >
                              🗑
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default LotManagerModal;
