import { useEffect, useMemo, useState } from "react";
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Doughnut, Bar, Line } from "react-chartjs-2";
import "./App.css";

const API_BASE = "/api";
const GREEN = "#0f9d58";
const RED = "#e02020";
const BLUE = "#1e6de0";
const BLUE_DARK = "#12315e";
const PALETTE = [BLUE, GREEN, "#4aa8ff", "#f5a623", RED, "#22b8cf", "#a855f7", "#facc15"];

const CURRENCY_SYMBOL = {
  USD: "$",
  THB: "฿",
  HKD: "HK$",
  CNH: "¥",
};

const STATUS_COLOR = {
  FILLED: GREEN,
  PARTIAL_FILLED: "#f5a623",
  SUBMITTED: BLUE,
  PENDING: BLUE,
  CANCELLED: "#9aa0ac",
  FAILED: RED,
};

const STATUS_LABEL = {
  FILLED: "สำเร็จ",
  PARTIAL_FILLED: "สำเร็จบางส่วน",
  SUBMITTED: "ส่งคำสั่งแล้ว",
  PENDING: "รออนุมัติ",
  CANCELLED: "ยกเลิก",
  FAILED: "ล้มเหลว",
};

// จำนวน trading day ต่อ period ใช้ filter จากชุดข้อมูล 1200 bars เดียวกัน
const PRICE_PERIODS = [
  { key: "1W", label: "1W", barCount: 5 },
  { key: "1M", label: "1M", barCount: 22 },
  { key: "3M", label: "3M", barCount: 66 },
  { key: "6M", label: "6M", barCount: 132 },
  { key: "1Y", label: "1Y", barCount: 252 },
  { key: "5Y", label: "5Y", barCount: 1200 },
];

const imageCache = {};

function loadImage(url, onLoadCallback) {
  if (imageCache[url]) return imageCache[url];
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    if (onLoadCallback) onLoadCallback();
  };
  img.src = url;
  imageCache[url] = img;
  return img;
}

const doughnutLogoPlugin = {
  id: "doughnutLogoPlugin",
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    const meta = chart.getDatasetMeta(0);
    if (!meta || !meta.data) return;

    meta.data.forEach((arc, index) => {
      const url = chart.data.logoUrls?.[index];
      if (!url) return;

      const img = loadImage(url, () => chart.draw());
      if (!img.complete || img.naturalWidth === 0) return;

      const { x, y } = arc.getCenterPoint();
      const size = 28;

      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, size / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x - size / 2, y - size / 2, size, size);
      ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
      ctx.restore();

      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, size / 2, 0, Math.PI * 2);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    });
  },
};

ChartJS.register(
  ArcElement,
  BarElement,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
  doughnutLogoPlugin
);

function logoUrl(ticker) {
  return `https://images.financialmodelingprep.com/symbol/${ticker}.png`;
}

