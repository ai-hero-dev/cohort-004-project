import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as _schema from "~/db/schema";

let testDb: ReturnType<typeof createTestDb>;
let base: ReturnType<typeof seedBaseData>;

vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

// Import after mock so the module picks up our test db
import {
  getLessonById,
  getLessonsByModule,
  getLessonCount,
  createLesson,
  updateLesson,
  updateLessonTitle,
  updateLessonContent,
  deleteLesson,
  moveLessonToPosition,
  swapLessonPositions,
  reorderLessons,
} from "./lessonService";
import { createModule } from "./moduleService";

let moduleId: number;

describe("lessonService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
    // Create a module to hold lessons
    const mod = createModule(base.course.id, "Test Module", 1);
    moduleId = mod.id;
  });

  // ─── CRUD ───

  describe("createLesson", () => {
    it("creates a lesson with explicit position", () => {
      const lesson = createLesson({ moduleId, title: "Lesson 1", content: "Some content", videoUrl: null, position: 1, durationMinutes: 30 });

      expect(lesson).toBeDefined();
      expect(lesson.title).toBe("Lesson 1");
      expect(lesson.moduleId).toBe(moduleId);
      expect(lesson.content).toBe("Some content");
      expect(lesson.position).toBe(1);
      expect(lesson.durationMinutes).toBe(30);
    });

    it("auto-calculates position when null", () => {
      createLesson({ moduleId, title: "Lesson 1", content: null, videoUrl: null, position: null, durationMinutes: null });
      const l2 = createLesson({ moduleId, title: "Lesson 2", content: null, videoUrl: null, position: null, durationMinutes: null });

      expect(l2.position).toBe(2);
    });

    it("starts auto position at 1 for empty module", () => {
      const lesson = createLesson({ moduleId, title: "First", content: null, videoUrl: null, position: null, durationMinutes: null });

      expect(lesson.position).toBe(1);
    });

    it("creates a lesson with video URL", () => {
      const lesson = createLesson({
        moduleId,
        title: "Video Lesson",
        content: null,
        videoUrl: "https://youtube.com/watch?v=abc123",
        position: 1,
        durationMinutes: null,
      });

      expect(lesson.videoUrl).toBe("https://youtube.com/watch?v=abc123");
    });
  });

  describe("getLessonById", () => {
    it("returns a lesson by id", () => {
      const created = createLesson({ moduleId, title: "Find Me", content: null, videoUrl: null, position: 1, durationMinutes: null });

      const found = getLessonById(created.id);
      expect(found).toBeDefined();
      expect(found!.title).toBe("Find Me");
    });

    it("returns undefined for non-existent id", () => {
      expect(getLessonById(9999)).toBeUndefined();
    });
  });

  describe("getLessonsByModule", () => {
    it("returns lessons ordered by position", () => {
      createLesson({ moduleId, title: "Third", content: null, videoUrl: null, position: 3, durationMinutes: null });
      createLesson({ moduleId, title: "First", content: null, videoUrl: null, position: 1, durationMinutes: null });
      createLesson({ moduleId, title: "Second", content: null, videoUrl: null, position: 2, durationMinutes: null });

      const lessons = getLessonsByModule(moduleId);
      expect(lessons).toHaveLength(3);
      expect(lessons[0].title).toBe("First");
      expect(lessons[1].title).toBe("Second");
      expect(lessons[2].title).toBe("Third");
    });

    it("returns empty array for module with no lessons", () => {
      expect(getLessonsByModule(moduleId)).toHaveLength(0);
    });
  });

  describe("getLessonCount", () => {
    it("returns the number of lessons in a module", () => {
      createLesson({ moduleId, title: "L1", content: null, videoUrl: null, position: 1, durationMinutes: null });
      createLesson({ moduleId, title: "L2", content: null, videoUrl: null, position: 2, durationMinutes: null });

      expect(getLessonCount(moduleId)).toBe(2);
    });

    it("returns 0 for module with no lessons", () => {
      expect(getLessonCount(moduleId)).toBe(0);
    });
  });

  describe("updateLesson", () => {
    it("updates title when provided", () => {
      const lesson = createLesson({ moduleId, title: "Old", content: "old content", videoUrl: null, position: 1, durationMinutes: 10 });

      const updated = updateLesson({ id: lesson.id, title: "New Title", content: null, videoUrl: null, durationMinutes: null });
      expect(updated!.title).toBe("New Title");
      expect(updated!.content).toBe("old content"); // unchanged
    });

    it("updates content when provided", () => {
      const lesson = createLesson({ moduleId, title: "Title", content: "old content", videoUrl: null, position: 1, durationMinutes: null });

      const updated = updateLesson({ id: lesson.id, title: null, content: "new content", videoUrl: null, durationMinutes: null });
      expect(updated!.content).toBe("new content");
      expect(updated!.title).toBe("Title"); // unchanged
    });

    it("updates multiple fields at once", () => {
      const lesson = createLesson({ moduleId, title: "Old", content: null, videoUrl: null, position: 1, durationMinutes: null });

      const updated = updateLesson({ id: lesson.id, title: "New", content: "some content", videoUrl: "https://yt.com", durationMinutes: 45 });
      expect(updated!.title).toBe("New");
      expect(updated!.content).toBe("some content");
      expect(updated!.videoUrl).toBe("https://yt.com");
      expect(updated!.durationMinutes).toBe(45);
    });

    it("returns lesson unchanged when all fields are null", () => {
      const lesson = createLesson({ moduleId, title: "Same", content: "same content", videoUrl: null, position: 1, durationMinutes: 10 });

      const result = updateLesson({ id: lesson.id, title: null, content: null, videoUrl: null, durationMinutes: null });
      expect(result!.title).toBe("Same");
      expect(result!.content).toBe("same content");
    });
  });

  describe("updateLessonTitle", () => {
    it("updates just the title", () => {
      const lesson = createLesson({ moduleId, title: "Old Title", content: null, videoUrl: null, position: 1, durationMinutes: null });

      const updated = updateLessonTitle(lesson.id, "New Title");
      expect(updated!.title).toBe("New Title");
    });
  });

  describe("updateLessonContent", () => {
    it("updates just the content", () => {
      const lesson = createLesson({ moduleId, title: "Title", content: "old content", videoUrl: null, position: 1, durationMinutes: null });

      const updated = updateLessonContent(lesson.id, "new content");
      expect(updated!.content).toBe("new content");
    });
  });

  describe("deleteLesson", () => {
    it("deletes a lesson", () => {
      const lesson = createLesson({ moduleId, title: "Delete Me", content: null, videoUrl: null, position: 1, durationMinutes: null });

      const deleted = deleteLesson(lesson.id);
      expect(deleted).toBeDefined();
      expect(deleted!.id).toBe(lesson.id);

      expect(getLessonById(lesson.id)).toBeUndefined();
    });
  });

  // ─── Reordering ───

  describe("moveLessonToPosition", () => {
    it("moves a lesson down (position 1 → 3)", () => {
      const l1 = createLesson({ moduleId, title: "L1", content: null, videoUrl: null, position: 1, durationMinutes: null });
      const _l2 = createLesson({ moduleId, title: "L2", content: null, videoUrl: null, position: 2, durationMinutes: null });
      const _l3 = createLesson({ moduleId, title: "L3", content: null, videoUrl: null, position: 3, durationMinutes: null });

      const moved = moveLessonToPosition({ lessonId: l1.id, newPosition: 3 });
      expect(moved!.position).toBe(3);

      const lessons = getLessonsByModule(moduleId);
      expect(lessons[0].title).toBe("L2");
      expect(lessons[0].position).toBe(1);
      expect(lessons[1].title).toBe("L3");
      expect(lessons[1].position).toBe(2);
      expect(lessons[2].title).toBe("L1");
      expect(lessons[2].position).toBe(3);
    });

    it("moves a lesson up (position 3 → 1)", () => {
      const _l1 = createLesson({ moduleId, title: "L1", content: null, videoUrl: null, position: 1, durationMinutes: null });
      const _l2 = createLesson({ moduleId, title: "L2", content: null, videoUrl: null, position: 2, durationMinutes: null });
      const l3 = createLesson({ moduleId, title: "L3", content: null, videoUrl: null, position: 3, durationMinutes: null });

      const moved = moveLessonToPosition({ lessonId: l3.id, newPosition: 1 });
      expect(moved!.position).toBe(1);

      const lessons = getLessonsByModule(moduleId);
      expect(lessons[0].title).toBe("L3");
      expect(lessons[0].position).toBe(1);
      expect(lessons[1].title).toBe("L1");
      expect(lessons[1].position).toBe(2);
      expect(lessons[2].title).toBe("L2");
      expect(lessons[2].position).toBe(3);
    });

    it("returns lesson unchanged when moving to same position", () => {
      const l1 = createLesson({ moduleId, title: "L1", content: null, videoUrl: null, position: 1, durationMinutes: null });

      const result = moveLessonToPosition({ lessonId: l1.id, newPosition: 1 });
      expect(result!.position).toBe(1);
    });

    it("returns null for non-existent lesson", () => {
      expect(moveLessonToPosition({ lessonId: 9999, newPosition: 1 })).toBeNull();
    });

    it("moves a lesson to middle position (1 → 2 of 3)", () => {
      const l1 = createLesson({ moduleId, title: "L1", content: null, videoUrl: null, position: 1, durationMinutes: null });
      const _l2 = createLesson({ moduleId, title: "L2", content: null, videoUrl: null, position: 2, durationMinutes: null });
      const _l3 = createLesson({ moduleId, title: "L3", content: null, videoUrl: null, position: 3, durationMinutes: null });

      moveLessonToPosition({ lessonId: l1.id, newPosition: 2 });

      const lessons = getLessonsByModule(moduleId);
      expect(lessons[0].title).toBe("L2");
      expect(lessons[0].position).toBe(1);
      expect(lessons[1].title).toBe("L1");
      expect(lessons[1].position).toBe(2);
      expect(lessons[2].title).toBe("L3");
      expect(lessons[2].position).toBe(3);
    });

    it("moves from middle to end (2 → 3 of 3)", () => {
      const _l1 = createLesson({ moduleId, title: "L1", content: null, videoUrl: null, position: 1, durationMinutes: null });
      const l2 = createLesson({ moduleId, title: "L2", content: null, videoUrl: null, position: 2, durationMinutes: null });
      const _l3 = createLesson({ moduleId, title: "L3", content: null, videoUrl: null, position: 3, durationMinutes: null });

      moveLessonToPosition({ lessonId: l2.id, newPosition: 3 });

      const lessons = getLessonsByModule(moduleId);
      expect(lessons[0].title).toBe("L1");
      expect(lessons[0].position).toBe(1);
      expect(lessons[1].title).toBe("L3");
      expect(lessons[1].position).toBe(2);
      expect(lessons[2].title).toBe("L2");
      expect(lessons[2].position).toBe(3);
    });

    it("does not affect lessons in other modules", () => {
      const mod2 = createModule(base.course.id, "Module 2", 2);

      const l1 = createLesson({ moduleId, title: "L1", content: null, videoUrl: null, position: 1, durationMinutes: null });
      const _l2 = createLesson({ moduleId, title: "L2", content: null, videoUrl: null, position: 2, durationMinutes: null });
      const other = createLesson({ moduleId: mod2.id, title: "Other L1", content: null, videoUrl: null, position: 1, durationMinutes: null });

      moveLessonToPosition({ lessonId: l1.id, newPosition: 2 });

      // Other module's lesson should be untouched
      const otherLesson = getLessonById(other.id);
      expect(otherLesson!.position).toBe(1);
    });
  });

  describe("swapLessonPositions", () => {
    it("swaps positions of two lessons", () => {
      const l1 = createLesson({ moduleId, title: "L1", content: null, videoUrl: null, position: 1, durationMinutes: null });
      const l2 = createLesson({ moduleId, title: "L2", content: null, videoUrl: null, position: 2, durationMinutes: null });

      const result = swapLessonPositions({ lessonIdA: l1.id, lessonIdB: l2.id });
      expect(result).toBeDefined();
      expect(result!.a.position).toBe(2);
      expect(result!.b.position).toBe(1);

      const lessons = getLessonsByModule(moduleId);
      expect(lessons[0].title).toBe("L2");
      expect(lessons[1].title).toBe("L1");
    });

    it("swaps non-adjacent lessons", () => {
      const l1 = createLesson({ moduleId, title: "L1", content: null, videoUrl: null, position: 1, durationMinutes: null });
      const _l2 = createLesson({ moduleId, title: "L2", content: null, videoUrl: null, position: 2, durationMinutes: null });
      const l3 = createLesson({ moduleId, title: "L3", content: null, videoUrl: null, position: 3, durationMinutes: null });

      swapLessonPositions({ lessonIdA: l1.id, lessonIdB: l3.id });

      const lessons = getLessonsByModule(moduleId);
      expect(lessons[0].title).toBe("L3");
      expect(lessons[0].position).toBe(1);
      expect(lessons[1].title).toBe("L2");
      expect(lessons[1].position).toBe(2);
      expect(lessons[2].title).toBe("L1");
      expect(lessons[2].position).toBe(3);
    });

    it("returns null when first lesson does not exist", () => {
      const l1 = createLesson({ moduleId, title: "L1", content: null, videoUrl: null, position: 1, durationMinutes: null });

      expect(swapLessonPositions({ lessonIdA: 9999, lessonIdB: l1.id })).toBeNull();
    });

    it("returns null when second lesson does not exist", () => {
      const l1 = createLesson({ moduleId, title: "L1", content: null, videoUrl: null, position: 1, durationMinutes: null });

      expect(swapLessonPositions({ lessonIdA: l1.id, lessonIdB: 9999 })).toBeNull();
    });
  });

  describe("reorderLessons", () => {
    it("reorders lessons according to the given id array", () => {
      const l1 = createLesson({ moduleId, title: "L1", content: null, videoUrl: null, position: 1, durationMinutes: null });
      const l2 = createLesson({ moduleId, title: "L2", content: null, videoUrl: null, position: 2, durationMinutes: null });
      const l3 = createLesson({ moduleId, title: "L3", content: null, videoUrl: null, position: 3, durationMinutes: null });

      // Reverse the order: L3 → pos 1, L2 → pos 2, L1 → pos 3
      const result = reorderLessons(moduleId, [l3.id, l2.id, l1.id]);

      // Result is ordered by position (returned by getLessonsByModule)
      expect(result).toHaveLength(3);
      expect(result[0].title).toBe("L3");
      expect(result[0].position).toBe(1);
      expect(result[1].title).toBe("L2");
      expect(result[1].position).toBe(2);
      expect(result[2].title).toBe("L1");
      expect(result[2].position).toBe(3);
    });

    it("assigns positions starting at 1 and normalizes gaps", () => {
      const l1 = createLesson({ moduleId, title: "L1", content: null, videoUrl: null, position: 10, durationMinutes: null });
      const l2 = createLesson({ moduleId, title: "L2", content: null, videoUrl: null, position: 20, durationMinutes: null });

      reorderLessons(moduleId, [l2.id, l1.id]);

      const lessons = getLessonsByModule(moduleId);
      expect(lessons[0].position).toBe(1);
      expect(lessons[1].position).toBe(2);
    });

    it("does not reorder lessons from a different module", () => {
      const mod2 = createModule(base.course.id, "Module 2", 2);

      const l1 = createLesson({ moduleId, title: "L1", content: null, videoUrl: null, position: 1, durationMinutes: null });
      const other = createLesson({ moduleId: mod2.id, title: "Other", content: null, videoUrl: null, position: 1, durationMinutes: null });

      // Try to include a lesson from another module
      reorderLessons(moduleId, [other.id, l1.id]);

      // Other module's lesson should be unchanged — moduleId filter prevents update
      const otherLesson = getLessonById(other.id);
      expect(otherLesson!.position).toBe(1);
    });
  });
});
