import { db } from "~/db";
import {
  courses,
  purchases,
  enrollments,
  courseReviews,
  users,
} from "~/db/schema";
import { eq, and, gte, sql, desc } from "drizzle-orm";

export type Period = "7d" | "30d" | "12m" | "all";

export type InstructorSummary = {
  totalRevenue: number;
  totalEnrollments: number;
  avgRating: number | null;
  ratingCount: number;
};

export type PlatformSummary = {
  totalRevenue: number;
  totalEnrollments: number;
  topCourse: { title: string; revenue: number } | null;
};

export type RevenueDataPoint = {
  date: string;
  revenue: number;
};

export type CourseBreakdown = {
  courseId: number;
  title: string;
  listPrice: number;
  revenue: number;
  salesCount: number;
  enrollmentCount: number;
  avgRating: number | null;
  ratingCount: number;
};

export type PlatformCourseBreakdown = CourseBreakdown & {
  instructorName: string;
};

export type InstructorOption = {
  id: number;
  name: string;
};

function getPeriodCutoff(period: Period): string | null {
  if (period === "all") return null;
  const now = new Date();
  if (period === "7d") now.setDate(now.getDate() - 7);
  else if (period === "30d") now.setDate(now.getDate() - 30);
  else if (period === "12m") now.setMonth(now.getMonth() - 12);
  return now.toISOString();
}

export function getInstructorSummary(opts: {
  instructorId: number;
  period: Period;
}): InstructorSummary {
  const { instructorId, period } = opts;
  const cutoff = getPeriodCutoff(period);

  const revenueRow = db
    .select({ total: sql<number>`coalesce(sum(${purchases.pricePaid}), 0)` })
    .from(purchases)
    .innerJoin(courses, eq(purchases.courseId, courses.id))
    .where(
      and(
        eq(courses.instructorId, instructorId),
        cutoff ? gte(purchases.createdAt, cutoff) : undefined
      )
    )
    .get();

  const enrollmentRow = db
    .select({ count: sql<number>`count(*)` })
    .from(enrollments)
    .innerJoin(courses, eq(enrollments.courseId, courses.id))
    .where(
      and(
        eq(courses.instructorId, instructorId),
        cutoff ? gte(enrollments.enrolledAt, cutoff) : undefined
      )
    )
    .get();

  const ratingRow = db
    .select({
      avg: sql<number | null>`avg(${courseReviews.rating})`,
      count: sql<number>`count(*)`,
    })
    .from(courseReviews)
    .innerJoin(courses, eq(courseReviews.courseId, courses.id))
    .where(
      and(
        eq(courses.instructorId, instructorId),
        cutoff ? gte(courseReviews.createdAt, cutoff) : undefined
      )
    )
    .get();

  return {
    totalRevenue: revenueRow?.total ?? 0,
    totalEnrollments: enrollmentRow?.count ?? 0,
    avgRating: ratingRow?.avg ?? null,
    ratingCount: ratingRow?.count ?? 0,
  };
}