function fmtMoney(num) {
  const value = Number(num || 0);
  const sign = value < 0 ? "-" : "";
  return sign + "$" + Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtCurrency(num, currency) {
  const value = Number(num || 0);
  const symbol = CURRENCY_SYMBOL[currency] || currency + " ";
  const sign = value < 0 ? "-" : "";
  return sign + symbol + Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtSignedMoney(num) {
  const value = Number(num || 0);
  const sign = value >= 0 ? "+" : "-";
  return sign + "$" + Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtPercent(num) {
  const value = Number(num || 0);
  const arrow = value >= 0 ? "▲" : "▼";
  return `${arrow} ${Math.abs(value).toFixed(2)}%`;
}

function fmtDateTime(isoStr) {
  if (!isoStr) return "-";
  const d = new Date(isoStr);
  return d.toLocaleString("th-TH", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function mapHolding(h, index) {
  const qty = toNumber(h.quantity ?? h.qty);
  const cost = toNumber(h.cost_price ?? h.unit_cost ?? h.cost);
  const marketPrice = toNumber(h.last_price ?? h.market_price);
  const invested = qty * cost;
  const marketValue = qty * marketPrice;
  const pnl = toNumber(h.unrealized_profit_loss, marketValue - invested);
  const pnlPercent = cost > 0 ? (marketPrice / cost - 1) * 100 : 0;

  return {
    ticker: h.symbol ?? h.ticker ?? "-",
    company: h.short_name ?? h.instrument_name ?? h.company ?? h.symbol ?? "-",
    currency: h.currency ?? "USD",
    qty,
    cost,
    marketPrice,
    invested,
    marketValue,
    pnl,
    pnlPercent,
    color: pnl >= 0 ? GREEN : RED,
    paletteColor: PALETTE[index % PALETTE.length],
  };
}

// ---------------------------------------------------------------------------
// SymbolDetailPanel — router 2 ชั้น + cache ผลลัพธ์ตาม symbol+tab
// ---------------------------------------------------------------------------

const DETAIL_TABS = [
  { key: "profile", label: "ข้อมูลบริษัท" },
  { key: "target-price", label: "ราคาเป้าหมาย" },
  { key: "rating", label: "คำแนะนำนักวิเคราะห์" },
];

const ENDPOINT_BY_TAB = {
  profile: "company-profile",
  "target-price": "analyst-target-price",
  rating: "analyst-rating",
};

const detailCache = new Map();
const CACHE_TTL_MS = 30 * 1000;

function useSymbolDetail(symbol, tab) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const cacheKey = useMemo(() => `${symbol}|${tab}`, [symbol, tab]);

  useEffect(() => {
    if (!symbol) return;

    const cached = detailCache.get(cacheKey);
    const isFresh = cached && Date.now() - cached.timestamp < CACHE_TTL_MS;

    if (isFresh) {
      setData(cached.data);
      setError("");
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const endpoint = ENDPOINT_BY_TAB[tab];
        const res = await fetch(`${API_BASE}/${endpoint}?symbol=${symbol}&category=US_STOCK`);
        if (!res.ok) throw new Error(`${endpoint} API ${res.status}`);
        const json = await res.json();
        if (!cancelled) {
          detailCache.set(cacheKey, { data: json, timestamp: Date.now() });
          setData(json);
        }
      } catch (err) {
        if (!cancelled) {
          console.error(err);
          setError(err.message || "โหลดข้อมูลไม่สำเร็จ");
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [cacheKey, symbol, tab]);

  return { data, loading, error };
}

// ---------------------------------------------------------------------------
// Price History (Bars) — ยิง API ครั้งเดียวต่อ symbol ด้วย timespan=D, count=1200
// แล้วใช้ useMemo filter ตามช่วงเวลาที่ user เลือกจากข้อมูลชุดเดียวกัน ไม่ยิงซ้ำ
// Response schema: [{ tickerId, symbol, time, open, close, high, low, volume, trading_session }]
// ---------------------------------------------------------------------------

const barsCache = new Map();
const BARS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 นาที เพราะดึงมาทีเดียว 1200 bars

function useAllBars(symbol) {
  const [rawBars, setRawBars] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!symbol) return;

    const cached = barsCache.get(symbol);
    const isFresh = cached && Date.now() - cached.timestamp < BARS_CACHE_TTL_MS;

    if (isFresh) {
      setRawBars(cached.data);
      setError("");
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const url = `${API_BASE}/bars?symbol=${symbol}&category=US_STOCK&timespan=D&count=1200&real_time_required=true`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`bars API ${res.status}`);
        const json = await res.json();
        const list = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : [];
        if (!cancelled) {
          barsCache.set(symbol, { data: list, timestamp: Date.now() });
          setRawBars(list);
        }
      } catch (err) {
        if (!cancelled) {
          console.error(err);
          setError(err.message || "โหลดราคาย้อนหลังไม่สำเร็จ");
          setRawBars([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [symbol]);

  // แปลงและ sort ครั้งเดียวจากเก่า -> ใหม่ พร้อมตัดทศนิยม 2 ตำแหน่งตั้งแต่ต้น
  const sortedBars = useMemo(
    () =>
      [...rawBars]
        .map((c) => ({
          time: c.time,
          close: Number(toNumber(c.close).toFixed(2)),
        }))
        .sort((a, b) => new Date(a.time) - new Date(b.time)),
    [rawBars]
  );

  return { sortedBars, loading, error };
}

function PriceChartView({ symbol }) {
  const [period, setPeriod] = useState("1M");
  const { sortedBars, loading, error } = useAllBars(symbol);

  // filter จากชุดข้อมูล 1200 bars ที่มีอยู่แล้วในเครื่อง ไม่ยิง API ซ้ำเวลาสลับ period
  const points = useMemo(() => {
    const config = PRICE_PERIODS.find((p) => p.key === period) || PRICE_PERIODS[0];
    if (sortedBars.length === 0) return [];
    return sortedBars.slice(-config.barCount);
  }, [sortedBars, period]);

  const firstPrice = points[0]?.close ?? 0;
  const lastPrice = points[points.length - 1]?.close ?? 0;
  const change = Number((lastPrice - firstPrice).toFixed(2));
  const changePercent = firstPrice > 0 ? Number(((change / firstPrice) * 100).toFixed(2)) : 0;
  const lineColor = change >= 0 ? GREEN : RED;

  const chartData = {
    labels: points.map((p) => {
      const d = new Date(p.time);
      if (period === "5Y" || period === "1Y") {
        return d.toLocaleDateString("th-TH", { month: "short", year: "2-digit" });
      }
      return d.toLocaleDateString("th-TH", { day: "2-digit", month: "short" });
    }),
    datasets: [
      {
        label: symbol,
        data: points.map((p) => p.close),
        borderColor: lineColor,
        backgroundColor: (ctx) => {
          const chart = ctx.chart;
          const { ctx: canvasCtx, chartArea } = chart;
          if (!chartArea) return "transparent";
          const gradient = canvasCtx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, change >= 0 ? "rgba(15,157,88,0.2)" : "rgba(224,32,32,0.2)");
          gradient.addColorStop(1, "rgba(255,255,255,0)");
          return gradient;
        },
        fill: true,
        tension: 0.25,
        pointRadius: 0,
        pointHoverRadius: 4,
        borderWidth: 2,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: "#6b7280", maxTicksLimit: 7, font: { size: 11 } },
      },
      y: {
        grid: { color: "rgba(18,49,94,0.08)" },
        ticks: { color: "#6b7280", callback: (v) => "$" + Number(v).toFixed(2) },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => ` $${ctx.parsed.y.toFixed(2)}`,
        },
      },
    },
  };

  return (
    <section className="card">
      <div className="card-header-row">
        <div>
          <h4 className="chart-title" style={{ marginBottom: 6 }}>กราฟราคาหุ้น {symbol}</h4>
          {points.length > 0 && (
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 26, fontWeight: 700, color: BLUE_DARK }}>
                ${lastPrice.toFixed(2)}
              </span>
              <span style={{ fontSize: 14, fontWeight: 600, color: lineColor }}>
                {change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(2)} ({Math.abs(changePercent).toFixed(2)}%)
              </span>
            </div>
          )}
        </div>

        <div className="period-tabs">
          {PRICE_PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              style={{
                padding: "5px 12px",
                borderRadius: 8,
                border: "none",
                background: period === p.key ? BLUE : "#eef1f6",
                color: period === p.key ? "#fff" : "#4b5563",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 12,
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="chart-wrap" style={{ height: 300, position: "relative", marginTop: 16 }}>
        {loading && points.length === 0 ? (
          <div className="sub">กำลังโหลดข้อมูลราคา...</div>
        ) : error ? (
          <div className="sub" style={{ color: RED }}>โหลดข้อมูลไม่สำเร็จ: {error}</div>
        ) : points.length === 0 ? (
          <div className="sub">ไม่มีข้อมูลราคาย้อนหลัง</div>
        ) : (
          <Line data={chartData} options={chartOptions} />
        )}
      </div>
    </section>
  );
}

function InfoCard({ icon, label, value }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "14px 16px",
        borderRadius: 10,
        background: "#f4f6f9",
        border: "1px solid #e3e8ef",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: "rgba(30,109,224,0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="sub" style={{ marginBottom: 2 }}>{label}</div>
        <div style={{ fontWeight: 600, color: "#1a1d29", fontSize: 14, wordBreak: "break-word" }}>
          {value ?? "-"}
        </div>
      </div>
    </div>
  );
}

// ---------- Profile: ตาม schema จริง ----------
function ProfileView({ data, symbol }) {
  if (!data) return null;

  const industries = Array.isArray(data.industries) ? data.industries : [];

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "18px 20px",
          borderRadius: 12,
          background: "linear-gradient(135deg, rgba(30,109,224,0.08), rgba(30,109,224,0.02))",
          border: "1px solid #e3e8ef",
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        <img
          src={logoUrl(data.symbol || symbol)}
          alt={`${data.company_name} logo`}
          style={{ width: 56, height: 56, borderRadius: 12, background: "#fff", border: "1px solid #e3e8ef", flexShrink: 0 }}
          onError={(e) => { e.currentTarget.style.display = "none"; }}
        />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: BLUE_DARK, lineHeight: 1.3 }}>
            {data.company_name}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: BLUE,
                background: "rgba(30,109,224,0.12)",
                padding: "2px 8px",
                borderRadius: 6,
              }}
            >
              {data.exhibition_code}
            </span>
            <span className="sub">{data.symbol || symbol}</span>
          </div>
        </div>
      </div>

      {industries.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
          {industries.map((ind) => (
            <span
              key={ind}
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#4b5563",
                background: "#eef1f6",
                border: "1px solid #d5dce6",
                padding: "5px 12px",
                borderRadius: 999,
              }}
            >
              {ind}
            </span>
          ))}
        </div>
      )}

      <div className="info-grid">
        <InfoCard icon="👤" label="CEO" value={data.ceo} />
        <InfoCard icon="📅" label="ก่อตั้งเมื่อ" value={data.establish_date} />
        <InfoCard
          icon="👥"
          label="จำนวนพนักงาน"
          value={data.employees ? Number(data.employees).toLocaleString("en-US") + " คน" : "-"}
        />
        <InfoCard icon="📍" label="ที่อยู่" value={data.address} />
      </div>

      {data.profile && (
        <div>
          <div className="sub" style={{ marginBottom: 6, fontWeight: 700, color: BLUE_DARK }}>
            ลักษณะธุรกิจ
          </div>
          <div style={{ fontSize: 13.5, lineHeight: 1.7, color: "#374151" }}>
            {data.profile}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Target Price: mean, low, high, median, currency ----------
function TargetPriceView({ data }) {
  if (!data) return null;

  const low = toNumber(data.low);
  const median = toNumber(data.median);
  const mean = toNumber(data.mean);
  const high = toNumber(data.high);
  const currency = data.currency || "USD";

  const chartData = {
    labels: ["ต่ำสุด", "กลาง", "เฉลี่ย", "สูงสุด"],
    datasets: [{
      label: `ราคาเป้าหมาย (${currency})`,
      data: [low, median, mean, high],
      backgroundColor: [RED, "#f5a623", BLUE, GREEN],
      borderRadius: 10,
      borderSkipped: false,
      maxBarThickness: 64,
    }],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { grid: { display: false }, ticks: { color: "#6b7280", font: { size: 13 } } },
      y: {
        grid: { color: "rgba(18,49,94,0.08)" },
        ticks: {
          color: "#6b7280",
          callback: (v) => `${CURRENCY_SYMBOL[currency] || currency + " "}${Number(v).toFixed(2)}`,
        },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${CURRENCY_SYMBOL[currency] || currency + " "}${ctx.parsed.y.toFixed(2)}`,
        },
      },
    },
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 20 }}>
        <div>
          <div className="sub">ราคาเป้าหมายเฉลี่ย (Mean)</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: BLUE }}>
            {CURRENCY_SYMBOL[currency] || currency + " "}{mean.toFixed(2)}
          </div>
        </div>
        <div style={{ minWidth: 260 }}>
          <div className="sub" style={{ marginBottom: 8 }}>ช่วงราคา (Low – High)</div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "4px 10px",
                borderRadius: 999,
                background: "rgba(224,32,32,0.1)",
                color: RED,
                fontWeight: 700,
                fontSize: 16,
              }}
            >
              ▼ {CURRENCY_SYMBOL[currency] || currency + " "}{low.toFixed(2)}
            </span>

            <span style={{ color: "#c3cad6", fontWeight: 400 }}>—</span>

            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "4px 10px",
                borderRadius: 999,
                background: "rgba(15,157,88,0.1)",
                color: GREEN,
                fontWeight: 700,
                fontSize: 16,
              }}
            >
              ▲ {CURRENCY_SYMBOL[currency] || currency + " "}{high.toFixed(2)}
            </span>
          </div>

          <div style={{ position: "relative", height: 8, borderRadius: 999, background: "linear-gradient(90deg, #e02020, #f5a623, #0f9d58)" }}>
            <div
              style={{
                position: "absolute",
                top: -4,
                left: `${high > low ? Math.min(100, Math.max(0, ((mean - low) / (high - low)) * 100)) : 50}%`,
                transform: "translateX(-50%)",
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: "#fff",
                border: `3px solid ${BLUE}`,
                boxShadow: "0 1px 4px rgba(18,49,94,0.3)",
              }}
              title={`ราคาเฉลี่ย ${CURRENCY_SYMBOL[currency] || currency + " "}${mean.toFixed(2)}`}
            />
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280", textAlign: "center" }}>
            จุดกลม = ราคาเฉลี่ย (Mean) ที่ {CURRENCY_SYMBOL[currency] || currency + " "}{mean.toFixed(2)}
          </div>
        </div>
      </div>
      <div className="chart-wrap" style={{ height: 260, position: "relative" }}>
        <Bar data={chartData} options={chartOptions} />
      </div>
    </div>
  );
}

// ---------- Rating: number, strong_buy, buy, hold, sell, under_perform ----------
function RatingView({ data }) {
  if (!data) return null;

  const strongBuy = toNumber(data.strong_buy);
  const buy = toNumber(data.buy);
  const hold = toNumber(data.hold);
  const sell = toNumber(data.sell);
  const underPerform = toNumber(data.under_perform);
  const total = toNumber(data.number, strongBuy + buy + hold + sell + underPerform);

  const chartData = {
    labels: ["Strong Buy", "Buy", "Hold", "Sell", "Underperform"],
    datasets: [{
      data: [strongBuy, buy, hold, sell, underPerform],
      backgroundColor: [GREEN, BLUE, "#f5a623", RED, "#8b0000"],
      borderColor: "#ffffff",
      borderWidth: 3,
      hoverOffset: 10,
    }],
  };

  const chartOptions = {
    cutout: "65%",
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "right",
        labels: { color: "#1a1d29", font: { size: 13 }, boxWidth: 14 },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(2) : "0.00";
            return ` ${ctx.label}: ${ctx.parsed} (${pct}%)`;
          },
        },
      },
    },
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 20 }}>
        <div>
          <div className="sub">จำนวนนักวิเคราะห์ทั้งหมด</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: BLUE_DARK }}>{total}</div>
        </div>
        <div>
          <div className="sub">Strong Buy + Buy</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: GREEN }}>
            {total > 0 ? (((strongBuy + buy) / total) * 100).toFixed(2) : "0.00"}%
          </div>
        </div>
      </div>
      <div className="chart-wrap" style={{ height: 280, position: "relative" }}>
        <Doughnut data={chartData} options={chartOptions} />
      </div>
    </div>
  );
}

function SymbolDetailPanel({ positions }) {
  const [selectedSymbol, setSelectedSymbol] = useState("");
  const [activeTab, setActiveTab] = useState("profile");

  useEffect(() => {
    if (!selectedSymbol && positions.length > 0) {
      setSelectedSymbol(positions[0].ticker);
    }
  }, [positions, selectedSymbol]);

  const { data, loading, error } = useSymbolDetail(selectedSymbol, activeTab);

  if (positions.length === 0) {
    return (
      <section className="card">
        <h3>ข้อมูลเชิงลึกของหุ้นในพอร์ต</h3>
        <div className="sub">ไม่มีหุ้นในพอร์ตสำหรับแสดงข้อมูล</div>
      </section>
    );
  }

  return (
    <>
      <section className="card">
        <h3>ข้อมูลเชิงลึกของหุ้นในพอร์ต</h3>

        <div className="symbol-tabs" style={{ margin: "12px 0" }}>
          {positions.map((s) => (
            <button
              key={s.ticker}
              onClick={() => setSelectedSymbol(s.ticker)}
              style={{
                padding: "6px 14px",
                borderRadius: 20,
                border: s.ticker === selectedSymbol ? `1px solid ${BLUE}` : "1px solid #d5dce6",
                background: s.ticker === selectedSymbol ? "rgba(30,109,224,0.1)" : "transparent",
                color: s.ticker === selectedSymbol ? BLUE : "#4b5563",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              {s.ticker}
            </button>
          ))}
        </div>

        <div className="detail-tabs" style={{ marginBottom: 16 }}>
          {DETAIL_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                border: "none",
                background: t.key === activeTab ? BLUE : "#eef1f6",
                color: t.key === activeTab ? "#fff" : "#4b5563",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="sub">กำลังโหลดข้อมูล...</div>
        ) : error ? (
          <div className="sub" style={{ color: RED }}>โหลดข้อมูลไม่สำเร็จ: {error}</div>
        ) : (
          <>
            {activeTab === "profile" && <ProfileView data={data} symbol={selectedSymbol} />}
            {activeTab === "target-price" && <TargetPriceView data={data} />}
            {activeTab === "rating" && <RatingView data={data} />}
          </>
        )}
      </section>

      <PriceChartView symbol={selectedSymbol} />
    </>
  );
}

function App() {
  const [positions, setPositions] = useState([]);
  const [balance, setBalance] = useState(null);
  const [status, setStatus] = useState("กำลังเชื่อมต่อ...");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState("");

  const loadPortfolio = async () => {
    try {
      setLoading(true);
      setError("");
      setStatus("กำลังโหลดข้อมูลพอร์ต...");

      const [posRes, balRes] = await Promise.all([
        fetch(`${API_BASE}/positions`),
        fetch(`${API_BASE}/balance`),
      ]);

      if (!posRes.ok) throw new Error(`positions API ${posRes.status}`);
      if (!balRes.ok) throw new Error(`balance API ${balRes.status}`);

      const posData = await posRes.json();
      const balData = await balRes.json();

      const holdings = Array.isArray(posData?.holdings)
        ? posData.holdings
        : Array.isArray(posData)
          ? posData
          : [];

      setPositions(holdings.map(mapHolding));
      setBalance(balData);
      setStatus("เชื่อมต่อสำเร็จ • ข้อมูลจาก Webull Open API");
    } catch (err) {
      console.error(err);
      setError(err.message || "โหลดข้อมูลไม่สำเร็จ");
      setStatus("เชื่อมต่อ backend ไม่สำเร็จ");
      setPositions([]);
    } finally {
      setLoading(false);
    }
  };

  const loadOrders = async () => {
    try {
      setOrdersLoading(true);
      setOrdersError("");

      const res = await fetch(`${API_BASE}/orders?page_size=50`);
      if (!res.ok) throw new Error(`orders API ${res.status}`);

      const data = await res.json();
      const groups = Array.isArray(data) ? data : [];
      const flat = groups.flatMap((g) => g.orders || []);

      setOrders(flat);
    } catch (err) {
      console.error(err);
      setOrdersError(err.message || "โหลด order ไม่สำเร็จ");
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  };

  useEffect(() => {
    loadPortfolio();
    const timer = setInterval(loadPortfolio, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadOrders();
    const timer = setInterval(loadOrders, 30000);
    return () => clearInterval(timer);
  }, []);

  const summary = useMemo(() => {
    const totalQty = positions.reduce((a, s) => a + s.qty, 0);
    const totalInvested = positions.reduce((a, s) => a + s.invested, 0);
    const totalMarket = positions.reduce((a, s) => a + s.marketValue, 0);
    const totalPnl = positions.reduce((a, s) => a + s.pnl, 0);

    const weightedPnlSum = positions.reduce((a, s) => a + s.pnlPercent * s.invested, 0);
    const totalPnlPercent = totalInvested > 0 ? weightedPnlSum / totalInvested : 0;

    return {
      totalQty,
      totalInvested,
      totalMarket,
      totalPnl,
      totalPnlPercent,
      totalColor: totalPnl >= 0 ? GREEN : RED,
    };
  }, [positions]);

  const movers = useMemo(() => {
    const sorted = [...positions].sort((a, b) => b.pnlPercent - a.pnlPercent);
    return {
      gainers: sorted.filter((s) => s.pnlPercent > 0),
      losers: sorted.filter((s) => s.pnlPercent <= 0).reverse(),
    };
  }, [positions]);

  const currencyAssets = useMemo(() => {
    if (!balance?.account_currency_assets) return [];
    return balance.account_currency_assets
      .map((c) => ({
        currency: c.currency,
        cashBalance: toNumber(c.cash_balance),
        marketValue: toNumber(c.market_value),
        buyingPower: toNumber(c.buying_power),
        pnl: toNumber(c.unrealized_profit_loss),
      }))
      .filter((c) => c.cashBalance !== 0 || c.marketValue !== 0);
  }, [balance]);

  const ordersSummary = useMemo(() => {
    const buyOrders = orders.filter((o) => o.side === "BUY");
    const sellOrders = orders.filter((o) => o.side === "SELL");
    const filledOrders = orders.filter((o) => o.status === "FILLED" || o.status === "PARTIAL_FILLED");

    const buyValue = buyOrders.reduce(
      (a, o) => a + toNumber(o.filled_quantity) * toNumber(o.filled_price),
      0
    );
    const sellValue = sellOrders.reduce(
      (a, o) => a + toNumber(o.filled_quantity) * toNumber(o.filled_price),
      0
    );

    const symbolCount = {};
    orders.forEach((o) => {
      symbolCount[o.symbol] = (symbolCount[o.symbol] || 0) + 1;
    });
    const mostTraded = Object.entries(symbolCount).sort((a, b) => b[1] - a[1])[0];

    return {
      total: orders.length,
      buyCount: buyOrders.length,
      sellCount: sellOrders.length,
      filledCount: filledOrders.length,
      buyValue,
      sellValue,
      mostTradedSymbol: mostTraded ? mostTraded[0] : "-",
      mostTradedCount: mostTraded ? mostTraded[1] : 0,
    };
  }, [orders]);

  const allocationData = {
    labels: positions.map((s) => s.ticker),
    logoUrls: positions.map((s) => logoUrl(s.ticker)),
    datasets: [{
      data: positions.map((s) => s.marketValue),
      backgroundColor: positions.map((s) => s.paletteColor),
      borderColor: "#ffffff",
      borderWidth: 3,
      hoverOffset: 10,
    }],
  };

  const allocationOptions = {
    cutout: "68%",
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${ctx.label}: ${fmtMoney(ctx.parsed)} (${summary.totalMarket ? ((ctx.parsed / summary.totalMarket) * 100).toFixed(2) : "0.00"}%)`,
        },
      },
    },
  };

  const pnlData = {
    labels: positions.map((s) => s.ticker),
    datasets: [{
      label: "กำไร/ขาดทุน (%)",
      data: positions.map((s) => Number(s.pnlPercent.toFixed(2))),
      backgroundColor: positions.map((s) => s.color),
      borderRadius: 8,
      maxBarThickness: 42,
    }],
  };

  const pnlOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { grid: { display: false }, ticks: { color: "#6b7280" } },
      y: {
        grid: { color: "rgba(18,49,94,0.08)" },
        ticks: { color: "#6b7280", callback: (v) => Number(v).toFixed(2) + "%" },
        suggestedMin: -10,
        suggestedMax: 10,
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx) => ` ${ctx.parsed.y >= 0 ? "+" : ""}${ctx.parsed.y.toFixed(2)}%` } },
    },
  };

  return (
    <div className="board">
      <div className="Webull-API-Connection">
        <img
          src="https://webull.com/favicon.ico"
          alt="Webull API Connection"
          className="Connection-logo"
          onError={(e) => { e.currentTarget.style.display = "none"; }}
        />
        <div className="Webull-API-Connection-Box">
          <div className="Webull-API-Connection-text">พอร์ต Webull</div>
          <div className="Webull-API-Connection-info" style={{ color: error ? RED : BLUE }}>
            {status}
          </div>
        </div>
      </div>

      <SymbolDetailPanel positions={positions} />

      <div className="Position-Display-Box">
        <section className="card">
          <div className="card-header-row">
            <h3>หุ้นในพอร์ตการลงทุน (USD)</h3>
            <button
              className={`refresh-btn ${loading ? "loading" : ""}`}
              onClick={loadPortfolio}
              disabled={loading}
            >
              <span className="refresh-icon" />
              {loading ? "กำลังโหลด..." : "รีเฟรช"}
            </button>
          </div>

          <table id="positions-table">
            <thead>
              <tr>
                <th>หุ้นในพอร์ต</th>
                <th>จำนวนหุ้น</th>
                <th>ต้นทุนต่อหุ้น</th>
                <th>เงินลงทุน</th>
                <th>มูลค่าตลาด</th>
                <th className="right">กำไร/ขาดทุน-ทั้งหมด</th>
              </tr>
            </thead>
            <tbody id="positions-body">
              {loading && positions.length === 0 ? (
                <tr><td colSpan="6" className="sub">กำลังโหลดข้อมูล...</td></tr>
              ) : error ? (
                <tr><td colSpan="6" className="sub" style={{ color: RED }}>โหลดข้อมูลไม่สำเร็จ: {error}</td></tr>
              ) : positions.length === 0 ? (
                <tr><td colSpan="6" className="sub">ไม่มีข้อมูลหุ้นในพอร์ต</td></tr>
              ) : (
                positions.map((s) => (
                  <tr key={s.ticker}>
                    <td>
                      <div className="stock-name">
                        <img src={logoUrl(s.ticker)} alt={`${s.ticker} logo`} className="stock-logo" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                        <div className="ticker-company">
                          <span className="ticker-name">{s.ticker}</span>
                          <span className="company-name">{s.company}</span>
                        </div>
                      </div>
                    </td>
                    <td>{s.qty}</td>
                    <td>${s.cost.toFixed(2)}</td>
                    <td>{fmtMoney(s.invested)}</td>
                    <td>
                      <div>{fmtMoney(s.marketValue)}</div>
                      <div className="sub">${s.marketPrice.toFixed(2)}</div>
                    </td>
                    <td className="right">
                      <div style={{ color: s.color }}>{fmtSignedMoney(s.pnl)}</div>
                      <div className="sub" style={{ color: s.color }}>{fmtPercent(s.pnlPercent)}</div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr id="totals-row" className="totals">
                <td>รวมทั้งหมด</td>
                <td>{positions.length ? summary.totalQty.toFixed(4).replace(/\.?0+$/, "") : "-"}</td>
                <td>-</td>
                <td>{positions.length ? fmtMoney(summary.totalInvested) : "-"}</td>
                <td>{positions.length ? fmtMoney(summary.totalMarket) : "-"}</td>
                <td className="right">
                  {positions.length ? (
                    <>
                      <div style={{ color: summary.totalColor }}>{fmtSignedMoney(summary.totalPnl)}</div>
                      <div className="sub" style={{ color: summary.totalColor }}>{fmtPercent(summary.totalPnlPercent)}</div>
                    </>
                  ) : "-"}
                </td>
              </tr>
            </tfoot>
          </table>
        </section>

        <section className="card">
          <h3>เงินสด &amp; มูลค่าสินทรัพย์แยกตามสกุลเงิน</h3>
          {balance && (
            <div className="summary-row">
              <div>
                <div className="sub">มูลค่าหุ้นรวม ({balance.total_asset_currency})</div>
                <div style={{ fontSize: 20, fontWeight: 600, color: BLUE_DARK }}>
                  {fmtCurrency(balance.total_market_value, balance.total_asset_currency)}
                </div>
              </div>
              <div>
                <div className="sub">เงินสดรวม ({balance.total_asset_currency})</div>
                <div style={{ fontSize: 20, fontWeight: 600, color: GREEN }}>
                  {fmtCurrency(balance.total_cash_balance, balance.total_asset_currency)}
                </div>
              </div>
              <div>
                <div className="sub">กำไร/ขาดทุนรวม ({balance.total_asset_currency})</div>
                <div style={{ fontSize: 20, fontWeight: 600, color: toNumber(balance.total_unrealized_profit_loss) >= 0 ? GREEN : RED }}>
                  {fmtCurrency(balance.total_unrealized_profit_loss, balance.total_asset_currency)}
                </div>
              </div>
            </div>
          )}

          <table id="currency-table">
            <thead>
              <tr>
                <th>สกุลเงิน</th>
                <th>เงินสด</th>
                <th>มูลค่าหุ้น</th>
                <th>Buying Power</th>
                <th className="right">กำไร/ขาดทุน</th>
              </tr>
            </thead>
            <tbody>
              {currencyAssets.length === 0 ? (
                <tr><td colSpan="5" className="sub">ไม่มีข้อมูล</td></tr>
              ) : (
                currencyAssets.map((c) => (
                  <tr key={c.currency}>
                    <td><strong>{c.currency}</strong></td>
                    <td>{fmtCurrency(c.cashBalance, c.currency)}</td>
                    <td>{fmtCurrency(c.marketValue, c.currency)}</td>
                    <td>{fmtCurrency(c.buyingPower, c.currency)}</td>
                    <td className="right" style={{ color: c.pnl >= 0 ? GREEN : RED }}>
                      {fmtCurrency(c.pnl, c.currency)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <div className="charts-grid">
          <section className="card chart-card">
            <h4 className="chart-title">สัดส่วนพอร์ตตามมูลค่าตลาด</h4>
            <div className="chart-wrap" style={{ height: 280, position: "relative" }}>
              {positions.length === 0 ? (
                <div className="sub">ไม่มีข้อมูล</div>
              ) : (
                <Doughnut data={allocationData} options={allocationOptions} />
              )}
            </div>

            {positions.length > 0 && (
              <div className="chart-legend">
                {positions.map((s) => (
                  <div key={`legend-${s.ticker}`} className="legend-item">
                    <span className="legend-dot" style={{ background: s.paletteColor }} />
                    <span className="legend-label">{s.ticker}</span>
                    <span className="legend-value">
                      {summary.totalMarket > 0
                        ? ((s.marketValue / summary.totalMarket) * 100).toFixed(2)
                        : "0.00"}
                      %
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
          <section className="card chart-card" style={{ width: "100%", boxSizing: "border-box" }}>
            <h4 className="chart-title">กำไร/ขาดทุนรายตัว (%)</h4>
            <div className="chart-wrap" style={{ height: 280, width: "100%", position: "relative" }}>
              {positions.length === 0 ? <div className="sub">ไม่มีข้อมูล</div> : <Bar data={pnlData} options={pnlOptions} />}
            </div>
          </section>
        </div>

        <div className="movers-grid">
          <section className="card">
            <h4>หุ้นบวกแรงในวันนี้</h4>
            <div id="gainers-list" className="movers-list">
              {movers.gainers.length ? movers.gainers.map((s) => (
                <div className="mover-item" key={`gainer-${s.ticker}`}>
                  <div className="ticker-company-box">
                    <img src={logoUrl(s.ticker)} alt={`${s.ticker} logo`} className="stock-logo" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                    <div className="ticker-company">
                      <span className="ticker-name">{s.ticker}</span>
                      <span className="company-name">{s.company}</span>
                    </div>
                  </div>
                  <span style={{ color: s.color }}>{fmtPercent(s.pnlPercent)}</span>
                </div>
              )) : <div className="sub">ไม่มีข้อมูล</div>}
            </div>
          </section>

          <section className="card">
            <h4>หุ้นลบแรงในวันนี้</h4>
            <div id="losers-list" className="movers-list">
              {movers.losers.length ? movers.losers.map((s) => (
                <div className="mover-item" key={`loser-${s.ticker}`}>
                  <div className="ticker-company-box">
                    <img src={logoUrl(s.ticker)} alt={`${s.ticker} logo`} className="stock-logo" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                    <div className="ticker-company">
                      <span className="ticker-name">{s.ticker}</span>
                      <span className="company-name">{s.company}</span>
                    </div>
                  </div>
                  <span style={{ color: s.color }}>{fmtPercent(s.pnlPercent)}</span>
                </div>
              )) : <div className="sub">ไม่มีข้อมูล</div>}
            </div>
          </section>
        </div>

        <section className="card">
          <div className="card-header-row">
            <h3>ประวัติคำสั่งซื้อขาย (7 วันล่าสุด)</h3>
            <button
              className={`refresh-btn ${ordersLoading ? "loading" : ""}`}
              onClick={loadOrders}
              disabled={ordersLoading}
            >
              <span className="refresh-icon" />
              {ordersLoading ? "กำลังโหลด..." : "รีเฟรช"}
            </button>
          </div>

          {orders.length > 0 && (
            <div className="summary-row" style={{ margin: "16px 0" }}>
              <div>
                <div className="sub">คำสั่งทั้งหมด</div>
                <div style={{ fontSize: 20, fontWeight: 600, color: BLUE_DARK }}>{ordersSummary.total}</div>
              </div>
              <div>
                <div className="sub">ซื้อ / ขาย</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>
                  <span style={{ color: GREEN }}>{ordersSummary.buyCount}</span>
                  {" / "}
                  <span style={{ color: RED }}>{ordersSummary.sellCount}</span>
                </div>
              </div>
              <div>
                <div className="sub">มูลค่าซื้อรวม</div>
                <div style={{ fontSize: 20, fontWeight: 600, color: GREEN }}>{fmtMoney(ordersSummary.buyValue)}</div>
              </div>
              <div>
                <div className="sub">มูลค่าขายรวม</div>
                <div style={{ fontSize: 20, fontWeight: 600, color: RED }}>{fmtMoney(ordersSummary.sellValue)}</div>
              </div>
              <div>
                <div className="sub">เทรดบ่อยสุด</div>
                <div style={{ fontSize: 20, fontWeight: 600, color: BLUE_DARK }}>
                  {ordersSummary.mostTradedSymbol} ({ordersSummary.mostTradedCount})
                </div>
              </div>
            </div>
          )}

          <table id="orders-table">
            <thead>
              <tr>
                <th>สัญลักษณ์</th>
                <th>ประเภท</th>
                <th>ทิศทาง</th>
                <th>จำนวน</th>
                <th>ราคาที่ได้</th>
                <th>สถานะ</th>
                <th className="right">เวลาส่งคำสั่ง</th>
              </tr>
            </thead>
            <tbody>
              {ordersLoading && orders.length === 0 ? (
                <tr><td colSpan="7" className="sub">กำลังโหลดข้อมูล...</td></tr>
              ) : ordersError ? (
                <tr><td colSpan="7" className="sub" style={{ color: RED }}>โหลดข้อมูลไม่สำเร็จ: {ordersError}</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan="7" className="sub">ไม่มีประวัติคำสั่งซื้อขายในช่วงนี้</td></tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.order_id}>
                    <td>
                      <div className="stock-name">
                        <img src={logoUrl(o.symbol)} alt={`${o.symbol} logo`} className="stock-logo" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                        <span className="ticker-name">{o.symbol}</span>
                      </div>
                    </td>
                    <td>{o.order_type}</td>
                    <td style={{ color: o.side === "BUY" ? GREEN : RED, fontWeight: 600 }}>
                      {o.side === "BUY" ? "ซื้อ" : "ขาย"}
                    </td>
                    <td>
                      {toNumber(o.filled_quantity)} / {toNumber(o.total_quantity)}
                    </td>
                    <td>{o.filled_price ? `$${toNumber(o.filled_price).toFixed(2)}` : "-"}</td>
                    <td>
                      <span style={{ color: STATUS_COLOR[o.status] || "#9aa0ac", fontWeight: 600 }}>
                        {STATUS_LABEL[o.status] || o.status}
                      </span>
                    </td>
                    <td className="right sub">{fmtDateTime(o.place_time_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

export default App;