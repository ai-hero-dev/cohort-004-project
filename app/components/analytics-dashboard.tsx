import { useState, useSyncExternalStore } from "react";
import { Link } from "react-router";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ArrowDown, ArrowUp, ArrowUpDown, DollarSign, Star, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { cn, formatPrice } from "~/lib/utils";
import type {
  CourseBreakdown,
  InstructorSummary,
  Period,
  RevenueDataPoint,
} from "~/services/analyticsService";

const PERIODS: { value: Period; label: string }[] = [
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "12m", label: "12mo" },
  { value: "all", label: "All" },
];

type SortKey = keyof Pick<
  CourseBreakdown,
  "title" | "listPrice" | "revenue" | "salesCount" | "enrollmentCount" | "avgRating" | "ratingCount"
>;
type SortDir = "asc" | "desc";

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

function SortIndicator({ col, sortCol, sortDir }: { col: SortKey; sortCol: SortKey; sortDir: SortDir }) {
  if (col !== sortCol) return <ArrowUpDown className="ml-1 inline size-3 opacity-40" />;
  return sortDir === "asc"
    ? <ArrowUp className="ml-1 inline size-3" />
    : <ArrowDown className="ml-1 inline size-3" />;
}

const emptySubscribe = () => () => {};

function RevenueChart({ data, period }: { data: RevenueDataPoint[]; period: Period }) {
  const isClient = useSyncExternalStore(emptySubscribe, () => true, () => false);

  if (!isClient) {
    return <div className="h-[300px] animate-pulse rounded-md bg-muted" />;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
        <XAxis
          dataKey="date"
          tickFormatter={(v: string) => formatDateLabel(v, period)}
          interval="preserveStartEnd"
          tick={{ fontSize: 11 }}
        />
        <YAxis tickFormatter={formatYAxisTick} tick={{ fontSize: 11 }} width={55} />
        <Tooltip
          formatter={(value) => [
            typeof value === "number" ? formatTooltipRevenue(value) : "$0.00",
            "Revenue",
          ]}
          labelFormatter={(v) =>
            typeof v === "string" ? formatDateLabel(v, period) : String(v)
          }
        />
        <Line
          type="monotone"
          dataKey="revenue"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

type Props = {
  summary: InstructorSummary;
  timeSeries: RevenueDataPoint[];
  courseBreakdowns: CourseBreakdown[];
  period: Period;
};

export function AnalyticsDashboard({ summary, timeSeries, courseBreakdowns, period }: Props) {
  const [sortCol, setSortCol] = useState<SortKey>("revenue");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(col: SortKey) {
    if (col === sortCol) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("desc");
    }
  }

  const sortedCourses = [...courseBreakdowns].sort((a, b) => {
    const aVal = a[sortCol];
    const bVal = b[sortCol];
    if (aVal === null && bVal === null) return 0;
    if (aVal === null) return 1;
    if (bVal === null) return -1;
    if (typeof aVal === "string" && typeof bVal === "string") {
      return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    const diff = (aVal as number) - (bVal as number);
    return sortDir === "asc" ? diff : -diff;
  });

  const TABLE_COLS: { key: SortKey; label: string }[] = [
    { key: "title", label: "Course" },
    { key: "listPrice", label: "List Price" },
    { key: "revenue", label: "Revenue" },
    { key: "salesCount", label: "Sales" },
    { key: "enrollmentCount", label: "Enrollments" },
    { key: "avgRating", label: "Avg Rating" },
    { key: "ratingCount", label: "Ratings" },
  ];

  return (
    <div className="space-y-8">
      {/* Period selector */}
      <div className="flex w-fit gap-1 rounded-lg border p-1">
        {PERIODS.map(({ value, label }) => (
          <Link
            key={value}
            to={`?period=${value}`}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              period === value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPrice(summary.totalRevenue)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Enrollments</CardTitle>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalEnrollments}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
            <Star className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.avgRating !== null ? summary.avgRating.toFixed(1) : "—"}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary.ratingCount} {summary.ratingCount === 1 ? "review" : "reviews"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue chart */}
      {timeSeries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Revenue Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueChart data={timeSeries} period={period} />
          </CardContent>
        </Card>
      )}

      {/* Per-course table */}
      {courseBreakdowns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Course Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    {TABLE_COLS.map(({ key, label }) => (
                      <th
                        key={key}
                        className="cursor-pointer select-none px-4 py-3 text-left font-medium text-muted-foreground hover:text-foreground"
                        onClick={() => handleSort(key)}
                      >
                        {label}
                        <SortIndicator col={key} sortCol={sortCol} sortDir={sortDir} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedCourses.map((course) => (
                    <tr key={course.courseId} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{course.title}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatPrice(course.listPrice)}</td>
                      <td className="px-4 py-3">{formatPrice(course.revenue)}</td>
                      <td className="px-4 py-3">{course.salesCount}</td>
                      <td className="px-4 py-3">{course.enrollmentCount}</td>
                      <td className="px-4 py-3">
                        {course.avgRating !== null ? course.avgRating.toFixed(1) : "—"}
                      </td>
                      <td className="px-4 py-3">{course.ratingCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
