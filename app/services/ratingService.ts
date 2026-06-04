import { eq, and, inArray, sql } from "drizzle-orm";
import { db } from "~/db";
import { courseRatings } from "~/db/schema";

export function getUserRating(userId: number, courseId: number) {
  return db
    .select()
    .from(courseRatings)
    .where(
      and(eq(courseRatings.userId, userId), eq(courseRatings.courseId, courseId))
    )
    .get();
}

export function getAverageRating(courseId: number) {
  return db
    .select({
      average: sql<number>`ROUND(AVG(${courseRatings.rating}), 1)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(courseRatings)
    .where(eq(courseRatings.courseId, courseId))
    .get();
}

export function getAverageRatingsForCourses(courseIds: number[]) {
  if (courseIds.length === 0) return {} as Record<number, { average: number; count: number }>;

  const results = db
    .select({
      courseId: courseRatings.courseId,
      average: sql<number>`ROUND(AVG(${courseRatings.rating}), 1)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(courseRatings)
    .where(inArray(courseRatings.courseId, courseIds))
    .groupBy(courseRatings.courseId)
    .all();

  return Object.fromEntries(
    results.map((r) => [r.courseId, { average: r.average, count: r.count }])
  ) as Record<number, { average: number; count: number }>;
}

export function submitRating(userId: number, courseId: number, rating: number) {
  return db
    .insert(courseRatings)
    .values({ userId, courseId, rating, updatedAt: new Date().toISOString() })
    .onConflictDoUpdate({
      target: [courseRatings.userId, courseRatings.courseId],
      set: { rating, updatedAt: new Date().toISOString() },
    })
    .returning()
    .get();
}
