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
  getPlatformSummary,
  getPlatformRevenueTimeSeries,
} from "./analyticsService";

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

describe("admin analytics — getPlatformSummary", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  it("returns zeros when there is no data", () => {
    const result = getPlatformSummary({ period: "30d" });
    expect(result.totalRevenue).toBe(0);
    expect(result.totalEnrollments).toBe(0);
    expect(result.topCourse).toBeNull();
  });

  it("sums revenue across all instructors", () => {
    const otherInstructor = testDb
      .insert(schema.users)
      .values({
        name: "Other Instructor",
        email: "other@test.com",
        role: schema.UserRole.Instructor,
      })
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

    testDb
      .insert(schema.purchases)
      .values({
        userId: base.user.id,
        courseId: base.course.id,
        pricePaid: 4999,
        country: null,
      })
      .run();
    testDb
      .insert(schema.purchases)
      .values({
        userId: base.user.id,
        courseId: otherCourse.id,
        pricePaid: 3000,
        country: null,
      })
      .run();

    const result = getPlatformSummary({ period: "30d" });
    expect(result.totalRevenue).toBe(7999);
  });

  it("counts enrollments across all courses", () => {
    testDb
      .insert(schema.enrollments)
      .values({ userId: base.user.id, courseId: base.course.id })
      .run();

    const otherInstructor = testDb
      .insert(schema.users)
      .values({
        name: "Other",
        email: "other2@test.com",
        role: schema.UserRole.Instructor,
      })
      .returning()
      .get();
    const otherCourse = testDb
      .insert(schema.courses)
      .values({
        title: "Other",
        slug: "other2",
        description: "d",
        instructorId: otherInstructor.id,
        categoryId: base.category.id,
        status: schema.CourseStatus.Published,
      })
      .returning()
      .get();
    testDb
      .insert(schema.enrollments)
      .values({ userId: base.user.id, courseId: otherCourse.id })
      .run();

    const result = getPlatformSummary({ period: "30d" });
    expect(result.totalEnrollments).toBe(2);
  });

  it("excludes purchases older than the period", () => {
    testDb
      .insert(schema.purchases)
      .values({
        userId: base.user.id,
        courseId: base.course.id,
        pricePaid: 9999,
        country: null,
        createdAt: daysAgo(45),
      })
      .run();

    const result = getPlatformSummary({ period: "30d" });
    expect(result.totalRevenue).toBe(0);
  });

  it("excludes enrollments older than the period", () => {
    testDb
      .insert(schema.enrollments)
      .values({
        userId: base.user.id,
        courseId: base.course.id,
        enrolledAt: daysAgo(45),
      })
      .run();

    const result = getPlatformSummary({ period: "30d" });
    expect(result.totalEnrollments).toBe(0);
  });

  it("includes all data for 'all' period", () => {
    testDb
      .insert(schema.purchases)
      .values({
        userId: base.user.id,
        courseId: base.course.id,
        pricePaid: 5000,
        country: null,
        createdAt: monthsAgo(18),
      })
      .run();
    testDb
      .insert(schema.purchases)
      .values({
        userId: base.user.id,
        courseId: base.course.id,
        pricePaid: 3000,
        country: null,
      })
      .run();

    const result = getPlatformSummary({ period: "all" });
    expect(result.totalRevenue).toBe(8000);
  });

  it("returns the top earning course", () => {
    const course2 = testDb
      .insert(schema.courses)
      .values({
        title: "Top Earner",
        slug: "top-earner",
        description: "desc",
        instructorId: base.instructor.id,
        categoryId: base.category.id,
        status: schema.CourseStatus.Published,
      })
      .returning()
      .get();

    testDb
      .insert(schema.purchases)
      .values({
        userId: base.user.id,
        courseId: base.course.id,
        pricePaid: 1000,
        country: null,
      })
      .run();
    testDb
      .insert(schema.purchases)
      .values({
        userId: base.user.id,
        courseId: course2.id,
        pricePaid: 9999,
        country: null,
      })
      .run();

    const result = getPlatformSummary({ period: "30d" });
    expect(result.topCourse).not.toBeNull();
    expect(result.topCourse!.title).toBe("Top Earner");
    expect(result.topCourse!.revenue).toBe(9999);
  });

  it("returns null topCourse when there are no purchases", () => {
    const result = getPlatformSummary({ period: "30d" });
    expect(result.topCourse).toBeNull();
  });

  it("respects 7d period filter", () => {
    testDb
      .insert(schema.purchases)
      .values({
        userId: base.user.id,
        courseId: base.course.id,
        pricePaid: 1000,
        country: null,
      })
      .run();
    testDb
      .insert(schema.purchases)
      .values({
        userId: base.user.id,
        courseId: base.course.id,
        pricePaid: 5000,
        country: null,
        createdAt: daysAgo(10),
      })
      .run();

    const result = getPlatformSummary({ period: "7d" });
    expect(result.totalRevenue).toBe(1000);
  });

  it("respects 12m period filter", () => {
    testDb
      .insert(schema.purchases)
      .values({
        userId: base.user.id,
        courseId: base.course.id,
        pricePaid: 3000,
        country: null,
        createdAt: daysAgo(90),
      })
      .run();
    testDb
      .insert(schema.purchases)
      .values({
        userId: base.user.id,
        courseId: base.course.id,
        pricePaid: 9999,
        country: null,
        createdAt: monthsAgo(14),
      })
      .run();

    const result = getPlatformSummary({ period: "12m" });
    expect(result.totalRevenue).toBe(3000);
  });
});

