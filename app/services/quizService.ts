import { eq, and, sql, desc } from "drizzle-orm";
import { db } from "~/db";
import {
  quizzes,
  quizQuestions,
  quizOptions,
  quizAttempts,
  quizAnswers,
  type QuestionType,
} from "~/db/schema";

// ─── Quiz Service ───
// Handles quiz CRUD, question/option management, and attempt recording.
// Uses object destructuring for functions with multiple same-type parameters.

// ─── Quiz CRUD ───

export function getQuizById(id: number) {
  return db.select().from(quizzes).where(eq(quizzes.id, id)).get();
}

export function getQuizByLessonId(lessonId: number) {
  return db.select().from(quizzes).where(eq(quizzes.lessonId, lessonId)).get();
}

export function getQuizWithQuestions(quizId: number) {
  const quiz = getQuizById(quizId);
  if (!quiz) return null;

  const questions = db
    .select()
    .from(quizQuestions)
    .where(eq(quizQuestions.quizId, quizId))
    .orderBy(quizQuestions.position)
    .all();

  const questionsWithOptions = questions.map((question) => {
    const options = db
      .select()
      .from(quizOptions)
      .where(eq(quizOptions.questionId, question.id))
      .all();
    return { ...question, options };
  });

  return { ...quiz, questions: questionsWithOptions };
}

export function createQuiz(opts: {
  lessonId: number;
  title: string;
  passingScore: number;
}) {
  return db
    .insert(quizzes)
    .values({ lessonId: opts.lessonId, title: opts.title, passingScore: opts.passingScore })
    .returning()
    .get();
}

export function updateQuiz(
  id: number,
  title: string | null,
  passingScore: number | null
) {
  const updates: Record<string, unknown> = {};
  if (title !== null) updates.title = title;
  if (passingScore !== null) updates.passingScore = passingScore;

  if (Object.keys(updates).length === 0) {
    return getQuizById(id);
  }

  return db
    .update(quizzes)
    .set(updates)
    .where(eq(quizzes.id, id))
    .returning()
    .get();
}

export function deleteQuiz(id: number) {
  // Cascade: delete answers -> attempts -> options -> questions -> quiz
  const questions = getQuestionsByQuiz(id);
  for (const question of questions) {
    db.delete(quizOptions).where(eq(quizOptions.questionId, question.id)).run();
  }

  const attempts = db
    .select()
    .from(quizAttempts)
    .where(eq(quizAttempts.quizId, id))
    .all();
  for (const attempt of attempts) {
    db.delete(quizAnswers).where(eq(quizAnswers.attemptId, attempt.id)).run();
  }

  db.delete(quizAttempts).where(eq(quizAttempts.quizId, id)).run();
  db.delete(quizQuestions).where(eq(quizQuestions.quizId, id)).run();
  return db.delete(quizzes).where(eq(quizzes.id, id)).returning().get();
}

// ─── Question Management ───

export function getQuestionById(id: number) {
  return db.select().from(quizQuestions).where(eq(quizQuestions.id, id)).get();
}

export function getQuestionsByQuiz(quizId: number) {
  return db
    .select()
    .from(quizQuestions)
    .where(eq(quizQuestions.quizId, quizId))
    .orderBy(quizQuestions.position)
    .all();
}

export function getQuestionCount(quizId: number) {
  const result = db
    .select({ count: sql<number>`count(*)` })
    .from(quizQuestions)
    .where(eq(quizQuestions.quizId, quizId))
    .get();
  return result?.count ?? 0;
}

export function createQuestion(
  quizId: number,
  questionText: string,
  questionType: QuestionType,
  position: number | null
) {
  const pos =
    position ??
    db
      .select({
        max: sql<number>`coalesce(max(${quizQuestions.position}), 0)`,
      })
      .from(quizQuestions)
      .where(eq(quizQuestions.quizId, quizId))
      .get()!.max + 1;

  return db
    .insert(quizQuestions)
    .values({ quizId, questionText, questionType, position: pos })
    .returning()
    .get();
}

export function updateQuestion(
  id: number,
  questionText: string | null,
  questionType: QuestionType | null
) {
  const updates: Record<string, unknown> = {};
  if (questionText !== null) updates.questionText = questionText;
  if (questionType !== null) updates.questionType = questionType;

  if (Object.keys(updates).length === 0) {
    return getQuestionById(id);
  }

  return db
    .update(quizQuestions)
    .set(updates)
    .where(eq(quizQuestions.id, id))
    .returning()
    .get();
}

export function deleteQuestion(id: number) {
  db.delete(quizOptions).where(eq(quizOptions.questionId, id)).run();
  return db
    .delete(quizQuestions)
    .where(eq(quizQuestions.id, id))
    .returning()
    .get();
}

// ─── Question Reordering ───

