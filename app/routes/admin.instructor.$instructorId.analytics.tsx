import { Link, data, isRouteErrorResponse } from "react-router";
import type { Route } from "./+types/admin.instructor.$instructorId.analytics";
import { z } from "zod";
import { AlertTriangle } from "lucide-react";
import { Button } from "~/components/ui/button";
import { getCurrentUserId } from "~/lib/session";
import { getUserById } from "~/services/userService";
import { UserRole } from "~/db/schema";
import {
  getCourseBreakdowns,
  getInstructorSummary,
  getRevenueTimeSeries,
  type Period,
} from "~/services/analyticsService";
import { AnalyticsDashboard } from "~/components/analytics-dashboard";
import { parseParams } from "~/lib/validation";

const periodSchema = z.enum(["7d", "30d", "12m", "all"]);
const paramsSchema = z.object({ instructorId: z.coerce.number().int().positive() });

export function meta() {
  return [
    { title: "Instructor Analytics — Cadence" },
    { name: "description", content: "View instructor course revenue and enrollment analytics" },
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const currentUserId = await getCurrentUserId(request);
  if (!currentUserId) {
    throw data("Select a user from the DevUI panel to view analytics.", { status: 401 });
  }

  const currentUser = getUserById(currentUserId);
  if (!currentUser || currentUser.role !== UserRole.Admin) {
    throw data("Only admins can access this page.", { status: 403 });
  }

  const { instructorId } = parseParams(params, paramsSchema);
  const instructor = getUserById(instructorId);
  if (!instructor) {
    throw data("Instructor not found.", { status: 404 });
  }

  const url = new URL(request.url);
  const rawPeriod = url.searchParams.get("period") ?? "30d";
  const parsedPeriod = periodSchema.safeParse(rawPeriod);
  const period: Period = parsedPeriod.success ? parsedPeriod.data : "30d";

  const summary = getInstructorSummary({ instructorId, period });
  const timeSeries = getRevenueTimeSeries({ instructorId, period });
  const courseBreakdowns = getCourseBreakdowns({ instructorId, period });

  return { summary, timeSeries, courseBreakdowns, period, instructorName: instructor.name };
}

export default function AdminInstructorAnalytics({ loaderData }: Route.ComponentProps) {
  const { summary, timeSeries, courseBreakdowns, period, instructorName } = loaderData;

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground">
          Home
        </Link>
        <span className="mx-2">/</span>
        <Link to="/admin/users" className="hover:text-foreground">
          Manage Users
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Analytics</span>
      </nav>

      <div className="mb-8">
        <h1 className="text-3xl font-bold">{instructorName} — Analytics</h1>
        <p className="mt-1 text-muted-foreground">Revenue and enrollment data for this instructor</p>
      </div>

      <AnalyticsDashboard
        summary={summary}
        timeSeries={timeSeries}
        courseBreakdowns={courseBreakdowns}
        period={period}
      />
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
          : "You don't have permission to access this page.";
    } else if (error.status === 404) {
      title = "Instructor not found";
      message =
        typeof error.data === "string" ? error.data : "This instructor could not be found.";
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
          <Link to="/admin/users">
            <Button variant="outline">Manage Users</Button>
          </Link>
          <Link to="/">
            <Button>Go Home</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
