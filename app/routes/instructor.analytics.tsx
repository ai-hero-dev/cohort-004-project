import { useState } from "react";
import { Link, useNavigate } from "react-router";
import type { Route } from "./+types/instructor.analytics";
import { data, isRouteErrorResponse } from "react-router";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { AlertTriangle, ChevronDown, ChevronRight, BarChart2 } from "lucide-react";
import { getCurrentUserId } from "~/lib/session";
import { getUserById } from "~/services/userService";
import { UserRole } from "~/db/schema";
import {
  getInstructorSummary,
  getCourseSummaries,
  getCourseDetail,
} from "~/services/analyticsService";

export function meta() {
  return [
    { title: "Analytics — Cadence" },
    { name: "description", content: "Instructor analytics dashboard" },
  ];
}

type Preset = "7d" | "30d" | "90d" | "12m" | "all";

function presetToRange(preset: Preset): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString();
  switch (preset) {
    case "7d": {
      const from = new Date(now);
      from.setDate(from.getDate() - 7);
      return { from: from.toISOString(), to };
    }
    case "30d": {
      const from = new Date(now);
      from.setDate(from.getDate() - 30);
      return { from: from.toISOString(), to };
    }
    case "90d": {
      const from = new Date(now);
      from.setDate(from.getDate() - 90);
      return { from: from.toISOString(), to };
    }
    case "12m": {
      const from = new Date(now);
      from.setFullYear(from.getFullYear() - 1);
      return { from: from.toISOString(), to };
    }
    case "all":
      return { from: "2000-01-01T00:00:00.000Z", to };
  }
}

export async function loader({ request }: Route.LoaderArgs) {
  const currentUserId = await getCurrentUserId(request);

  if (!currentUserId) {
    throw data("Select a user from the DevUI panel to view analytics.", {
      status: 401,
    });
  }

  const currentUser = getUserById(currentUserId);

  if (!currentUser) {
    throw data("User not found.", { status: 401 });
  }

  if (
    currentUser.role !== UserRole.Instructor &&
    currentUser.role !== UserRole.Admin
  ) {
    throw data("Only instructors can access analytics.", { status: 403 });
  }

  const url = new URL(request.url);
  const presetParam = (url.searchParams.get("preset") as Preset) ?? "30d";
  const validPresets: Preset[] = ["7d", "30d", "90d", "12m", "all"];
  const preset = validPresets.includes(presetParam) ? presetParam : "30d";

  const instructorIdParam = url.searchParams.get("instructorId");
  let targetInstructorId = currentUserId;

  if (instructorIdParam && currentUser.role === UserRole.Admin) {
    const parsed = parseInt(instructorIdParam, 10);
    if (!isNaN(parsed)) {
      targetInstructorId = parsed;
    }
  }

  const dateRange = presetToRange(preset);

  const summary = getInstructorSummary({
    instructorId: targetInstructorId,
    dateRange,
  });

  const courseSummaries = getCourseSummaries({
    instructorId: targetInstructorId,
    dateRange,
  });

  const courseDetails = Object.fromEntries(
    courseSummaries.map((c) => [
      c.courseId,
      getCourseDetail({ courseId: c.courseId, dateRange }),
    ])
  );

  return { summary, courseSummaries, courseDetails, preset, dateRange };
}

