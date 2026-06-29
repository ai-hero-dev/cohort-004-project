import { eq, and, gte, lte, inArray, or } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db } from "~/db";
import {
  courses,
  purchases,
  enrollments,
  lessonProgress,
  courseRatings,
  quizAttempts,
  quizzes,
  lessons,
  modules,
  LessonProgressStatus,
} from "~/db/schema";

type DateRange = { from: string; to: string };

function getLessonIdsForCourse(courseId: number): number[] {
  const rows = db
    .select({ id: lessons.id })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(eq(modules.courseId, courseId))
    .all();
  return rows.map((r) => r.id);
}

export function getInstructorSummary(opts: {
  instructorId: number;
  dateRange: DateRange;
}) {
  const { instructorId, dateRange } = opts;

  const instructorCourses = db
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.instructorId, instructorId))
    .all();

  const courseIds = instructorCourses.map((c) => c.id);

  if (courseIds.length === 0) {
    return {
      totalRevenue: 0,
      totalStudents: 0,
      avgRating: null,
      completionRate: null,
      progressRate: null,
    };
  }

  const revenueRow = db
    .select({ total: sql<number>`COALESCE(SUM(${purchases.pricePaid}), 0)` })
    .from(purchases)
    .where(
      and(
        inArray(purchases.courseId, courseIds),
        gte(purchases.createdAt, dateRange.from),
        lte(purchases.createdAt, dateRange.to)
      )
    )
    .get();

  const enrollmentRows = db
    .select({
      userId: enrollments.userId,
      completedAt: enrollments.completedAt,
    })
    .from(enrollments)
    .where(
      and(
        inArray(enrollments.courseId, courseIds),
        gte(enrollments.enrolledAt, dateRange.from),
        lte(enrollments.enrolledAt, dateRange.to)
      )
    )
    .all();

  const ratingRow = db
    .select({ avg: sql<number | null>`AVG(${courseRatings.rating})` })
    .from(courseRatings)
    .where(inArray(courseRatings.courseId, courseIds))
    .get();

  const totalStudents = new Set(enrollmentRows.map((r) => r.userId)).size;
  const completionRate =
    enrollmentRows.length > 0
      ? enrollmentRows.filter((e) => e.completedAt !== null).length /
        enrollmentRows.length
      : null;

  const enrolledUserIds = [...new Set(enrollmentRows.map((e) => e.userId))];
  let progressRate: number | null = null;

  if (enrolledUserIds.length > 0) {
    const allLessonIds = courseIds.flatMap(getLessonIdsForCourse);
    if (allLessonIds.length > 0) {
      const progressRows = db
        .select({ userId: lessonProgress.userId })
        .from(lessonProgress)
        .where(
          and(
            inArray(lessonProgress.lessonId, allLessonIds),
            inArray(lessonProgress.userId, enrolledUserIds),
            or(
              eq(lessonProgress.status, LessonProgressStatus.InProgress),
              eq(lessonProgress.status, LessonProgressStatus.Completed)
            )
          )
        )
        .all();
      const activeUsers = new Set(progressRows.map((r) => r.userId));
      progressRate = activeUsers.size / enrolledUserIds.length;
    }
  }

  return {
    totalRevenue: revenueRow?.total ?? 0,
    totalStudents,
    avgRating: ratingRow?.avg ?? null,
    completionRate,
    progressRate,
  };
}

export function getCourseSummaries(opts: {
  instructorId: number;
  dateRange: DateRange;
}) {
  const { instructorId, dateRange } = opts;

  const instructorCourses = db
    .select()
    .from(courses)
    .where(eq(courses.instructorId, instructorId))
    .all();

  return instructorCourses.map((course) => {
    const revenueRow = db
      .select({ total: sql<number>`COALESCE(SUM(${purchases.pricePaid}), 0)` })
      .from(purchases)
      .where(
        and(
          eq(purchases.courseId, course.id),
          gte(purchases.createdAt, dateRange.from),
          lte(purchases.createdAt, dateRange.to)
        )
      )
      .get();

    const enrollmentRows = db
      .select({
        userId: enrollments.userId,
        completedAt: enrollments.completedAt,
      })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.courseId, course.id),
          gte(enrollments.enrolledAt, dateRange.from),
          lte(enrollments.enrolledAt, dateRange.to)
        )
      )
      .all();

    const ratingRow = db
      .select({ avg: sql<number | null>`AVG(${courseRatings.rating})` })
      .from(courseRatings)
      .where(eq(courseRatings.courseId, course.id))
      .get();

    const students = new Set(enrollmentRows.map((r) => r.userId)).size;
    const completionRate =
      enrollmentRows.length > 0
        ? enrollmentRows.filter((e) => e.completedAt !== null).length /
          enrollmentRows.length
        : null;

    return {
      courseId: course.id,
      title: course.title,
      slug: course.slug,
      revenue: revenueRow?.total ?? 0,
      students,
      avgRating: ratingRow?.avg ?? null,
      completionRate,
    };
  });
}

