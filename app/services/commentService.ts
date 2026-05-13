import { eq, asc } from "drizzle-orm";
import { db } from "~/db";
import {
  lessonComments,
  users,
  courses,
  lessons,
  modules,
  UserRole,
} from "~/db/schema";

import { COMMENT_MAX_LENGTH } from "./commentConstants";

// ─── Comment Service ───
// Lesson discussion comments. Flat list, soft delete, plain text.
// Uses positional parameters (project convention).

export { COMMENT_MAX_LENGTH };

export type CommentWithAuthor = {
  id: number;
  lessonId: number;
  userId: number;
  content: string;
  createdAt: string;
  deletedAt: string | null;
  authorName: string;
  authorAvatarUrl: string | null;
  authorRole: UserRole;
};

export function listCommentsForLesson(
  lessonId: number
): CommentWithAuthor[] {
  return db
    .select({
      id: lessonComments.id,
      lessonId: lessonComments.lessonId,
      userId: lessonComments.userId,
      content: lessonComments.content,
      createdAt: lessonComments.createdAt,
      deletedAt: lessonComments.deletedAt,
      authorName: users.name,
      authorAvatarUrl: users.avatarUrl,
      authorRole: users.role,
    })
    .from(lessonComments)
    .innerJoin(users, eq(users.id, lessonComments.userId))
    .where(eq(lessonComments.lessonId, lessonId))
    .orderBy(asc(lessonComments.createdAt))
    .all() as CommentWithAuthor[];
}

export function createComment(
  lessonId: number,
  userId: number,
  content: string
) {
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    throw new Error("Comment cannot be empty");
  }
  if (trimmed.length > COMMENT_MAX_LENGTH) {
    throw new Error(`Comment exceeds ${COMMENT_MAX_LENGTH} characters`);
  }

  return db
    .insert(lessonComments)
    .values({ lessonId, userId, content: trimmed })
    .returning()
    .get();
}

export function getCommentById(id: number) {
  return db
    .select()
    .from(lessonComments)
    .where(eq(lessonComments.id, id))
    .get();
}

/**
 * Returns the instructor id of the course that owns the given lesson.
 * Used to authorize comment deletion.
 */
export function getInstructorIdForLesson(lessonId: number): number | null {
  const row = db
    .select({ instructorId: courses.instructorId })
    .from(lessons)
    .innerJoin(modules, eq(modules.id, lessons.moduleId))
    .innerJoin(courses, eq(courses.id, modules.courseId))
    .where(eq(lessons.id, lessonId))
    .get();
  return row?.instructorId ?? null;
}

/**
 * Soft deletes a comment. Returns null if not authorized or not found.
 * Allowed for: comment author, the lesson's course instructor, or any admin.
 */
export function softDeleteComment(
  commentId: number,
  actingUserId: number,
  actingUserRole: UserRole
) {
  const comment = getCommentById(commentId);
  if (!comment) return null;
  if (comment.deletedAt) return comment;

  const isAuthor = comment.userId === actingUserId;
  const isAdmin = actingUserRole === UserRole.Admin;
  const instructorId = isAuthor || isAdmin
    ? null
    : getInstructorIdForLesson(comment.lessonId);
  const isInstructor = instructorId === actingUserId;

  if (!isAuthor && !isAdmin && !isInstructor) {
    return null;
  }

  return db
    .update(lessonComments)
    .set({ deletedAt: new Date().toISOString() })
    .where(eq(lessonComments.id, commentId))
    .returning()
    .get();
}
