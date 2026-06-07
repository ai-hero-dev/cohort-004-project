import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";

let testDb: ReturnType<typeof createTestDb>;
let base: ReturnType<typeof seedBaseData>;
let lessonId: number;

vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

// Import after mock so the module picks up our test db
import {
  toggleBookmark,
  isLessonBookmarked,
  getBookmarkedLessonIds,
} from "./bookmarkService";

describe("bookmarkService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);

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

    lessonId = lesson.id;
  });

  describe("isLessonBookmarked", () => {
    it("returns false when no bookmark exists", () => {
      expect(
        isLessonBookmarked({ userId: base.user.id, lessonId: lessonId })
      ).toBe(false);
    });

    it("returns true after a bookmark is created", () => {
      toggleBookmark({ userId: base.user.id, lessonId: lessonId });

      expect(
        isLessonBookmarked({ userId: base.user.id, lessonId: lessonId })
      ).toBe(true);
    });
  });

  describe("toggleBookmark", () => {
    it("creates a bookmark and returns bookmarked: true", () => {
      const result = toggleBookmark({
        userId: base.user.id,
        lessonId: lessonId,
      });

      expect(result).toEqual({ bookmarked: true });
    });

    it("removes an existing bookmark and returns bookmarked: false", () => {
      toggleBookmark({ userId: base.user.id, lessonId: lessonId });

      const result = toggleBookmark({
        userId: base.user.id,
        lessonId: lessonId,
      });

      expect(result).toEqual({ bookmarked: false });
    });

    it("toggling twice results in no bookmark", () => {
      toggleBookmark({ userId: base.user.id, lessonId: lessonId });
      toggleBookmark({ userId: base.user.id, lessonId: lessonId });

      expect(
        isLessonBookmarked({ userId: base.user.id, lessonId: lessonId })
      ).toBe(false);
    });

    it("bookmarks are per-user — different users are independent", () => {
      toggleBookmark({ userId: base.user.id, lessonId: lessonId });

      expect(
        isLessonBookmarked({
          userId: base.instructor.id,
          lessonId: lessonId,
        })
      ).toBe(false);
    });
  });

  describe("getBookmarkedLessonIds", () => {
    it("returns empty array when no bookmarks exist", () => {
      expect(
        getBookmarkedLessonIds({
          userId: base.user.id,
          courseId: base.course.id,
        })
      ).toEqual([]);
    });

    it("returns lesson id after bookmarking", () => {
      toggleBookmark({ userId: base.user.id, lessonId: lessonId });

      const ids = getBookmarkedLessonIds({
        userId: base.user.id,
        courseId: base.course.id,
      });

      expect(ids).toContain(lessonId);
    });

    it("does not return lesson id after unbookmarking", () => {
      toggleBookmark({ userId: base.user.id, lessonId: lessonId });
      toggleBookmark({ userId: base.user.id, lessonId: lessonId });

      const ids = getBookmarkedLessonIds({
        userId: base.user.id,
        courseId: base.course.id,
      });

      expect(ids).not.toContain(lessonId);
    });

    it("only returns bookmarks belonging to the given course", () => {
      toggleBookmark({ userId: base.user.id, lessonId: lessonId });

      const ids = getBookmarkedLessonIds({
        userId: base.user.id,
        courseId: 9999,
      });

      expect(ids).toHaveLength(0);
    });

    it("only returns bookmarks belonging to the given user", () => {
      toggleBookmark({ userId: base.user.id, lessonId: lessonId });

      const ids = getBookmarkedLessonIds({
        userId: base.instructor.id,
        courseId: base.course.id,
      });

      expect(ids).toHaveLength(0);
    });
  });
});