export function getCourseDetail(opts: {
  courseId: number;
  dateRange: DateRange;
}) {
  const { courseId, dateRange } = opts;

  const revenueTimeSeries = db
    .select({
      date: sql<string>`DATE(${purchases.createdAt})`,
      revenue: sql<number>`SUM(${purchases.pricePaid})`,
    })
    .from(purchases)
    .where(
      and(
        eq(purchases.courseId, courseId),
        gte(purchases.createdAt, dateRange.from),
        lte(purchases.createdAt, dateRange.to)
      )
    )
    .groupBy(sql`DATE(${purchases.createdAt})`)
    .orderBy(sql`DATE(${purchases.createdAt})`)
    .all();

  const monthlyRevenue = db
    .select({
      month: sql<string>`STRFTIME('%Y-%m', ${purchases.createdAt})`,
      revenue: sql<number>`SUM(${purchases.pricePaid})`,
    })
    .from(purchases)
    .where(
      and(
        eq(purchases.courseId, courseId),
        gte(purchases.createdAt, dateRange.from),
        lte(purchases.createdAt, dateRange.to)
      )
    )
    .groupBy(sql`STRFTIME('%Y-%m', ${purchases.createdAt})`)
    .orderBy(sql`STRFTIME('%Y-%m', ${purchases.createdAt})`)
    .all();

  const enrollmentsOverTime = db
    .select({
      date: sql<string>`DATE(${enrollments.enrolledAt})`,
      count: sql<number>`COUNT(*)`,
    })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.courseId, courseId),
        gte(enrollments.enrolledAt, dateRange.from),
        lte(enrollments.enrolledAt, dateRange.to)
      )
    )
    .groupBy(sql`DATE(${enrollments.enrolledAt})`)
    .orderBy(sql`DATE(${enrollments.enrolledAt})`)
    .all();

  const lessonIds = getLessonIdsForCourse(courseId);

  let lessonCompletion: Array<{
    lessonId: number;
    title: string;
    completedCount: number;
    totalAttempts: number;
  }> = [];

  if (lessonIds.length > 0) {
    const lessonRows = db
      .select({ id: lessons.id, title: lessons.title })
      .from(lessons)
      .where(inArray(lessons.id, lessonIds))
      .all();

    lessonCompletion = lessonRows.map((lesson) => {
      const progressRows = db
        .select({ status: lessonProgress.status })
        .from(lessonProgress)
        .where(eq(lessonProgress.lessonId, lesson.id))
        .all();
      return {
        lessonId: lesson.id,
        title: lesson.title,
        completedCount: progressRows.filter(
          (p) => p.status === LessonProgressStatus.Completed
        ).length,
        totalAttempts: progressRows.length,
      };
    });
  }

  let quizPassRates: Array<{
    quizId: number;
    title: string;
    passRate: number | null;
    totalAttempts: number;
  }> = [];

  if (lessonIds.length > 0) {
    const quizRows = db
      .select({ id: quizzes.id, title: quizzes.title })
      .from(quizzes)
      .where(inArray(quizzes.lessonId, lessonIds))
      .all();

    quizPassRates = quizRows.map((quiz) => {
      const attempts = db
        .select({ passed: quizAttempts.passed })
        .from(quizAttempts)
        .where(eq(quizAttempts.quizId, quiz.id))
        .all();
      return {
        quizId: quiz.id,
        title: quiz.title,
        passRate:
          attempts.length > 0
            ? attempts.filter((a) => a.passed).length / attempts.length
            : null,
        totalAttempts: attempts.length,
      };
    });
  }

  const ratingRow = db
    .select({ avg: sql<number | null>`AVG(${courseRatings.rating})` })
    .from(courseRatings)
    .where(eq(courseRatings.courseId, courseId))
    .get();

  return {
    revenueTimeSeries,
    monthlyRevenue,
    enrollmentsOverTime,
    lessonCompletion,
    quizPassRates,
    avgRating: ratingRow?.avg ?? null,
  };
}
