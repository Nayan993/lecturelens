import type { Id, IsoDateTime, PageParams } from './common';
import type { OptionId, Question, StudentQuestion } from './question';

/** docs/CONTRACTS.md §5.7. Students get StudentQuestion[]; the owning teacher gets Question[]. */
export interface Quiz {
  id: Id;
  lectureId: Id;
  createdBy: Id;
  title: string;
  /** Topics requested; [] = all. */
  topicIds: Id[];
  questions: StudentQuestion[] | Question[];
  createdAt: IsoDateTime;
}

/** One row of GET /quizzes — docs/CONTRACTS.md §5.7. */
export interface QuizSummary {
  id: Id;
  lectureId: Id;
  lectureTitle: string;
  title: string;
  /** Approved topics covered by the quiz's questions. */
  topics: Array<{ id: Id; label: string }>;
  questionCount: number;
  createdAt: IsoDateTime;
  attemptCount: number;
  bestScore: Score | null;
  lastAttemptId: Id | null;
  lastAttemptAt: IsoDateTime | null;
}

/** GET /quizzes query. */
export interface ListQuizzesParams extends PageParams {
  lectureId?: Id;
}

/** POST /quizzes body. */
export interface CreateQuizPayload {
  lectureId: Id;
  topicIds?: Id[];
  /** 1–20, default 10. */
  questionCount?: number;
}

/** A student's response to one question (null = skipped, counts as wrong). */
export interface AttemptResponse {
  questionId: Id;
  selectedOptionId: OptionId | null;
}

/** POST /quizzes/:id/attempts body — one response per quiz question. */
export interface SubmitAttemptPayload {
  startedAt: IsoDateTime;
  answers: AttemptResponse[];
}

/** One scored answer, revealing the key and explanation after submission. */
export interface AttemptAnswer {
  questionId: Id;
  topicId: Id;
  selectedOptionId: OptionId | null;
  correctOptionId: OptionId;
  correct: boolean;
  explanation: string;
  deepLink: string;
}

export interface Score {
  correct: number;
  total: number;
  /** correct / total, 3 decimals. */
  accuracy: number;
}

export interface PerTopicScore extends Score {
  topicId: Id;
  topicLabel: string;
}

/** Scored, immutable attempt — §4.9, §6.11. */
export interface Attempt {
  id: Id;
  quizId: Id;
  lectureId: Id;
  studentId: Id;
  answers: AttemptAnswer[];
  score: Score;
  /** Ordered by topic index. */
  perTopic: PerTopicScore[];
  startedAt: IsoDateTime;
  submittedAt: IsoDateTime;
  /** submittedAt − startedAt, float seconds. */
  timeTakenSec: number;
}