describe("admin analytics — getPlatformRevenueTimeSeries", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  it("returns 7 daily data points for 7d period", () => {
    const result = getPlatformRevenueTimeSeries({ period: "7d" });
    expect(result).toHaveLength(7);
    expect(result.every((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.date))).toBe(true);
  });

  it("returns 30 daily data points for 30d period", () => {
    const result = getPlatformRevenueTimeSeries({ period: "30d" });
    expect(result).toHaveLength(30);
  });

  it("fills zero revenue for days with no purchases", () => {
    const result = getPlatformRevenueTimeSeries({ period: "7d" });
    expect(result.every((p) => p.revenue === 0)).toBe(true);
  });

  it("aggregates revenue across all instructors for a given day", () => {
    const otherInstructor = testDb
      .insert(schema.users)
      .values({
        name: "Other",
        email: "other-ts@test.com",
        role: schema.UserRole.Instructor,
      })
      .returning()
      .get();
    const otherCourse = testDb
      .insert(schema.courses)
      .values({
        title: "Other",
        slug: "other-ts",
        description: "d",
        instructorId: otherInstructor.id,
        categoryId: base.category.id,
        status: schema.CourseStatus.Published,
      })
      .returning()
      .get();

    testDb
      .insert(schema.purchases)
      .values({
        userId: base.user.id,
        courseId: base.course.id,
        pricePaid: 2000,
        country: null,
      })
      .run();
    testDb
      .insert(schema.purchases)
      .values({
        userId: base.user.id,
        courseId: otherCourse.id,
        pricePaid: 3000,
        country: null,
      })
      .run();

    const today = new Date().toISOString().slice(0, 10);
    const result = getPlatformRevenueTimeSeries({ period: "7d" });
    const todayPoint = result.find((p) => p.date === today);
    expect(todayPoint?.revenue).toBe(5000);
  });

  it("uses monthly data points for 12m period", () => {
    const result = getPlatformRevenueTimeSeries({ period: "12m" });
    expect(result.length).toBeGreaterThanOrEqual(12);
    expect(result.length).toBeLessThanOrEqual(13);
    expect(result.every((p) => /^\d{4}-\d{2}$/.test(p.date))).toBe(true);
  });

  it("returns empty array for 'all' period with no purchases", () => {
    const result = getPlatformRevenueTimeSeries({ period: "all" });
    expect(result).toHaveLength(0);
  });

  it("returns monthly data spanning from earliest purchase for 'all' period", () => {
    testDb
      .insert(schema.purchases)
      .values({
        userId: base.user.id,
        courseId: base.course.id,
        pricePaid: 5000,
        country: null,
        createdAt: monthsAgo(3),
      })
      .run();
    testDb
      .insert(schema.purchases)
      .values({
        userId: base.user.id,
        courseId: base.course.id,
        pricePaid: 3000,
        country: null,
      })
      .run();

    const result = getPlatformRevenueTimeSeries({ period: "all" });
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result.every((p) => /^\d{4}-\d{2}$/.test(p.date))).toBe(true);
    expect(result.some((p) => p.revenue > 0)).toBe(true);
  });
});
