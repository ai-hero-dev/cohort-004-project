import { eq, and, isNull } from "drizzle-orm";
import { db } from "~/db";
import { lessonComments, users } from "~/db/schema";

export function getCommentsForLesson(lessonId: number) {
  return db
    .select({
      id: lessonComments.id,
      lessonId: lessonComments.lessonId,
      userId: lessonComments.userId,
      parentId: lessonComments.parentId,
      body: lessonComments.body,
      createdAt: lessonComments.createdAt,
      deletedAt: lessonComments.deletedAt,
      authorName: users.name,
      authorAvatarUrl: users.avatarUrl,
      authorRole: users.role,
    })
    .from(lessonComments)
    .innerJoin(users, eq(lessonComments.userId, users.id))
    .where(eq(lessonComments.lessonId, lessonId))
    .orderBy(lessonComments.createdAt)
    .all();
}

export function createComment(
  lessonId: number,
  userId: number,
  body: string,
  parentId?: number
) {
  return db
    .insert(lessonComments)
    .values({ lessonId, userId, body, parentId: parentId ?? null })
    .returning()
    .get();
}

export function deleteComment(commentId: number, userId: number, isAdmin: boolean) {
  const where = isAdmin
    ? eq(lessonComments.id, commentId)
    : and(eq(lessonComments.id, commentId), eq(lessonComments.userId, userId));

  return db
    .update(lessonComments)
    .set({ deletedAt: new Date().toISOString() })
    .where(where)
    .returning()
    .get();
}

export function getComment(commentId: number) {
  return (
    db
      .select()
      .from(lessonComments)
      .where(and(eq(lessonComments.id, commentId), isNull(lessonComments.deletedAt)))
      .get() ?? null
  );
}
