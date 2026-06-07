import { eq, and, sql, gt, lt, gte, lte } from "drizzle-orm";
import { db } from "~/db";
import { lessons } from "~/db/schema";

// ─── Lesson Service ───
// Handles lesson CRUD and reordering within modules.

export function getLessonById(id: number) {
  return db.select().from(lessons).where(eq(lessons.id, id)).get();
}

export function getLessonsByModule(moduleId: number) {
  return db
    .select()
    .from(lessons)
    .where(eq(lessons.moduleId, moduleId))
    .orderBy(lessons.position)
    .all();
}

export function getLessonCount(moduleId: number) {
  const result = db
    .select({ count: sql<number>`count(*)` })
    .from(lessons)
    .where(eq(lessons.moduleId, moduleId))
    .get();
  return result?.count ?? 0;
}

export function createLesson(opts: {
  moduleId: number;
  title: string;
  content: string | null;
  videoUrl: string | null;
  position: number | null;
  durationMinutes: number | null;
}) {
  const pos =
    opts.position ??
    db
      .select({ max: sql<number>`coalesce(max(${lessons.position}), 0)` })
      .from(lessons)
      .where(eq(lessons.moduleId, opts.moduleId))
      .get()!.max + 1;

  return db
    .insert(lessons)
    .values({
      moduleId: opts.moduleId,
      title: opts.title,
      content: opts.content,
      videoUrl: opts.videoUrl,
      position: pos,
      durationMinutes: opts.durationMinutes,
    })
    .returning()
    .get();
}

export function updateLesson(opts: {
  id: number;
  title: string | null;
  content: string | null;
  videoUrl: string | null;
  durationMinutes: number | null;
  githubRepoUrl?: string | null;
}) {
  const updates: Record<string, unknown> = {};
  if (opts.title !== null) updates.title = opts.title;
  if (opts.content !== null) updates.content = opts.content;
  if (opts.videoUrl !== null) updates.videoUrl = opts.videoUrl;
  if (opts.durationMinutes !== null) updates.durationMinutes = opts.durationMinutes;
  if ((opts.githubRepoUrl ?? null) !== null) updates.githubRepoUrl = opts.githubRepoUrl;

  if (Object.keys(updates).length === 0) {
    return getLessonById(opts.id);
  }

  return db
    .update(lessons)
    .set(updates)
    .where(eq(lessons.id, opts.id))
    .returning()
    .get();
}

export function updateLessonTitle(id: number, title: string) {
  return db
    .update(lessons)
    .set({ title })
    .where(eq(lessons.id, id))
    .returning()
    .get();
}

export function updateLessonContent(id: number, content: string) {
  return db
    .update(lessons)
    .set({ content })
    .where(eq(lessons.id, id))
    .returning()
    .get();
}

export function deleteLesson(id: number) {
  return db.delete(lessons).where(eq(lessons.id, id)).returning().get();
}

// ─── Reordering ───

export function moveLessonToPosition(opts: {
  lessonId: number;
  newPosition: number;
}) {
  const lesson = getLessonById(opts.lessonId);
  if (!lesson) return null;

  const oldPosition = lesson.position;
  if (oldPosition === opts.newPosition) return lesson;

  if (opts.newPosition > oldPosition) {
    // Moving down: shift items between old+1 and new up by 1
    db.update(lessons)
      .set({ position: sql`${lessons.position} - 1` })
      .where(
        and(
          eq(lessons.moduleId, lesson.moduleId),
          gt(lessons.position, oldPosition),
          lte(lessons.position, opts.newPosition)
        )
      )
      .run();
  } else {
    // Moving up: shift items between new and old-1 down by 1
    db.update(lessons)
      .set({ position: sql`${lessons.position} + 1` })
      .where(
        and(
          eq(lessons.moduleId, lesson.moduleId),
          gte(lessons.position, opts.newPosition),
          lt(lessons.position, oldPosition)
        )
      )
      .run();
  }

  return db
    .update(lessons)
    .set({ position: opts.newPosition })
    .where(eq(lessons.id, opts.lessonId))
    .returning()
    .get();
}

export function swapLessonPositions(opts: {
  lessonIdA: number;
  lessonIdB: number;
}) {
  const lessonA = getLessonById(opts.lessonIdA);
  const lessonB = getLessonById(opts.lessonIdB);
  if (!lessonA || !lessonB) return null;

  db.update(lessons)
    .set({ position: lessonB.position })
    .where(eq(lessons.id, opts.lessonIdA))
    .run();

  db.update(lessons)
    .set({ position: lessonA.position })
    .where(eq(lessons.id, opts.lessonIdB))
    .run();

  return {
    a: { ...lessonA, position: lessonB.position },
    b: { ...lessonB, position: lessonA.position },
  };
}

export function reorderLessons(moduleId: number, lessonIds: number[]) {
  for (let i = 0; i < lessonIds.length; i++) {
    db.update(lessons)
      .set({ position: i + 1 })
      .where(and(eq(lessons.id, lessonIds[i]), eq(lessons.moduleId, moduleId)))
      .run();
  }
  return getLessonsByModule(moduleId);
}

/**
 * Move a lesson from one module to another at a specific position.
 * Closes the gap in the source module and opens a gap in the destination module.
 */
export function moveLessonToModule(opts: {
  lessonId: number;
  targetModuleId: number;
  targetPosition: number;
}) {
  const lesson = getLessonById(opts.lessonId);
  if (!lesson) return null;

  const sourceModuleId = lesson.moduleId;

  // 1. Close the gap in the source module
  db.update(lessons)
    .set({ position: sql`${lessons.position} - 1` })
    .where(
      and(
        eq(lessons.moduleId, sourceModuleId),
        gt(lessons.position, lesson.position)
      )
    )
    .run();

  // 2. Open a gap in the destination module
  db.update(lessons)
    .set({ position: sql`${lessons.position} + 1` })
    .where(
      and(
        eq(lessons.moduleId, opts.targetModuleId),
        gte(lessons.position, opts.targetPosition)
      )
    )
    .run();

  // 3. Move the lesson to the target module at the target position
  return db
    .update(lessons)
    .set({ moduleId: opts.targetModuleId, position: opts.targetPosition })
    .where(eq(lessons.id, opts.lessonId))
    .returning()
    .get();
}
