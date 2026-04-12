import React, { useEffect, useMemo, useState } from "react";
import {
  fetchMarketSymbols,
  fetchNasdaqHours,
  fetchStockChart,
  type NasdaqHoursResponse,
  type PricePoint,
  type StockChartResponse,
} from "../api/market";

const RANGES = ["1W", "1M", "3M", "6M", "1Y", "2Y", "5Y", "10Y"] as const;

function formatPct(value: number | null | undefined) {
  if (value == null) return "--";
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(2)}%`;
}

function formatPrice(value: number | null | undefined) {
  if (value == null) return "--";
  return value.toFixed(2);
}

function buildPath(points: PricePoint[], width: number, height: number) {
  const closes = points.map((point) => point.close).filter((value): value is number => value != null);
  if (closes.length === 0) {
    return { path: "", min: 0, max: 0 };
  }
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const spread = Math.max(max - min, 1e-6);

  const path = points
    .map((point, index) => {
      const close = point.close ?? min;
      const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width;
      const y = height - ((close - min) / spread) * height;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  return { path, min, max };
}

function shiftPath(path: string, dx: number, dy: number) {
  return path.replace(/(^| )([0-9.]+) ([0-9.]+)/g, (_, prefix: string, x: string, y: string) => {
    const shiftedX = Number(x) + dx;
    const shiftedY = Number(y) + dy;
    return `${prefix}${shiftedX} ${shiftedY}`;
  });
}

const MarketCharts: React.FC = () => {
  const [symbols, setSymbols] = useState<string[]>([]);
  const [symbol, setSymbol] = useState("AAPL");
  const [range, setRange] = useState<(typeof RANGES)[number]>("1Y");
  const [chart, setChart] = useState<StockChartResponse | null>(null);
  const [hours, setHours] = useState<NasdaqHoursResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchMarketSymbols()
      .then((data) => {
        setSymbols(data);
        if (data.length > 0) {
          setSymbol((prev) => (data.includes(prev) ? prev : data[0]));
        }
      })
      .catch((err) => setError((err as Error).message));

    fetchNasdaqHours()
      .then(setHours)
      .catch((err) => setError((err as Error).message));
  }, []);

  useEffect(() => {
    if (!symbol) return;
    setLoading(true);
    setError("");
    fetchStockChart(symbol, range)
      .then(setChart)
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [symbol, range]);

  const chartShape = useMemo(() => {
    return buildPath(chart?.points ?? [], 860, 280);
  }, [chart]);

  return (
    <section style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0 }}>Market Charts</h2>
          <p style={{ margin: "8px 0 0", color: "#666" }}>
            查看核心股票日线走势，快速切换 1W / 1M / 3M / 6M / 1Y / 2Y / 5Y / 10Y。
          </p>
        </div>
        <div
          style={{
            minWidth: 340,
            padding: 12,
            border: "1px solid #ddd",
            borderRadius: 10,
            background: "#fafafa",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 6 }}>纳斯达克北京时间</div>
          <div style={{ fontSize: 14, color: "#444", marginBottom: 4 }}>{hours?.current_note ?? "加载中..."}</div>
          <div style={{ fontSize: 13, color: "#666" }}>夏令时：{hours?.daylight_saving ?? "--"}</div>
          <div style={{ fontSize: 13, color: "#666" }}>冬令时：{hours?.standard_time ?? "--"}</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 13, color: "#666" }}>股票</span>
          <select value={symbol} onChange={(e) => setSymbol(e.target.value)} style={{ minWidth: 140, padding: "8px 10px" }}>
            {symbols.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {RANGES.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setRange(item)}
              style={{
                padding: "8px 12px",
                borderRadius: 999,
                border: item === range ? "1px solid #1d4ed8" : "1px solid #d1d5db",
                background: item === range ? "#eff6ff" : "#fff",
                color: item === range ? "#1d4ed8" : "#374151",
                fontWeight: item === range ? 600 : 500,
                cursor: "pointer",
              }}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 16,
          background: "#fff",
        }}
      >
        {error && <div style={{ color: "#b91c1c", marginBottom: 12 }}>{error}</div>}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{chart?.symbol ?? symbol}</div>
            <div style={{ color: "#666", marginTop: 4 }}>
              最新收盘价 {formatPrice(chart?.latestClose)} · 区间涨跌{" "}
              <span style={{ color: (chart?.changePct ?? 0) >= 0 ? "#15803d" : "#b91c1c", fontWeight: 700 }}>
                {formatPct(chart?.changePct)}
              </span>
            </div>
          </div>
          <div style={{ color: "#666", fontSize: 13 }}>
            {chart?.marketHoursBeijing ?? "夏令时: 21:30-04:00 | 冬令时: 22:30-05:00"}
          </div>
        </div>

        {loading ? (
          <div style={{ padding: "40px 0", color: "#666" }}>正在加载图表...</div>
        ) : (
          <div>
            <svg viewBox="0 0 920 320" width="100%" style={{ display: "block", background: "#fcfcfd", borderRadius: 8 }}>
              <rect x="0" y="0" width="920" height="320" fill="#fcfcfd" />
              <line x1="40" y1="20" x2="40" y2="290" stroke="#e5e7eb" />
              <line x1="40" y1="290" x2="900" y2="290" stroke="#e5e7eb" />
              {[0, 1, 2, 3].map((i) => {
                const y = 30 + i * 80;
                return <line key={i} x1="40" y1={y} x2="900" y2={y} stroke="#f1f5f9" />;
              })}
              {chartShape.path && (
                <path
                  d={shiftPath(chartShape.path, 40, 20)}
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )}
              <text x="48" y="26" fill="#64748b" fontSize="12">
                High {formatPrice(chartShape.max)}
              </text>
              <text x="48" y="286" fill="#64748b" fontSize="12">
                Low {formatPrice(chartShape.min)}
              </text>
            </svg>

            <div style={{ marginTop: 12, fontSize: 13, color: "#666" }}>
              数据点：{chart?.points.length ?? 0} 个日线收盘点
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default MarketCharts;
