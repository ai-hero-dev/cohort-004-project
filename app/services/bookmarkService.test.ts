import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";

let testDb: ReturnType<typeof createTestDb>;
let base: ReturnType<typeof seedBaseData>;

vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

import {
  toggleBookmark,
  isLessonBookmarked,
  getBookmarkedLessonIds,
} from "./bookmarkService";
import { createModule } from "./moduleService";
import { createLesson } from "./lessonService";

let lessonId: number;
let otherLessonId: number;

describe("bookmarkService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
    const mod = createModule(base.course.id, "Test Module", 1);
    const lesson = createLesson(mod.id, "L1", null, null, 1, null);
    const otherLesson = createLesson(mod.id, "L2", null, null, 2, null);
    lessonId = lesson.id;
    otherLessonId = otherLesson.id;
  });

  describe("toggleBookmark", () => {
    it("creates a bookmark when none exists", () => {
      const result = toggleBookmark({ userId: base.user.id, lessonId });
      expect(result).toEqual({ bookmarked: true });
    });

    it("removes a bookmark when one already exists", () => {
      toggleBookmark({ userId: base.user.id, lessonId });
      const result = toggleBookmark({ userId: base.user.id, lessonId });
      expect(result).toEqual({ bookmarked: false });
    });

    it("toggling is scoped to the user", () => {
      toggleBookmark({ userId: base.user.id, lessonId });
      const result = toggleBookmark({ userId: base.instructor.id, lessonId });
      expect(result).toEqual({ bookmarked: true });
    });
  });

  describe("isLessonBookmarked", () => {
    it("returns false when not bookmarked", () => {
      expect(isLessonBookmarked({ userId: base.user.id, lessonId })).toBe(
        false
      );
    });

    it("returns true after bookmarking", () => {
      toggleBookmark({ userId: base.user.id, lessonId });
      expect(isLessonBookmarked({ userId: base.user.id, lessonId })).toBe(
        true
      );
    });

    it("returns false after toggling off", () => {
      toggleBookmark({ userId: base.user.id, lessonId });
      toggleBookmark({ userId: base.user.id, lessonId });
      expect(isLessonBookmarked({ userId: base.user.id, lessonId })).toBe(
        false
      );
    });
  });

  describe("getBookmarkedLessonIds", () => {
    it("returns empty array when no bookmarks", () => {
      const ids = getBookmarkedLessonIds({
        userId: base.user.id,
        courseId: base.course.id,
      });
      expect(ids).toEqual([]);
    });

    it("returns bookmarked lesson ids for the course", () => {
      toggleBookmark({ userId: base.user.id, lessonId });
      toggleBookmark({ userId: base.user.id, lessonId: otherLessonId });
      const ids = getBookmarkedLessonIds({
        userId: base.user.id,
        courseId: base.course.id,
      });
      expect(ids).toContain(lessonId);
      expect(ids).toContain(otherLessonId);
      expect(ids).toHaveLength(2);
    });

    it("excludes lessons from other courses", () => {
      toggleBookmark({ userId: base.user.id, lessonId });
      const ids = getBookmarkedLessonIds({
        userId: base.user.id,
        courseId: base.course.id + 999,
      });
      expect(ids).toEqual([]);
    });

    it("excludes other users bookmarks", () => {
      toggleBookmark({ userId: base.instructor.id, lessonId });
      const ids = getBookmarkedLessonIds({
        userId: base.user.id,
        courseId: base.course.id,
      });
      expect(ids).toEqual([]);
    });
  });
});
