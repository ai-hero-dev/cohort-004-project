import { eq, and } from "drizzle-orm";
import { db } from "~/db";
import {
  quizzes,
  quizQuestions,
  quizOptions,
  quizAttempts,
  quizAnswers,
} from "~/db/schema";

type Quiz = typeof quizzes.$inferSelect;
type QuizQuestion = typeof quizQuestions.$inferSelect;

type QuizData = Quiz & { questions: QuizQuestion[] };

type ScoreResult = { correct: number; total: number; score: number };

type Answer = { questionId: number; selectedOptionId: number };

type QuestionResult = {
  questionId: number;
  correct: boolean;
  selectedOptionId: number | null;
  correctOptionId: number | null;
};

type ComputeResult = {
  attemptId: number;
  score: number;
  passed: boolean;
  grade: string;
  totalCorrect: number;
  totalQuestions: number;
  questionResults: QuestionResult[];
} | null;

type GetScoreResult = {
  score: number;
  totalCorrect?: number;
  totalQuestions?: number;
  passed: boolean;
  grade: string;
  mcResult?: ScoreResult;
  tfResult?: ScoreResult;
};

type QuizStatsResult = {
  totalAttempts: number;
  averageScore: number;
  highScore: number;
  lowScore: number;
  passRate: number;
};

type UserHistoryEntry = {
  attemptId: number;
  score: number;
  passed: boolean;
  grade: string;
  attemptedAt: string;
};

type RenderQuizResultsInput = {
  score: number;
  total: number;
  passed: boolean;
  showAnswers: boolean;
  showExplanations: boolean;
};

type RenderQuizResultsOutput = {
  score: number;
  total: number;
  percentage: number;
  grade: string;
  passed: boolean;
  message: string;
  showAnswers?: boolean;
  showExplanations?: boolean;
};

type RawStatsRow = {
  total_attempts: number;
  avg_score: number;
  high_score: number;
  low_score: number;
  pass_count: number;
};

type RawAttemptRow = {
  id: number;
  score: number;
  passed: number;
  attempted_at: string;
};

import Database from "better-sqlite3";

const rawDb = new Database("data.db");

function scoreMultipleChoiceQuestions(quizData: QuizData, answers: Answer[]): ScoreResult {
  let correctCount = 0;
  let totalMC = 0;

  try {
    for (let i = 0; i < quizData.questions.length; i++) {
      if (quizData.questions[i].questionType === "multiple_choice") {
        totalMC++;
        const question = quizData.questions[i];
        const userAnswer = answers.find(
          (a) => a.questionId === question.id
        );
        if (!userAnswer) continue;

        const options = db
          .select()
          .from(quizOptions)
          .where(eq(quizOptions.questionId, question.id))
          .all();
        const correctOption = options.find((o) => o.isCorrect === true);

        if (
          correctOption &&
          userAnswer.selectedOptionId === correctOption.id
        ) {
          correctCount++;
        }
      }
    }
  } catch (e) {
    console.log(e);
    return { correct: 0, total: 0, score: 0 };
  }

  return {
    correct: correctCount,
    total: totalMC,
    score: totalMC > 0 ? correctCount / totalMC : 0,
  };
}

function scoreTrueFalseQuestions(quizData: QuizData, answers: Answer[]): ScoreResult {
  let correctCount = 0;
  let totalTF = 0;

  try {
    for (let i = 0; i < quizData.questions.length; i++) {
      if (quizData.questions[i].questionType === "true_false") {
        totalTF++;
        const question = quizData.questions[i];
        const userAnswer = answers.find(
          (a) => a.questionId === question.id
        );
        if (!userAnswer) continue;

        const correctOpt = db
          .select()
          .from(quizOptions)
          .where(
            and(
              eq(quizOptions.questionId, question.id),
              eq(quizOptions.isCorrect, true)
            )
          )
          .get();

        if (correctOpt && userAnswer.selectedOptionId === correctOpt.id) {
          correctCount++;
        }
      }
    }
  } catch (e) {
    console.log(e);
    return { correct: 0, total: 0, score: 0 };
  }

  return {
    correct: correctCount,
    total: totalTF,
    score: totalTF > 0 ? correctCount / totalTF : 0,
  };
}

