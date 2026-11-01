import { randomInt } from 'node:crypto';
import { Types, type HydratedDocument } from 'mongoose';
import {
  Attempt,
  Lecture,
  Question,
  Quiz,
  TopicSection,
  type IAttempt,
  type ILecture,
  type IQuiz,
  type OptionId,
  type QuestionOption,
} from '../../models/index.js';
import { visibleTo, type Viewer } from '../../modules/lectures/lectures.service.js';
import { deepLinkFor } from '../../utils/deepLink.js';
import { notFound, validationFailed } from '../../utils/errors.js';
import { generateRevisionPlan } from './revisionPlanner.js';

/**
 * Quizzes and attempts (PC.3, CONTRACTS.md §5.7). The approval gate is applied in the MongoDB query
 * (`approvedFor` / `approvedOnly`) everywhere a quiz is built or shown, never only in the route or
 * the UI; answer keys are stripped here, server-side, for anyone but the lecture's owner.
 */

/** A Question document as the model returns it (with its approval query helpers). */
type QuestionDoc = NonNullable<Awaited<ReturnType<typeof Question.findById>>>;
type QuizDoc = HydratedDocument<IQuiz>;

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Quiz question as a student sees it before submitting (§5.7): no key, explanation, evidence or status. */
export function studentQuestion(q: QuestionDoc) {
  return { id: String(q._id), topicId: String(q.topicId), difficulty: q.difficulty, stem: q.stem, options: q.options.map((o: QuestionOption) => ({ id: o.id, text: o.text })) };
}

const isOwner = (lecture: Pick<ILecture, 'uploadedBy'>, viewer: Viewer) => String(lecture.uploadedBy) === viewer.id;

/**
 * A quiz the viewer may open: the lecture's owner, or the quiz's creator while they can still see
 * the lecture. Anything else is a 404 — existence is not revealed (§1.5).
 */
export async function findAccessibleQuiz(quizId: string, viewer: Viewer): Promise<{ quiz: QuizDoc; lecture: HydratedDocument<ILecture> }> {
  const quiz = await Quiz.findById(quizId);
  if (!quiz) throw notFound('Quiz');
  const lecture = await Lecture.findById(quiz.lectureId);
  if (!lecture) throw notFound('Quiz');
  const creator = String(quiz.createdBy) === viewer.id;
  const canSeeLecture = (await Lecture.exists({ _id: lecture._id, ...visibleTo(viewer) })) !== null;
  if (!isOwner(lecture, viewer) && !(creator && canSeeLecture)) throw notFound('Quiz');
  return { quiz, lecture };
}

/** The quiz's questions that are approved NOW (re-applied on every read, §5.7), in quiz order. */
async function approvedQuestionsOf(quiz: QuizDoc): Promise<QuestionDoc[]> {
  const docs = await Question.find({ _id: { $in: quiz.questionIds } }).approvedOnly();
  const byId = new Map(docs.map((d) => [String(d._id), d]));
  return quiz.questionIds.map((id) => byId.get(String(id))).filter((q): q is QuestionDoc => q !== undefined);
}

export async function presentQuiz(quiz: QuizDoc, lecture: Pick<ILecture, 'uploadedBy'>, viewer: Viewer) {
  const questions = await approvedQuestionsOf(quiz);
  return {
    id: String(quiz._id),
    lectureId: String(quiz.lectureId),
    createdBy: String(quiz.createdBy),
    title: quiz.title,
    topicIds: quiz.topicIds.map(String),
    questions: isOwner(lecture, viewer) ? questions.map((q) => q.toJSON()) : questions.map(studentQuestion),
    createdAt: quiz.createdAt,
  };
}

