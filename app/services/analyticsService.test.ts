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

import { getInstructorSummary, getRevenueTimeSeries, getCourseBreakdowns } from "./analyticsService";

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

  // ─── getRevenueTimeSeries ───

  describe("getRevenueTimeSeries", () => {
    it("returns 7 daily data points for 7d period", () => {
      const result = getRevenueTimeSeries({ instructorId: base.instructor.id, period: "7d" });
      expect(result).toHaveLength(7);
      expect(result.every((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.date))).toBe(true);
    });

    it("returns 30 daily data points for 30d period", () => {
      const result = getRevenueTimeSeries({ instructorId: base.instructor.id, period: "30d" });
      expect(result).toHaveLength(30);
      expect(result.every((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.date))).toBe(true);
    });

    it("fills zero revenue for days with no purchases", () => {
      const result = getRevenueTimeSeries({ instructorId: base.instructor.id, period: "7d" });
      expect(result.every((p) => p.revenue === 0)).toBe(true);
    });

    it("includes correct revenue for a day with purchases", () => {
      testDb
        .insert(schema.purchases)
        .values({ userId: base.user.id, courseId: base.course.id, pricePaid: 4999, country: null, createdAt: daysAgo(3) })
        .run();

      const result = getRevenueTimeSeries({ instructorId: base.instructor.id, period: "7d" });
      const dayWithRevenue = result.find((p) => p.revenue > 0);
      expect(dayWithRevenue?.revenue).toBe(4999);
    });

    it("aggregates multiple purchases on the same day", () => {
      testDb.insert(schema.purchases).values({ userId: base.user.id, courseId: base.course.id, pricePaid: 2000, country: null }).run();
      testDb.insert(schema.purchases).values({ userId: base.user.id, courseId: base.course.id, pricePaid: 3000, country: null }).run();

      const today = new Date().toISOString().slice(0, 10);
      const result = getRevenueTimeSeries({ instructorId: base.instructor.id, period: "7d" });
      const todayPoint = result.find((p) => p.date === today);
      expect(todayPoint?.revenue).toBe(5000);
    });

    it("uses monthly data points for 12m period", () => {
      const result = getRevenueTimeSeries({ instructorId: base.instructor.id, period: "12m" });
      expect(result.length).toBeGreaterThanOrEqual(12);
      expect(result.length).toBeLessThanOrEqual(13);
      expect(result.every((p) => /^\d{4}-\d{2}$/.test(p.date))).toBe(true);
      expect(result.every((p) => p.revenue === 0)).toBe(true);
    });

    it("fills zero revenue for months with no purchases in 12m", () => {
      testDb
        .insert(schema.purchases)
        .values({ userId: base.user.id, courseId: base.course.id, pricePaid: 5000, country: null, createdAt: monthsAgo(6) })
        .run();

      const result = getRevenueTimeSeries({ instructorId: base.instructor.id, period: "12m" });
      expect(result.some((p) => p.revenue > 0)).toBe(true);
      expect(result.some((p) => p.revenue === 0)).toBe(true);
    });

    it("returns empty array for 'all' period with no purchases", () => {
      const result = getRevenueTimeSeries({ instructorId: base.instructor.id, period: "all" });
      expect(result).toHaveLength(0);
    });

    it("returns monthly data spanning from earliest purchase for 'all' period", () => {
      testDb
        .insert(schema.purchases)
        .values({ userId: base.user.id, courseId: base.course.id, pricePaid: 5000, country: null, createdAt: monthsAgo(3) })
        .run();
      testDb
        .insert(schema.purchases)
        .values({ userId: base.user.id, courseId: base.course.id, pricePaid: 3000, country: null })
        .run();

      const result = getRevenueTimeSeries({ instructorId: base.instructor.id, period: "all" });
      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result.every((p) => /^\d{4}-\d{2}$/.test(p.date))).toBe(true);
      expect(result.some((p) => p.revenue > 0)).toBe(true);
    });

    it("excludes purchases from other instructors in time series", () => {
      const other = testDb
        .insert(schema.users)
        .values({ name: "Other", email: "other-ts@test.com", role: schema.UserRole.Instructor })
        .returning()
        .get();
      const otherCourse = testDb
        .insert(schema.courses)
        .values({
          title: "Other", slug: "other-ts", description: "d",
          instructorId: other.id, categoryId: base.category.id,
          status: schema.CourseStatus.Published,
        })
        .returning()
        .get();
      testDb.insert(schema.purchases).values({ userId: base.user.id, courseId: otherCourse.id, pricePaid: 9999, country: null }).run();

      const result = getRevenueTimeSeries({ instructorId: base.instructor.id, period: "7d" });
      expect(result.every((p) => p.revenue === 0)).toBe(true);
    });
  });

  // ─── getCourseBreakdowns ───

  describe("getCourseBreakdowns", () => {
    it("returns empty array when instructor has no courses", () => {
      const other = testDb
        .insert(schema.users)
        .values({ name: "No Courses", email: "nocourses@test.com", role: schema.UserRole.Instructor })
        .returning()
        .get();

      const result = getCourseBreakdowns({ instructorId: other.id, period: "30d" });
      expect(result).toHaveLength(0);
    });

    it("returns a course with zero metrics when there is no activity", () => {
      const result = getCourseBreakdowns({ instructorId: base.instructor.id, period: "30d" });
      expect(result).toHaveLength(1);
      expect(result[0].courseId).toBe(base.course.id);
      expect(result[0].revenue).toBe(0);
      expect(result[0].salesCount).toBe(0);
      expect(result[0].enrollmentCount).toBe(0);
      expect(result[0].avgRating).toBeNull();
      expect(result[0].ratingCount).toBe(0);
    });

    it("returns the course list price", () => {
      const result = getCourseBreakdowns({ instructorId: base.instructor.id, period: "30d" });
      expect(result[0].listPrice).toBe(base.course.price);
    });

    it("returns correct revenue and sales count", () => {
      testDb.insert(schema.purchases).values({ userId: base.user.id, courseId: base.course.id, pricePaid: 4999, country: null }).run();
      testDb.insert(schema.purchases).values({ userId: base.user.id, courseId: base.course.id, pricePaid: 2999, country: null }).run();

      const result = getCourseBreakdowns({ instructorId: base.instructor.id, period: "30d" });
      expect(result[0].revenue).toBe(7998);
      expect(result[0].salesCount).toBe(2);
    });

    it("excludes purchases older than the period", () => {
      testDb
        .insert(schema.purchases)
        .values({ userId: base.user.id, courseId: base.course.id, pricePaid: 9999, country: null, createdAt: daysAgo(45) })
        .run();

      const result = getCourseBreakdowns({ instructorId: base.instructor.id, period: "30d" });
      expect(result[0].revenue).toBe(0);
      expect(result[0].salesCount).toBe(0);
    });

    it("returns correct enrollment count", () => {
      testDb.insert(schema.enrollments).values({ userId: base.user.id, courseId: base.course.id }).run();

      const result = getCourseBreakdowns({ instructorId: base.instructor.id, period: "30d" });
      expect(result[0].enrollmentCount).toBe(1);
    });

    it("excludes enrollments older than the period", () => {
      testDb
        .insert(schema.enrollments)
        .values({ userId: base.user.id, courseId: base.course.id, enrolledAt: daysAgo(45) })
        .run();

      const result = getCourseBreakdowns({ instructorId: base.instructor.id, period: "30d" });
      expect(result[0].enrollmentCount).toBe(0);
    });

    it("returns correct average rating and rating count", () => {
      testDb.insert(schema.courseReviews).values({ userId: base.user.id, courseId: base.course.id, rating: 4 }).run();

      const result = getCourseBreakdowns({ instructorId: base.instructor.id, period: "30d" });
      expect(result[0].avgRating).toBe(4);
      expect(result[0].ratingCount).toBe(1);
    });

    it("excludes reviews older than the period", () => {
      testDb
        .insert(schema.courseReviews)
        .values({ userId: base.user.id, courseId: base.course.id, rating: 5, createdAt: daysAgo(45) })
        .run();

      const result = getCourseBreakdowns({ instructorId: base.instructor.id, period: "30d" });
      expect(result[0].avgRating).toBeNull();
      expect(result[0].ratingCount).toBe(0);
    });

    it("returns data for multiple courses attributed correctly", () => {
      const course2 = testDb
        .insert(schema.courses)
        .values({
          title: "Course 2", slug: "course-2", description: "d",
          instructorId: base.instructor.id, categoryId: base.category.id,
          status: schema.CourseStatus.Published,
        })
        .returning()
        .get();

      testDb.insert(schema.purchases).values({ userId: base.user.id, courseId: base.course.id, pricePaid: 4999, country: null }).run();
      testDb.insert(schema.purchases).values({ userId: base.user.id, courseId: course2.id, pricePaid: 9999, country: null }).run();

      const result = getCourseBreakdowns({ instructorId: base.instructor.id, period: "30d" });
      expect(result).toHaveLength(2);

      const c1 = result.find((r) => r.courseId === base.course.id);
      const c2 = result.find((r) => r.courseId === course2.id);
      expect(c1?.revenue).toBe(4999);
      expect(c2?.revenue).toBe(9999);
    });

    it("only returns courses from the specified instructor", () => {
      const other = testDb
        .insert(schema.users)
        .values({ name: "Other", email: "other-cb@test.com", role: schema.UserRole.Instructor })
        .returning()
        .get();
      testDb
        .insert(schema.courses)
        .values({
          title: "Other Course", slug: "other-cb", description: "d",
          instructorId: other.id, categoryId: base.category.id,
          status: schema.CourseStatus.Published,
        })
        .run();

      const result = getCourseBreakdowns({ instructorId: base.instructor.id, period: "30d" });
      expect(result).toHaveLength(1);
      expect(result[0].courseId).toBe(base.course.id);
    });

    it("includes all purchases for 'all' period regardless of date", () => {
      testDb
        .insert(schema.purchases)
        .values({ userId: base.user.id, courseId: base.course.id, pricePaid: 5000, country: null, createdAt: monthsAgo(18) })
        .run();
      testDb
        .insert(schema.purchases)
        .values({ userId: base.user.id, courseId: base.course.id, pricePaid: 3000, country: null })
        .run();

      const result = getCourseBreakdowns({ instructorId: base.instructor.id, period: "all" });
      expect(result[0].revenue).toBe(8000);
      expect(result[0].salesCount).toBe(2);
    });
  });
});