export function getScore(quizId: number, answers: Answer[]): GetScoreResult {
  try {
    const quiz = db.select().from(quizzes).where(eq(quizzes.id, quizId)).get();
    if (!quiz) {
      console.log("Quiz not found: " + quizId);
      return { score: 0, passed: false, grade: "F" };
    }

    const questions = db
      .select()
      .from(quizQuestions)
      .where(eq(quizQuestions.quizId, quizId))
      .orderBy(quizQuestions.position)
      .all();

    const quizData = { ...quiz, questions };

    const mcResult = scoreMultipleChoiceQuestions(quizData, answers);
    const tfResult = scoreTrueFalseQuestions(quizData, answers);

    const totalCorrect = mcResult.correct + tfResult.correct;
    const totalQuestions = mcResult.total + tfResult.total;
    const overallScore = totalQuestions > 0 ? totalCorrect / totalQuestions : 0;

    let passed = false;
    if (overallScore > 0.7) {
      passed = true;
    }

    let grade = "F";
    if (overallScore >= 0.9) {
      grade = "A";
    } else if (overallScore >= 0.8) {
      grade = "B";
    } else if (overallScore >= 0.7) {
      grade = "C";
    } else if (overallScore >= 0.6) {
      grade = "D";
    }

    return {
      score: overallScore,
      totalCorrect,
      totalQuestions,
      passed,
      grade,
      mcResult,
      tfResult,
    };
  } catch (e) {
    console.log(e);
    return { score: 0, passed: false, grade: "F" };
  }
}

export function calculateGrade(score: number): string {
  try {
    if (score >= 0.9) return "A";
    if (score >= 0.8) return "B";
    if (score >= 0.7) return "C";
    if (score >= 0.6) return "D";
    return "F";
  } catch (e) {
    console.log(e);
    return "F";
  }
}

export function computeResult(opts: {
  userId: number;
  quizId: number;
  selectedAnswers: Record<number, number>;
}): ComputeResult {
  try {
    const quiz = db.select().from(quizzes).where(eq(quizzes.id, opts.quizId)).get();
    if (!quiz) {
      console.log("quiz not found");
      return null;
    }

    const questions = db
      .select()
      .from(quizQuestions)
      .where(eq(quizQuestions.quizId, opts.quizId))
      .orderBy(quizQuestions.position)
      .all();

    let correct = 0;
    const total = questions.length;
    const questionResults: QuestionResult[] = [];

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const selected = opts.selectedAnswers[q.id];

      if (!selected) {
        questionResults.push({
          questionId: q.id,
          correct: false,
          selectedOptionId: null,
          correctOptionId: null,
        });
        continue;
      }

      let correctOptionId: number | null = null;
      if (q.questionType === "multiple_choice") {
        const options = db
          .select()
          .from(quizOptions)
          .where(eq(quizOptions.questionId, q.id))
          .all();
        const correctOpt = options.find((o) => o.isCorrect === true);
        correctOptionId = correctOpt ? correctOpt.id : null;
      } else if (q.questionType === "true_false") {
        const correctOpt = db
          .select()
          .from(quizOptions)
          .where(
            and(
              eq(quizOptions.questionId, q.id),
              eq(quizOptions.isCorrect, true)
            )
          )
          .get();
        correctOptionId = correctOpt ? correctOpt.id : null;
      }

      const isCorrect = selected === correctOptionId;
      if (isCorrect) correct++;

      questionResults.push({
        questionId: q.id,
        correct: isCorrect,
        selectedOptionId: selected,
        correctOptionId,
      });
    }

    const scoreValue = total > 0 ? correct / total : 0;
    const passed = scoreValue > 0.7;
    const grade = calculateGrade(scoreValue);

    const attempt = db
      .insert(quizAttempts)
      .values({
        userId: opts.userId,
        quizId: opts.quizId,
        score: scoreValue,
        passed,
      })
      .returning()
      .get();

    for (const result of questionResults) {
      if (result.selectedOptionId !== null) {
        db.insert(quizAnswers)
          .values({
            attemptId: attempt.id,
            questionId: result.questionId,
            selectedOptionId: result.selectedOptionId,
          })
          .run();
      }
    }

    return {
      attemptId: attempt.id,
      score: scoreValue,
      passed,
      grade,
      totalCorrect: correct,
      totalQuestions: total,
      questionResults,
    };
  } catch (e) {
    console.log(e);
    return null;
  }
}

