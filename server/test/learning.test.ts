import request from 'supertest';
import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { z } from 'zod';

const llm = vi.hoisted(() => ({ client: null as null | { generateJson: (p: string, s: z.ZodTypeAny) => Promise<unknown> } }));
vi.mock('../src/services/llm/client.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/services/llm/client.js')>()),
  getLlmClient: () => llm.client,
  llmModelName: () => 'test-model',
}));

import {
  Attempt,
  Chunk,
  Lecture,
  Question,
  Quiz,
  RevisionRecommendation,
  TopicSection,
  TranscriptSegment,
  initialStages,
  type ILecture,
} from '../src/models/index.js';
import { LlmError } from '../src/services/llm/client.js';
import { allocate } from '../src/services/learning/questionGenerator.js';
import { priorityScore, revisionReason } from '../src/services/learning/revisionPlanner.js';
import { authHeader, buildApp, makeStudent, makeTeacher, resetDb } from './setup.js';

const app = await buildApp();
const api = () => request(app);

/* ------------------------------------------------------------------ fixtures ---- */

const SEGMENTS = [
  'Gradient descent moves the parameters downhill on the loss surface.',
  'The learning rate sets the size of each step we take.',
  'A learning rate that is too large makes the loss diverge.',
  'Backpropagation computes every gradient with the chain rule.',
];

async function readyLecture(ownerId: Types.ObjectId, overrides: Partial<ILecture> = {}) {
  const lecture = await Lecture.create({
    title: 'Lecture 7', uploadedBy: ownerId,
    consent: { lecturerConsent: true, purposeShown: true, processorNamed: true, grantedBy: ownerId, grantedAt: new Date() },
    status: 'ready', statusDetail: 'Ready.', durationSec: 80, transcriptApproved: true,
    stages: initialStages().map((s) => ({ ...s, state: 'done', ms: 1 })),
    mediaPath: 'x/l.mp3', media: { originalFilename: 'l.mp3', mimeType: 'audio/mpeg', sizeBytes: 1 },
    ...overrides,
  });
  await TranscriptSegment.insertMany(SEGMENTS.map((text, index) => ({
    lectureId: lecture._id, index, startSec: index * 20, endSec: index * 20 + 20, text,
    confidence: 0.9, lowConfidence: false, corrected: false, modelVersion: 'fixture',
  })));
  const chunks = await Chunk.insertMany([
    { lectureId: lecture._id, index: 0, startSec: 0, endSec: 60, segmentStart: 0, segmentEnd: 2, text: SEGMENTS.slice(0, 3).join(' '), embeddingModel: 'm' },
    { lectureId: lecture._id, index: 1, startSec: 60, endSec: 80, segmentStart: 3, segmentEnd: 3, text: SEGMENTS[3]!, embeddingModel: 'm' },
  ]);
  const topic = (index: number, segmentStart: number, segmentEnd: number, label: string, status: 'approved' | 'pending_review') => ({
    lectureId: lecture._id, index, startSec: segmentStart * 20, endSec: segmentEnd * 20 + 20, segmentStart, segmentEnd, label,
    keywords: ['a', 'b', 'c'], method: 'fixed_window', boundaryScore: null, status,
    rejectionReason: null, reviewedBy: null, reviewedAt: null,
  });
  const [t0, t1] = await TopicSection.insertMany([
    topic(0, 0, 2, 'Gradient descent and the learning rate', 'approved'),
    topic(1, 3, 3, 'Backpropagation', 'approved'),
  ]);
  return { lecture, chunks, topics: [t0!, t1!] };
}

let qCounter = 0;
async function question(
  lectureId: Types.ObjectId, topicId: Types.ObjectId, chunkId: Types.ObjectId,
  status: 'approved' | 'pending_review' | 'rejected', correctOptionId: 'a' | 'b' | 'c' | 'd' = 'a',
) {
  qCounter += 1;
  return Question.create({
    lectureId, topicId, type: 'mcq', difficulty: 'easy', stem: `Question ${qCounter}: what does the learning rate control?`,
    options: [{ id: 'a', text: 'Step size' }, { id: 'b', text: 'Data' }, { id: 'c', text: 'Labels' }, { id: 'd', text: 'Nothing' }],
    correctOptionId, explanation: 'The lecture says it sets the size of each step.',
    evidence: [{ chunkId, startSec: 20, endSec: 40, quote: 'The learning rate sets the size of each step we take.' }],
    status, rejectionReason: status === 'rejected' ? 'TOO_EASY' : null, reviewedBy: null, reviewedAt: null, reviewNote: null,
    model: 'test-model', promptVersion: 'mcq-v1',
  });
}

