"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart2,
  Loader2,
  RefreshCw
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from "recharts";

type SignupDataPoint = {
  date: string;
  label: string;
  count: number;
  isCurrentPeriod: boolean;
};

type SignupSummary = {
  totalSignups: number;
  todaySignups: number;
  thisWeekSignups: number;
  thisMonthSignups: number;
  previousPeriodSignups: number;
  growthRate: number;
};

type Navigation = {
  previousDate: string;
  nextDate: string | null;
  today: string;
};

type SignupsResponse = {
  success: boolean;
  data: {
    granularity: "day" | "week" | "month";
    referenceDate: string;
    days: number;
    dataPoints: SignupDataPoint[];
    summary: SignupSummary;
    navigation: Navigation;
  };
};

type StatCard = {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  trend?: {
    value: number;
    label: string;
  };
  color?: "blue" | "emerald" | "amber" | "violet" | "rose";
};

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toString();
}

function getTrendIcon(rate: number) {
  if (rate > 0) return <TrendingUp className="h-4 w-4 text-emerald-600" />;
  if (rate < 0) return <TrendingDown className="h-4 w-4 text-rose-600" />;
  return <Minus className="h-4 w-4 text-slate-400" />;
}

function StatCardComponent({ label, value, icon: Icon, trend, color = "blue" }: StatCard) {
  const colorClasses: Record<string, { bg: string; text: string; iconBg: string }> = {
    blue: { bg: "bg-blue-50", text: "text-blue-700", iconBg: "bg-blue-100" },
    emerald: { bg: "bg-emerald-50", text: "text-emerald-700", iconBg: "bg-emerald-100" },
    amber: { bg: "bg-amber-50", text: "text-amber-700", iconBg: "bg-amber-100" },
    violet: { bg: "bg-violet-50", text: "text-violet-700", iconBg: "bg-violet-100" },
    rose: { bg: "bg-rose-50", text: "text-rose-700", iconBg: "bg-rose-100" }
  };

  const c = colorClasses[color];

  return (
    <article className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70 ${c.bg}`}>
      <div className="flex items-center justify-between gap-3">
        <span className={`grid h-11 w-11 place-items-center rounded-xl ${c.iconBg}`}>
          <Icon className={`h-5 w-5 ${c.text}`} />
        </span>
        {trend && (
          <div className="flex items-center gap-1 text-xs font-bold">
            {getTrendIcon(trend.value)}
            <span className={trend.value > 0 ? "text-emerald-600" : trend.value < 0 ? "text-rose-600" : "text-slate-500"}>
              {trend.value > 0 ? "+" : ""}{trend.value.toFixed(1)}%
            </span>
            <span className="text-slate-400">{trend.label}</span>
          </div>
        )}
      </div>
      <p className="mt-4 text-xs font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <strong className="mt-1 block text-3xl font-black tracking-tight text-slate-950">{value}</strong>
    </article>
  );
}

export function SignupTracker() {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [data, setData] = useState<SignupsResponse["data"] | null>(null);
  const [message, setMessage] = useState("");
  const [granularity, setGranularity] = useState<"day" | "week" | "month">("day");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function load() {
    setState("loading");
    setMessage("");
    try {
      const params = new URLSearchParams();
      params.set("granularity", granularity);
      if (selectedDate) params.set("date", selectedDate);
      params.set("days", granularity === "day" ? "30" : granularity === "week" ? "12" : "12");

      const response = await fetch(`/api/admin/users/signups?${params.toString()}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to load signup data.");
      setData(payload.data);
      setState("ready");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load signup data.");
      setState("error");
    } finally {
      setIsRefreshing(false);
    }
  }

  async function refresh() {
    setIsRefreshing(true);
    await load();
  }

  function navigate(date: string | null) {
    if (!date) return;
    setSelectedDate(date);
  }

  function goToToday() {
    setSelectedDate("");
  }

  function changeGranularity(newGranularity: "day" | "week" | "month") {
    setGranularity(newGranularity);
    // Reset date when changing granularity to avoid invalid combinations
    setSelectedDate("");
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [granularity, selectedDate]);

  const statCards = useMemo(() => {
    if (!data) return [];
    const { summary, navigation } = data;
    return [
      {
        label: "Total in period",
        value: formatNumber(summary.totalSignups),
        icon: BarChart2,
        trend: {
          value: summary.growthRate,
          label: "vs prev period"
        },
        color: "blue" as const
      },
      {
        label: "Today",
        value: formatNumber(summary.todaySignups),
        icon: Calendar,
        color: "emerald" as const
      },
      {
        label: "This week",
        value: formatNumber(summary.thisWeekSignups),
        icon: TrendingUp,
        color: "violet" as const
      },
      {
        label: "This month",
        value: formatNumber(summary.thisMonthSignups),
        icon: Calendar,
        color: "amber" as const
      }
    ];
  }, [data]);

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.dataPoints.map((dp) => ({
      name: dp.label,
      signups: dp.count,
      date: dp.date,
      isCurrent: dp.isCurrentPeriod
    }));
  }, [data]);

  const maxSignups = useMemo(() => {
    if (!data) return 10;
    return Math.max(...data.dataPoints.map(dp => dp.count), 10);
  }, [data]);

  if (state === "loading") {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm shadow-slate-200/70">
        <div className="flex items-center justify-center gap-3 text-sm font-bold text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          Loading signup analytics...
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 shadow-sm shadow-rose-200/70">
        <div className="flex items-center gap-3 text-rose-800">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-rose-100">
            <Loader2 className="h-5 w-5 text-rose-600" />
          </div>
          <div>
            <p className="font-bold text-slate-900">Unable to load signup data</p>
            <p className="text-sm font-semibold text-rose-700">{message}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-black text-white transition hover:bg-rose-700"
        >
          <RefreshCw className="h-4 w-4" /> Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { navigation, referenceDate, granularity: currentGranularity } = data;
  const isToday = referenceDate === navigation.today;

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm shadow-slate-200/70">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart2 className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-black tracking-tight text-slate-900">User Signup Analytics</h3>
          </div>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Track daily, weekly, or monthly user registrations with period-over-period comparison.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Granularity Selector */}
          <div className="inline-flex rounded-lg bg-slate-100 p-1" role="group" aria-label="Time granularity">
            {(["day", "week", "month"] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => changeGranularity(g)}
                className={`inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-xs font-black transition ${
                  granularity === g
                    ? "bg-white text-blue-700 shadow-sm shadow-blue-600/20"
                    : "text-slate-600 hover:bg-white hover:text-blue-700"
                }`}
                aria-pressed={granularity === g}
              >
                {g.charAt(0).toUpperCase() + g.slice(1)}
              </button>
            ))}
          </div>

          {/* Date Navigation */}
          <div className="inline-flex items-center gap-2 border border-slate-200 bg-white rounded-xl px-3">
            <button
              type="button"
              onClick={() => navigate(navigation.previousDate)}
              disabled={!navigation.previousDate}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-black transition disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
              aria-label="Previous period"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <input
              type="date"
              value={referenceDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-9 w-32 rounded-lg border-0 bg-transparent px-2 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              aria-label="Select date"
            />
            <button
              type="button"
              onClick={() => navigate(navigation.nextDate)}
              disabled={!navigation.nextDate}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-black transition disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
              aria-label="Next period"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            {!isToday && (
              <button
                type="button"
                onClick={goToToday}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-black text-white transition hover:bg-blue-700"
              >
                Today
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={refresh}
            disabled={isRefreshing}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <StatCardComponent key={card.label} {...card} />
        ))}
      </div>

      {/* Chart */}
      <div className="border-t border-slate-100 px-5 py-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
              {currentGranularity.charAt(0).toUpperCase() + currentGranularity.slice(1)}ly Signups
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {data.dataPoints.length} {currentGranularity}{data.dataPoints.length !== 1 ? "s" : ""} •{" "}
              {data.summary.totalSignups.toLocaleString()} total signups
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <span className="inline-flex items-center gap-1">
              <span className="h-3 w-3 rounded bg-blue-600" />
              Signups
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-3 w-3 rounded bg-blue-600/40" />
              Current period
            </span>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef1ff" vertical={false} />
            <XAxis
              type="number"
              domain={[0, "dataMax + 20%"]}
              tick={{ fontSize: 11, fill: "#64708e" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={80}
              tick={{ fontSize: 11, fill: "#64708e" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => value}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#fff",
                border: "1px solid #eef1ff",
                borderRadius: "12px",
                boxShadow: "0 10px 30px rgba(37, 55, 130, 0.12)",
                padding: "12px 16px"
              }}
              formatter={(value) => [Number(value ?? 0).toLocaleString(), "signups"]}
              labelFormatter={(label) => String(label ?? "")}
            />
            <Bar
              dataKey="signups"
              radius={[0, 4, 4, 0]}
              maxBarSize={32}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.isCurrent ? "#246bfe" : "rgba(36, 107, 254, 0.35)"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Empty state */}
        {!chartData.length && (
          <div className="text-center py-12">
            <BarChart2 className="h-12 w-12 mx-auto text-slate-300" />
            <p className="mt-4 text-sm font-semibold text-slate-500">No signup data for this period</p>
            <p className="mt-1 text-xs text-slate-400">Try adjusting the date range or granularity</p>
          </div>
        )}

        {/* Period comparison note */}
        <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs font-semibold text-slate-600">
          <strong className="text-slate-900">Period comparison:</strong>{" "}
          Current period ({data.days} {currentGranularity}{data.days !== 1 ? "s" : ""}) vs previous period
          ({data.summary.previousPeriodSignups.toLocaleString()} signups)
          {data.summary.growthRate !== 0 ? (
            <>
              {" • "}
              <span className={data.summary.growthRate > 0 ? "text-emerald-700" : "text-rose-700"}>
                {data.summary.growthRate > 0 ? "▲" : "▼"} {Math.abs(data.summary.growthRate).toFixed(1)}%
              </span>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}