export function getRevenueTimeSeries(opts: {
  instructorId: number;
  period: Period;
}): RevenueDataPoint[] {
  const { instructorId, period } = opts;
  const isDaily = period === "7d" || period === "30d";

  if (isDaily) {
    const cutoff = getPeriodCutoff(period)!;
    const rows = db
      .select({
        date: sql<string>`strftime('%Y-%m-%d', ${purchases.createdAt})`,
        revenue: sql<number>`sum(${purchases.pricePaid})`,
      })
      .from(purchases)
      .innerJoin(courses, eq(purchases.courseId, courses.id))
      .where(
        and(
          eq(courses.instructorId, instructorId),
          gte(purchases.createdAt, cutoff)
        )
      )
      .groupBy(sql`strftime('%Y-%m-%d', ${purchases.createdAt})`)
      .all();

    const revenueByDate = new Map(rows.map((r) => [r.date, r.revenue]));
    const days = period === "7d" ? 7 : 30;
    const points: RevenueDataPoint[] = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      points.push({ date: dateStr, revenue: revenueByDate.get(dateStr) ?? 0 });
    }
    return points;
  }

  // Monthly granularity (12m or all)
  let startDate: Date;
  if (period === "12m") {
    startDate = new Date(getPeriodCutoff("12m")!);
  } else {
    const earliest = db
      .select({ date: sql<string | null>`min(${purchases.createdAt})` })
      .from(purchases)
      .innerJoin(courses, eq(purchases.courseId, courses.id))
      .where(eq(courses.instructorId, instructorId))
      .get();
    if (!earliest?.date) return [];
    startDate = new Date(earliest.date);
  }

  const cutoff = period === "12m" ? getPeriodCutoff("12m") : null;
  const rows = db
    .select({
      date: sql<string>`strftime('%Y-%m', ${purchases.createdAt})`,
      revenue: sql<number>`sum(${purchases.pricePaid})`,
    })
    .from(purchases)
    .innerJoin(courses, eq(purchases.courseId, courses.id))
    .where(
      and(
        eq(courses.instructorId, instructorId),
        cutoff ? gte(purchases.createdAt, cutoff) : undefined
      )
    )
    .groupBy(sql`strftime('%Y-%m', ${purchases.createdAt})`)
    .all();

  const revenueByMonth = new Map(rows.map((r) => [r.date, r.revenue]));
  const points: RevenueDataPoint[] = [];
  const now = new Date();
  const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 1);

  while (current <= end) {
    const monthStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`;
    points.push({ date: monthStr, revenue: revenueByMonth.get(monthStr) ?? 0 });
    current.setMonth(current.getMonth() + 1);
  }

  return points;
}

export function getCourseBreakdowns(opts: {
  instructorId: number;
  period: Period;
}): CourseBreakdown[] {
  const { instructorId, period } = opts;
  const cutoff = getPeriodCutoff(period);

  const courseRows = db
    .select({
      courseId: courses.id,
      title: courses.title,
      listPrice: courses.price,
    })
    .from(courses)
    .where(eq(courses.instructorId, instructorId))
    .all();

  if (courseRows.length === 0) return [];

  const purchaseRows = db
    .select({
      courseId: purchases.courseId,
      revenue: sql<number>`sum(${purchases.pricePaid})`,
      salesCount: sql<number>`count(*)`,
    })
    .from(purchases)
    .innerJoin(courses, eq(purchases.courseId, courses.id))
    .where(
      and(
        eq(courses.instructorId, instructorId),
        cutoff ? gte(purchases.createdAt, cutoff) : undefined
      )
    )
    .groupBy(purchases.courseId)
    .all();

  const enrollmentRows = db
    .select({
      courseId: enrollments.courseId,
      enrollmentCount: sql<number>`count(*)`,
    })
    .from(enrollments)
    .innerJoin(courses, eq(enrollments.courseId, courses.id))
    .where(
      and(
        eq(courses.instructorId, instructorId),
        cutoff ? gte(enrollments.enrolledAt, cutoff) : undefined
      )
    )
    .groupBy(enrollments.courseId)
    .all();

  const reviewRows = db
    .select({
      courseId: courseReviews.courseId,
      avgRating: sql<number | null>`avg(${courseReviews.rating})`,
      ratingCount: sql<number>`count(*)`,
    })
    .from(courseReviews)
    .innerJoin(courses, eq(courseReviews.courseId, courses.id))
    .where(
      and(
        eq(courses.instructorId, instructorId),
        cutoff ? gte(courseReviews.createdAt, cutoff) : undefined
      )
    )
    .groupBy(courseReviews.courseId)
    .all();

  const purchaseMap = new Map(purchaseRows.map((r) => [r.courseId, r]));
  const enrollmentMap = new Map(enrollmentRows.map((r) => [r.courseId, r]));
  const reviewMap = new Map(reviewRows.map((r) => [r.courseId, r]));

  return courseRows.map((c) => ({
    courseId: c.courseId,
    title: c.title,
    listPrice: c.listPrice,
    revenue: purchaseMap.get(c.courseId)?.revenue ?? 0,
    salesCount: purchaseMap.get(c.courseId)?.salesCount ?? 0,
    enrollmentCount: enrollmentMap.get(c.courseId)?.enrollmentCount ?? 0,
    avgRating: reviewMap.get(c.courseId)?.avgRating ?? null,
    ratingCount: reviewMap.get(c.courseId)?.ratingCount ?? 0,
  }));
}

// ─── Platform-wide (admin) analytics ───

export function getPlatformSummary(opts: { period: Period }): PlatformSummary {
  const cutoff = getPeriodCutoff(opts.period);

  const revenueRow = db
    .select({ total: sql<number>`coalesce(sum(${purchases.pricePaid}), 0)` })
    .from(purchases)
    .where(cutoff ? gte(purchases.createdAt, cutoff) : undefined)
    .get();

  const enrollmentRow = db
    .select({ count: sql<number>`count(*)` })
    .from(enrollments)
    .where(cutoff ? gte(enrollments.enrolledAt, cutoff) : undefined)
    .get();

  const topCourseRow = db
    .select({
      title: courses.title,
      revenue: sql<number>`coalesce(sum(${purchases.pricePaid}), 0)`,
    })
    .from(purchases)
    .innerJoin(courses, eq(purchases.courseId, courses.id))
    .where(cutoff ? gte(purchases.createdAt, cutoff) : undefined)
    .groupBy(purchases.courseId)
    .orderBy(desc(sql`sum(${purchases.pricePaid})`))
    .limit(1)
    .get();

  return {
    totalRevenue: revenueRow?.total ?? 0,
    totalEnrollments: enrollmentRow?.count ?? 0,
    topCourse: topCourseRow
      ? { title: topCourseRow.title, revenue: topCourseRow.revenue }
      : null,
  };
}

export function getPlatformRevenueTimeSeries(opts: {
  period: Period;
}): RevenueDataPoint[] {
  const { period } = opts;
  const isDaily = period === "7d" || period === "30d";

  if (isDaily) {
    const cutoff = getPeriodCutoff(period)!;
    const rows = db
      .select({
        date: sql<string>`strftime('%Y-%m-%d', ${purchases.createdAt})`,
        revenue: sql<number>`sum(${purchases.pricePaid})`,
      })
      .from(purchases)
      .where(gte(purchases.createdAt, cutoff))
      .groupBy(sql`strftime('%Y-%m-%d', ${purchases.createdAt})`)
      .all();

    const revenueByDate = new Map(rows.map((r) => [r.date, r.revenue]));
    const days = period === "7d" ? 7 : 30;
    const points: RevenueDataPoint[] = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      points.push({ date: dateStr, revenue: revenueByDate.get(dateStr) ?? 0 });
    }
    return points;
  }

  let startDate: Date;
  if (period === "12m") {
    startDate = new Date(getPeriodCutoff("12m")!);
  } else {
    const earliest = db
      .select({ date: sql<string | null>`min(${purchases.createdAt})` })
      .from(purchases)
      .get();
    if (!earliest?.date) return [];
    startDate = new Date(earliest.date);
  }

  const cutoff = period === "12m" ? getPeriodCutoff("12m") : null;
  const rows = db
    .select({
      date: sql<string>`strftime('%Y-%m', ${purchases.createdAt})`,
      revenue: sql<number>`sum(${purchases.pricePaid})`,
    })
    .from(purchases)
    .where(cutoff ? gte(purchases.createdAt, cutoff) : undefined)
    .groupBy(sql`strftime('%Y-%m', ${purchases.createdAt})`)
    .all();

  const revenueByMonth = new Map(rows.map((r) => [r.date, r.revenue]));
  const points: RevenueDataPoint[] = [];
  const now = new Date();
  const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 1);

  while (current <= end) {
    const monthStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`;
    points.push({ date: monthStr, revenue: revenueByMonth.get(monthStr) ?? 0 });
    current.setMonth(current.getMonth() + 1);
  }

  return points;
}

