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
  listCommentsForLesson,
  createComment,
  softDeleteComment,
  COMMENT_MAX_LENGTH,
} from "./commentService";
import { createModule } from "./moduleService";
import { createLesson } from "./lessonService";

let lessonId: number;

describe("commentService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
    const mod = createModule(base.course.id, "Test Module", 1);
    const lesson = createLesson({ moduleId: mod.id, title: "L1", content: null, videoUrl: null, position: 1, durationMinutes: null });
    lessonId = lesson.id;
  });

  describe("createComment", () => {
    it("creates a comment with trimmed content", () => {
      const c = createComment({ lessonId, userId: base.user.id, content: "  hello  " });
      expect(c.content).toBe("hello");
      expect(c.lessonId).toBe(lessonId);
      expect(c.userId).toBe(base.user.id);
      expect(c.deletedAt).toBeNull();
    });

    it("rejects empty content", () => {
      expect(() => createComment({ lessonId, userId: base.user.id, content: "   " })).toThrow();
    });

    it("rejects content over the limit", () => {
      const long = "a".repeat(COMMENT_MAX_LENGTH + 1);
      expect(() => createComment({ lessonId, userId: base.user.id, content: long })).toThrow();
    });
  });

  describe("listCommentsForLesson", () => {
    it("returns comments oldest-first with author info", () => {
      const a = createComment({ lessonId, userId: base.user.id, content: "first" });
      const b = createComment({ lessonId, userId: base.instructor.id, content: "second" });

      const list = listCommentsForLesson(lessonId);
      expect(list.map((c) => c.id)).toEqual([a.id, b.id]);
      expect(list[0].authorName).toBe(base.user.name);
      expect(list[1].authorRole).toBe(schema.UserRole.Instructor);
    });

    it("includes soft-deleted comments (renderable as [deleted])", () => {
      const c = createComment({ lessonId, userId: base.user.id, content: "oops" });
      softDeleteComment({ commentId: c.id, actingUserId: base.user.id, actingUserRole: schema.UserRole.Student });
      const list = listCommentsForLesson(lessonId);
      expect(list).toHaveLength(1);
      expect(list[0].deletedAt).not.toBeNull();
    });
  });

  describe("softDeleteComment", () => {
    it("lets author delete own comment", () => {
      const c = createComment({ lessonId, userId: base.user.id, content: "mine" });
      const res = softDeleteComment({ commentId: c.id, actingUserId: base.user.id, actingUserRole: schema.UserRole.Student });
      expect(res?.deletedAt).not.toBeNull();
    });

    it("lets the course instructor delete any comment on the lesson", () => {
      const c = createComment({ lessonId, userId: base.user.id, content: "mine" });
      const res = softDeleteComment({
        commentId: c.id,
        actingUserId: base.instructor.id,
        actingUserRole: schema.UserRole.Instructor,
      });
      expect(res?.deletedAt).not.toBeNull();
    });

    it("lets an admin delete any comment", () => {
      const admin = testDb
        .insert(schema.users)
        .values({
          name: "Admin",
          email: "admin@example.com",
          role: schema.UserRole.Admin,
        })
        .returning()
        .get();
      const c = createComment({ lessonId, userId: base.user.id, content: "mine" });
      const res = softDeleteComment({ commentId: c.id, actingUserId: admin.id, actingUserRole: schema.UserRole.Admin });
      expect(res?.deletedAt).not.toBeNull();
    });

    it("refuses delete by an unrelated student", () => {
      const other = testDb
        .insert(schema.users)
        .values({
          name: "Other",
          email: "other@example.com",
          role: schema.UserRole.Student,
        })
        .returning()
        .get();
      const c = createComment({ lessonId, userId: base.user.id, content: "mine" });
      const res = softDeleteComment({ commentId: c.id, actingUserId: other.id, actingUserRole: schema.UserRole.Student });
      expect(res).toBeNull();
    });

    it("returns null for unknown comment", () => {
      const res = softDeleteComment({ commentId: 999999, actingUserId: base.user.id, actingUserRole: schema.UserRole.Student });
      expect(res).toBeNull();
    });
  });
});
