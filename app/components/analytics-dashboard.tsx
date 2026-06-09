import { useState } from "react";
import { Link } from "react-router";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BarChart2,
  DollarSign,
  Star,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { RevenueChart } from "~/components/revenue-chart";
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
  | "title"
  | "listPrice"
  | "revenue"
  | "salesCount"
  | "enrollmentCount"
  | "avgRating"
  | "ratingCount"
>;
type SortDir = "asc" | "desc";

function SortIndicator({
  col,
  sortCol,
  sortDir,
}: {
  col: SortKey;
  sortCol: SortKey;
  sortDir: SortDir;
}) {
  if (col !== sortCol)
    return <ArrowUpDown className="ml-1 inline size-3 opacity-40" />;
  return sortDir === "asc" ? (
    <ArrowUp className="ml-1 inline size-3" />
  ) : (
    <ArrowDown className="ml-1 inline size-3" />
  );
}

type Props = {
  summary: InstructorSummary;
  timeSeries: RevenueDataPoint[];
  courseBreakdowns: CourseBreakdown[];
  period: Period;
};

const PERIOD_SELECTOR = (period: Period) => (
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
);

export function AnalyticsDashboard({
  summary,
  timeSeries,
  courseBreakdowns,
  period,
}: Props) {
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
      return sortDir === "asc"
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
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

  if (courseBreakdowns.length === 0) {
    return (
      <div className="space-y-8">
        {PERIOD_SELECTOR(period)}
        <Card>
          <CardContent className="py-16 text-center">
            <BarChart2 className="mx-auto mb-4 size-10 text-muted-foreground/40" />
            <p className="font-medium">No revenue data yet.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Publish a course to start tracking analytics.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasNoDataForPeriod =
    summary.totalRevenue === 0 &&
    summary.totalEnrollments === 0 &&
    summary.ratingCount === 0;

  if (hasNoDataForPeriod) {
    return (
      <div className="space-y-8">
        {PERIOD_SELECTOR(period)}
        <Card>
          <CardContent className="py-16 text-center">
            <BarChart2 className="mx-auto mb-4 size-10 text-muted-foreground/40" />
            <p className="font-medium">No data for this period.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Try selecting a longer time range.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Period selector */}
      {PERIOD_SELECTOR(period)}

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPrice(summary.totalRevenue)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Enrollments
            </CardTitle>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalEnrollments}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Average Rating
            </CardTitle>
            <Star className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.avgRating !== null ? summary.avgRating.toFixed(1) : "—"}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary.ratingCount}{" "}
              {summary.ratingCount === 1 ? "review" : "reviews"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue chart */}
      {timeSeries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">
              Revenue Over Time
            </CardTitle>
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
            <CardTitle className="text-base font-medium">
              Course Breakdown
            </CardTitle>
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
                        <SortIndicator
                          col={key}
                          sortCol={sortCol}
                          sortDir={sortDir}
                        />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedCourses.map((course) => (
                    <tr
                      key={course.courseId}
                      className="border-b last:border-0 hover:bg-muted/30"
                    >
                      <td className="px-4 py-3 font-medium">{course.title}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatPrice(course.listPrice)}
                      </td>
                      <td className="px-4 py-3">
                        {formatPrice(course.revenue)}
                      </td>
                      <td className="px-4 py-3">{course.salesCount}</td>
                      <td className="px-4 py-3">{course.enrollmentCount}</td>
                      <td className="px-4 py-3">
                        {course.avgRating !== null
                          ? course.avgRating.toFixed(1)
                          : "—"}
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