/** POST /quizzes — random APPROVED questions (of approved topics); fewer than asked → all; none → 422. */
export async function createQuiz(
  body: { lectureId: string; topicIds?: string[]; questionCount: number },
  viewer: Viewer,
): Promise<QuizDoc> {
  const lecture = await Lecture.findOne({ _id: body.lectureId, ...visibleTo(viewer) });
  if (!lecture) throw notFound('Lecture');

  const approvedTopics = await TopicSection.approvedFor(lecture._id)
    .where(body.topicIds?.length ? { _id: { $in: body.topicIds } } : {})
    .sort({ index: 1 })
    .select('_id label');
  const pool = await Question.approvedFor(lecture._id).where({ topicId: { $in: approvedTopics.map((t) => t._id) } });
  if (pool.length === 0) {
    throw validationFailed({
      questionCount: body.topicIds?.length
        ? 'No approved questions available for these topics (0 available)'
        : 'No approved questions available for this lecture',
    });
  }

  // Fisher–Yates with a CSPRNG; then keep the first questionCount.
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  const picked = pool.slice(0, body.questionCount);
  const topicLabel = approvedTopics.length === 1 ? approvedTopics[0]!.label : null;

  return Quiz.create({
    lectureId: lecture._id,
    createdBy: viewer.id,
    title: topicLabel ? `${lecture.title} — ${topicLabel}` : `${lecture.title} — quiz`,
    questionIds: picked.map((q) => q._id),
    topicIds: body.topicIds ?? [],
  });
}

/** GET /quizzes — the caller's own quizzes, newest first, as QuizSummary (§5.7). */
export async function listQuizzes(query: { lectureId?: string; page: number; limit: number }, viewer: Viewer) {
  const filter = { createdBy: new Types.ObjectId(viewer.id), ...(query.lectureId ? { lectureId: new Types.ObjectId(query.lectureId) } : {}) };
  const [quizzes, total] = await Promise.all([
    Quiz.find(filter).sort({ createdAt: -1, _id: -1 }).skip((query.page - 1) * query.limit).limit(query.limit),
    Quiz.countDocuments(filter),
  ]);

  const items = await Promise.all(
    quizzes.map(async (quiz) => {
      const [lecture, questions, attempts] = await Promise.all([
        Lecture.findById(quiz.lectureId).select('title').lean(),
        approvedQuestionsOf(quiz),
        Attempt.find({ quizId: quiz._id, studentId: viewer.id }).sort({ submittedAt: -1 }).select('score submittedAt').lean(),
      ]);
      const topics = await TopicSection.find({ _id: { $in: [...new Set(questions.map((q) => String(q.topicId)))] } })
        .approvedOnly()
        .sort({ index: 1 })
        .select('label')
        .lean();
      const best = attempts.reduce<IAttempt['score'] | null>(
        (b, a) => (!b || a.score.accuracy > b.accuracy || (a.score.accuracy === b.accuracy && a.score.correct > b.correct) ? a.score : b),
        null,
      );
      return {
        id: String(quiz._id),
        lectureId: String(quiz.lectureId),
        lectureTitle: lecture?.title ?? '',
        title: quiz.title,
        topics: topics.map((t) => ({ id: String(t._id), label: t.label })),
        questionCount: questions.length,
        createdAt: quiz.createdAt,
        attemptCount: attempts.length,
        bestScore: best ? { correct: best.correct, total: best.total, accuracy: best.accuracy } : null,
        lastAttemptId: attempts[0] ? String(attempts[0]._id) : null,
        lastAttemptAt: attempts[0]?.submittedAt ?? null,
      };
    }),
  );
  return { items, page: query.page, limit: query.limit, total };
}

