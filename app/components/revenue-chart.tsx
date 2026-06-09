import { useSyncExternalStore } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { Period, RevenueDataPoint } from "~/services/analyticsService";

function formatDateLabel(dateStr: string, period: Period): string {
  if (period === "7d" || period === "30d") {
    const [year, month, day] = dateStr.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }
  const [year, month] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

function formatYAxisTick(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1000) return `$${(dollars / 1000).toFixed(1)}k`;
  return `$${dollars.toFixed(0)}`;
}

function formatTooltipRevenue(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

const emptySubscribe = () => () => {};

export function RevenueChart({
  data,
  period,
}: {
  data: RevenueDataPoint[];
  period: Period;
}) {
  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const strokeColor = isClient
    ? getComputedStyle(document.documentElement)
        .getPropertyValue("--primary")
        .trim()
    : "#000";

  if (!isClient) {
    return <div className="h-[300px] animate-pulse rounded-md bg-muted" />;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart
        data={data}
        margin={{ top: 5, right: 20, bottom: 5, left: 10 }}
      >
        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
        <XAxis
          dataKey="date"
          tickFormatter={(v: string) => formatDateLabel(v, period)}
          interval="preserveStartEnd"
          tick={{ fontSize: 11 }}
        />
        <YAxis
          tickFormatter={formatYAxisTick}
          tick={{ fontSize: 11 }}
          width={55}
        />
        <Tooltip
          formatter={(value) => [
            typeof value === "number" ? formatTooltipRevenue(value) : "$0.00",
            "Revenue",
          ]}
          labelFormatter={(v) =>
            typeof v === "string" ? formatDateLabel(v, period) : String(v)
          }
          contentStyle={{
            backgroundColor: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: "6px",
            color: "#0f172a",
          }}
          itemStyle={{ color: "#0f172a" }}
          labelStyle={{ color: "#0f172a", fontWeight: 600 }}
        />
        <Line
          type="monotone"
          dataKey="revenue"
          stroke={strokeColor}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
