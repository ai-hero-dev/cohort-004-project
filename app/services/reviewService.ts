import { eq, sql, and } from "drizzle-orm";
import { db } from "~/db";
import { courseReviews } from "~/db/schema";

export function upsertReview(userId: number, courseId: number, rating: number) {
  return db
    .insert(courseReviews)
    .values({ userId, courseId, rating, updatedAt: new Date().toISOString() })
    .onConflictDoUpdate({
      target: [courseReviews.userId, courseReviews.courseId],
      set: { rating, updatedAt: new Date().toISOString() },
    })
    .returning()
    .get();
}

export function getCourseRating(courseId: number) {
  const result = db
    .select({
      average: sql<number | null>`avg(${courseReviews.rating})`,
      count: sql<number>`count(*)`,
    })
    .from(courseReviews)
    .where(eq(courseReviews.courseId, courseId))
    .get();

  return { average: result?.average ?? null, count: result?.count ?? 0 };
}

export function getUserReviewForCourse(userId: number, courseId: number) {
  return (
    db
      .select()
      .from(courseReviews)
      .where(
        and(
          eq(courseReviews.userId, userId),
          eq(courseReviews.courseId, courseId)
        )
      )
      .get() ?? null
  );
}
