import { eq, and, sql } from "drizzle-orm";
import { db } from "~/db";
import {
  enrollments,
  courses,
} from "~/db/schema";

// ─── Enrollment Service ───
// Handles enrollment, unenrollment, duplicate prevention, and enrollment validation.
// Uses positional parameters (project convention).

export function getEnrollmentById(id: number) {
  return db.select().from(enrollments).where(eq(enrollments.id, id)).get();
}

export function getEnrollmentsByUser(userId: number) {
  return db
    .select()
    .from(enrollments)
    .where(eq(enrollments.userId, userId))
    .all();
}

export function getEnrollmentsByCourse(courseId: number) {
  return db
    .select()
    .from(enrollments)
    .where(eq(enrollments.courseId, courseId))
    .all();
}

export function getEnrollmentCountForCourse(courseId: number) {
  const result = db
    .select({ count: sql<number>`count(*)` })
    .from(enrollments)
    .where(eq(enrollments.courseId, courseId))
    .get();

  return result?.count ?? 0;
}

export function findEnrollment(opts: {
  userId: number;
  courseId: number;
}) {
  return db
    .select()
    .from(enrollments)
    .where(
      and(eq(enrollments.userId, opts.userId), eq(enrollments.courseId, opts.courseId))
    )
    .get();
}

export function isUserEnrolled(opts: {
  userId: number;
  courseId: number;
}) {
  return !!findEnrollment({ userId: opts.userId, courseId: opts.courseId });
}

export function enrollUser(opts: {
  userId: number;
  courseId: number;
  sendEmail: boolean;
  skipValidation: boolean;
}) {
  if (!opts.skipValidation) {
    // Check if already enrolled
    const existing = findEnrollment({ userId: opts.userId, courseId: opts.courseId });
    if (existing) {
      throw new Error("User is already enrolled in this course");
    }

    // Check that the course exists
    const course = db
      .select()
      .from(courses)
      .where(eq(courses.id, opts.courseId))
      .get();
    if (!course) {
      throw new Error("Course not found");
    }
  }

  const enrollment = db
    .insert(enrollments)
    .values({ userId: opts.userId, courseId: opts.courseId })
    .returning()
    .get();

  // sendEmail parameter accepted but not implemented (no email service — PRD out of scope)
  if (opts.sendEmail) {
    // Would send welcome email here
  }

  return enrollment;
}

export function unenrollUser(opts: {
  userId: number;
  courseId: number;
}) {
  const existing = findEnrollment({ userId: opts.userId, courseId: opts.courseId });
  if (!existing) {
    throw new Error("User is not enrolled in this course");
  }

  return db
    .delete(enrollments)
    .where(
      and(eq(enrollments.userId, opts.userId), eq(enrollments.courseId, opts.courseId))
    )
    .returning()
    .get();
}

export function markEnrollmentComplete(opts: {
  userId: number;
  courseId: number;
}) {
  return db
    .update(enrollments)
    .set({ completedAt: new Date().toISOString() })
    .where(
      and(eq(enrollments.userId, opts.userId), eq(enrollments.courseId, opts.courseId))
    )
    .returning()
    .get();
}

export function getUserEnrolledCourses(userId: number) {
  return db
    .select({
      enrollmentId: enrollments.id,
      courseId: enrollments.courseId,
      enrolledAt: enrollments.enrolledAt,
      completedAt: enrollments.completedAt,
      courseTitle: courses.title,
      courseSlug: courses.slug,
      courseDescription: courses.description,
      coverImageUrl: courses.coverImageUrl,
    })
    .from(enrollments)
    .innerJoin(courses, eq(enrollments.courseId, courses.id))
    .where(eq(enrollments.userId, userId))
    .all();
}

export function getCourseEnrolledStudents(courseId: number) {
  return db
    .select({
      enrollmentId: enrollments.id,
      userId: enrollments.userId,
      enrolledAt: enrollments.enrolledAt,
      completedAt: enrollments.completedAt,
    })
    .from(enrollments)
    .where(eq(enrollments.courseId, courseId))
    .all();
}
