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

import { getInstructorSummary } from "./analyticsService";

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function monthsAgo(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString();
}

describe("analyticsService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  // ─── getInstructorSummary ───

  describe("getInstructorSummary", () => {
    it("returns zeros when instructor has no data", () => {
      const result = getInstructorSummary({ instructorId: base.instructor.id, period: "30d" });
      expect(result.totalRevenue).toBe(0);
      expect(result.totalEnrollments).toBe(0);
      expect(result.avgRating).toBeNull();
      expect(result.ratingCount).toBe(0);
    });

    // ─── Revenue ───

    it("sums revenue from purchases within the period", () => {
      testDb.insert(schema.purchases).values({ userId: base.user.id, courseId: base.course.id, pricePaid: 4999, country: null }).run();
      testDb.insert(schema.purchases).values({ userId: base.user.id, courseId: base.course.id, pricePaid: 2999, country: null }).run();

      const result = getInstructorSummary({ instructorId: base.instructor.id, period: "30d" });
      expect(result.totalRevenue).toBe(7998);
    });

    it("excludes purchases older than the period", () => {
      testDb.insert(schema.purchases).values({ userId: base.user.id, courseId: base.course.id, pricePaid: 9999, country: null, createdAt: daysAgo(45) }).run();

      const result = getInstructorSummary({ instructorId: base.instructor.id, period: "30d" });
      expect(result.totalRevenue).toBe(0);
    });

    it("includes purchases within the 7d period and excludes older ones", () => {
      testDb.insert(schema.purchases).values({ userId: base.user.id, courseId: base.course.id, pricePaid: 1000, country: null }).run();
      testDb.insert(schema.purchases).values({ userId: base.user.id, courseId: base.course.id, pricePaid: 5000, country: null, createdAt: daysAgo(10) }).run();

      const result = getInstructorSummary({ instructorId: base.instructor.id, period: "7d" });
      expect(result.totalRevenue).toBe(1000);
    });

    it("includes purchases within 12m and excludes older ones", () => {
      testDb.insert(schema.purchases).values({ userId: base.user.id, courseId: base.course.id, pricePaid: 3000, country: null, createdAt: daysAgo(90) }).run();
      testDb.insert(schema.purchases).values({ userId: base.user.id, courseId: base.course.id, pricePaid: 9999, country: null, createdAt: monthsAgo(14) }).run();

      const result = getInstructorSummary({ instructorId: base.instructor.id, period: "12m" });
      expect(result.totalRevenue).toBe(3000);
    });

    it("includes all purchases for 'all' period", () => {
      testDb.insert(schema.purchases).values({ userId: base.user.id, courseId: base.course.id, pricePaid: 9999, country: null, createdAt: monthsAgo(18) }).run();
      testDb.insert(schema.purchases).values({ userId: base.user.id, courseId: base.course.id, pricePaid: 1000, country: null }).run();

      const result = getInstructorSummary({ instructorId: base.instructor.id, period: "all" });
      expect(result.totalRevenue).toBe(10999);
    });

    // ─── Enrollments ───

    it("counts enrollments within the period", () => {
      testDb.insert(schema.enrollments).values({ userId: base.user.id, courseId: base.course.id }).run();

      const result = getInstructorSummary({ instructorId: base.instructor.id, period: "30d" });
      expect(result.totalEnrollments).toBe(1);
    });

    it("excludes enrollments older than the period", () => {
      testDb.insert(schema.enrollments).values({ userId: base.user.id, courseId: base.course.id, enrolledAt: daysAgo(45) }).run();

      const result = getInstructorSummary({ instructorId: base.instructor.id, period: "30d" });
      expect(result.totalEnrollments).toBe(0);
    });

    // ─── Ratings ───

    it("calculates average rating and count from reviews in the period", () => {
      testDb.insert(schema.courseReviews).values({ userId: base.user.id, courseId: base.course.id, rating: 4 }).run();

      const result = getInstructorSummary({ instructorId: base.instructor.id, period: "30d" });
      expect(result.avgRating).toBe(4);
      expect(result.ratingCount).toBe(1);
    });

    it("excludes reviews older than the period", () => {
      testDb.insert(schema.courseReviews).values({ userId: base.user.id, courseId: base.course.id, rating: 5, createdAt: daysAgo(45) }).run();

      const result = getInstructorSummary({ instructorId: base.instructor.id, period: "30d" });
      expect(result.avgRating).toBeNull();
      expect(result.ratingCount).toBe(0);
    });

    // ─── Instructor isolation ───

    it("only includes data from the instructor's own courses", () => {
      const otherInstructor = testDb
        .insert(schema.users)
        .values({ name: "Other", email: "other@example.com", role: schema.UserRole.Instructor })
        .returning()
        .get();

      const otherCourse = testDb
        .insert(schema.courses)
        .values({
          title: "Other Course",
          slug: "other-course",
          description: "desc",
          instructorId: otherInstructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
        })
        .returning()
        .get();

      testDb.insert(schema.purchases).values({ userId: base.user.id, courseId: otherCourse.id, pricePaid: 9999, country: null }).run();
      testDb.insert(schema.enrollments).values({ userId: base.user.id, courseId: otherCourse.id }).run();

      testDb.insert(schema.purchases).values({ userId: base.user.id, courseId: base.course.id, pricePaid: 4999, country: null }).run();

      const result = getInstructorSummary({ instructorId: base.instructor.id, period: "all" });
      expect(result.totalRevenue).toBe(4999);
      expect(result.totalEnrollments).toBe(0);
    });

    it("returns zero revenue when instructor has courses but no purchases", () => {
      testDb.insert(schema.enrollments).values({ userId: base.user.id, courseId: base.course.id }).run();

      const result = getInstructorSummary({ instructorId: base.instructor.id, period: "30d" });
      expect(result.totalRevenue).toBe(0);
      expect(result.totalEnrollments).toBe(1);
    });
  });
});
