import { Link, data, isRouteErrorResponse } from "react-router";
import type { Route } from "./+types/admin.analytics";
import { z } from "zod";
import {
  AlertTriangle,
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
  type Period,
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

  const summary = getPlatformSummary({ period });
  const timeSeries = getPlatformRevenueTimeSeries({ period });

  return { summary, timeSeries, period };
}

export default function AdminAnalytics({ loaderData }: Route.ComponentProps) {
  const { summary, timeSeries, period } = loaderData;

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
