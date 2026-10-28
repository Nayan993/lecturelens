import type {
  Attempt,
  AttemptAnswer,
  Id,
  OptionId,
  PerTopicScore,
  Question,
  Quiz,
  QuizSummary,
  StudentQuestion,
  User,
} from '../../types';
import { DIFFICULTIES, REJECTION_REASONS, REVIEW_STATUSES } from '../../types';
import type { QuizService, RevisionService } from '../types';
import { approvedFor, clone, db, deepLink, delay, fail, newId, nowIso, ownedLecture, requireUser, round3, visibleLecture } from './db';

const OPTION_IDS: OptionId[] = ['a', 'b', 'c', 'd'];

const toStudentView = ({ id, topicId, difficulty, stem, options }: Question): StudentQuestion => ({
  id,
  topicId,
  difficulty,
  stem,
  options: clone(options),
});

function quizFor(user: User, stored: (typeof db.quizzes)[number]): Quiz {
  const lecture = db.lectures.find((l) => l.id === stored.lectureId);
  const owner = user.role === 'teacher' && lecture?.uploadedBy === user.id;
  if (stored.createdBy !== user.id && !owner) fail(404, 'NOT_FOUND', 'Quiz not found.');
  // Re-apply the approved filter: a question un-approved after quiz creation drops out (§5.7).
  const questions = stored.questionIds
    .map((qid) => db.questions.find((q) => q.id === qid))
    .filter((q): q is Question => q !== undefined && q.status === 'approved');
  const { questionIds: _ids, ...rest } = stored;
  return { ...clone(rest), questions: owner ? clone(questions) : questions.map(toStudentView) };
}

/** Score answers against the answer key: the same rules the server applies (§4.9). */
function score(quizQuestions: Question[], answers: Array<{ questionId: Id; selectedOptionId: OptionId | null }>) {
  const byId = new Map(answers.map((a) => [a.questionId, a.selectedOptionId]));
  const topicOrder = new Map(db.topics.map((t) => [t.id, t]));
  const scored: AttemptAnswer[] = quizQuestions.map((q) => {
    const selected = byId.get(q.id) ?? null;
    return {
      questionId: q.id,
      topicId: q.topicId,
      selectedOptionId: selected,
      correctOptionId: q.correctOptionId,
      correct: selected === q.correctOptionId,
      explanation: q.explanation,
      deepLink: deepLink(q.lectureId, q.evidence[0]?.startSec ?? 0),
    };
  });
  const perTopic = new Map<Id, PerTopicScore>();
  for (const a of scored) {
    const entry = perTopic.get(a.topicId) ?? { topicId: a.topicId, topicLabel: topicOrder.get(a.topicId)?.label ?? 'Topic', correct: 0, total: 0, accuracy: 0 };
    entry.total += 1;
    entry.correct += a.correct ? 1 : 0;
    entry.accuracy = round3(entry.correct / entry.total);
    perTopic.set(a.topicId, entry);
  }
  const correct = scored.filter((a) => a.correct).length;
  return {
    answers: scored,
    score: { correct, total: scored.length, accuracy: scored.length ? round3(correct / scored.length) : 0 },
    perTopic: [...perTopic.values()].sort((a, b) => (topicOrder.get(a.topicId)?.index ?? 0) - (topicOrder.get(b.topicId)?.index ?? 0)),
  };
}

function buildAttempt(quizId: Id, lectureId: Id, studentId: Id, questions: Question[], answers: Array<{ questionId: Id; selectedOptionId: OptionId | null }>, startedAt: string, submittedAt: string, id = newId()): Attempt {
  return {
    id,
    quizId,
    lectureId,
    studentId,
    ...score(questions, answers),
    startedAt,
    submittedAt,
    timeTakenSec: round3((Date.parse(submittedAt) - Date.parse(startedAt)) / 1000),
  };
}

// ---- seed: the quiz and three attempts that mocks/revision.json was computed from ------------
{
  const lectureId = db.revision.lectureId!;
  const approved = db.questions.filter((q) => q.lectureId === lectureId && q.status === 'approved');
  const quizId = '6650c3a0c3b2e41d8a700001';
  db.quizzes.push({
    id: quizId,
    lectureId,
    createdBy: db.revision.studentId,
    title: 'Practice quiz — Lecture 7',
    topicIds: [],
    questionIds: approved.map((q) => q.id),
    createdAt: '2026-10-23T16:58:10.442Z',
  });
  const picks: OptionId[][] = [
    ['b', 'b', 'c', 'c', 'b'],
    ['b', 'b', 'c', 'b', 'a'],
    ['b', 'b', 'c', 'c', 'a'],
  ];
  const started = ['2026-10-23T16:58:31.007Z', '2026-10-24T20:23:40.212Z', '2026-10-26T18:31:02.118Z'];
  db.revision.basedOnAttemptIds.forEach((attemptId, i) => {
    const submittedAt = ['2026-10-23T17:05:44.912Z', '2026-10-24T20:31:09.550Z', '2026-10-26T18:39:27.031Z'][i];
    const answers = approved.map((q, j) => ({ questionId: q.id, selectedOptionId: picks[i][j] }));
    db.attempts.push(buildAttempt(quizId, lectureId, db.revision.studentId, approved, answers, started[i], submittedAt, attemptId));
  });
}

