import { eq, and, inArray, sql } from "drizzle-orm";
import { db } from "~/db";
import { courseReviews } from "~/db/schema";

// ─── Course Review Service ───
// Handles star-rating reviews (one per user+course, editable) and rating aggregates.
// Uses positional parameters (project convention).

export function findReview(userId: number, courseId: number) {
  return db
    .select()
    .from(courseReviews)
    .where(
      and(
        eq(courseReviews.userId, userId),
        eq(courseReviews.courseId, courseId)
      )
    )
    .get();
}

export function upsertReview(userId: number, courseId: number, rating: number) {
  const existing = findReview(userId, courseId);

  if (existing) {
    return db
      .update(courseReviews)
      .set({ rating, updatedAt: new Date().toISOString() })
      .where(eq(courseReviews.id, existing.id))
      .returning()
      .get();
  }

  return db
    .insert(courseReviews)
    .values({ userId, courseId, rating })
    .returning()
    .get();
}

export function getAverageRatingForCourse(courseId: number) {
  const result = db
    .select({
      average: sql<number>`avg(${courseReviews.rating})`,
      count: sql<number>`count(*)`,
    })
    .from(courseReviews)
    .where(eq(courseReviews.courseId, courseId))
    .get();

  return {
    average: result?.average ?? 0,
    count: result?.count ?? 0,
  };
}

export function getAverageRatingsForCourses(courseIds: number[]) {
  const map = new Map<number, { average: number; count: number }>();

  if (courseIds.length === 0) return map;

  const rows = db
    .select({
      courseId: courseReviews.courseId,
      average: sql<number>`avg(${courseReviews.rating})`,
      count: sql<number>`count(*)`,
    })
    .from(courseReviews)
    .where(inArray(courseReviews.courseId, courseIds))
    .groupBy(courseReviews.courseId)
    .all();

  for (const row of rows) {
    map.set(row.courseId, { average: row.average, count: row.count });
  }

  return map;
}
