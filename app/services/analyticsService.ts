import { db } from "~/db";
import { courses, purchases, enrollments, courseReviews } from "~/db/schema";
import { eq, and, gte, sql } from "drizzle-orm";

export type Period = "7d" | "30d" | "12m" | "all";

export type InstructorSummary = {
  totalRevenue: number;
  totalEnrollments: number;
  avgRating: number | null;
  ratingCount: number;
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
