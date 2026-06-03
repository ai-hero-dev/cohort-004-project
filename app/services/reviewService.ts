import { eq, sql, and, inArray } from "drizzle-orm";
import { db } from "~/db";
import { courseReviews } from "~/db/schema";

export function getCourseRating(courseId: number) {
  const result = db
    .select({
      averageRating: sql<number | null>`avg(${courseReviews.rating})`,
      count: sql<number>`count(*)`,
    })
    .from(courseReviews)
    .where(eq(courseReviews.courseId, courseId))
    .get();

  return {
    averageRating: result?.averageRating ?? null,
    count: result?.count ?? 0,
  };
}

export function getUserCourseRating(
  userId: number,
  courseId: number
): number | null {
  const result = db
    .select({ rating: courseReviews.rating })
    .from(courseReviews)
    .where(
      and(
        eq(courseReviews.userId, userId),
        eq(courseReviews.courseId, courseId)
      )
    )
    .get();

  return result?.rating ?? null;
}

export function upsertCourseReview(
  userId: number,
  courseId: number,
  rating: number
) {
  return db
    .insert(courseReviews)
    .values({ userId, courseId, rating })
    .onConflictDoUpdate({
      target: [courseReviews.userId, courseReviews.courseId],
      set: { rating, updatedAt: new Date().toISOString() },
    })
    .run();
}

export function getCourseRatingsBulk(
  courseIds: number[]
): Map<number, { averageRating: number; count: number }> {
  if (courseIds.length === 0) return new Map();

  const results = db
    .select({
      courseId: courseReviews.courseId,
      averageRating: sql<number>`avg(${courseReviews.rating})`,
      count: sql<number>`count(*)`,
    })
    .from(courseReviews)
    .where(inArray(courseReviews.courseId, courseIds))
    .groupBy(courseReviews.courseId)
    .all();

  const map = new Map<number, { averageRating: number; count: number }>();
  for (const result of results) {
    map.set(result.courseId, {
      averageRating: result.averageRating,
      count: result.count,
    });
  }
  return map;
}
