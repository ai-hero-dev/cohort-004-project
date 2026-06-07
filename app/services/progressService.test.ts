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
  getLessonProgress,
  getLessonProgressForCourse,
  markLessonComplete,
  markLessonInProgress,
  resetLessonProgress,
  calculateProgress,
  getCompletedLessonCount,
  getTotalLessonCount,
  isLessonCompleted,
  getNextIncompleteLesson,
} from "./progressService";

// Helper to create a module with lessons in the test db
function createModuleWithLessons(opts: {
  courseId: number;
  moduleTitle: string;
  position: number;
  lessonCount: number;
  durationMinutes?: number;
}) {
  const mod = testDb
    .insert(schema.modules)
    .values({
      courseId: opts.courseId,
      title: opts.moduleTitle,
      position: opts.position,
    })
    .returning()
    .get();

  const createdLessons = [];
  for (let i = 0; i < opts.lessonCount; i++) {
    const lesson = testDb
      .insert(schema.lessons)
      .values({
        moduleId: mod.id,
        title: `Lesson ${i + 1}`,
        position: i + 1,
        durationMinutes: opts.durationMinutes ?? null,
      })
      .returning()
      .get();
    createdLessons.push(lesson);
  }

  return { module: mod, lessons: createdLessons };
}

describe("progressService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  describe("markLessonComplete", () => {
    it("marks a lesson as completed with a new progress record", () => {
      const { lessons } = createModuleWithLessons({ courseId: base.course.id, moduleTitle: "Module 1", position: 1, lessonCount: 1 });

      const progress = markLessonComplete({ userId: base.user.id, lessonId: lessons[0].id });

      expect(progress).toBeDefined();
      expect(progress.userId).toBe(base.user.id);
      expect(progress.lessonId).toBe(lessons[0].id);
      expect(progress.status).toBe(schema.LessonProgressStatus.Completed);
      expect(progress.completedAt).toBeDefined();
      expect(progress.completedAt).not.toBeNull();
    });

    it("updates an existing in-progress record to completed", () => {
      const { lessons } = createModuleWithLessons({ courseId: base.course.id, moduleTitle: "Module 1", position: 1, lessonCount: 1 });

      markLessonInProgress({ userId: base.user.id, lessonId: lessons[0].id });
      const progress = markLessonComplete({ userId: base.user.id, lessonId: lessons[0].id });

      expect(progress.status).toBe(schema.LessonProgressStatus.Completed);
      expect(progress.completedAt).not.toBeNull();
    });

    it("is idempotent — completing an already completed lesson still returns completed", () => {
      const { lessons } = createModuleWithLessons({ courseId: base.course.id, moduleTitle: "Module 1", position: 1, lessonCount: 1 });

      markLessonComplete({ userId: base.user.id, lessonId: lessons[0].id });
      const progress = markLessonComplete({ userId: base.user.id, lessonId: lessons[0].id });

      expect(progress.status).toBe(schema.LessonProgressStatus.Completed);
    });
  });

  describe("markLessonInProgress", () => {
    it("marks a lesson as in-progress with a new progress record", () => {
      const { lessons } = createModuleWithLessons({ courseId: base.course.id, moduleTitle: "Module 1", position: 1, lessonCount: 1 });

      const progress = markLessonInProgress({ userId: base.user.id, lessonId: lessons[0].id });

      expect(progress.status).toBe(schema.LessonProgressStatus.InProgress);
      expect(progress.completedAt).toBeNull();
    });

    it("does not downgrade a completed lesson back to in-progress", () => {
      const { lessons } = createModuleWithLessons({ courseId: base.course.id, moduleTitle: "Module 1", position: 1, lessonCount: 1 });

      markLessonComplete({ userId: base.user.id, lessonId: lessons[0].id });
      const progress = markLessonInProgress({ userId: base.user.id, lessonId: lessons[0].id });

      expect(progress.status).toBe(schema.LessonProgressStatus.Completed);
    });

    it("updates an existing not-started record to in-progress", () => {
      const { lessons } = createModuleWithLessons({ courseId: base.course.id, moduleTitle: "Module 1", position: 1, lessonCount: 1 });

      // Create initial in-progress, then mark in-progress again (no-op for in_progress)
      const first = markLessonInProgress({ userId: base.user.id, lessonId: lessons[0].id });
      const second = markLessonInProgress({ userId: base.user.id, lessonId: lessons[0].id });

      expect(second.status).toBe(schema.LessonProgressStatus.InProgress);
      expect(second.id).toBe(first.id);
    });
  });

  describe("getLessonProgress", () => {
    it("returns the progress record for a user/lesson pair", () => {
      const { lessons } = createModuleWithLessons({ courseId: base.course.id, moduleTitle: "Module 1", position: 1, lessonCount: 1 });

      markLessonComplete({ userId: base.user.id, lessonId: lessons[0].id });

      const progress = getLessonProgress({ userId: base.user.id, lessonId: lessons[0].id });
      expect(progress).toBeDefined();
      expect(progress!.status).toBe(schema.LessonProgressStatus.Completed);
    });

    it("returns undefined when no progress exists", () => {
      const { lessons } = createModuleWithLessons({ courseId: base.course.id, moduleTitle: "Module 1", position: 1, lessonCount: 1 });

      const progress = getLessonProgress({ userId: base.user.id, lessonId: lessons[0].id });
      expect(progress).toBeUndefined();
    });
  });

  describe("getLessonProgressForCourse", () => {
    it("returns all lesson progress records for a user in a course", () => {
      const { lessons } = createModuleWithLessons({ courseId: base.course.id, moduleTitle: "Module 1", position: 1, lessonCount: 3 });

      markLessonComplete({ userId: base.user.id, lessonId: lessons[0].id });
      markLessonInProgress({ userId: base.user.id, lessonId: lessons[1].id });

      const progress = getLessonProgressForCourse({ userId: base.user.id, courseId: base.course.id });
      expect(progress).toHaveLength(2);
    });

    it("returns empty array for a course with no modules", () => {
      // Use a second course with no modules
      const emptyCourse = testDb
        .insert(schema.courses)
        .values({
          title: "Empty Course",
          slug: "empty-course",
          description: "No modules",
          instructorId: base.instructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
        })
        .returning()
        .get();

      const progress = getLessonProgressForCourse({ userId: base.user.id, courseId: emptyCourse.id });
      expect(progress).toHaveLength(0);
    });

    it("returns empty array when user has no progress", () => {
      createModuleWithLessons({ courseId: base.course.id, moduleTitle: "Module 1", position: 1, lessonCount: 3 });

      const progress = getLessonProgressForCourse({ userId: base.user.id, courseId: base.course.id });
      expect(progress).toHaveLength(0);
    });
  });

  describe("resetLessonProgress", () => {
    it("deletes the progress record for a user/lesson pair", () => {
      const { lessons } = createModuleWithLessons({ courseId: base.course.id, moduleTitle: "Module 1", position: 1, lessonCount: 1 });

      markLessonComplete({ userId: base.user.id, lessonId: lessons[0].id });
      const deleted = resetLessonProgress({ userId: base.user.id, lessonId: lessons[0].id });

      expect(deleted).toBeDefined();
      expect(getLessonProgress({ userId: base.user.id, lessonId: lessons[0].id })).toBeUndefined();
    });

    it("returns undefined when no progress exists to reset", () => {
      const { lessons } = createModuleWithLessons({ courseId: base.course.id, moduleTitle: "Module 1", position: 1, lessonCount: 1 });

      const deleted = resetLessonProgress({ userId: base.user.id, lessonId: lessons[0].id });
      expect(deleted).toBeUndefined();
    });
  });

  describe("isLessonCompleted", () => {
    it("returns true when lesson is completed", () => {
      const { lessons } = createModuleWithLessons({ courseId: base.course.id, moduleTitle: "Module 1", position: 1, lessonCount: 1 });

      markLessonComplete({ userId: base.user.id, lessonId: lessons[0].id });

      expect(isLessonCompleted({ userId: base.user.id, lessonId: lessons[0].id })).toBe(true);
    });

    it("returns false when lesson is in-progress", () => {
      const { lessons } = createModuleWithLessons({ courseId: base.course.id, moduleTitle: "Module 1", position: 1, lessonCount: 1 });

      markLessonInProgress({ userId: base.user.id, lessonId: lessons[0].id });

      expect(isLessonCompleted({ userId: base.user.id, lessonId: lessons[0].id })).toBe(false);
    });

    it("returns false when no progress exists", () => {
      const { lessons } = createModuleWithLessons({ courseId: base.course.id, moduleTitle: "Module 1", position: 1, lessonCount: 1 });

      expect(isLessonCompleted({ userId: base.user.id, lessonId: lessons[0].id })).toBe(false);
    });
  });

  describe("calculateProgress", () => {
    it("returns 0 for a course with no lessons", () => {
      const emptyCourse = testDb
        .insert(schema.courses)
        .values({
          title: "Empty Course",
          slug: "empty-course",
          description: "No content",
          instructorId: base.instructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
        })
        .returning()
        .get();

      const progress = calculateProgress({ userId: base.user.id, courseId: emptyCourse.id, includeQuizzes: false, weightByDuration: false });
      expect(progress).toBe(0);
    });

    it("returns 0 when no lessons are completed", () => {
      createModuleWithLessons({ courseId: base.course.id, moduleTitle: "Module 1", position: 1, lessonCount: 4 });

      const progress = calculateProgress({ userId: base.user.id, courseId: base.course.id, includeQuizzes: false, weightByDuration: false });
      expect(progress).toBe(0);
    });

    it("returns 100 when all lessons are completed", () => {
      const { lessons } = createModuleWithLessons({ courseId: base.course.id, moduleTitle: "Module 1", position: 1, lessonCount: 3 });

      for (const lesson of lessons) {
        markLessonComplete({ userId: base.user.id, lessonId: lesson.id });
      }

      const progress = calculateProgress({ userId: base.user.id, courseId: base.course.id, includeQuizzes: false, weightByDuration: false });
      expect(progress).toBe(100);
    });

    it("calculates correct percentage for partial completion", () => {
      const { lessons } = createModuleWithLessons({ courseId: base.course.id, moduleTitle: "Module 1", position: 1, lessonCount: 4 });

      markLessonComplete({ userId: base.user.id, lessonId: lessons[0].id });
      markLessonComplete({ userId: base.user.id, lessonId: lessons[1].id });

      const progress = calculateProgress({ userId: base.user.id, courseId: base.course.id, includeQuizzes: false, weightByDuration: false });
      expect(progress).toBe(50); // 2/4 = 50%
    });

    it("only counts completed lessons, not in-progress ones", () => {
      const { lessons } = createModuleWithLessons({ courseId: base.course.id, moduleTitle: "Module 1", position: 1, lessonCount: 4 });

      markLessonComplete({ userId: base.user.id, lessonId: lessons[0].id });
      markLessonInProgress({ userId: base.user.id, lessonId: lessons[1].id });

      const progress = calculateProgress({ userId: base.user.id, courseId: base.course.id, includeQuizzes: false, weightByDuration: false });
      expect(progress).toBe(25); // 1/4 = 25%
    });

    it("calculates progress across multiple modules", () => {
      const m1 = createModuleWithLessons({ courseId: base.course.id, moduleTitle: "Module 1", position: 1, lessonCount: 2 });
      const m2 = createModuleWithLessons({ courseId: base.course.id, moduleTitle: "Module 2", position: 2, lessonCount: 2 });

      markLessonComplete({ userId: base.user.id, lessonId: m1.lessons[0].id });
      markLessonComplete({ userId: base.user.id, lessonId: m2.lessons[0].id });

      const progress = calculateProgress({ userId: base.user.id, courseId: base.course.id, includeQuizzes: false, weightByDuration: false });
      expect(progress).toBe(50); // 2/4 = 50%
    });

    it("rounds progress to nearest integer", () => {
      const { lessons } = createModuleWithLessons({ courseId: base.course.id, moduleTitle: "Module 1", position: 1, lessonCount: 3 });

      markLessonComplete({ userId: base.user.id, lessonId: lessons[0].id });

      const progress = calculateProgress({ userId: base.user.id, courseId: base.course.id, includeQuizzes: false, weightByDuration: false });
      expect(progress).toBe(33); // 1/3 = 33.33... → 33
    });
  });

  describe("calculateProgress — weight by duration", () => {
    it("weights progress by lesson duration", () => {
      const mod = testDb
        .insert(schema.modules)
        .values({ courseId: base.course.id, title: "Module 1", position: 1 })
        .returning()
        .get();

      const lesson1 = testDb
        .insert(schema.lessons)
        .values({ moduleId: mod.id, title: "Short Lesson", position: 1, durationMinutes: 10 })
        .returning()
        .get();

      const _lesson2 = testDb
        .insert(schema.lessons)
        .values({ moduleId: mod.id, title: "Long Lesson", position: 2, durationMinutes: 30 })
        .returning()
        .get();

      // Complete only the short lesson (10 out of 40 total minutes)
      markLessonComplete({ userId: base.user.id, lessonId: lesson1.id });

      const progress = calculateProgress({ userId: base.user.id, courseId: base.course.id, includeQuizzes: false, weightByDuration: true });
      expect(progress).toBe(25); // 10/40 = 25%
    });

    it("uses duration 1 as fallback for lessons with null duration", () => {
      const mod = testDb
        .insert(schema.modules)
        .values({ courseId: base.course.id, title: "Module 1", position: 1 })
        .returning()
        .get();

      const lesson1 = testDb
        .insert(schema.lessons)
        .values({ moduleId: mod.id, title: "Timed Lesson", position: 1, durationMinutes: 9 })
        .returning()
        .get();

      testDb
        .insert(schema.lessons)
        .values({ moduleId: mod.id, title: "No Duration", position: 2 })
        .returning()
        .get();

      // Complete only the timed lesson (9 out of 10 total minutes)
      markLessonComplete({ userId: base.user.id, lessonId: lesson1.id });

      const progress = calculateProgress({ userId: base.user.id, courseId: base.course.id, includeQuizzes: false, weightByDuration: true });
      expect(progress).toBe(90); // 9/10 = 90%
    });

    it("returns 0 for empty course with weight by duration", () => {
      const emptyCourse = testDb
        .insert(schema.courses)
        .values({
          title: "Empty",
          slug: "empty",
          description: "Empty",
          instructorId: base.instructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
        })
        .returning()
        .get();

      const progress = calculateProgress({ userId: base.user.id, courseId: emptyCourse.id, includeQuizzes: false, weightByDuration: true });
      expect(progress).toBe(0);
    });
  });

  describe("getCompletedLessonCount", () => {
    it("returns count of completed lessons in a course", () => {
      const { lessons } = createModuleWithLessons({ courseId: base.course.id, moduleTitle: "Module 1", position: 1, lessonCount: 3 });

      markLessonComplete({ userId: base.user.id, lessonId: lessons[0].id });
      markLessonComplete({ userId: base.user.id, lessonId: lessons[1].id });

      expect(getCompletedLessonCount({ userId: base.user.id, courseId: base.course.id })).toBe(2);
    });

    it("does not count in-progress lessons", () => {
      const { lessons } = createModuleWithLessons({ courseId: base.course.id, moduleTitle: "Module 1", position: 1, lessonCount: 3 });

      markLessonComplete({ userId: base.user.id, lessonId: lessons[0].id });
      markLessonInProgress({ userId: base.user.id, lessonId: lessons[1].id });

      expect(getCompletedLessonCount({ userId: base.user.id, courseId: base.course.id })).toBe(1);
    });

    it("returns 0 when no lessons are completed", () => {
      createModuleWithLessons({ courseId: base.course.id, moduleTitle: "Module 1", position: 1, lessonCount: 3 });

      expect(getCompletedLessonCount({ userId: base.user.id, courseId: base.course.id })).toBe(0);
    });

    it("returns 0 for a course with no lessons", () => {
      expect(getCompletedLessonCount({ userId: base.user.id, courseId: base.course.id })).toBe(0);
    });
  });

  describe("getTotalLessonCount", () => {
    it("returns total number of lessons in a course", () => {
      createModuleWithLessons({ courseId: base.course.id, moduleTitle: "Module 1", position: 1, lessonCount: 3 });
      createModuleWithLessons({ courseId: base.course.id, moduleTitle: "Module 2", position: 2, lessonCount: 2 });

      expect(getTotalLessonCount(base.course.id)).toBe(5);
    });

    it("returns 0 for a course with no lessons", () => {
      expect(getTotalLessonCount(base.course.id)).toBe(0);
    });
  });

  describe("getNextIncompleteLesson", () => {
    it("returns the first lesson when no progress exists", () => {
      const { lessons } = createModuleWithLessons({ courseId: base.course.id, moduleTitle: "Module 1", position: 1, lessonCount: 3 });

      const next = getNextIncompleteLesson({ userId: base.user.id, courseId: base.course.id });
      expect(next).toBeDefined();
      expect(next!.id).toBe(lessons[0].id);
    });

    it("returns the first incomplete lesson after completed ones", () => {
      const { lessons } = createModuleWithLessons({ courseId: base.course.id, moduleTitle: "Module 1", position: 1, lessonCount: 3 });

      markLessonComplete({ userId: base.user.id, lessonId: lessons[0].id });

      const next = getNextIncompleteLesson({ userId: base.user.id, courseId: base.course.id });
      expect(next).toBeDefined();
      expect(next!.id).toBe(lessons[1].id);
    });

    it("crosses module boundaries to find the next incomplete lesson", () => {
      const m1 = createModuleWithLessons({ courseId: base.course.id, moduleTitle: "Module 1", position: 1, lessonCount: 2 });
      const m2 = createModuleWithLessons({ courseId: base.course.id, moduleTitle: "Module 2", position: 2, lessonCount: 2 });

      // Complete all lessons in module 1
      markLessonComplete({ userId: base.user.id, lessonId: m1.lessons[0].id });
      markLessonComplete({ userId: base.user.id, lessonId: m1.lessons[1].id });

      const next = getNextIncompleteLesson({ userId: base.user.id, courseId: base.course.id });
      expect(next).toBeDefined();
      expect(next!.id).toBe(m2.lessons[0].id);
    });

    it("returns null when all lessons are completed", () => {
      const { lessons } = createModuleWithLessons({ courseId: base.course.id, moduleTitle: "Module 1", position: 1, lessonCount: 2 });

      for (const lesson of lessons) {
        markLessonComplete({ userId: base.user.id, lessonId: lesson.id });
      }

      const next = getNextIncompleteLesson({ userId: base.user.id, courseId: base.course.id });
      expect(next).toBeNull();
    });

    it("returns null for a course with no modules", () => {
      const next = getNextIncompleteLesson({ userId: base.user.id, courseId: base.course.id });
      expect(next).toBeNull();
    });

    it("treats in-progress lessons as incomplete", () => {
      const { lessons } = createModuleWithLessons({ courseId: base.course.id, moduleTitle: "Module 1", position: 1, lessonCount: 3 });

      markLessonInProgress({ userId: base.user.id, lessonId: lessons[0].id });

      const next = getNextIncompleteLesson({ userId: base.user.id, courseId: base.course.id });
      expect(next).toBeDefined();
      expect(next!.id).toBe(lessons[0].id);
    });
  });
});
