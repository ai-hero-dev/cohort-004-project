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
  createNotification,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from "./notificationService";

function makeNotification(recipientUserId: number, overrides?: Partial<Parameters<typeof createNotification>[0]>) {
  return createNotification({
    recipientUserId,
    type: schema.NotificationType.Enrollment,
    title: "New Enrollment",
    message: "Test User enrolled in Test Course",
    linkUrl: "/instructor/1/students",
    ...overrides,
  });
}

describe("notificationService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  describe("createNotification", () => {
    it("creates a notification with all fields", () => {
      const notification = makeNotification(base.instructor.id);

      expect(notification).toBeDefined();
      expect(notification.recipientUserId).toBe(base.instructor.id);
      expect(notification.type).toBe(schema.NotificationType.Enrollment);
      expect(notification.title).toBe("New Enrollment");
      expect(notification.message).toBe("Test User enrolled in Test Course");
      expect(notification.linkUrl).toBe("/instructor/1/students");
      expect(notification.isRead).toBe(false);
      expect(notification.createdAt).toBeDefined();
    });
  });

  describe("getNotifications", () => {
    it("returns notifications for a user ordered newest first", () => {
      const first = makeNotification(base.instructor.id, { message: "First" });
      const second = makeNotification(base.instructor.id, { message: "Second" });

      const results = getNotifications({ userId: base.instructor.id, limit: 10, offset: 0 });

      expect(results).toHaveLength(2);
      // newest first — second was inserted last, so its id > first's id
      expect(results[0].id).toBe(second.id);
      expect(results[1].id).toBe(first.id);
    });

    it("respects limit", () => {
      makeNotification(base.instructor.id);
      makeNotification(base.instructor.id);
      makeNotification(base.instructor.id);

      const results = getNotifications({ userId: base.instructor.id, limit: 2, offset: 0 });
      expect(results).toHaveLength(2);
    });

    it("respects offset", () => {
      makeNotification(base.instructor.id, { message: "First" });
      makeNotification(base.instructor.id, { message: "Second" });
      makeNotification(base.instructor.id, { message: "Third" });

      const results = getNotifications({ userId: base.instructor.id, limit: 10, offset: 1 });
      expect(results).toHaveLength(2);
    });

    it("only returns notifications for the specified user", () => {
      const otherUser = testDb
        .insert(schema.users)
        .values({ name: "Other", email: "other@example.com", role: schema.UserRole.Instructor })
        .returning()
        .get();

      makeNotification(base.instructor.id);
      makeNotification(otherUser.id);

      const results = getNotifications({ userId: base.instructor.id, limit: 10, offset: 0 });
      expect(results).toHaveLength(1);
      expect(results[0].recipientUserId).toBe(base.instructor.id);
    });

    it("returns empty array when user has no notifications", () => {
      const results = getNotifications({ userId: base.instructor.id, limit: 10, offset: 0 });
      expect(results).toHaveLength(0);
    });
  });

  describe("getUnreadCount", () => {
    it("returns the count of unread notifications", () => {
      makeNotification(base.instructor.id);
      makeNotification(base.instructor.id);

      expect(getUnreadCount(base.instructor.id)).toBe(2);
    });

    it("returns 0 when all notifications are read", () => {
      const n = makeNotification(base.instructor.id);
      markAsRead(n.id);

      expect(getUnreadCount(base.instructor.id)).toBe(0);
    });

    it("returns 0 when user has no notifications", () => {
      expect(getUnreadCount(base.instructor.id)).toBe(0);
    });

    it("only counts unread notifications for the specified user", () => {
      const otherUser = testDb
        .insert(schema.users)
        .values({ name: "Other", email: "other@example.com", role: schema.UserRole.Instructor })
        .returning()
        .get();

      makeNotification(base.instructor.id);
      makeNotification(otherUser.id);

      expect(getUnreadCount(base.instructor.id)).toBe(1);
    });
  });

  describe("markAsRead", () => {
    it("marks a notification as read", () => {
      const notification = makeNotification(base.instructor.id);
      expect(notification.isRead).toBe(false);

      const updated = markAsRead(notification.id);
      expect(updated?.isRead).toBe(true);
    });

    it("does not affect other notifications", () => {
      const n1 = makeNotification(base.instructor.id);
      const n2 = makeNotification(base.instructor.id);

      markAsRead(n1.id);

      expect(getUnreadCount(base.instructor.id)).toBe(1);
      const remaining = getNotifications({ userId: base.instructor.id, limit: 10, offset: 0 });
      const n2State = remaining.find((n) => n.id === n2.id);
      expect(n2State?.isRead).toBe(false);
    });
  });

  describe("markAllAsRead", () => {
    it("marks all notifications as read for a user", () => {
      makeNotification(base.instructor.id);
      makeNotification(base.instructor.id);

      markAllAsRead(base.instructor.id);

      expect(getUnreadCount(base.instructor.id)).toBe(0);
    });

    it("does not affect other users' notifications", () => {
      const otherUser = testDb
        .insert(schema.users)
        .values({ name: "Other", email: "other@example.com", role: schema.UserRole.Instructor })
        .returning()
        .get();

      makeNotification(base.instructor.id);
      makeNotification(otherUser.id);

      markAllAsRead(base.instructor.id);

      expect(getUnreadCount(otherUser.id)).toBe(1);
    });
  });
});
