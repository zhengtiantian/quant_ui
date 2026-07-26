import React from "react";
import {
  addTransaction,
  deleteTransaction,
  fetchHoldings,
  fetchTransactions,
  setCash as putCash,
  updateTransaction,
} from "../api/holdings";
import type {
  Holding,
  HoldingsResponse,
  TradeSide,
  Transaction,
  TransactionInput,
} from "../api/holdings";

/**
 * The user's own portfolio.
 *
 * Transactions are the source of truth; quantity, average cost and P&L are derived
 * server-side, so correcting a mis-keyed trade re-derives every number that depended
 * on it. Distinct from the Positions tab, which shows the rule-generated paper
 * positions the signal tracker opens automatically.
 */

const REFRESH_MS = 15000;

const money = (v: number) =>
  v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const signed = (v: number) => `${v >= 0 ? "+" : "−"}${money(Math.abs(v))}`;
const signedPct = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(2)}%`;
const pnlColor = (v: number) => (v > 0 ? "#1e8e3e" : v < 0 ? "#c0392b" : "#666");

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = (): TransactionInput => ({
  symbol: "",
  side: "BUY",
  quantity: 0,
  price: 0,
  tradeDate: today(),
  fee: 0,
  note: "",
});

const cell: React.CSSProperties = {
  padding: "8px 10px",
  borderBottom: "1px solid #eee",
  fontVariantNumeric: "tabular-nums",
};
const th: React.CSSProperties = {
  ...cell,
  textAlign: "right",
  fontSize: 12,
  color: "#888",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  borderBottom: "1px solid #ddd",
};
const num: React.CSSProperties = { ...cell, textAlign: "right" };

const Holdings: React.FC = () => {
  const [data, setData] = React.useState<HoldingsResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [autoRefresh, setAutoRefresh] = React.useState(true);

  const [cashDraft, setCashDraft] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<TransactionInput>(emptyForm());
  const [showForm, setShowForm] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [trades, setTrades] = React.useState<Transaction[]>([]);
  const [editing, setEditing] = React.useState<Transaction | null>(null);

  const load = React.useCallback(async () => {
    try {
      setData(await fetchHoldings());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  // Prices only move while the US session is open, so polling off-hours would just
  // re-read a cached close.
  React.useEffect(() => {
    if (!autoRefresh || !data?.marketOpen) return;
    const id = window.setInterval(() => void load(), REFRESH_MS);
    return () => window.clearInterval(id);
  }, [autoRefresh, data?.marketOpen, load]);

  const openTrades = async (symbol: string) => {
    if (expanded === symbol) {
      setExpanded(null);
      return;
    }
    setExpanded(symbol);
    setEditing(null);
    try {
      setTrades(await fetchTransactions(symbol));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const submitForm = async () => {
    setBusy(true);
    setFormError(null);
    try {
      await addTransaction({
        ...form,
        symbol: form.symbol.trim().toUpperCase(),
        quantity: Number(form.quantity),
        price: Number(form.price),
        fee: Number(form.fee ?? 0),
      });
      setForm(emptyForm());
      setShowForm(false);
      await load();
      if (expanded) setTrades(await fetchTransactions(expanded));
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      await updateTransaction(editing.id, {
        symbol: editing.symbol,
        side: editing.side,
        quantity: Number(editing.quantity),
        price: Number(editing.price),
        tradeDate: editing.tradeDate,
        fee: Number(editing.fee),
        note: editing.note,
      });
      setEditing(null);
      await load();
      if (expanded) setTrades(await fetchTransactions(expanded));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const removeTrade = async (t: Transaction) => {
    if (!window.confirm(`Delete ${t.side} ${t.quantity} ${t.symbol} @ ${t.price}?`)) return;
    setBusy(true);
    try {
      await deleteTransaction(t.id);
      await load();
      if (expanded) setTrades(await fetchTransactions(expanded));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const saveCash = async () => {
    if (cashDraft === null) return;
    const amount = Number(cashDraft);
    if (!Number.isFinite(amount) || amount < 0) {
      setError("Cash balance must be a number of 0 or more");
      return;
    }
    setBusy(true);
    try {
      await putCash(amount, data?.currency || "USD");
      setCashDraft(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const totals = data?.totals;
  const stale = data?.holdings.some((h) => h.quoteSource !== "finnhub");

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
      <h2 style={{ marginBottom: 4 }}>My Holdings</h2>
      <p style={{ color: "#888", marginTop: 0, fontSize: 14 }}>
        Your own positions, entered by hand. Quantity, average cost and P&amp;L are
        derived from the transaction log, so editing a trade re-derives everything that
        depended on it. The Positions tab shows the rule-generated paper positions
        instead.
      </p>

      {/* Summary */}
      {totals && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 12,
            margin: "16px 0",
          }}
        >
          {[
            { k: "Total value", v: money(totals.totalValue), c: "#222" },
            { k: "Holdings", v: money(totals.holdingsValue), c: "#222" },
            {
              k: "Unrealised P&L",
              v: `${signed(totals.unrealisedPnl)} (${signedPct(totals.unrealisedPnlPct)})`,
              c: pnlColor(totals.unrealisedPnl),
            },
            {
              k: "Realised P&L",
              v: signed(totals.realisedPnl),
              c: pnlColor(totals.realisedPnl),
            },
            { k: "Open positions", v: String(totals.openPositions), c: "#222" },
          ].map((s) => (
            <div
              key={s.k}
              style={{ border: "1px solid #ddd", borderRadius: 8, padding: "10px 12px" }}
            >
              <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase" }}>
                {s.k}
              </div>
              <div
                style={{
                  fontSize: 17,
                  marginTop: 3,
                  color: s.c,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {s.v}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cash + controls */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 12,
        }}
      >
        <span style={{ fontSize: 14 }}>
          <strong>Cash</strong>{" "}
          {cashDraft === null ? (
            <>
              {data?.currency || "USD"} {money(totals?.cash ?? 0)}{" "}
              <button
                onClick={() => setCashDraft(String(totals?.cash ?? 0))}
                style={{ fontSize: 12 }}
              >
                Edit
              </button>
            </>
          ) : (
            <>
              <input
                type="number"
                step="0.01"
                value={cashDraft}
                onChange={(e) => setCashDraft(e.target.value)}
                style={{ width: 130, padding: "4px 6px" }}
                autoFocus
              />{" "}
              <button onClick={saveCash} disabled={busy}>
                Save
              </button>{" "}
              <button onClick={() => setCashDraft(null)}>Cancel</button>
            </>
          )}
        </span>

        <span style={{ flex: 1 }} />

        <span style={{ fontSize: 12, color: "#888" }}>
          {data?.marketOpen ? "US market open" : "US market closed"}
          {stale ? " · showing last close" : ""}
        </span>
        <label style={{ fontSize: 12, color: "#888" }}>
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
          />{" "}
          Auto-refresh
        </label>
        <button onClick={() => void load()} disabled={loading}>
          Refresh
        </button>
        <button onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Close" : "+ Add trade"}
        </button>
      </div>

      {/* Add trade */}
      {showForm && (
        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: 12,
            marginBottom: 16,
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "flex-end",
          }}
        >
          <Field label="Symbol">
            <input
              value={form.symbol}
              onChange={(e) => setForm({ ...form, symbol: e.target.value.toUpperCase() })}
              placeholder="NVDA"
              style={{ width: 90, padding: "6px 8px" }}
            />
          </Field>
          <Field label="Side">
            <select
              value={form.side}
              onChange={(e) => setForm({ ...form, side: e.target.value as TradeSide })}
              style={{ padding: "6px 8px" }}
            >
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
            </select>
          </Field>
          <Field label="Quantity">
            <input
              type="number"
              step="any"
              value={form.quantity || ""}
              onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
              style={{ width: 100, padding: "6px 8px" }}
            />
          </Field>
          <Field label="Price">
            <input
              type="number"
              step="any"
              value={form.price || ""}
              onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
              style={{ width: 110, padding: "6px 8px" }}
            />
          </Field>
          <Field label="Trade date">
            <input
              type="date"
              value={form.tradeDate}
              onChange={(e) => setForm({ ...form, tradeDate: e.target.value })}
              style={{ padding: "6px 8px" }}
            />
          </Field>
          <Field label="Fee">
            <input
              type="number"
              step="any"
              value={form.fee || ""}
              onChange={(e) => setForm({ ...form, fee: Number(e.target.value) })}
              style={{ width: 80, padding: "6px 8px" }}
            />
          </Field>
          <Field label="Note">
            <input
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="optional"
              style={{ width: 180, padding: "6px 8px" }}
            />
          </Field>
          <button onClick={submitForm} disabled={busy || !form.symbol.trim()}>
            {busy ? "Saving…" : "Save trade"}
          </button>
          {formError && (
            <span style={{ color: "#c0392b", fontSize: 13 }}>{formError}</span>
          )}
        </div>
      )}

      {error && (
        <div style={{ color: "#c0392b", fontSize: 14, marginBottom: 12 }}>{error}</div>
      )}

      {/* Holdings table */}
      {loading && !data ? (
        <div style={{ color: "#888", fontSize: 14 }}>Loading…</div>
      ) : !data || data.holdings.length === 0 ? (
        <div style={{ color: "#888", fontSize: 14 }}>
          No open holdings yet. Add a trade to get started.
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: "left" }}>Symbol</th>
              <th style={th}>Qty</th>
              <th style={th}>Avg cost</th>
              <th style={th}>Price</th>
              <th style={th}>Day</th>
              <th style={th}>Market value</th>
              <th style={th}>Unrealised P&amp;L</th>
              <th style={th}>Weight</th>
              <th style={{ ...th, textAlign: "center" }}>Trades</th>
            </tr>
          </thead>
          <tbody>
            {data.holdings.map((h: Holding) => (
              <React.Fragment key={h.symbol}>
                <tr>
                  <td style={{ ...cell, fontWeight: 600 }}>
                    {h.symbol}
                    {h.warning && (
                      <span title={h.warning} style={{ color: "#e67e22" }}>
                        {" "}
                        ⚠
                      </span>
                    )}
                  </td>
                  <td style={num}>{h.quantity}</td>
                  <td style={num}>{money(h.avgCost)}</td>
                  <td style={num}>{money(h.price)}</td>
                  <td style={{ ...num, color: pnlColor(h.dayChangePct) }}>
                    {signedPct(h.dayChangePct)}
                  </td>
                  <td style={num}>{money(h.marketValue)}</td>
                  <td style={{ ...num, color: pnlColor(h.unrealisedPnl) }}>
                    {signed(h.unrealisedPnl)}{" "}
                    <span style={{ fontSize: 12 }}>
                      ({signedPct(h.unrealisedPnlPct)})
                    </span>
                  </td>
                  <td style={num}>{h.weightPct.toFixed(1)}%</td>
                  <td style={{ ...cell, textAlign: "center" }}>
                    <button onClick={() => void openTrades(h.symbol)} style={{ fontSize: 12 }}>
                      {expanded === h.symbol ? "Hide" : `${h.tradeCount}`}
                    </button>
                  </td>
                </tr>

                {expanded === h.symbol && (
                  <tr>
                    <td colSpan={9} style={{ background: "#fafafa", padding: "8px 12px" }}>
                      {trades.length === 0 ? (
                        <span style={{ color: "#888", fontSize: 13 }}>No trades.</span>
                      ) : (
                        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                          <tbody>
                            {trades.map((t) =>
                              editing?.id === t.id ? (
                                <tr key={t.id}>
                                  <td style={cell} colSpan={7}>
                                    <div
                                      style={{
                                        display: "flex",
                                        gap: 6,
                                        alignItems: "center",
                                        flexWrap: "wrap",
                                      }}
                                    >
                                      <select
                                        value={editing.side}
                                        onChange={(e) =>
                                          setEditing({
                                            ...editing,
                                            side: e.target.value as TradeSide,
                                          })
                                        }
                                      >
                                        <option value="BUY">BUY</option>
                                        <option value="SELL">SELL</option>
                                      </select>
                                      <input
                                        type="number"
                                        step="any"
                                        value={editing.quantity}
                                        onChange={(e) =>
                                          setEditing({
                                            ...editing,
                                            quantity: Number(e.target.value),
                                          })
                                        }
                                        style={{ width: 80 }}
                                      />
                                      @
                                      <input
                                        type="number"
                                        step="any"
                                        value={editing.price}
                                        onChange={(e) =>
                                          setEditing({
                                            ...editing,
                                            price: Number(e.target.value),
                                          })
                                        }
                                        style={{ width: 90 }}
                                      />
                                      <input
                                        type="date"
                                        value={editing.tradeDate}
                                        onChange={(e) =>
                                          setEditing({ ...editing, tradeDate: e.target.value })
                                        }
                                      />
                                      <input
                                        type="number"
                                        step="any"
                                        value={editing.fee}
                                        onChange={(e) =>
                                          setEditing({ ...editing, fee: Number(e.target.value) })
                                        }
                                        style={{ width: 70 }}
                                        title="Fee"
                                      />
                                      <input
                                        value={editing.note}
                                        onChange={(e) =>
                                          setEditing({ ...editing, note: e.target.value })
                                        }
                                        placeholder="note"
                                        style={{ width: 150 }}
                                      />
                                      <button onClick={saveEdit} disabled={busy}>
                                        Save
                                      </button>
                                      <button onClick={() => setEditing(null)}>Cancel</button>
                                    </div>
                                  </td>
                                </tr>
                              ) : (
                                <tr key={t.id}>
                                  <td style={cell}>{t.tradeDate}</td>
                                  <td
                                    style={{
                                      ...cell,
                                      color: t.side === "BUY" ? "#1e8e3e" : "#c0392b",
                                    }}
                                  >
                                    {t.side}
                                  </td>
                                  <td style={num}>{t.quantity}</td>
                                  <td style={num}>@ {money(t.price)}</td>
                                  <td style={num}>{t.fee ? `fee ${money(t.fee)}` : ""}</td>
                                  <td style={{ ...cell, color: "#888" }}>{t.note}</td>
                                  <td style={{ ...cell, textAlign: "right" }}>
                                    <button
                                      onClick={() => setEditing(t)}
                                      style={{ fontSize: 12 }}
                                    >
                                      Edit
                                    </button>{" "}
                                    <button
                                      onClick={() => void removeTrade(t)}
                                      style={{ fontSize: 12 }}
                                      disabled={busy}
                                    >
                                      Delete
                                    </button>
                                  </td>
                                </tr>
                              ),
                            )}
                          </tbody>
                        </table>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      )}

      {data && (
        <div style={{ fontSize: 12, color: "#888", marginTop: 12 }}>
          Cost basis {money(data.totals.costBasis)} · fees paid{" "}
          {money(data.totals.feesPaid)} · quotes{" "}
          {stale ? "from last daily close" : "live from Finnhub, cached 20s"} · updated{" "}
          {new Date(data.asOf).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 12 }}>
    <span style={{ color: "#888" }}>{label}</span>
    {children}
  </label>
);

export default Holdings;
