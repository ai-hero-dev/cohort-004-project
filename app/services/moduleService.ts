import { eq, and, sql, gt, lt, gte, lte } from "drizzle-orm";
import { db } from "~/db";
import { modules, lessons } from "~/db/schema";

// ─── Module Service ───
// Handles module CRUD and reordering within courses.

export function getModuleById(id: number) {
  return db.select().from(modules).where(eq(modules.id, id)).get();
}

export function getModulesByCourse(courseId: number) {
  return db
    .select()
    .from(modules)
    .where(eq(modules.courseId, courseId))
    .orderBy(modules.position)
    .all();
}

export function getModuleWithLessons(id: number) {
  const mod = getModuleById(id);
  if (!mod) return null;

  const moduleLessons = db
    .select()
    .from(lessons)
    .where(eq(lessons.moduleId, id))
    .orderBy(lessons.position)
    .all();

  return { ...mod, lessons: moduleLessons };
}

export function createModule(
  courseId: number,
  title: string,
  position: number | null
) {
  const pos =
    position ??
    db
      .select({ max: sql<number>`coalesce(max(${modules.position}), 0)` })
      .from(modules)
      .where(eq(modules.courseId, courseId))
      .get()!.max + 1;

  return db
    .insert(modules)
    .values({ courseId, title, position: pos })
    .returning()
    .get();
}

export function updateModuleTitle(id: number, title: string) {
  return db
    .update(modules)
    .set({ title })
    .where(eq(modules.id, id))
    .returning()
    .get();
}

export function deleteModule(id: number) {
  // Delete all lessons in this module first
  db.delete(lessons).where(eq(lessons.moduleId, id)).run();
  return db.delete(modules).where(eq(modules.id, id)).returning().get();
}

export function getModuleCount(courseId: number) {
  const result = db
    .select({ count: sql<number>`count(*)` })
    .from(modules)
    .where(eq(modules.courseId, courseId))
    .get();
  return result?.count ?? 0;
}

// ─── Reordering ───

export function moveModuleToPosition(opts: {
  moduleId: number;
  newPosition: number;
}) {
  const mod = getModuleById(opts.moduleId);
  if (!mod) return null;

  const oldPosition = mod.position;
  if (oldPosition === opts.newPosition) return mod;

  if (opts.newPosition > oldPosition) {
    // Moving down: shift items between old+1 and new up by 1
    db.update(modules)
      .set({ position: sql`${modules.position} - 1` })
      .where(
        and(
          eq(modules.courseId, mod.courseId),
          gt(modules.position, oldPosition),
          lte(modules.position, opts.newPosition)
        )
      )
      .run();
  } else {
    // Moving up: shift items between new and old-1 down by 1
    db.update(modules)
      .set({ position: sql`${modules.position} + 1` })
      .where(
        and(
          eq(modules.courseId, mod.courseId),
          gte(modules.position, opts.newPosition),
          lt(modules.position, oldPosition)
        )
      )
      .run();
  }

  return db
    .update(modules)
    .set({ position: opts.newPosition })
    .where(eq(modules.id, opts.moduleId))
    .returning()
    .get();
}

export function swapModulePositions(opts: {
  moduleIdA: number;
  moduleIdB: number;
}) {
  const modA = getModuleById(opts.moduleIdA);
  const modB = getModuleById(opts.moduleIdB);
  if (!modA || !modB) return null;

  db.update(modules)
    .set({ position: modB.position })
    .where(eq(modules.id, opts.moduleIdA))
    .run();

  db.update(modules)
    .set({ position: modA.position })
    .where(eq(modules.id, opts.moduleIdB))
    .run();

  return {
    a: { ...modA, position: modB.position },
    b: { ...modB, position: modA.position },
  };
}

export function reorderModules(courseId: number, moduleIds: number[]) {
  for (let i = 0; i < moduleIds.length; i++) {
    db.update(modules)
      .set({ position: i + 1 })
      .where(and(eq(modules.id, moduleIds[i]), eq(modules.courseId, courseId)))
      .run();
  }
  return getModulesByCourse(courseId);
}