function formatCurrency(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatPercent(rate: number | null) {
  if (rate === null) return "—";
  return `${Math.round(rate * 100)}%`;
}

function formatRating(avg: number | null) {
  if (avg === null) return "—";
  return avg.toFixed(1);
}

const PRESETS: { label: string; value: Preset }[] = [
  { label: "7 days", value: "7d" },
  { label: "30 days", value: "30d" },
  { label: "90 days", value: "90d" },
  { label: "12 months", value: "12m" },
  { label: "All time", value: "all" },
];

type CourseDetail = ReturnType<typeof getCourseDetail>;

function CourseDetailPanel({ detail }: { detail: CourseDetail }) {
  const hasRevenueData = detail.revenueTimeSeries.length > 0;
  const hasMonthlyData = detail.monthlyRevenue.length > 0;
  const hasEnrollmentData = detail.enrollmentsOverTime.length > 0;

  return (
    <div className="border-t bg-muted/30 p-4 space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-2 text-sm font-medium">Revenue over time</h4>
          {hasRevenueData ? (
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={detail.revenueTimeSeries}>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis
                  tickFormatter={(v) => `$${(v / 100).toFixed(0)}`}
                  tick={{ fontSize: 11 }}
                  width={50}
                />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Line type="monotone" dataKey="revenue" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground">No revenue data for this period.</p>
          )}
        </div>

        <div>
          <h4 className="mb-2 text-sm font-medium">Monthly revenue</h4>
          {hasMonthlyData ? (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={detail.monthlyRevenue}>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis
                  tickFormatter={(v) => `$${(v / 100).toFixed(0)}`}
                  tick={{ fontSize: 11 }}
                  width={50}
                />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Bar dataKey="revenue" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground">No monthly revenue data.</p>
          )}
        </div>

        <div>
          <h4 className="mb-2 text-sm font-medium">Enrollments over time</h4>
          {hasEnrollmentData ? (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={detail.enrollmentsOverTime}>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={30} />
                <Tooltip />
                <Bar dataKey="count" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground">No enrollment data for this period.</p>
          )}
        </div>

        <div>
          <h4 className="mb-2 text-sm font-medium">Average rating</h4>
          <p className="text-3xl font-bold">
            {detail.avgRating !== null ? (
              <>
                {detail.avgRating.toFixed(1)}{" "}
                <span className="text-base font-normal text-muted-foreground">/ 5</span>
              </>
            ) : (
              <span className="text-muted-foreground text-base font-normal">No ratings yet</span>
            )}
          </p>
        </div>
      </div>

      {detail.lessonCompletion.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-medium">Lesson completion</h4>
          <div className="space-y-1">
            {detail.lessonCompletion.map((l) => {
              const pct =
                l.totalAttempts > 0
                  ? Math.round((l.completedCount / l.totalAttempts) * 100)
                  : 0;
              return (
                <div key={l.lessonId} className="flex items-center gap-3 text-sm">
                  <span className="w-48 truncate text-muted-foreground">{l.title}</span>
                  <div className="h-2 flex-1 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-10 text-right">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {detail.quizPassRates.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-medium">Quiz pass rates</h4>
          <div className="space-y-1">
            {detail.quizPassRates.map((q) => {
              const pct =
                q.passRate !== null ? Math.round(q.passRate * 100) : null;
              return (
                <div key={q.quizId} className="flex items-center gap-3 text-sm">
                  <span className="w-48 truncate text-muted-foreground">{q.title}</span>
                  <div className="h-2 flex-1 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-green-500"
                      style={{ width: pct !== null ? `${pct}%` : "0%" }}
                    />
                  </div>
                  <span className="w-16 text-right">
                    {pct !== null ? `${pct}%` : "—"}{" "}
                    <span className="text-muted-foreground">({q.totalAttempts})</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function InstructorAnalytics({ loaderData }: Route.ComponentProps) {
  const { summary, courseSummaries, courseDetails, preset } = loaderData;
  const [expandedCourseId, setExpandedCourseId] = useState<number | null>(null);
  const navigate = useNavigate();

  function handlePreset(p: Preset) {
    const url = new URL(window.location.href);
    url.searchParams.set("preset", p);
    navigate(url.pathname + url.search);
  }

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground">Home</Link>
        <span className="mx-2">/</span>
        <Link to="/instructor" className="hover:text-foreground">My Courses</Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Analytics</span>
      </nav>

      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-3xl font-bold">Analytics</h1>
        <div className="flex gap-1 rounded-lg border p-1">
          {PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => handlePreset(p.value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                preset === p.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Total Revenue", value: formatCurrency(summary.totalRevenue) },
          { label: "Total Students", value: summary.totalStudents.toString() },
          { label: "Avg Rating", value: formatRating(summary.avgRating) },
          { label: "Completion Rate", value: formatPercent(summary.completionRate) },
          { label: "Progress Rate", value: formatPercent(summary.progressRate) },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <p className="mt-1 text-2xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      {courseSummaries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <BarChart2 className="mb-4 size-12 text-muted-foreground/50" />
          <h2 className="text-lg font-medium">No courses yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a course to start seeing analytics.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 w-6" />
                <th className="px-4 py-3">Course</th>
                <th className="px-4 py-3 text-right">Revenue</th>
                <th className="px-4 py-3 text-right">Students</th>
                <th className="px-4 py-3 text-right">Avg Rating</th>
                <th className="px-4 py-3 text-right">Completion</th>
              </tr>
            </thead>
            <tbody>
              {courseSummaries.map((course) => {
                const isExpanded = expandedCourseId === course.courseId;
                const detail = courseDetails[course.courseId];
                return (
                  <>
                    <tr
                      key={course.courseId}
                      className="border-b cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() =>
                        setExpandedCourseId(isExpanded ? null : course.courseId)
                      }
                    >
                      <td className="px-4 py-3 text-muted-foreground">
                        {isExpanded ? (
                          <ChevronDown className="size-4" />
                        ) : (
                          <ChevronRight className="size-4" />
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium">{course.title}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatCurrency(course.revenue)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {course.students}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatRating(course.avgRating)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatPercent(course.completionRate)}
                      </td>
                    </tr>
                    {isExpanded && detail && (
                      <tr key={`${course.courseId}-detail`}>
                        <td colSpan={6} className="p-0">
                          <CourseDetailPanel detail={detail} />
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Something went wrong";
  let message = "An unexpected error occurred while loading analytics.";

  if (isRouteErrorResponse(error)) {
    if (error.status === 401) {
      title = "Sign in required";
      message = typeof error.data === "string" ? error.data : "Please select a user.";
    } else if (error.status === 403) {
      title = "Access denied";
      message = typeof error.data === "string" ? error.data : "You don't have permission to view analytics.";
    }
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="text-center">
        <AlertTriangle className="mx-auto mb-4 size-12 text-muted-foreground" />
        <h1 className="mb-2 text-2xl font-bold">{title}</h1>
        <p className="mb-6 text-muted-foreground">{message}</p>
        <Link to="/instructor">
          <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            My Courses
          </button>
        </Link>
      </div>
    </div>
  );
}