export function moveQuestionToPosition(opts: {
  questionId: number;
  newPosition: number;
}) {
  const question = getQuestionById(opts.questionId);
  if (!question) return null;

  const oldPosition = question.position;
  if (oldPosition === opts.newPosition) return question;

  if (opts.newPosition > oldPosition) {
    db.update(quizQuestions)
      .set({ position: sql`${quizQuestions.position} - 1` })
      .where(
        and(
          eq(quizQuestions.quizId, question.quizId),
          sql`${quizQuestions.position} > ${oldPosition}`,
          sql`${quizQuestions.position} <= ${opts.newPosition}`
        )
      )
      .run();
  } else {
    db.update(quizQuestions)
      .set({ position: sql`${quizQuestions.position} + 1` })
      .where(
        and(
          eq(quizQuestions.quizId, question.quizId),
          sql`${quizQuestions.position} >= ${opts.newPosition}`,
          sql`${quizQuestions.position} < ${oldPosition}`
        )
      )
      .run();
  }

  return db
    .update(quizQuestions)
    .set({ position: opts.newPosition })
    .where(eq(quizQuestions.id, opts.questionId))
    .returning()
    .get();
}

export function reorderQuestions(quizId: number, questionIds: number[]) {
  for (let i = 0; i < questionIds.length; i++) {
    db.update(quizQuestions)
      .set({ position: i + 1 })
      .where(
        and(
          eq(quizQuestions.id, questionIds[i]),
          eq(quizQuestions.quizId, quizId)
        )
      )
      .run();
  }
  return getQuestionsByQuiz(quizId);
}

// ─── Option Management ───

export function getOptionById(id: number) {
  return db.select().from(quizOptions).where(eq(quizOptions.id, id)).get();
}

export function getOptionsByQuestion(questionId: number) {
  return db
    .select()
    .from(quizOptions)
    .where(eq(quizOptions.questionId, questionId))
    .all();
}

export function createOption(
  questionId: number,
  optionText: string,
  isCorrect: boolean
) {
  return db
    .insert(quizOptions)
    .values({ questionId, optionText, isCorrect })
    .returning()
    .get();
}

export function updateOption(
  id: number,
  optionText: string | null,
  isCorrect: boolean | null
) {
  const updates: Record<string, unknown> = {};
  if (optionText !== null) updates.optionText = optionText;
  if (isCorrect !== null) updates.isCorrect = isCorrect;

  if (Object.keys(updates).length === 0) {
    return getOptionById(id);
  }

  return db
    .update(quizOptions)
    .set(updates)
    .where(eq(quizOptions.id, id))
    .returning()
    .get();
}

export function deleteOption(id: number) {
  return db.delete(quizOptions).where(eq(quizOptions.id, id)).returning().get();
}

// ─── Attempt Recording ───

export function getAttemptById(id: number) {
  return db.select().from(quizAttempts).where(eq(quizAttempts.id, id)).get();
}

export function getAttemptsByUser(opts: {
  userId: number;
  quizId: number;
}) {
  return db
    .select()
    .from(quizAttempts)
    .where(
      and(eq(quizAttempts.userId, opts.userId), eq(quizAttempts.quizId, opts.quizId))
    )
    .orderBy(desc(quizAttempts.attemptedAt))
    .all();
}

export function getAttemptCountForQuiz(quizId: number) {
  const result = db
    .select({ count: sql<number>`count(*)` })
    .from(quizAttempts)
    .where(eq(quizAttempts.quizId, quizId))
    .get();
  return result?.count ?? 0;
}

export function getBestAttempt(opts: {
  userId: number;
  quizId: number;
}) {
  return db
    .select()
    .from(quizAttempts)
    .where(
      and(eq(quizAttempts.userId, opts.userId), eq(quizAttempts.quizId, opts.quizId))
    )
    .orderBy(desc(quizAttempts.score))
    .limit(1)
    .get();
}

export function getLatestAttempt(opts: {
  userId: number;
  quizId: number;
}) {
  return db
    .select()
    .from(quizAttempts)
    .where(
      and(eq(quizAttempts.userId, opts.userId), eq(quizAttempts.quizId, opts.quizId))
    )
    .orderBy(desc(quizAttempts.attemptedAt))
    .limit(1)
    .get();
}

export function recordAttempt(opts: {
  userId: number;
  quizId: number;
  score: number;
  passed: boolean;
}) {
  return db
    .insert(quizAttempts)
    .values({ userId: opts.userId, quizId: opts.quizId, score: opts.score, passed: opts.passed })
    .returning()
    .get();
}

export function recordAnswer(opts: {
  attemptId: number;
  questionId: number;
  selectedOptionId: number;
}) {
  return db
    .insert(quizAnswers)
    .values({ attemptId: opts.attemptId, questionId: opts.questionId, selectedOptionId: opts.selectedOptionId })
    .returning()
    .get();
}

export function getAnswersByAttempt(attemptId: number) {
  return db
    .select()
    .from(quizAnswers)
    .where(eq(quizAnswers.attemptId, attemptId))
    .all();
}

export function getAttemptWithAnswers(attemptId: number) {
  const attempt = getAttemptById(attemptId);
  if (!attempt) return null;

  const answers = getAnswersByAttempt(attemptId);
  return { ...attempt, answers };
}
