import { eq, like, and, or, sql } from "drizzle-orm";
import { db } from "~/db";
import {
  courses,
  categories,
  users,
  modules,
  lessons,
  CourseStatus,
} from "~/db/schema";

// ─── Course Service ───
// Handles course CRUD, search, category filtering, and status transitions.

export function getAllCourses() {
  return db.select().from(courses).all();
}

export function getCourseById(id: number) {
  return db.select().from(courses).where(eq(courses.id, id)).get();
}

export function getCourseBySlug(slug: string) {
  return db.select().from(courses).where(eq(courses.slug, slug)).get();
}

export function getCoursesByInstructor(instructorId: number) {
  return db
    .select()
    .from(courses)
    .where(eq(courses.instructorId, instructorId))
    .all();
}

export function getCoursesByCategory(categoryId: number) {
  return db
    .select()
    .from(courses)
    .where(eq(courses.categoryId, categoryId))
    .all();
}

export function getCoursesByStatus(status: CourseStatus) {
  return db.select().from(courses).where(eq(courses.status, status)).all();
}

export function getPublishedCourses() {
  return getCoursesByStatus(CourseStatus.Published);
}

export function buildCourseQuery(opts: {
  search: string | null;
  category: string | null;
  status: CourseStatus | null;
  sortBy: string | null;
  limit: number;
  offset: number;
}) {
  const conditions = [];

  if (opts.status) {
    conditions.push(eq(courses.status, opts.status));
  }

  if (opts.search) {
    const term = `%${opts.search}%`;
    conditions.push(
      or(like(courses.title, term), like(courses.description, term))!
    );
  }

  const query = db
    .select({
      id: courses.id,
      title: courses.title,
      slug: courses.slug,
      description: courses.description,
      salesCopy: courses.salesCopy,
      instructorId: courses.instructorId,
      categoryId: courses.categoryId,
      status: courses.status,
      coverImageUrl: courses.coverImageUrl,
      price: courses.price,
      pppEnabled: courses.pppEnabled,
      createdAt: courses.createdAt,
      updatedAt: courses.updatedAt,
      instructorName: users.name,
      instructorAvatarUrl: users.avatarUrl,
      categoryName: categories.name,
    })
    .from(courses)
    .innerJoin(users, eq(courses.instructorId, users.id))
    .innerJoin(categories, eq(courses.categoryId, categories.id));

  if (opts.category) {
    conditions.push(eq(categories.slug, opts.category));
  }

  const filtered =
    conditions.length > 0 ? query.where(and(...conditions)) : query;

  const sorted =
    opts.sortBy === "title"
      ? filtered.orderBy(courses.title)
      : opts.sortBy === "oldest"
        ? filtered.orderBy(courses.createdAt)
        : filtered.orderBy(sql`${courses.createdAt} DESC`);

  return sorted.limit(opts.limit).offset(opts.offset).all();
}

export function getCourseWithDetails(id: number) {
  const course = db
    .select({
      id: courses.id,
      title: courses.title,
      slug: courses.slug,
      description: courses.description,
      salesCopy: courses.salesCopy,
      instructorId: courses.instructorId,
      categoryId: courses.categoryId,
      status: courses.status,
      coverImageUrl: courses.coverImageUrl,
      price: courses.price,
      pppEnabled: courses.pppEnabled,
      createdAt: courses.createdAt,
      updatedAt: courses.updatedAt,
      instructorName: users.name,
      instructorAvatarUrl: users.avatarUrl,
      instructorBio: users.bio,
      categoryName: categories.name,
    })
    .from(courses)
    .innerJoin(users, eq(courses.instructorId, users.id))
    .innerJoin(categories, eq(courses.categoryId, categories.id))
    .where(eq(courses.id, id))
    .get();

  if (!course) return null;

  const courseModules = db
    .select()
    .from(modules)
    .where(eq(modules.courseId, id))
    .orderBy(modules.position)
    .all();

  const moduleIds = courseModules.map((m) => m.id);

  const courseLessons =
    moduleIds.length > 0
      ? db
          .select()
          .from(lessons)
          .where(or(...moduleIds.map((mid) => eq(lessons.moduleId, mid)))!)
          .orderBy(lessons.position)
          .all()
      : [];

  return {
    ...course,
    modules: courseModules.map((mod) => ({
      ...mod,
      lessons: courseLessons.filter((l) => l.moduleId === mod.id),
    })),
  };
}

export function getLessonCountForCourse(courseId: number) {
  const courseModules = db
    .select({ id: modules.id })
    .from(modules)
    .where(eq(modules.courseId, courseId))
    .all();

  if (courseModules.length === 0) return 0;

  const count = db
    .select({ count: sql<number>`count(*)` })
    .from(lessons)
    .where(or(...courseModules.map((m) => eq(lessons.moduleId, m.id)))!)
    .get();

  return count?.count ?? 0;
}

export function createCourse(opts: {
  title: string;
  slug: string;
  description: string;
  instructorId: number;
  categoryId: number;
  coverImageUrl: string | null;
}) {
  return db
    .insert(courses)
    .values({
      title: opts.title,
      slug: opts.slug,
      description: opts.description,
      instructorId: opts.instructorId,
      categoryId: opts.categoryId,
      status: CourseStatus.Draft,
      coverImageUrl: opts.coverImageUrl,
    })
    .returning()
    .get();
}

export function updateCourse(opts: {
  id: number;
  title: string;
  description: string;
}) {
  return db
    .update(courses)
    .set({ title: opts.title, description: opts.description, updatedAt: new Date().toISOString() })
    .where(eq(courses.id, opts.id))
    .returning()
    .get();
}

export function updateCourseStatus(id: number, status: CourseStatus) {
  return db
    .update(courses)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(eq(courses.id, id))
    .returning()
    .get();
}

export function updateCourseSalesCopy(id: number, salesCopy: string | null) {
  return db
    .update(courses)
    .set({ salesCopy, updatedAt: new Date().toISOString() })
    .where(eq(courses.id, id))
    .returning()
    .get();
}

export function updateCoursePrice(opts: {
  id: number;
  price: number;
}) {
  return db
    .update(courses)
    .set({ price: opts.price, updatedAt: new Date().toISOString() })
    .where(eq(courses.id, opts.id))
    .returning()
    .get();
}

export function updateCoursePppEnabled(id: number, pppEnabled: boolean) {
  return db
    .update(courses)
    .set({ pppEnabled, updatedAt: new Date().toISOString() })
    .where(eq(courses.id, id))
    .returning()
    .get();
}

export function deleteCourse(id: number) {
  return db.delete(courses).where(eq(courses.id, id)).returning().get();
}