/** Attempt JSON (§6.11): stored answers plus, after submission, the key, explanation and a deep link. */
export async function presentAttempt(attempt: HydratedDocument<IAttempt>) {
  const questions = await Question.find({ _id: { $in: attempt.answers.map((a) => a.questionId) } }).lean();
  const byId = new Map(questions.map((q) => [String(q._id), q]));
  const lectureId = String(attempt.lectureId);
  return {
    id: String(attempt._id),
    quizId: String(attempt.quizId),
    lectureId,
    studentId: String(attempt.studentId),
    answers: attempt.answers.map((a) => {
      const q = byId.get(String(a.questionId));
      return {
        questionId: String(a.questionId),
        topicId: String(a.topicId),
        selectedOptionId: a.selectedOptionId,
        // A question deleted by a later reprocess keeps the stored result; its key is then unknown.
        correctOptionId: q?.correctOptionId ?? null,
        correct: a.correct,
        explanation: q?.explanation ?? 'This question was removed when the lecture was reprocessed.',
        deepLink: deepLinkFor(lectureId, q?.evidence[0]?.startSec ?? 0),
      };
    }),
    score: attempt.score,
    perTopic: attempt.perTopic.map((t) => ({ topicId: String(t.topicId), topicLabel: t.topicLabel, correct: t.correct, total: t.total, accuracy: t.accuracy })),
    startedAt: attempt.startedAt,
    submittedAt: attempt.submittedAt,
    timeTakenSec: attempt.timeTakenSec,
  };
}

/** Allowed clock difference between the browser's startedAt and the server's now. */
const CLOCK_SKEW_MS = 60_000;

/** POST /quizzes/:id/attempts — scores, stores, then regenerates the student's revision plans. */
export async function submitAttempt(
  quizId: string,
  body: { startedAt: string; answers: Array<{ questionId: string; selectedOptionId: OptionId | null }> },
  viewer: Viewer,
): Promise<HydratedDocument<IAttempt>> {
  const { quiz } = await findAccessibleQuiz(quizId, viewer);
  const questions = await approvedQuestionsOf(quiz);
  if (questions.length === 0) throw validationFailed({ answers: 'This quiz has no approved questions left' });

  const expected = new Set(questions.map((q) => String(q._id)));
  const given = body.answers.map((a) => a.questionId);
  if (new Set(given).size !== given.length || given.length !== expected.size || !given.every((id) => expected.has(id))) {
    throw validationFailed({ answers: `Must answer every quiz question exactly once (${expected.size} questions)` });
  }

  const submittedAt = new Date();
  const startedAt = new Date(body.startedAt);
  if (startedAt.getTime() > submittedAt.getTime() + CLOCK_SKEW_MS) throw validationFailed({ startedAt: 'Must not be in the future' });

  const selected = new Map(body.answers.map((a) => [a.questionId, a.selectedOptionId]));
  const answers = questions.map((q) => {
    const choice = selected.get(String(q._id)) ?? null;
    return { questionId: q._id, topicId: q.topicId, selectedOptionId: choice, correct: choice !== null && choice === q.correctOptionId };
  });

  const topics = await TopicSection.find({ _id: { $in: [...new Set(answers.map((a) => String(a.topicId)))] } }).select('label index').lean();
  const perTopic = topics
    .sort((a, b) => a.index - b.index)
    .map((t) => {
      const mine = answers.filter((a) => String(a.topicId) === String(t._id));
      const correct = mine.filter((a) => a.correct).length;
      return { topicId: t._id, topicLabel: t.label, correct, total: mine.length, accuracy: round3(correct / mine.length) };
    });
  const correct = answers.filter((a) => a.correct).length;

  const attempt = await Attempt.create({
    quizId: quiz._id,
    lectureId: quiz.lectureId,
    studentId: viewer.id,
    answers,
    score: { correct, total: answers.length, accuracy: round3(correct / answers.length) },
    perTopic,
    startedAt,
    submittedAt,
    timeTakenSec: round3(Math.max(0, submittedAt.getTime() - startedAt.getTime()) / 1000),
  });

  // §5.7: the attempt regenerates the student's revision plans (this lecture, and across lectures).
  await generateRevisionPlan({ studentId: viewer.id, lectureId: String(quiz.lectureId) });
  await generateRevisionPlan({ studentId: viewer.id, lectureId: null });
  return attempt;
}

/** GET /attempts/:id — the attempt's own user only; anyone else gets a 404 (§1.6). */
export async function findOwnAttempt(attemptId: string, viewer: Viewer): Promise<HydratedDocument<IAttempt>> {
  const attempt = await Attempt.findOne({ _id: attemptId, studentId: viewer.id });
  if (!attempt) throw notFound('Attempt');
  return attempt;
}