export const mockQuizService: QuizService = {
  async listQuestions({ lectureId, status, topicId, page = 1, limit = 20 }) {
    await delay();
    const user = requireUser('teacher');
    ownedLecture(user, lectureId);
    if (status && !REVIEW_STATUSES.includes(status)) fail(422, 'VALIDATION_FAILED', 'Query is invalid.', { status: 'Unknown status' });
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) fail(422, 'VALIDATION_FAILED', 'Query is invalid.', { limit: 'Must be 1–100' });
    const all = db.questions.filter((q) => q.lectureId === lectureId && (!status || q.status === status) && (!topicId || q.topicId === topicId));
    return { items: clone(all.slice((page - 1) * limit, page * limit)), page, limit, total: all.length };
  },

  async generateQuestions(lectureId, { count = 5, topicIds, difficulty } = {}) {
    await delay();
    const lecture = ownedLecture(requireUser(), lectureId);
    if (lecture.status !== 'ready') fail(409, 'CONFLICT', 'The lecture must finish processing first.', { status: lecture.status });
    if (!Number.isInteger(count) || count < 1 || count > 20) fail(422, 'VALIDATION_FAILED', 'Request body is invalid.', { count: 'Must be 1–20' });
    if (difficulty && !DIFFICULTIES.includes(difficulty)) fail(422, 'VALIDATION_FAILED', 'Request body is invalid.', { difficulty: 'Unknown difficulty' });
    // No LLM in mock mode: new questions are copies of the fixture questions for the requested topics.
    const pool = db.questions.filter(
      (q) => q.lectureId === lectureId && q.status !== 'rejected' && (!topicIds?.length || topicIds.includes(q.topicId)) && (!difficulty || q.difficulty === difficulty),
    );
    if (pool.length === 0) fail(503, 'PROVIDER_UNAVAILABLE', 'Mock data has no source questions for these topics.', { provider: 'mock' });
    const at = nowIso();
    const created = Array.from({ length: count }, (_, i): Question => ({
      ...clone(pool[i % pool.length]),
      id: newId(),
      status: 'pending_review',
      rejectionReason: null,
      reviewNote: null,
      reviewedBy: null,
      reviewedAt: null,
      createdAt: at,
      updatedAt: at,
    }));
    db.questions.push(...created);
    return clone(created);
  },

  async updateQuestion(id, payload) {
    await delay();
    const user = requireUser();
    const question = db.questions.find((q) => q.id === id);
    if (!question) fail(404, 'NOT_FOUND', 'Question not found.');
    ownedLecture(user, question.lectureId);
    const details: Record<string, string> = {};
    if (payload.status && !REVIEW_STATUSES.includes(payload.status)) details.status = 'Unknown status';
    if (payload.status === 'rejected' && !(payload.rejectionReason && REJECTION_REASONS.includes(payload.rejectionReason))) {
      details.rejectionReason = 'Required when status is rejected';
    }
    if (payload.options && (payload.options.length !== 4 || payload.options.some((o, i) => o.id !== OPTION_IDS[i] || !o.text.trim()))) {
      details.options = 'Exactly four non-empty options with ids a–d in order';
    }
    if (payload.correctOptionId && !OPTION_IDS.includes(payload.correctOptionId)) details.correctOptionId = 'Must be a–d';
    if (Object.keys(details).length) fail(422, 'VALIDATION_FAILED', 'Request body is invalid.', details);

    const contentEdited = (['stem', 'options', 'correctOptionId', 'explanation', 'difficulty'] as const).some((k) => payload[k] !== undefined);
    const { status, rejectionReason, reviewNote, ...content } = payload;
    Object.assign(question, clone(content));
    if (reviewNote !== undefined) question.reviewNote = reviewNote;
    if (status) {
      question.status = status;
      question.rejectionReason = status === 'rejected' ? rejectionReason! : null;
      question.reviewedBy = user.id;
      question.reviewedAt = nowIso();
    } else if (contentEdited && question.status === 'approved') {
      question.status = 'pending_review';
    }
    question.updatedAt = nowIso();
    return clone(question);
  },

  async list({ lectureId, page = 1, limit = 20 } = {}) {
    await delay();
    const user = requireUser();
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) fail(422, 'VALIDATION_FAILED', 'Query is invalid.', { limit: 'Must be 1–100' });
    const topicsById = new Map(approvedFor(user, db.topics).map((t) => [t.id, t]));
    const mine = db.quizzes
      .filter((q) => q.createdBy === user.id && (!lectureId || q.lectureId === lectureId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const items = mine.slice((page - 1) * limit, page * limit).map((stored): QuizSummary => {
      // Same approved filter GET /quizzes/:id applies, so counts match what the quiz will show.
      const questions = stored.questionIds
        .map((qid) => db.questions.find((q) => q.id === qid))
        .filter((q): q is Question => q !== undefined && q.status === 'approved');
      const topicIds = [...new Set(questions.map((q) => q.topicId))].filter((id) => topicsById.has(id));
      const topics = topicIds
        .map((id) => topicsById.get(id)!)
        .sort((a, b) => a.index - b.index)
        .map((t) => ({ id: t.id, label: t.label }));
      const attempts = db.attempts.filter((a) => a.quizId === stored.id && a.studentId === user.id);
      const best = attempts.reduce<Attempt | null>((b, a) => (!b || a.score.accuracy > b.score.accuracy ? a : b), null);
      const last = attempts.reduce<Attempt | null>((l, a) => (!l || a.submittedAt > l.submittedAt ? a : l), null);
      return {
        id: stored.id,
        lectureId: stored.lectureId,
        lectureTitle: db.lectures.find((l) => l.id === stored.lectureId)?.title ?? 'Lecture',
        title: stored.title,
        topics,
        questionCount: questions.length,
        createdAt: stored.createdAt,
        attemptCount: attempts.length,
        bestScore: best ? clone(best.score) : null,
        lastAttemptId: last?.id ?? null,
        lastAttemptAt: last?.submittedAt ?? null,
      };
    });
    return { items, page, limit, total: mine.length };
  },

  async create({ lectureId, topicIds = [], questionCount = 10 }) {
    await delay();
    const user = requireUser();
    visibleLecture(user, lectureId);
    if (!Number.isInteger(questionCount) || questionCount < 1 || questionCount > 20) {
      fail(422, 'VALIDATION_FAILED', 'Request body is invalid.', { questionCount: 'Must be 1–20' });
    }
    const approved = db.questions.filter(
      (q) => q.lectureId === lectureId && q.status === 'approved' && (topicIds.length === 0 || topicIds.includes(q.topicId)),
    );
    if (approved.length === 0) fail(422, 'VALIDATION_FAILED', 'Request body is invalid.', { questionCount: 'No approved questions available for this lecture' });
    const picked = [...approved].sort(() => Math.random() - 0.5).slice(0, questionCount);
    const lecture = db.lectures.find((l) => l.id === lectureId)!;
    const stored = {
      id: newId(),
      lectureId,
      createdBy: user.id,
      title: `Practice quiz — ${lecture.title.split(' — ')[0]}`,
      topicIds: [...topicIds],
      questionIds: picked.map((q) => q.id),
      createdAt: nowIso(),
    };
    db.quizzes.push(stored);
    return quizFor(user, stored);
  },

  async get(id) {
    await delay();
    const user = requireUser();
    const stored = db.quizzes.find((q) => q.id === id);
    if (!stored) fail(404, 'NOT_FOUND', 'Quiz not found.');
    return quizFor(user, stored);
  },

  async submitAttempt(quizId, { startedAt, answers }) {
    await delay();
    const user = requireUser('student');
    const stored = db.quizzes.find((q) => q.id === quizId);
    if (!stored) fail(404, 'NOT_FOUND', 'Quiz not found.');
    const quiz = quizFor(user, stored);
    const questions = quiz.questions.map((q) => db.questions.find((full) => full.id === q.id)!);
    const answered = new Set(answers.map((a) => a.questionId));
    const missing = questions.filter((q) => !answered.has(q.id));
    if (missing.length || answers.length !== questions.length) {
      fail(422, 'VALIDATION_FAILED', 'Request body is invalid.', { answers: 'Give exactly one answer per quiz question' });
    }
    if (Number.isNaN(Date.parse(startedAt))) fail(422, 'VALIDATION_FAILED', 'Request body is invalid.', { startedAt: 'Must be an ISO date-time' });
    const attempt = buildAttempt(quizId, stored.lectureId, user.id, questions, answers, startedAt, nowIso());
    db.attempts.push(attempt);
    return clone(attempt);
  },

  async getAttempt(id) {
    await delay();
    const user = requireUser();
    const attempt = db.attempts.find((a) => a.id === id);
    const lecture = attempt && db.lectures.find((l) => l.id === attempt.lectureId);
    const allowed = attempt && (attempt.studentId === user.id || (user.role === 'teacher' && lecture?.uploadedBy === user.id));
    if (!allowed) fail(404, 'NOT_FOUND', 'Attempt not found.');
    return clone(attempt);
  },
};

/**
 * Mock revision plan: the fixture plan for the demo student (it was computed from the seeded
 * attempts above). Other students get null until the real server generates plans.
 */
export const mockRevisionService: RevisionService = {
  async getPlan(lectureId) {
    await delay();
    const user = requireUser('student');
    const plan = db.revision;
    if (plan.studentId !== user.id || (lectureId && plan.lectureId !== lectureId)) return null;
    // Items only reference approved topics (§4.10).
    const approvedTopics = new Set(approvedFor(user, db.topics).map((t) => t.id));
    return { ...clone(plan), items: clone(plan.items.filter((i) => approvedTopics.has(i.topicId))) };
  },
};
