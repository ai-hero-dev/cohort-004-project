import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "~/db";
import { videoWatchEvents } from "~/db/schema";

// ─── Video Tracking Service ───
// Logs video watch events and calculates watch progress per lesson.
// Uses positional parameters (project convention).

export function logWatchEvent(opts: {
  userId: number;
  lessonId: number;
  eventType: string;
  positionSeconds: number;
}) {
  return db
    .insert(videoWatchEvents)
    .values({
      userId: opts.userId,
      lessonId: opts.lessonId,
      eventType: opts.eventType,
      positionSeconds: opts.positionSeconds,
    })
    .returning()
    .get();
}

export function getWatchEvents(opts: {
  userId: number;
  lessonId: number;
}) {
  return db
    .select()
    .from(videoWatchEvents)
    .where(
      and(
        eq(videoWatchEvents.userId, opts.userId),
        eq(videoWatchEvents.lessonId, opts.lessonId)
      )
    )
    .orderBy(videoWatchEvents.createdAt)
    .all();
}

export function getLastWatchPosition(opts: {
  userId: number;
  lessonId: number;
}) {
  const lastEvent = db
    .select()
    .from(videoWatchEvents)
    .where(
      and(
        eq(videoWatchEvents.userId, opts.userId),
        eq(videoWatchEvents.lessonId, opts.lessonId)
      )
    )
    .orderBy(desc(videoWatchEvents.createdAt))
    .limit(1)
    .get();

  return lastEvent?.positionSeconds ?? 0;
}

export function getWatchEventCount(opts: {
  userId: number;
  lessonId: number;
}) {
  const result = db
    .select({ count: sql<number>`count(*)` })
    .from(videoWatchEvents)
    .where(
      and(
        eq(videoWatchEvents.userId, opts.userId),
        eq(videoWatchEvents.lessonId, opts.lessonId)
      )
    )
    .get();

  return result?.count ?? 0;
}

export function getMaxWatchPosition(opts: {
  userId: number;
  lessonId: number;
}) {
  const result = db
    .select({ maxPos: sql<number>`max(${videoWatchEvents.positionSeconds})` })
    .from(videoWatchEvents)
    .where(
      and(
        eq(videoWatchEvents.userId, opts.userId),
        eq(videoWatchEvents.lessonId, opts.lessonId)
      )
    )
    .get();

  return result?.maxPos ?? 0;
}

export function calculateWatchProgress(opts: {
  userId: number;
  lessonId: number;
  videoDurationSeconds: number;
}) {
  if (opts.videoDurationSeconds <= 0) return 0;

  const maxPosition = getMaxWatchPosition({ userId: opts.userId, lessonId: opts.lessonId });
  const progress = Math.min(
    Math.round((maxPosition / opts.videoDurationSeconds) * 100),
    100
  );

  return progress;
}

export function hasUserWatchedVideo(opts: {
  userId: number;
  lessonId: number;
}) {
  const count = getWatchEventCount({ userId: opts.userId, lessonId: opts.lessonId });
  return count > 0;
}

export function hasUserCompletedVideo(opts: {
  userId: number;
  lessonId: number;
  videoDurationSeconds: number;
  completionThreshold: number;
}) {
  const progress = calculateWatchProgress({
    userId: opts.userId,
    lessonId: opts.lessonId,
    videoDurationSeconds: opts.videoDurationSeconds,
  });
  return progress >= opts.completionThreshold;
}

export function getUserWatchHistory(userId: number) {
  return db
    .select({
      lessonId: videoWatchEvents.lessonId,
      eventCount: sql<number>`count(*)`,
      lastPosition: sql<number>`max(${videoWatchEvents.positionSeconds})`,
      lastWatched: sql<string>`max(${videoWatchEvents.createdAt})`,
    })
    .from(videoWatchEvents)
    .where(eq(videoWatchEvents.userId, userId))
    .groupBy(videoWatchEvents.lessonId)
    .all();
}

export function deleteWatchEvents(opts: { userId: number; lessonId: number }) {
  return db
    .delete(videoWatchEvents)
    .where(
      and(
        eq(videoWatchEvents.userId, opts.userId),
        eq(videoWatchEvents.lessonId, opts.lessonId)
      )
    )
    .returning()
    .all();
}
