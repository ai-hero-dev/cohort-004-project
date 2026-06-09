import { useState } from "react";
import { Link, data, isRouteErrorResponse } from "react-router";
import type { Route } from "./+types/admin.analytics";
import { z } from "zod";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BarChart2,
  DollarSign,
  TrendingUp,
  Users,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { RevenueChart } from "~/components/revenue-chart";
import { cn, formatPrice } from "~/lib/utils";
import { getCurrentUserId } from "~/lib/session";
import { getUserById } from "~/services/userService";
import { UserRole } from "~/db/schema";
import {
  getPlatformSummary,
  getPlatformRevenueTimeSeries,
  getPlatformCourseBreakdowns,
  getInstructorsWithCourses,
  type Period,
  type PlatformCourseBreakdown,
} from "~/services/analyticsService";

const periodSchema = z.enum(["7d", "30d", "12m", "all"]);

const PERIODS: { value: Period; label: string }[] = [
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "12m", label: "12mo" },
  { value: "all", label: "All" },
];

export function meta() {
  return [
    { title: "Admin Analytics — Cadence" },
    {
      name: "description",
      content: "Platform-wide revenue and enrollment analytics",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const currentUserId = await getCurrentUserId(request);
  if (!currentUserId) {
    throw data("Select a user from the DevUI panel to view analytics.", {
      status: 401,
    });
  }

  const currentUser = getUserById(currentUserId);
  if (!currentUser || currentUser.role !== UserRole.Admin) {
    throw data("Only admins can access this page.", { status: 403 });
  }

  const url = new URL(request.url);
  const rawPeriod = url.searchParams.get("period") ?? "30d";
  const parsed = periodSchema.safeParse(rawPeriod);
  const period: Period = parsed.success ? parsed.data : "30d";

  const rawInstructor = url.searchParams.get("instructor");
  const instructorId = rawInstructor ? Number(rawInstructor) : undefined;

  const summary = getPlatformSummary({ period });
  const timeSeries = getPlatformRevenueTimeSeries({ period });
  const courseBreakdowns = getPlatformCourseBreakdowns({
    period,
    instructorId:
      instructorId && !Number.isNaN(instructorId) ? instructorId : undefined,
  });
  const instructors = getInstructorsWithCourses();

  return {
    summary,
    timeSeries,
    courseBreakdowns,
    instructors,
    period,
    selectedInstructorId: instructorId ?? null,
  };
}

type SortKey = keyof Pick<
  PlatformCourseBreakdown,
  | "title"
  | "instructorName"
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

const TABLE_COLS: { key: SortKey; label: string }[] = [
  { key: "title", label: "Course" },
  { key: "instructorName", label: "Instructor" },
  { key: "listPrice", label: "List Price" },
  { key: "revenue", label: "Revenue" },
  { key: "salesCount", label: "Sales" },
  { key: "enrollmentCount", label: "Enrollments" },
  { key: "avgRating", label: "Avg Rating" },
  { key: "ratingCount", label: "Ratings" },
];

function buildFilterUrl(opts: {
  period: string;
  instructorId?: number | null;
}) {
  const params = new URLSearchParams();
  params.set("period", opts.period);
  if (opts.instructorId) params.set("instructor", String(opts.instructorId));
  return `?${params.toString()}`;
}

export default function AdminAnalytics({ loaderData }: Route.ComponentProps) {
  const {
    summary,
    timeSeries,
    courseBreakdowns,
    instructors,
    period,
    selectedInstructorId,
  } = loaderData;

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

  const hasNoData =
    summary.totalRevenue === 0 &&
    summary.totalEnrollments === 0 &&
    !summary.topCourse;

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground">
          Home
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Admin Analytics</span>
      </nav>

      <div className="mb-8">
        <h1 className="text-3xl font-bold">Platform Analytics</h1>
        <p className="mt-1 text-muted-foreground">
          Revenue and enrollment data across all courses
        </p>
      </div>

      <div className="space-y-8">
        {/* Period selector */}
        <div className="flex w-fit gap-1 rounded-lg border p-1">
          {PERIODS.map(({ value, label }) => (
            <Link
              key={value}
              to={buildFilterUrl({
                period: value,
                instructorId: selectedInstructorId,
              })}
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

        {hasNoData ? (
          <Card>
            <CardContent className="py-16 text-center">
              <BarChart2 className="mx-auto mb-4 size-10 text-muted-foreground/40" />
              <p className="font-medium">No data for this period.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try selecting a longer time range, or wait for course purchases
                to come in.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Revenue
                  </CardTitle>
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
                  <div className="text-2xl font-bold">
                    {summary.totalEnrollments}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Top Earning Course
                  </CardTitle>
                  <TrendingUp className="size-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {summary.topCourse ? (
                    <>
                      <div className="truncate text-2xl font-bold">
                        {summary.topCourse.title}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatPrice(summary.topCourse.revenue)}
                      </p>
                    </>
                  ) : (
                    <div className="text-2xl font-bold">—</div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Revenue over time chart */}
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
          </>
        )}

        {/* Course breakdown table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium">
                Course Breakdown
              </CardTitle>
              {instructors.length > 0 && (
                <select
                  value={selectedInstructorId ?? ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    window.location.href = buildFilterUrl({
                      period,
                      instructorId: val ? Number(val) : null,
                    });
                  }}
                  className="rounded-md border bg-background px-3 py-1.5 text-sm"
                >
                  <option value="">All Instructors</option>
                  {instructors.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {courseBreakdowns.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-muted-foreground">
                  No courses found for the selected filters.
                </p>
              </div>
            ) : (
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
                        <td className="px-4 py-3 font-medium">
                          {course.title}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {course.instructorName}
                        </td>
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
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Something went wrong";
  let message = "An unexpected error occurred while loading analytics.";

  if (isRouteErrorResponse(error)) {
    if (error.status === 401) {
      title = "Sign in required";
      message =
        typeof error.data === "string"
          ? error.data
          : "Please select a user from the DevUI panel.";
    } else if (error.status === 403) {
      title = "Access denied";
      message =
        typeof error.data === "string"
          ? error.data
          : "Only admins can access this page.";
    } else {
      title = `Error ${error.status}`;
      message = typeof error.data === "string" ? error.data : error.statusText;
    }
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="text-center">
        <AlertTriangle className="mx-auto mb-4 size-12 text-muted-foreground" />
        <h1 className="mb-2 text-2xl font-bold">{title}</h1>
        <p className="mb-6 text-muted-foreground">{message}</p>
        <div className="flex items-center justify-center gap-3">
          <Link to="/">
            <Button>Go Home</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