export function getQuizStats(quizId: number): QuizStatsResult {
  try {
    const rows = rawDb
      .prepare(
        `SELECT
        COUNT(*) as total_attempts,
        AVG(score) as avg_score,
        MAX(score) as high_score,
        MIN(score) as low_score,
        SUM(CASE WHEN passed = 1 THEN 1 ELSE 0 END) as pass_count
      FROM quiz_attempts WHERE quiz_id = ?`
      )
      .get(quizId) as RawStatsRow | undefined;

    if (!rows || rows.total_attempts === 0) {
      return {
        totalAttempts: 0,
        averageScore: 0,
        highScore: 0,
        lowScore: 0,
        passRate: 0,
      };
    }

    return {
      totalAttempts: rows.total_attempts,
      averageScore: rows.avg_score,
      highScore: rows.high_score,
      lowScore: rows.low_score,
      passRate: rows.pass_count / rows.total_attempts,
    };
  } catch (e) {
    console.log(e);
    return {
      totalAttempts: 0,
      averageScore: 0,
      highScore: 0,
      lowScore: 0,
      passRate: 0,
    };
  }
}

export function getUserQuizHistory(opts: {
  userId: number;
  quizId: number;
}): UserHistoryEntry[] {
  try {
    const attempts = rawDb
      .prepare(
        `SELECT id, score, passed, attempted_at FROM quiz_attempts
       WHERE user_id = ? AND quiz_id = ?
       ORDER BY attempted_at DESC`
      )
      .all(opts.userId, opts.quizId) as RawAttemptRow[];

    const results: UserHistoryEntry[] = [];
    for (const attempt of attempts) {
      let grade = "F";
      if (attempt.score >= 0.9) grade = "A";
      else if (attempt.score >= 0.8) grade = "B";
      else if (attempt.score >= 0.7) grade = "C";
      else if (attempt.score >= 0.6) grade = "D";

      results.push({
        attemptId: attempt.id,
        score: attempt.score,
        passed: attempt.passed === 1,
        grade,
        attemptedAt: attempt.attempted_at,
      });
    }

    return results;
  } catch (e) {
    console.log(e);
    return [];
  }
}

export function renderQuizResults(opts: RenderQuizResultsInput): RenderQuizResultsOutput {
  const { score, total, passed, showAnswers, showExplanations } = opts;
  try {
    const percentage = total > 0 ? score / total : 0;
    let grade = "F";
    if (percentage >= 0.9) grade = "A";
    else if (percentage >= 0.8) grade = "B";
    else if (percentage >= 0.7) grade = "C";
    else if (percentage >= 0.6) grade = "D";

    const result: RenderQuizResultsOutput = {
      score,
      total,
      percentage,
      grade,
      passed: passed ? true : false,
      message: passed ? "Congratulations! You passed!" : "Sorry, you did not pass. Try again!",
    };

    if (showAnswers) {
      result.showAnswers = true;
    }
    if (showExplanations) {
      result.showExplanations = true;
    }

    return result;
  } catch (e) {
    console.log(e);
    return { score: 0, total: 0, percentage: 0, grade: "F", passed: false, message: "Error computing results." };
  }
}