export function getInstructorsWithCourses(): InstructorOption[] {
  const rows = db
    .selectDistinct({
      id: users.id,
      name: users.name,
    })
    .from(users)
    .innerJoin(courses, eq(courses.instructorId, users.id))
    .orderBy(users.name)
    .all();

  return rows;
}

export function getPlatformCourseBreakdowns(opts: {
  period: Period;
  instructorId?: number;
}): PlatformCourseBreakdown[] {
  const { period, instructorId } = opts;
  const cutoff = getPeriodCutoff(period);

  const courseRows = db
    .select({
      courseId: courses.id,
      title: courses.title,
      listPrice: courses.price,
      instructorName: users.name,
    })
    .from(courses)
    .innerJoin(users, eq(courses.instructorId, users.id))
    .where(instructorId ? eq(courses.instructorId, instructorId) : undefined)
    .all();

  if (courseRows.length === 0) return [];

  const courseIds = courseRows.map((c) => c.courseId);

  const purchaseRows = db
    .select({
      courseId: purchases.courseId,
      revenue: sql<number>`sum(${purchases.pricePaid})`,
      salesCount: sql<number>`count(*)`,
    })
    .from(purchases)
    .where(
      and(
        sql`${purchases.courseId} IN (${sql.join(
          courseIds.map((id) => sql`${id}`),
          sql`, `
        )})`,
        cutoff ? gte(purchases.createdAt, cutoff) : undefined
      )
    )
    .groupBy(purchases.courseId)
    .all();

  const enrollmentRows = db
    .select({
      courseId: enrollments.courseId,
      enrollmentCount: sql<number>`count(*)`,
    })
    .from(enrollments)
    .where(
      and(
        sql`${enrollments.courseId} IN (${sql.join(
          courseIds.map((id) => sql`${id}`),
          sql`, `
        )})`,
        cutoff ? gte(enrollments.enrolledAt, cutoff) : undefined
      )
    )
    .groupBy(enrollments.courseId)
    .all();

  const reviewRows = db
    .select({
      courseId: courseReviews.courseId,
      avgRating: sql<number | null>`avg(${courseReviews.rating})`,
      ratingCount: sql<number>`count(*)`,
    })
    .from(courseReviews)
    .where(
      and(
        sql`${courseReviews.courseId} IN (${sql.join(
          courseIds.map((id) => sql`${id}`),
          sql`, `
        )})`,
        cutoff ? gte(courseReviews.createdAt, cutoff) : undefined
      )
    )
    .groupBy(courseReviews.courseId)
    .all();

  const purchaseMap = new Map(purchaseRows.map((r) => [r.courseId, r]));
  const enrollmentMap = new Map(enrollmentRows.map((r) => [r.courseId, r]));
  const reviewMap = new Map(reviewRows.map((r) => [r.courseId, r]));

  return courseRows.map((c) => ({
    courseId: c.courseId,
    title: c.title,
    listPrice: c.listPrice,
    instructorName: c.instructorName,
    revenue: purchaseMap.get(c.courseId)?.revenue ?? 0,
    salesCount: purchaseMap.get(c.courseId)?.salesCount ?? 0,
    enrollmentCount: enrollmentMap.get(c.courseId)?.enrollmentCount ?? 0,
    avgRating: reviewMap.get(c.courseId)?.avgRating ?? null,
    ratingCount: reviewMap.get(c.courseId)?.ratingCount ?? 0,
  }));
}
