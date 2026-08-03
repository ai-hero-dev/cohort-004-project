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

// Import after mock so the module picks up our test db
import {
  findReview,
  upsertReview,
  getAverageRatingForCourse,
  getAverageRatingsForCourses,
} from "./courseReviewService";

describe("courseReviewService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  describe("upsertReview", () => {
    it("creates a new review when none exists", () => {
      const review = upsertReview(base.user.id, base.course.id, 4);

      expect(review).toBeDefined();
      expect(review.userId).toBe(base.user.id);
      expect(review.courseId).toBe(base.course.id);
      expect(review.rating).toBe(4);
      expect(review.createdAt).toBeDefined();
      expect(review.updatedAt).toBeDefined();
    });

    it("updates the existing review instead of creating a duplicate", () => {
      const first = upsertReview(base.user.id, base.course.id, 3);
      const second = upsertReview(base.user.id, base.course.id, 5);

      expect(second.id).toBe(first.id);
      expect(second.rating).toBe(5);

      const { count } = getAverageRatingForCourse(base.course.id);
      expect(count).toBe(1);
    });
  });

  describe("findReview", () => {
    it("returns the review when it exists", () => {
      upsertReview(base.user.id, base.course.id, 5);

      const found = findReview(base.user.id, base.course.id);
      expect(found).toBeDefined();
      expect(found!.rating).toBe(5);
    });

    it("returns undefined when no review exists", () => {
      expect(findReview(base.user.id, base.course.id)).toBeUndefined();
    });
  });

  describe("getAverageRatingForCourse", () => {
    it("returns 0/0 when no reviews exist", () => {
      expect(getAverageRatingForCourse(base.course.id)).toEqual({
        average: 0,
        count: 0,
      });
    });

    it("returns the average and count for a single review", () => {
      upsertReview(base.user.id, base.course.id, 4);

      expect(getAverageRatingForCourse(base.course.id)).toEqual({
        average: 4,
        count: 1,
      });
    });

    it("returns the average and count across multiple reviews", () => {
      const student2 = testDb
        .insert(schema.users)
        .values({
          name: "Student Two",
          email: "student2@example.com",
          role: schema.UserRole.Student,
        })
        .returning()
        .get();

      upsertReview(base.user.id, base.course.id, 3);
      upsertReview(student2.id, base.course.id, 5);

      expect(getAverageRatingForCourse(base.course.id)).toEqual({
        average: 4,
        count: 2,
      });
    });
  });

  describe("getAverageRatingsForCourses", () => {
    it("returns an empty map for an empty input list", () => {
      expect(getAverageRatingsForCourses([])).toEqual(new Map());
    });

    it("batches averages for multiple courses", () => {
      const course2 = testDb
        .insert(schema.courses)
        .values({
          title: "Second Course",
          slug: "second-course",
          description: "Another course",
          instructorId: base.instructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
        })
        .returning()
        .get();

      upsertReview(base.user.id, base.course.id, 2);
      upsertReview(base.user.id, course2.id, 5);

      const map = getAverageRatingsForCourses([base.course.id, course2.id]);
      expect(map.get(base.course.id)).toEqual({ average: 2, count: 1 });
      expect(map.get(course2.id)).toEqual({ average: 5, count: 1 });
    });

    it("omits courses with no reviews from the map", () => {
      const map = getAverageRatingsForCourses([base.course.id]);
      expect(map.has(base.course.id)).toBe(false);
    });
  });
});
