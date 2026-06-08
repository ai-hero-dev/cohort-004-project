import { eq, desc, and, sql } from "drizzle-orm";
import { db } from "~/db";
import { notifications } from "~/db/schema";
import type { NotificationType } from "~/db/schema";

export function createNotification(opts: {
  recipientUserId: number;
  type: NotificationType;
  title: string;
  message: string;
  linkUrl: string;
}) {
  return db.insert(notifications).values(opts).returning().get();
}

export function getNotifications(opts: {
  userId: number;
  limit: number;
  offset: number;
}) {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.recipientUserId, opts.userId))
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(opts.limit)
    .offset(opts.offset)
    .all();
}

export function getUnreadCount(userId: number) {
  const result = db
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(
      and(
        eq(notifications.recipientUserId, userId),
        eq(notifications.isRead, false)
      )
    )
    .get();

  return result?.count ?? 0;
}

export function getNotificationByIdForUser(opts: {
  notificationId: number;
  userId: number;
}) {
  return db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.id, opts.notificationId),
        eq(notifications.recipientUserId, opts.userId)
      )
    )
    .get();
}

export function markAsRead(notificationId: number) {
  return db
    .update(notifications)
    .set({ isRead: true })
    .where(eq(notifications.id, notificationId))
    .returning()
    .get();
}

export function markAllAsRead(userId: number) {
  return db
    .update(notifications)
    .set({ isRead: true })
    .where(
      and(
        eq(notifications.recipientUserId, userId),
        eq(notifications.isRead, false)
      )
    )
    .returning()
    .all();
}
