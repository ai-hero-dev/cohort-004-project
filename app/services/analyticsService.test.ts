import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";

let testDb: ReturnType<typeof createTestDb>;
let base: ReturnType<typeof seedBaseData>;

vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

import {
  getInstructorSummary,
  getCourseSummaries,
  getCourseDetail,
} from "./analyticsService";

const RANGE_ALL = { from: "2000-01-01", to: "2099-12-31" };
const RANGE_2024 = { from: "2024-01-01", to: "2024-12-31" };
const RANGE_2025 = { from: "2025-01-01", to: "2025-12-31" };

describe("analyticsService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  describe("getInstructorSummary", () => {
    it("returns zeros and nulls when the instructor has no courses", () => {
      const otherInstructor = testDb
        .insert(schema.users)
        .values({
          name: "Empty Instructor",
          email: "empty@example.com",
          role: schema.UserRole.Instructor,
        })
        .returning()
        .get();

      const result = getInstructorSummary({
        instructorId: otherInstructor.id,
        dateRange: RANGE_ALL,
      });

      expect(result.totalRevenue).toBe(0);
      expect(result.totalStudents).toBe(0);
      expect(result.avgRating).toBeNull();
      expect(result.completionRate).toBeNull();
      expect(result.progressRate).toBeNull();
    });

    it("sums revenue from purchases within the date range", () => {
      testDb
        .insert(schema.purchases)
        .values({ userId: base.user.id, courseId: base.course.id, pricePaid: 2000, createdAt: "2024-06-01T00:00:00.000Z" })
        .run();
      testDb
        .insert(schema.purchases)
        .values({ userId: base.user.id, courseId: base.course.id, pricePaid: 3000, createdAt: "2024-09-15T00:00:00.000Z" })
        .run();
      // Outside range
      testDb
        .insert(schema.purchases)
        .values({ userId: base.user.id, courseId: base.course.id, pricePaid: 9999, createdAt: "2025-01-01T00:00:00.000Z" })
        .run();

      const result = getInstructorSummary({
        instructorId: base.instructor.id,
        dateRange: RANGE_2024,
      });

      expect(result.totalRevenue).toBe(5000);
    });

    it("excludes revenue from purchases before the date range", () => {
      testDb
        .insert(schema.purchases)
        .values({ userId: base.user.id, courseId: base.course.id, pricePaid: 1000, createdAt: "2023-12-31T23:59:59.000Z" })
        .run();

      const result = getInstructorSummary({
        instructorId: base.instructor.id,
        dateRange: RANGE_2024,
      });

      expect(result.totalRevenue).toBe(0);
    });

    it("counts distinct students enrolled within the date range", () => {
      const user2 = testDb
        .insert(schema.users)
        .values({ name: "Student 2", email: "s2@example.com", role: schema.UserRole.Student })
        .returning()
        .get();

      testDb.insert(schema.enrollments).values({ userId: base.user.id, courseId: base.course.id, enrolledAt: "2024-03-01T00:00:00.000Z" }).run();
      testDb.insert(schema.enrollments).values({ userId: user2.id, courseId: base.course.id, enrolledAt: "2024-06-01T00:00:00.000Z" }).run();
      // Outside range
      testDb.insert(schema.enrollments).values({
        userId: base.user.id,
        courseId: base.course.id,
        enrolledAt: "2025-01-01T00:00:00.000Z",
      }).run();

      const result = getInstructorSummary({
        instructorId: base.instructor.id,
        dateRange: RANGE_2024,
      });

      expect(result.totalStudents).toBe(2);
    });

    it("calculates completion rate correctly", () => {
      testDb.insert(schema.enrollments).values({ userId: base.user.id, courseId: base.course.id, enrolledAt: "2024-01-01T00:00:00.000Z", completedAt: "2024-02-01T00:00:00.000Z" }).run();

      const user2 = testDb
        .insert(schema.users)
        .values({ name: "Student 2", email: "s2@example.com", role: schema.UserRole.Student })
        .returning()
        .get();
      testDb.insert(schema.enrollments).values({ userId: user2.id, courseId: base.course.id, enrolledAt: "2024-03-01T00:00:00.000Z" }).run();

      const result = getInstructorSummary({
        instructorId: base.instructor.id,
        dateRange: RANGE_2024,
      });

      expect(result.completionRate).toBeCloseTo(0.5);
    });

    it("returns null completionRate when there are no enrollments in range", () => {
      const result = getInstructorSummary({
        instructorId: base.instructor.id,
        dateRange: RANGE_2024,
      });

      expect(result.completionRate).toBeNull();
    });

    it("calculates progress rate from lessonProgress records", () => {
      const mod = testDb
        .insert(schema.modules)
        .values({ courseId: base.course.id, title: "Module 1", position: 1 })
        .returning()
        .get();
      const lesson = testDb
        .insert(schema.lessons)
        .values({ moduleId: mod.id, title: "Lesson 1", position: 1 })
        .returning()
        .get();

      testDb.insert(schema.enrollments).values({ userId: base.user.id, courseId: base.course.id, enrolledAt: "2024-01-01T00:00:00.000Z" }).run();

      const user2 = testDb
        .insert(schema.users)
        .values({ name: "Student 2", email: "s2@example.com", role: schema.UserRole.Student })
        .returning()
        .get();
      testDb.insert(schema.enrollments).values({ userId: user2.id, courseId: base.course.id, enrolledAt: "2024-01-01T00:00:00.000Z" }).run();

      // Only user has started the lesson
      testDb.insert(schema.lessonProgress).values({ userId: base.user.id, lessonId: lesson.id, status: schema.LessonProgressStatus.InProgress }).run();

      const result = getInstructorSummary({
        instructorId: base.instructor.id,
        dateRange: RANGE_2024,
      });

      expect(result.progressRate).toBeCloseTo(0.5);
    });

    it("only includes courses belonging to the target instructor", () => {
      const otherInstructor = testDb
        .insert(schema.users)
        .values({ name: "Other Instructor", email: "other@example.com", role: schema.UserRole.Instructor })
        .returning()
        .get();
      const otherCourse = testDb
        .insert(schema.courses)
        .values({ title: "Other Course", slug: "other-course", description: "desc", instructorId: otherInstructor.id, categoryId: base.category.id, status: schema.CourseStatus.Published })
        .returning()
        .get();

      testDb.insert(schema.purchases).values({ userId: base.user.id, courseId: otherCourse.id, pricePaid: 9999, createdAt: "2024-06-01T00:00:00.000Z" }).run();

      const result = getInstructorSummary({
        instructorId: base.instructor.id,
        dateRange: RANGE_2024,
      });

      expect(result.totalRevenue).toBe(0);
    });
  });

  describe("getCourseSummaries", () => {
    it("returns empty array when instructor has no courses", () => {
      const otherInstructor = testDb
        .insert(schema.users)
        .values({ name: "Empty", email: "emp@example.com", role: schema.UserRole.Instructor })
        .returning()
        .get();

      const result = getCourseSummaries({
        instructorId: otherInstructor.id,
        dateRange: RANGE_ALL,
      });

      expect(result).toHaveLength(0);
    });

    it("returns a row per course with correct revenue", () => {
      testDb.insert(schema.purchases).values({ userId: base.user.id, courseId: base.course.id, pricePaid: 1500, createdAt: "2024-05-01T00:00:00.000Z" }).run();

      const result = getCourseSummaries({
        instructorId: base.instructor.id,
        dateRange: RANGE_2024,
      });

      expect(result).toHaveLength(1);
      expect(result[0].courseId).toBe(base.course.id);
      expect(result[0].revenue).toBe(1500);
    });

    it("does not include courses from other instructors", () => {
      const otherInstructor = testDb
        .insert(schema.users)
        .values({ name: "Other", email: "other2@example.com", role: schema.UserRole.Instructor })
        .returning()
        .get();
      testDb
        .insert(schema.courses)
        .values({ title: "Their Course", slug: "their-course", description: "d", instructorId: otherInstructor.id, categoryId: base.category.id, status: schema.CourseStatus.Published })
        .run();

      const result = getCourseSummaries({
        instructorId: base.instructor.id,
        dateRange: RANGE_ALL,
      });

      expect(result.every((r) => r.courseId === base.course.id)).toBe(true);
    });

    it("calculates per-course completion rate", () => {
      testDb.insert(schema.enrollments).values({ userId: base.user.id, courseId: base.course.id, enrolledAt: "2024-01-01T00:00:00.000Z", completedAt: "2024-03-01T00:00:00.000Z" }).run();

      const result = getCourseSummaries({
        instructorId: base.instructor.id,
        dateRange: RANGE_2024,
      });

      expect(result[0].completionRate).toBe(1);
    });
  });

  describe("getCourseDetail", () => {
    it("returns empty arrays when there is no data", () => {
      const result = getCourseDetail({
        courseId: base.course.id,
        dateRange: RANGE_ALL,
      });

      expect(result.revenueTimeSeries).toHaveLength(0);
      expect(result.monthlyRevenue).toHaveLength(0);
      expect(result.enrollmentsOverTime).toHaveLength(0);
      expect(result.lessonCompletion).toHaveLength(0);
      expect(result.quizPassRates).toHaveLength(0);
      expect(result.avgRating).toBeNull();
    });

    it("groups revenue by day in revenueTimeSeries", () => {
      testDb.insert(schema.purchases).values({ userId: base.user.id, courseId: base.course.id, pricePaid: 1000, createdAt: "2024-06-01T10:00:00.000Z" }).run();
      testDb.insert(schema.purchases).values({ userId: base.user.id, courseId: base.course.id, pricePaid: 500, createdAt: "2024-06-01T15:00:00.000Z" }).run();
      testDb.insert(schema.purchases).values({ userId: base.user.id, courseId: base.course.id, pricePaid: 2000, createdAt: "2024-06-15T00:00:00.000Z" }).run();

      const result = getCourseDetail({
        courseId: base.course.id,
        dateRange: RANGE_2024,
      });

      expect(result.revenueTimeSeries).toHaveLength(2);
      expect(result.revenueTimeSeries[0].revenue).toBe(1500);
      expect(result.revenueTimeSeries[1].revenue).toBe(2000);
    });

    it("groups revenue by month in monthlyRevenue", () => {
      testDb.insert(schema.purchases).values({ userId: base.user.id, courseId: base.course.id, pricePaid: 1000, createdAt: "2024-06-01T00:00:00.000Z" }).run();
      testDb.insert(schema.purchases).values({ userId: base.user.id, courseId: base.course.id, pricePaid: 2000, createdAt: "2024-07-01T00:00:00.000Z" }).run();

      const result = getCourseDetail({
        courseId: base.course.id,
        dateRange: RANGE_2024,
      });

      expect(result.monthlyRevenue).toHaveLength(2);
      expect(result.monthlyRevenue[0].month).toBe("2024-06");
      expect(result.monthlyRevenue[1].month).toBe("2024-07");
    });

    it("excludes revenue outside the date range", () => {
      testDb.insert(schema.purchases).values({ userId: base.user.id, courseId: base.course.id, pricePaid: 999, createdAt: "2025-01-01T00:00:00.000Z" }).run();

      const result = getCourseDetail({
        courseId: base.course.id,
        dateRange: RANGE_2024,
      });

      expect(result.revenueTimeSeries).toHaveLength(0);
    });

    it("includes lesson completion breakdown", () => {
      const mod = testDb
        .insert(schema.modules)
        .values({ courseId: base.course.id, title: "M1", position: 1 })
        .returning()
        .get();
      const lesson = testDb
        .insert(schema.lessons)
        .values({ moduleId: mod.id, title: "Lesson 1", position: 1 })
        .returning()
        .get();

      testDb.insert(schema.lessonProgress).values({ userId: base.user.id, lessonId: lesson.id, status: schema.LessonProgressStatus.Completed }).run();

      const result = getCourseDetail({
        courseId: base.course.id,
        dateRange: RANGE_ALL,
      });

      expect(result.lessonCompletion).toHaveLength(1);
      expect(result.lessonCompletion[0].completedCount).toBe(1);
    });

    it("calculates quiz pass rates", () => {
      const mod = testDb
        .insert(schema.modules)
        .values({ courseId: base.course.id, title: "M1", position: 1 })
        .returning()
        .get();
      const lesson = testDb
        .insert(schema.lessons)
        .values({ moduleId: mod.id, title: "L1", position: 1 })
        .returning()
        .get();
      const quiz = testDb
        .insert(schema.quizzes)
        .values({ lessonId: lesson.id, title: "Quiz 1", passingScore: 0.7 })
        .returning()
        .get();

      testDb.insert(schema.quizAttempts).values({ userId: base.user.id, quizId: quiz.id, score: 0.8, passed: true }).run();
      testDb.insert(schema.quizAttempts).values({ userId: base.user.id, quizId: quiz.id, score: 0.4, passed: false }).run();

      const result = getCourseDetail({
        courseId: base.course.id,
        dateRange: RANGE_ALL,
      });

      expect(result.quizPassRates).toHaveLength(1);
      expect(result.quizPassRates[0].passRate).toBeCloseTo(0.5);
      expect(result.quizPassRates[0].totalAttempts).toBe(2);
    });

    it("returns avgRating from courseRatings", () => {
      testDb.insert(schema.courseRatings).values({ userId: base.user.id, courseId: base.course.id, rating: 4 }).run();

      const result = getCourseDetail({
        courseId: base.course.id,
        dateRange: RANGE_ALL,
      });

      expect(result.avgRating).toBe(4);
    });
  });
});