let teacher: Awaited<ReturnType<typeof makeTeacher>>;
let otherTeacher: Awaited<ReturnType<typeof makeTeacher>>;
let student: Awaited<ReturnType<typeof makeStudent>>;
let otherStudent: Awaited<ReturnType<typeof makeStudent>>;
beforeEach(async () => {
  await resetDb();
  [teacher, otherTeacher, student, otherStudent] = await Promise.all([makeTeacher(), makeTeacher(), makeStudent(), makeStudent()]);
  llm.client = null;
});

const SECRET_KEYS = ['correctOptionId', 'explanation', 'evidence', 'status', 'rejectionReason', 'reviewNote'];
const collectKeys = (v: unknown, out = new Set<string>()): Set<string> => {
  if (Array.isArray(v)) v.forEach((x) => collectKeys(x, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { out.add(k); collectKeys(x, out); }
  return out;
};

/* ------------------------------------------------------- the approval gate ---- */

describe('approval gate (written first): students never receive unapproved questions', () => {
  it('GET /quizzes/:id for a student contains NO pending_review or rejected question — even ones planted in the quiz', async () => {
    const { lecture, chunks, topics } = await readyLecture(teacher._id);
    const approved = await question(lecture._id, topics[0]!._id, chunks[0]!._id, 'approved');
    const pending = await question(lecture._id, topics[0]!._id, chunks[0]!._id, 'pending_review');
    const rejected = await question(lecture._id, topics[0]!._id, chunks[0]!._id, 'rejected');
    // A quiz document that (wrongly) references unapproved questions: the read must still filter them.
    const quiz = await Quiz.create({ lectureId: lecture._id, createdBy: student._id, title: 'Q', questionIds: [pending._id, approved._id, rejected._id] });

    const res = await api().get(`/api/v1/quizzes/${quiz.id}`).set(authHeader(student)).expect(200);
    expect(res.body.quiz.questions.map((q: { id: string }) => q.id)).toEqual([approved.id]);
  });

  it('the student view has no correctOptionId, explanation, evidence or status before submission', async () => {
    const { lecture, chunks, topics } = await readyLecture(teacher._id);
    await question(lecture._id, topics[0]!._id, chunks[0]!._id, 'approved');
    const created = await api().post('/api/v1/quizzes').set(authHeader(student)).send({ lectureId: lecture.id }).expect(201);
    const read = await api().get(`/api/v1/quizzes/${created.body.quiz.id}`).set(authHeader(student)).expect(200);
    for (const body of [created.body, read.body]) {
      const keys = collectKeys(body.quiz.questions);
      for (const secret of SECRET_KEYS) expect(keys.has(secret)).toBe(false);
      expect(Object.keys(body.quiz.questions[0]).sort()).toEqual(['difficulty', 'id', 'options', 'stem', 'topicId']);
    }
  });

  it('POST /quizzes draws ONLY approved questions; none approved → 422 with the reason', async () => {
    const { lecture, chunks, topics } = await readyLecture(teacher._id);
    await question(lecture._id, topics[0]!._id, chunks[0]!._id, 'pending_review');
    await question(lecture._id, topics[0]!._id, chunks[0]!._id, 'rejected');
    const none = await api().post('/api/v1/quizzes').set(authHeader(student)).send({ lectureId: lecture.id }).expect(422);
    expect(none.body.error).toMatchObject({ code: 'VALIDATION_FAILED', details: { questionCount: 'No approved questions available for this lecture' } });

    const ok = [await question(lecture._id, topics[0]!._id, chunks[0]!._id, 'approved'), await question(lecture._id, topics[1]!._id, chunks[1]!._id, 'approved')];
    const res = await api().post('/api/v1/quizzes').set(authHeader(student)).send({ lectureId: lecture.id, questionCount: 10 }).expect(201);
    // Fewer approved than requested → all of them (§5.7), and only them.
    expect(res.body.quiz.questions.map((q: { id: string }) => q.id).sort()).toEqual(ok.map((q) => q.id).sort());
    const stored = await Quiz.findById(res.body.quiz.id).lean();
    const statuses = await Question.find({ _id: { $in: stored!.questionIds } }).distinct('status');
    expect(statuses).toEqual(['approved']);
  });

  it('topicIds limit the quiz to those topics; a question of an UNapproved topic is never used', async () => {
    const { lecture, chunks, topics } = await readyLecture(teacher._id);
    await TopicSection.updateOne({ _id: topics[1]!._id }, { status: 'pending_review' });
    const inTopic0 = await question(lecture._id, topics[0]!._id, chunks[0]!._id, 'approved');
    await question(lecture._id, topics[1]!._id, chunks[1]!._id, 'approved'); // approved question, pending topic
    const res = await api().post('/api/v1/quizzes').set(authHeader(student)).send({ lectureId: lecture.id }).expect(201);
    expect(res.body.quiz.questions.map((q: { id: string }) => q.id)).toEqual([inTopic0.id]);
    const only1 = await api().post('/api/v1/quizzes').set(authHeader(student)).send({ lectureId: lecture.id, topicIds: [topics[1]!.id] }).expect(422);
    expect(only1.body.error.details.questionCount).toMatch(/No approved questions available for these topics/);
  });

  it('a student cannot build a quiz on a lecture they cannot see (404)', async () => {
    const { lecture, chunks, topics } = await readyLecture(teacher._id, { transcriptApproved: false });
    await question(lecture._id, topics[0]!._id, chunks[0]!._id, 'approved');
    await api().post('/api/v1/quizzes').set(authHeader(student)).send({ lectureId: lecture.id }).expect(404);
  });
});

/* ---------------------------------------------------------- quiz ownership ---- */

describe('GET /quizzes/:id ownership: the quiz creator or the lecture owner only', () => {
  it('another student → 404; another teacher → 404; the lecture owner sees full questions', async () => {
    const { lecture, chunks, topics } = await readyLecture(teacher._id);
    await question(lecture._id, topics[0]!._id, chunks[0]!._id, 'approved');
    const created = await api().post('/api/v1/quizzes').set(authHeader(student)).send({ lectureId: lecture.id }).expect(201);
    const id = created.body.quiz.id;

    expect((await api().get(`/api/v1/quizzes/${id}`).set(authHeader(otherStudent)).expect(404)).body.error.code).toBe('NOT_FOUND');
    await api().get(`/api/v1/quizzes/${id}`).set(authHeader(otherTeacher)).expect(404);
    const owner = await api().get(`/api/v1/quizzes/${id}`).set(authHeader(teacher)).expect(200);
    expect(owner.body.quiz.questions[0]).toMatchObject({ correctOptionId: 'a', status: 'approved' });
    await api().get(`/api/v1/quizzes/${id}`).expect(401);
  });

  it('a student loses access when the lecture stops being visible to them', async () => {
    const { lecture, chunks, topics } = await readyLecture(teacher._id);
    await question(lecture._id, topics[0]!._id, chunks[0]!._id, 'approved');
    const created = await api().post('/api/v1/quizzes').set(authHeader(student)).send({ lectureId: lecture.id }).expect(201);
    await Lecture.updateOne({ _id: lecture._id }, { transcriptApproved: false });
    await api().get(`/api/v1/quizzes/${created.body.quiz.id}`).set(authHeader(student)).expect(404);
  });

  it('GET /quizzes lists only the caller\'s quizzes with attempt stats (QuizSummary)', async () => {
    const { lecture, chunks, topics } = await readyLecture(teacher._id);
    const q = await question(lecture._id, topics[0]!._id, chunks[0]!._id, 'approved', 'b');
    const mine = (await api().post('/api/v1/quizzes').set(authHeader(student)).send({ lectureId: lecture.id }).expect(201)).body.quiz;
    await api().post('/api/v1/quizzes').set(authHeader(otherStudent)).send({ lectureId: lecture.id }).expect(201);
    await api().post(`/api/v1/quizzes/${mine.id}/attempts`).set(authHeader(student))
      .send({ startedAt: new Date().toISOString(), answers: [{ questionId: q.id, selectedOptionId: 'b' }] }).expect(201);

    const res = await api().get('/api/v1/quizzes').set(authHeader(student)).expect(200);
    expect(res.body).toMatchObject({ page: 1, limit: 20, total: 1 });
    expect(res.body.items[0]).toMatchObject({
      id: mine.id, lectureId: lecture.id, lectureTitle: 'Lecture 7', questionCount: 1, attemptCount: 1,
      topics: [{ id: topics[0]!.id, label: topics[0]!.label }], bestScore: { correct: 1, total: 1, accuracy: 1 },
    });
    expect(res.body.items[0].lastAttemptId).toEqual(expect.any(String));
  });
});

/* -------------------------------------------------------- question review ---- */

describe('PATCH /questions/:id and GET /questions — teacher review', () => {
  it('reject without a reason → 422; with a reason not in the enum → 422; with one → rejected', async () => {
    const { lecture, chunks, topics } = await readyLecture(teacher._id);
    const q = await question(lecture._id, topics[0]!._id, chunks[0]!._id, 'pending_review');
    const missing = await api().patch(`/api/v1/questions/${q.id}`).set(authHeader(teacher)).send({ status: 'rejected' }).expect(422);
    expect(missing.body.error.details).toHaveProperty('rejectionReason');
    await api().patch(`/api/v1/questions/${q.id}`).set(authHeader(teacher)).send({ status: 'rejected', rejectionReason: 'BORING' }).expect(422);
    expect((await Question.findById(q._id))!.status).toBe('pending_review');

    const res = await api().patch(`/api/v1/questions/${q.id}`).set(authHeader(teacher)).send({ status: 'rejected', rejectionReason: 'AMBIGUOUS' }).expect(200);
    expect(res.body.question).toMatchObject({ status: 'rejected', rejectionReason: 'AMBIGUOUS', reviewedBy: String(teacher._id) });
  });

  it('approve clears the reason and records the reviewer; editing an approved question\'s content resets it to pending_review', async () => {
    const { lecture, chunks, topics } = await readyLecture(teacher._id);
    const q = await question(lecture._id, topics[0]!._id, chunks[0]!._id, 'rejected');
    const approved = await api().patch(`/api/v1/questions/${q.id}`).set(authHeader(teacher)).send({ status: 'approved' }).expect(200);
    expect(approved.body.question).toMatchObject({ status: 'approved', rejectionReason: null, reviewedBy: String(teacher._id) });
    expect(approved.body.question.reviewedAt).toEqual(expect.any(String));

    const edited = await api().patch(`/api/v1/questions/${q.id}`).set(authHeader(teacher)).send({ stem: 'What does the learning rate set?' }).expect(200);
    expect(edited.body.question).toMatchObject({ status: 'pending_review', stem: 'What does the learning rate set?', reviewedBy: null });
  });

  it('students get 403; another teacher gets 404 (existence not revealed)', async () => {
    const { lecture, chunks, topics } = await readyLecture(teacher._id);
    const q = await question(lecture._id, topics[0]!._id, chunks[0]!._id, 'pending_review');
    await api().patch(`/api/v1/questions/${q.id}`).set(authHeader(student)).send({ status: 'approved' }).expect(403);
    await api().patch(`/api/v1/questions/${q.id}`).set(authHeader(otherTeacher)).send({ status: 'approved' }).expect(404);
    await api().get(`/api/v1/questions?lectureId=${lecture.id}`).set(authHeader(student)).expect(403);
    await api().get(`/api/v1/questions?lectureId=${lecture.id}`).set(authHeader(otherTeacher)).expect(404);
    expect((await Question.findById(q._id))!.status).toBe('pending_review');
  });

  it('GET /questions is the owner\'s paginated review queue, filterable by status', async () => {
    const { lecture, chunks, topics } = await readyLecture(teacher._id);
    await question(lecture._id, topics[0]!._id, chunks[0]!._id, 'pending_review');
    await question(lecture._id, topics[0]!._id, chunks[0]!._id, 'approved');
    const all = await api().get(`/api/v1/questions?lectureId=${lecture.id}`).set(authHeader(teacher)).expect(200);
    expect(all.body).toMatchObject({ page: 1, limit: 20, total: 2 });
    const pending = await api().get(`/api/v1/questions?lectureId=${lecture.id}&status=pending_review`).set(authHeader(teacher)).expect(200);
    expect(pending.body.items.map((q: { status: string }) => q.status)).toEqual(['pending_review']);
  });
});

/* ------------------------------------------------------ question generation ---- */

describe('POST /lectures/:id/questions/generate', () => {
  const mcq = (stem: string, quote: string) => ({
    stem, options: [{ id: 'a', text: 'It sets the step size' }, { id: 'b', text: 'It sets the data' }, { id: 'c', text: 'It sets labels' }, { id: 'd', text: 'Nothing' }],
    correctOptionId: 'a', explanation: 'The lecture says so.', quote, difficulty: 'easy',
  });

  it('saves every generated question as pending_review with located evidence; an unlocatable quote is discarded', async () => {
    const { lecture, topics } = await readyLecture(teacher._id);
    await TopicSection.updateOne({ _id: topics[1]!._id }, { status: 'pending_review' }); // only topic 0 is approved
    const generateJson = vi.fn(async (_prompt: string, schema: z.ZodTypeAny) => schema.parse({
      questions: [
        mcq('What does the learning rate set in gradient descent?', 'The learning rate sets the size of each step'),
        mcq('Which quote is invented by the model here?', 'momentum accelerates convergence in ravines'),
      ],
    }));
    llm.client = { generateJson };

    const res = await api().post(`/api/v1/lectures/${lecture.id}/questions/generate`).set(authHeader(teacher)).send({ count: 2 }).expect(201);
    expect(generateJson).toHaveBeenCalledOnce(); // one call: only the approved topic
    expect(generateJson.mock.calls[0]![0]).toContain('A learning rate that is too large'); // section text, not other topics
    expect(res.body.items).toHaveLength(1);
    const [q] = res.body.items;
    expect(q).toMatchObject({ status: 'pending_review', topicId: topics[0]!.id, model: 'test-model', promptVersion: 'mcq-v1', rejectionReason: null });
    expect(q.evidence[0]).toMatchObject({ startSec: 20, endSec: 40, quote: 'The learning rate sets the size of each step' });
    expect(await Question.countDocuments({ status: { $ne: 'pending_review' } })).toBe(0);
  });

  it('teacher-only (403), owner-only (404), ready lectures only (409); no approved topics → 422; provider down → 503; unusable output → nothing saved', async () => {
    const { lecture, topics } = await readyLecture(teacher._id);
    await api().post(`/api/v1/lectures/${lecture.id}/questions/generate`).set(authHeader(student)).send({}).expect(403);
    await api().post(`/api/v1/lectures/${lecture.id}/questions/generate`).set(authHeader(otherTeacher)).send({}).expect(404);

    llm.client = { generateJson: vi.fn(async () => { throw new LlmError('LLM request failed (HTTP 503)', 503); }) };
    expect((await api().post(`/api/v1/lectures/${lecture.id}/questions/generate`).set(authHeader(teacher)).send({}).expect(503)).body.error.code).toBe('PROVIDER_UNAVAILABLE');

    llm.client = { generateJson: vi.fn(async () => { throw new LlmError('LLM output was not valid JSON'); }) };
    const unusable = await api().post(`/api/v1/lectures/${lecture.id}/questions/generate`).set(authHeader(teacher)).send({}).expect(201);
    expect(unusable.body.items).toEqual([]);

    await TopicSection.updateMany({ lectureId: lecture._id }, { status: 'pending_review' });
    expect((await api().post(`/api/v1/lectures/${lecture.id}/questions/generate`).set(authHeader(teacher)).send({}).expect(422)).body.error.details).toHaveProperty('topicIds');
    await TopicSection.updateOne({ _id: topics[0]!._id }, { status: 'approved' });

    await Lecture.updateOne({ _id: lecture._id }, { status: 'summarising' });
    await api().post(`/api/v1/lectures/${lecture.id}/questions/generate`).set(authHeader(teacher)).send({}).expect(409);
    expect(await Question.countDocuments()).toBe(0);
  });

  it('spreads the requested count over the approved topics in order', () => {
    expect(allocate(5, 2)).toEqual([3, 2]);
    expect(allocate(1, 3)).toEqual([1, 0, 0]);
    expect(allocate(6, 3)).toEqual([2, 2, 2]);
  });
});

/* --------------------------------------------------------------- attempts ---- */

describe('POST /quizzes/:id/attempts and GET /attempts/:id', () => {
  async function quizWithFour() {
    const { lecture, chunks, topics } = await readyLecture(teacher._id);
    const qs = [
      await question(lecture._id, topics[0]!._id, chunks[0]!._id, 'approved', 'a'),
      await question(lecture._id, topics[0]!._id, chunks[0]!._id, 'approved', 'b'),
      await question(lecture._id, topics[0]!._id, chunks[0]!._id, 'approved', 'c'),
      await question(lecture._id, topics[1]!._id, chunks[1]!._id, 'approved', 'd'),
    ];
    const quiz = (await api().post('/api/v1/quizzes').set(authHeader(student)).send({ lectureId: lecture.id }).expect(201)).body.quiz;
    return { lecture, topics, qs, quiz };
  }

  it('scores the attempt; per-topic scores sum to the total; the result reveals keys, explanations and deep links', async () => {
    const { lecture, topics, qs, quiz } = await quizWithFour();
    const answers = [
      { questionId: qs[0]!.id, selectedOptionId: 'a' }, // right
      { questionId: qs[1]!.id, selectedOptionId: 'c' }, // wrong
      { questionId: qs[2]!.id, selectedOptionId: null }, // skipped = wrong
      { questionId: qs[3]!.id, selectedOptionId: 'd' }, // right
    ];
    const startedAt = new Date(Date.now() - 90_000).toISOString();
    const res = await api().post(`/api/v1/quizzes/${quiz.id}/attempts`).set(authHeader(student)).send({ startedAt, answers }).expect(201);
    const { attempt } = res.body;

    expect(attempt.score).toEqual({ correct: 2, total: 4, accuracy: 0.5 });
    expect(attempt.perTopic).toEqual([
      { topicId: topics[0]!.id, topicLabel: topics[0]!.label, correct: 1, total: 3, accuracy: 0.333 },
      { topicId: topics[1]!.id, topicLabel: topics[1]!.label, correct: 1, total: 1, accuracy: 1 },
    ]);
    expect(attempt.perTopic.reduce((n: number, t: { total: number }) => n + t.total, 0)).toBe(attempt.score.total);
    expect(attempt.perTopic.reduce((n: number, t: { correct: number }) => n + t.correct, 0)).toBe(attempt.score.correct);
    expect(attempt.timeTakenSec).toBeGreaterThanOrEqual(89);
    const a1 = attempt.answers.find((a: { questionId: string }) => a.questionId === qs[1]!.id);
    expect(a1).toMatchObject({ selectedOptionId: 'c', correctOptionId: 'b', correct: false, explanation: expect.any(String), deepLink: `/lectures/${lecture.id}/play?t=20` });
  });

  it('every quiz question must be answered exactly once → otherwise 422; nothing stored', async () => {
    const { qs, quiz } = await quizWithFour();
    const startedAt = new Date().toISOString();
    await api().post(`/api/v1/quizzes/${quiz.id}/attempts`).set(authHeader(student)).send({ startedAt, answers: [{ questionId: qs[0]!.id, selectedOptionId: 'a' }] }).expect(422);
    await api().post(`/api/v1/quizzes/${quiz.id}/attempts`).set(authHeader(student))
      .send({ startedAt, answers: qs.map((q) => ({ questionId: qs[0]!.id ?? q.id, selectedOptionId: 'a' })) }).expect(422);
    expect(await Attempt.countDocuments()).toBe(0);
  });

  it('a student cannot read another student\'s attempt (404, existence not revealed); the owner can', async () => {
    const { qs, quiz } = await quizWithFour();
    const answers = qs.map((q) => ({ questionId: q.id, selectedOptionId: 'a' }));
    const { attempt } = (await api().post(`/api/v1/quizzes/${quiz.id}/attempts`).set(authHeader(student)).send({ startedAt: new Date().toISOString(), answers }).expect(201)).body;
    const other = await api().get(`/api/v1/attempts/${attempt.id}`).set(authHeader(otherStudent)).expect(404);
    expect(other.body.error.code).toBe('NOT_FOUND');
    await api().get(`/api/v1/attempts/${attempt.id}`).set(authHeader(teacher)).expect(404);
    const own = await api().get(`/api/v1/attempts/${attempt.id}`).set(authHeader(student)).expect(200);
    expect(own.body.attempt).toMatchObject({ id: attempt.id, score: attempt.score });
    // Another student cannot submit to a quiz they cannot open either.
    await api().post(`/api/v1/quizzes/${quiz.id}/attempts`).set(authHeader(otherStudent)).send({ startedAt: new Date().toISOString(), answers }).expect(404);
  });
});

/* ---------------------------------------------------------------- revision ---- */

describe('revision plan (transparent rules)', () => {
  it('priorityScore = 0.6·(1 − accuracy) + 0.3·[accuracy < cohort] + 0.1·recency', () => {
    expect(priorityScore(0.25, 0.68, 1)).toBeCloseTo(0.6 * 0.75 + 0.3 + 0.1, 10);
    expect(priorityScore(1, 0.5, 0)).toBe(0);
    expect(priorityScore(0.5, 0.5, 0)).toBeCloseTo(0.3, 10); // equal to the cohort is not "below"
  });

  it('the reason states the actual numbers (at least two numeric values)', () => {
    const reason = revisionReason(1, 4, 0.68, true);
    expect(reason).toBe('You answered 1 of 4 questions on this topic correctly (25%, class average 68%). You missed at least one on your latest attempt.');
    expect((reason.match(/\d+/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it('plan is null before any attempt; after one it ranks the weakest topic first, with spans and deep links', async () => {
    const { lecture, chunks, topics } = await readyLecture(teacher._id);
    expect((await api().get('/api/v1/revision-plan').set(authHeader(student)).expect(200)).body).toEqual({ plan: null });

    const qs = [
      await question(lecture._id, topics[0]!._id, chunks[0]!._id, 'approved', 'a'),
      await question(lecture._id, topics[0]!._id, chunks[0]!._id, 'approved', 'a'),
      await question(lecture._id, topics[1]!._id, chunks[1]!._id, 'approved', 'a'),
    ];
    // A classmate does well on topic 0, so the class average is above our student's.
    const peerQuiz = (await api().post('/api/v1/quizzes').set(authHeader(otherStudent)).send({ lectureId: lecture.id }).expect(201)).body.quiz;
    await api().post(`/api/v1/quizzes/${peerQuiz.id}/attempts`).set(authHeader(otherStudent))
      .send({ startedAt: new Date().toISOString(), answers: qs.map((q) => ({ questionId: q.id, selectedOptionId: 'a' })) }).expect(201);

    const quiz = (await api().post('/api/v1/quizzes').set(authHeader(student)).send({ lectureId: lecture.id }).expect(201)).body.quiz;
    await api().post(`/api/v1/quizzes/${quiz.id}/attempts`).set(authHeader(student)).send({
      startedAt: new Date().toISOString(),
      answers: [
        { questionId: qs[0]!.id, selectedOptionId: 'b' }, { questionId: qs[1]!.id, selectedOptionId: 'a' }, // topic 0: 1 of 2
        { questionId: qs[2]!.id, selectedOptionId: 'a' }, // topic 1: 1 of 1
      ],
    }).expect(201);

    const { plan } = (await api().get(`/api/v1/revision-plan?lectureId=${lecture.id}`).set(authHeader(student)).expect(200)).body;
    expect(plan).toMatchObject({ studentId: String(student._id), lectureId: lecture.id, lectureAccuracy: 0.667 });
    expect(plan.items[0]).toMatchObject({
      rank: 1, topicId: topics[0]!.id, startSec: 0, endSec: 60, deepLink: `/lectures/${lecture.id}/play?t=0`,
      correct: 1, attempted: 2, accuracy: 0.5,
      reason: 'You answered 1 of 2 questions on this topic correctly (50%, class average 75%). You missed at least one on your latest attempt.',
    });
    expect(plan.items.length).toBeLessThanOrEqual(5);
    expect(await RevisionRecommendation.countDocuments({ studentId: student._id })).toBe(2); // lecture + all-lectures plans

    // The cross-lecture plan, and nobody reads another student's plan (always the caller's own).
    const all = (await api().get('/api/v1/revision-plan').set(authHeader(student)).expect(200)).body.plan;
    expect(all.lectureId).toBeNull();
    const peer = (await api().get(`/api/v1/revision-plan?lectureId=${lecture.id}`).set(authHeader(otherStudent)).expect(200)).body.plan;
    expect(peer.studentId).toBe(String(otherStudent._id));
  });

  it('a hidden lecture → 404; unauthenticated → 401', async () => {
    const { lecture } = await readyLecture(teacher._id, { transcriptApproved: false });
    await api().get(`/api/v1/revision-plan?lectureId=${lecture.id}`).set(authHeader(student)).expect(404);
    await api().get('/api/v1/revision-plan').expect(401);
  });
});
