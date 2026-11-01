import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import type { HydratedDocument } from 'mongoose';
import request from 'supertest';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { env, storageRoot } from '../src/config/env.js';

// /search and /ask embed the query: a deterministic fake model, so this suite never downloads one.
vi.mock('@xenova/transformers', async () => (await import('./fakeEmbeddings.js')).fakeTransformers);
import {
  Attempt,
  Chunk,
  Lecture,
  Question,
  Summary,
  TranscriptSegment,
  Quiz,
  TopicSection,
  initialStages,
  type IUser,
} from '../src/models/index.js';
import { setPipeline } from '../src/services/processing/pipeline.js';
import { TEST_PASSWORD, authHeader, buildApp, makeStudent, makeTeacher, resetDb } from './setup.js';

/**
 * The RBAC matrix — docs/CONTRACTS.md §1.6 — one test per cell, negatives included.
 *
 * "Allowed" is asserted as "passes authentication and the role check" (never 401/403); the cells
 * that depend on handler logic (approved-only filtering, ownership, own attempts) assert the
 * handler's answer too.
 */

const app = await buildApp();
const api = () => request(app);
const MP3 = Buffer.concat([Buffer.from('ID3\u0004\u0000\u0000'), Buffer.alloc(512, 1)]);

type User = HydratedDocument<IUser>;
let owner: User;
let otherTeacher: User;
let student: User;

/** Lectures owned by `owner` unless stated. */
const L = { readyApproved: '', readyUnapproved: '', processing: '', othersReady: '' };

async function lecture(uploadedBy: User, over: Record<string, unknown>) {
  const doc = await Lecture.create({
    title: String(over.title),
    uploadedBy: uploadedBy._id,
    consent: { lecturerConsent: true, purposeShown: true, processorNamed: true, grantedBy: uploadedBy._id, grantedAt: new Date() },
    status: 'ready',
    statusDetail: 'Ready.',
    stages: initialStages().map((s) => ({ ...s, state: 'done', ms: 1000 })),
    mediaPath: 'none/a.mp3',
    media: { originalFilename: 'a.mp3', mimeType: 'audio/mpeg', sizeBytes: MP3.length },
    transcriptApproved: true,
    ...over,
  });
  return doc.id as string;
}

beforeAll(async () => {
  await resetDb();
  setPipeline({ startProcessing: async () => undefined }); // keep statuses stable for these cells
  [owner, otherTeacher, student] = await Promise.all([makeTeacher(), makeTeacher(), makeStudent()]);
  L.readyApproved = await lecture(owner, { title: 'Ready, transcript approved' });
  L.readyUnapproved = await lecture(owner, { title: 'Ready, transcript not approved', transcriptApproved: false });
  L.processing = await lecture(owner, { title: 'Still transcribing', status: 'transcribing', transcriptApproved: false });
  L.othersReady = await lecture(otherTeacher, { title: "Another teacher's lecture" });

  await mkdir(path.join(storageRoot, L.readyApproved), { recursive: true });
  await writeFile(path.join(storageRoot, L.readyApproved, 'a.mp3'), MP3);
  await Lecture.updateOne({ _id: L.readyApproved }, { mediaPath: `${L.readyApproved}/a.mp3` });
});

/** Review content on a lecture: one approved and one pending topic + summary + question. */
async function reviewContent(lectureId: string) {
  const chunk = await Chunk.create({
    lectureId, index: 0, startSec: 0, endSec: 60, segmentStart: 0, segmentEnd: 1, text: 'The learning rate sets the step size.', embeddingModel: 'm',
  });
  const topic = (index: number, status: 'approved' | 'pending_review') => TopicSection.create({
    lectureId, index, startSec: index * 30, endSec: index * 30 + 30, segmentStart: index, segmentEnd: index, label: `Topic ${index}`,
    keywords: ['a', 'b', 'c'], method: 'fixed_window', boundaryScore: null, status,
  });
  const topics = [await topic(0, 'approved'), await topic(1, 'pending_review')];
  const evidence = [{ chunkId: chunk._id, startSec: 0, endSec: 10, quote: 'The learning rate sets the step size.' }];
  const summaries = await Promise.all(topics.map((t) => Summary.create({
    lectureId, topicId: t._id, title: t.label, text: 'One. Two.', keyPoints: ['One.', 'Two.'], evidence, status: t.status,
    model: 'm', promptVersion: 'p', faithfulnessScore: 1, unsupportedSentences: [],
  })));
  const questions = await Promise.all(topics.map((t) => Question.create({
    lectureId, topicId: t._id, type: 'mcq', difficulty: 'easy', stem: `About ${t.label}?`,
    options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }, { id: 'c', text: 'C' }, { id: 'd', text: 'D' }],
    correctOptionId: 'a', explanation: 'Because.', evidence, status: t.status, model: 'm', promptVersion: 'p',
  })));
  return { topics, summaries, questions };
}

const as = (user: User) => authHeader(user);
const ID = '6650c3a0c3b2e41d8a400000'; // a well-formed id for topic/summary/question/quiz/attempt stubs

type Method = 'get' | 'post' | 'patch' | 'delete';
interface Call {
  method: Method;
  path: () => string;
  body?: object;
}
const send = (call: Call, headers: Record<string, string> = {}) => {
  const req = api()[call.method](`/api/v1${call.path()}`).set(headers);
  return call.body ? req.send(call.body) : req;
};

/* Routes with the guards that let any signed-in user through (student or teacher). */
const OPEN_TO_ANY: Array<[string, Call]> = [
  ['read the transcript of a visible lecture', { method: 'get', path: () => `/lectures/${L.readyApproved}/transcript` }],
  ['read approved topic sections', { method: 'get', path: () => `/lectures/${L.readyApproved}/topics` }],
  ['read approved summaries', { method: 'get', path: () => `/lectures/${L.readyApproved}/summaries` }],
  ['search', { method: 'post', path: () => '/search', body: { query: 'learning rate' } }],
  ['ask', { method: 'post', path: () => '/ask', body: { question: 'Why does the loss diverge?' } }],
  // A fixed, well-formed id: bodies are built at load time, before beforeAll creates lectures.
  ['build a quiz', { method: 'post', path: () => '/quizzes', body: { lectureId: '6650c3a0c3b2e41d8a100001' } }],
  ['list own quizzes', { method: 'get', path: () => '/quizzes' }],
  ['read a quiz', { method: 'get', path: () => `/quizzes/${ID}` }],
  ['create an attempt', { method: 'post', path: () => `/quizzes/${ID}/attempts`, body: { startedAt: new Date().toISOString(), answers: [{ questionId: ID, selectedOptionId: 'a' }] } }],
  ['read own attempt', { method: 'get', path: () => `/attempts/${ID}` }],
  ['read own revision plan', { method: 'get', path: () => '/revision-plan' }],
];

/* Teacher-only routes (a student gets 403 FORBIDDEN). */
const TEACHER_ONLY: Array<[string, Call]> = [
  ['upload', { method: 'post', path: () => '/lectures' }],
  ['read processing status', { method: 'get', path: () => `/lectures/${L.readyApproved}/status` }],
  ['reprocess', { method: 'post', path: () => `/lectures/${L.readyApproved}/reprocess` }],
  ['delete a lecture', { method: 'delete', path: () => `/lectures/${L.readyApproved}` }],
  ['patch a transcript segment', { method: 'patch', path: () => `/lectures/${L.readyApproved}/segments/0`, body: { text: 'Edited.' } }],
  ['approve a transcript', { method: 'post', path: () => `/lectures/${L.readyApproved}/transcript/approve` }],
  ['edit a topic', { method: 'patch', path: () => `/topics/${ID}`, body: { label: 'New label' } }],
  ['approve a topic', { method: 'post', path: () => `/topics/${ID}/approve` }],
  ['reject a topic', { method: 'post', path: () => `/topics/${ID}/reject`, body: { rejectionReason: 'AMBIGUOUS' } }],
  ['edit a summary', { method: 'patch', path: () => `/summaries/${ID}`, body: { title: 'New title' } }],
  ['approve a summary', { method: 'post', path: () => `/summaries/${ID}/approve` }],
  ['reject a summary', { method: 'post', path: () => `/summaries/${ID}/reject`, body: { rejectionReason: 'UNSUPPORTED' } }],
  ['generate questions', { method: 'post', path: () => `/lectures/${L.readyApproved}/questions/generate`, body: {} }],
  ['read pending_review questions', { method: 'get', path: () => `/questions?lectureId=${L.readyApproved}&status=pending_review` }],
  ['approve or reject a question', { method: 'patch', path: () => `/questions/${ID}`, body: { status: 'approved' } }],
];

/* Teacher-only routes that are implemented (D, A, B and C); every other one is still a 501 stub. */
const LIVE_LECTURE_ROUTES = [
  'upload',
  'read processing status',
  'reprocess',
  'delete a lecture',
  'patch a transcript segment',
  'approve a transcript',
];
const LIVE_REVIEW_ROUTES = [
  'edit a topic', 'approve a topic', 'approve a summary', // Member B
  'generate questions', 'read pending_review questions', 'approve or reject a question', // Member C
];
const TEACHER_ONLY_STUBS = TEACHER_ONLY.filter(
  ([cell]) => !LIVE_LECTURE_ROUTES.includes(cell) && !LIVE_REVIEW_ROUTES.includes(cell),
);
const TEACHER_ONLY_LIVE_REVIEW = TEACHER_ONLY.filter(([cell]) => LIVE_REVIEW_ROUTES.includes(cell));

describe('student', () => {
  it('reads lectures whose status is ready AND transcriptApproved (list)', async () => {
    const res = await send({ method: 'get', path: () => '/lectures' }, as(student)).expect(200);
    expect(res.body.items.map((l: { id: string }) => l.id).sort()).toEqual([L.readyApproved, L.othersReady].sort());
  });

  it('reads a ready + transcript-approved lecture (detail)', async () => {
    await send({ method: 'get', path: () => `/lectures/${L.readyApproved}` }, as(student)).expect(200);
  });

  it('plays the media of a lecture it can see (signed URL)', async () => {
    const { body } = await send({ method: 'get', path: () => `/lectures/${L.readyApproved}` }, as(student)).expect(200);
    await api().get(body.mediaUrl).set('Range', 'bytes=0-1').expect(206);
  });

  it('cannot read a ready lecture whose transcript is not approved → 404', async () => {
    await send({ method: 'get', path: () => `/lectures/${L.readyUnapproved}` }, as(student)).expect(404);
  });

  it('cannot read a lecture that is not ready → 404', async () => {
    await send({ method: 'get', path: () => `/lectures/${L.processing}` }, as(student)).expect(404);
  });

  it.each(OPEN_TO_ANY)('may %s (passes the guards)', async (_cell, call) => {
    const res = await send(call, as(student));

    // Through the guards: never 401/403, never a server error (404/422 are the handler's own answers).
    expect([401, 403], `${_cell} → ${res.status}`).not.toContain(res.status);
    expect(res.status, `${_cell} → ${res.status}`).toBeLessThan(500);
  });

  it.each(TEACHER_ONLY)('may NOT %s → 403 FORBIDDEN', async (_cell, call) => {
    const res = await send(call, as(student)).expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('a refused student upload stores nothing, a refused delete deletes nothing', async () => {
    await api().post('/api/v1/lectures').set(as(student)).field('title', 'x').attach('file', MP3, 'a.mp3').expect(403);
    await send({ method: 'delete', path: () => `/lectures/${L.readyApproved}` }, as(student)).expect(403);
    expect(await Lecture.countDocuments()).toBe(4);
  });

  it('reads approved topic sections, summaries and questions ONLY (handler filter — PB.1, PB.2, PC.3)', async () => {
    const lectureId = await lecture(owner, { title: 'Review content, student view' });
    const { topics, summaries, questions } = await reviewContent(lectureId);
    const t = await send({ method: 'get', path: () => `/lectures/${lectureId}/topics` }, as(student)).expect(200);
    expect(t.body.items.map((x: { id: string }) => x.id)).toEqual([topics[0]!.id]);
    const sm = await send({ method: 'get', path: () => `/lectures/${lectureId}/summaries` }, as(student)).expect(200);
    expect(sm.body.items.map((x: { id: string }) => x.id)).toEqual([summaries[0]!.id]);
    // Questions reach students only through quizzes, which draw from approved questions only.
    const quiz = await send({ method: 'post', path: () => '/quizzes', body: { lectureId, questionCount: 20 } }, as(student)).expect(201);
    expect(quiz.body.quiz.questions.map((x: { id: string }) => x.id)).toEqual([questions[0]!.id]);
    await send({ method: 'get', path: () => `/questions?lectureId=${lectureId}` }, as(student)).expect(403);
    await Lecture.deleteOne({ _id: lectureId }); // keep the shared fixture's lecture count stable
  });
  it('never receives pending questions or answer keys before submitting (PC.3)', async () => {
    const topic = await TopicSection.create({
      lectureId: L.readyApproved,
      index: 0,
      startSec: 0,
      endSec: 60,
      segmentStart: 0,
      segmentEnd: 2,
      label: 'Introduction',
      keywords: ['intro', 'basics', 'overview'],
      method: 'fixed_window',
      boundaryScore: null,
      status: 'approved',
    });

    const questionData = {
      lectureId: L.readyApproved,
      topicId: topic._id,
      type: 'mcq' as const,
      difficulty: 'easy' as const,
      stem: 'What is the purpose of an operating system?',
      options: [
        { id: 'a', text: 'Manage computer resources' },
        { id: 'b', text: 'Design websites' },
        { id: 'c', text: 'Compile every program' },
        { id: 'd', text: 'Create hardware' },
      ],
      correctOptionId: 'a' as const,
      explanation: 'An operating system manages hardware and software resources.',
      evidence: [{
        chunkId: new (await import('mongoose')).Types.ObjectId(),
        startSec: 0,
        endSec: 10,
        quote: 'An operating system manages computer resources.',
      }],
      rejectionReason: null,
      reviewedBy: null,
      reviewedAt: null,
      reviewNote: null,
      model: 'test-model',
      promptVersion: 'test-v1',
    };

    const approved = await Question.create({
      ...questionData,
      status: 'approved',
      reviewedBy: owner._id,
      reviewedAt: new Date(),
    });

    const pending = await Question.create({
      ...questionData,
      stem: 'PENDING QUESTION — MUST NOT BE SHOWN',
      status: 'pending_review',
    });

    const quiz = await Quiz.create({
      lectureId: L.readyApproved,
      createdBy: student._id,
      title: 'Security test quiz',
      questionIds: [approved._id, pending._id],
      topicIds: [topic._id],
    });

    const res = await api()
      .get(`/api/v1/quizzes/${quiz.id}`)
      .set(as(student))
      .expect(200);

    expect(res.body.quiz.questions).toHaveLength(1);
    expect(res.body.quiz.questions[0].id).toBe(approved.id);
    expect(res.body.quiz.questions[0].stem).not.toContain('PENDING QUESTION');

    for (const question of res.body.quiz.questions) {
      expect(question).not.toHaveProperty('correctOptionId');
      expect(question).not.toHaveProperty('explanation');
      expect(question).not.toHaveProperty('evidence');
      expect(question).not.toHaveProperty('status');
    }
  });
  });

describe('teacher', () => {
  it.each(OPEN_TO_ANY)('can do what a student can: %s', async (_cell, call) => {
    const res = await send(call, as(owner));

    // Through the guards: never 401/403, never a server error (404/422 are the handler's own answers).
    expect([401, 403], `${_cell} → ${res.status}`).not.toContain(res.status);
    expect(res.status, `${_cell} → ${res.status}`).toBeLessThan(500);
  });

  it('uploads a lecture → 202', async () => {
    const res = await api()
      .post('/api/v1/lectures')
      .set(as(owner))
      .field({ title: 'New upload', lecturerConsent: 'true', purposeShown: 'true', processorNamed: 'true' })
      .attach('file', MP3, { filename: 'a.mp3', contentType: 'audio/mpeg' })
      .expect(202);
    expect(res.body.lecture.uploadedBy).toBe(owner.id);
  });

  it('lists only their own lectures, in any status', async () => {
    const res = await send({ method: 'get', path: () => '/lectures' }, as(owner)).expect(200);
    const ids = res.body.items.map((l: { id: string }) => l.id);
    expect(ids).toEqual(expect.arrayContaining([L.readyApproved, L.readyUnapproved, L.processing]));
    expect(ids).not.toContain(L.othersReady);
  });

  it('reads their own lecture before it is ready', async () => {
    await send({ method: 'get', path: () => `/lectures/${L.processing}` }, as(owner)).expect(200);
  });

  it('reads processing status of their own lecture', async () => {
    await send({ method: 'get', path: () => `/lectures/${L.processing}/status` }, as(owner)).expect(200);
  });

  it('reprocesses their own lecture → 202', async () => {
    await send({ method: 'post', path: () => `/lectures/${L.readyUnapproved}/reprocess` }, as(owner)).expect(202);
  });

  it('deletes their own lecture → 204', async () => {
    const id = await lecture(owner, { title: 'Disposable' });
    await send({ method: 'delete', path: () => `/lectures/${id}` }, as(owner)).expect(204);
  });

  it.each(TEACHER_ONLY_STUBS)('may %s (passes the guards → 501 until built)', async (_cell, call) => {
    const res = await send(call, as(owner)).expect(501);
    expect(res.body.error.code).toBe('NOT_IMPLEMENTED');
  });

  // Live review routes (B, C): the role check lets a teacher through (the ids here are made up,
  // so the handler answers 404 — what matters is that it is never 401/403 for a teacher).
  it.each(TEACHER_ONLY_LIVE_REVIEW)('may %s (passes the guards; handler reached)', async (_cell, call) => {
    const res = await send(call, as(owner));
    expect([401, 403]).not.toContain(res.status);
    // Question generation needs the LLM, which tests never configure: the handler's honest 503.
    if (res.status === 503) expect(res.body.error.code).toBe('PROVIDER_UNAVAILABLE');
    else expect(res.status).toBeLessThan(500);
  });

  describe("another teacher's lecture → 404, existence not revealed", () => {
    const cells: Array<[string, Call]> = [
      ['read it', { method: 'get', path: () => `/lectures/${L.othersReady}` }],
      ['read its status', { method: 'get', path: () => `/lectures/${L.othersReady}/status` }],
      ['reprocess it', { method: 'post', path: () => `/lectures/${L.othersReady}/reprocess` }],
      ['delete it', { method: 'delete', path: () => `/lectures/${L.othersReady}` }],
    ];
    it.each(cells)('may NOT %s', async (_cell, call) => {
      const res = await send(call, as(owner)).expect(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('and the lecture is untouched afterwards', async () => {
      const doc = await Lecture.findById(L.othersReady);
      expect(doc?.status).toBe('ready');
    });
  });

  it("may NOT approve, edit or read pending content of another teacher's lecture (handler ownership — PA.1, PB.1, PB.2, PC.3)", async () => {
    const { topics, summaries, questions } = await reviewContent(L.othersReady);
    await TranscriptSegment.create({
      lectureId: L.othersReady, index: 0, startSec: 0, endSec: 5, text: 'Original.', confidence: 0.9, lowConfidence: false, corrected: false, modelVersion: 'm',
    });
    await Lecture.updateOne({ _id: L.othersReady }, { transcriptApproved: false });
    const cells: Array<[string, Call]> = [
      ['read its transcript', { method: 'get', path: () => `/lectures/${L.othersReady}/transcript` }],
      ['edit a segment', { method: 'patch', path: () => `/lectures/${L.othersReady}/segments/0`, body: { text: 'Hijacked.' } }],
      ['approve its transcript', { method: 'post', path: () => `/lectures/${L.othersReady}/transcript/approve` }],
      ['read its topics', { method: 'get', path: () => `/lectures/${L.othersReady}/topics` }],
      ['edit a topic', { method: 'patch', path: () => `/topics/${topics[1]!.id}`, body: { label: 'Hijacked' } }],
      ['approve a topic', { method: 'post', path: () => `/topics/${topics[1]!.id}/approve` }],
      ['read its summaries', { method: 'get', path: () => `/lectures/${L.othersReady}/summaries` }],
      ['approve a summary', { method: 'post', path: () => `/summaries/${summaries[1]!.id}/approve` }],
      ['read its question queue', { method: 'get', path: () => `/questions?lectureId=${L.othersReady}&status=pending_review` }],
      ['approve a question', { method: 'patch', path: () => `/questions/${questions[1]!.id}`, body: { status: 'approved' } }],
      ['generate questions', { method: 'post', path: () => `/lectures/${L.othersReady}/questions/generate`, body: {} }],
    ];
    for (const [cell, call] of cells) {
      const res = await send(call, as(owner));
      expect(res.status, cell).toBe(404);
      expect(res.body.error.code, cell).toBe('NOT_FOUND');
    }
    // Nothing changed.
    expect((await TopicSection.findById(topics[1]!._id))!.status).toBe('pending_review');
    expect((await Summary.findById(summaries[1]!._id))!.status).toBe('pending_review');
    expect((await Question.findById(questions[1]!._id))!.status).toBe('pending_review');
    expect((await TranscriptSegment.findOne({ lectureId: L.othersReady }))!.text).toBe('Original.');
    expect((await Lecture.findById(L.othersReady))!.transcriptApproved).toBe(false);
    // Restore the shared fixture for the cells that follow.
    await Promise.all([
      Lecture.updateOne({ _id: L.othersReady }, { transcriptApproved: true }),
      ...[TopicSection, Summary, Question, TranscriptSegment, Chunk].map((m) => (m as typeof Chunk).deleteMany({ lectureId: L.othersReady })),
    ]);
  });
});

describe('nobody', () => {
  const ALL_PROTECTED: Array<[string, Call]> = [
    ['GET /auth/me', { method: 'get', path: () => '/auth/me' }],
    ['GET /users/me', { method: 'get', path: () => '/users/me' }],
    ['PATCH /users/me', { method: 'patch', path: () => '/users/me', body: { name: 'Someone' } }],
    ['GET /lectures', { method: 'get', path: () => '/lectures' }],
    ['GET /lectures/:id', { method: 'get', path: () => `/lectures/${L.readyApproved}` }],
    ...OPEN_TO_ANY.map(([name, call]): [string, Call] => [name, call]),
    ...TEACHER_ONLY,
  ];

  it.each(ALL_PROTECTED)('without a token may NOT %s → 401', async (_cell, call) => {
    const res = await send(call).expect(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it.each(ALL_PROTECTED)('with a forged token may NOT %s → 401', async (_cell, call) => {
    const forged = jwt.sign({ role: 'teacher' }, 'not-the-server-secret-but-32-characters!', { subject: owner.id });
    await send(call, { Authorization: `Bearer ${forged}` }).expect(401);
  });

  it('an expired token → 401 with reason "expired"', async () => {
    const expired = jwt.sign({ role: 'teacher' }, env.JWT_SECRET, { subject: owner.id, expiresIn: -1 });
    const res = await send({ method: 'get', path: () => '/lectures' }, { Authorization: `Bearer ${expired}` }).expect(401);
    expect(res.body.error.details).toEqual({ reason: 'expired' });
  });

  it('media without a signature, or with another lecture\'s signature → 401', async () => {
    await api().get(`/api/v1/lectures/${L.readyApproved}/media`).expect(401);
    const { body } = await send({ method: 'get', path: () => `/lectures/${L.othersReady}` }, as(student)).expect(200);
    const borrowed = body.mediaUrl.replace(L.othersReady, L.readyApproved);
    await api().get(borrowed).expect(401);
  });

  it('public routes need no token: health, register, login', async () => {
    await api().get('/api/v1/health').expect(200);
    await api().post('/api/v1/auth/register').send({ name: 'New Person', email: 'new@example.edu', password: 'abcdefg1', role: 'student' }).expect(201);
    await api().post('/api/v1/auth/login').send({ email: student.email, password: TEST_PASSWORD }).expect(200);
  });

  it("may NOT read another user's attempts — GET /attempts/:id ownership (PC.3)", async () => {
    const quiz = await Quiz.create({ lectureId: L.readyApproved, createdBy: student._id, title: 'Q', questionIds: [ID] });
    const attempt = await Attempt.create({
      quizId: quiz._id, lectureId: L.readyApproved, studentId: student._id,
      answers: [{ questionId: ID, topicId: ID, selectedOptionId: 'a', correct: true }],
      score: { correct: 1, total: 1, accuracy: 1 }, perTopic: [], startedAt: new Date(), submittedAt: new Date(), timeTakenSec: 1,
    });
    const classmate = await makeStudent();
    for (const user of [classmate, owner, otherTeacher]) {
      const res = await send({ method: 'get', path: () => `/attempts/${attempt.id}` }, as(user)).expect(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    }
    await send({ method: 'get', path: () => `/attempts/${attempt.id}` }, as(student)).expect(200);
    await api().get(`/api/v1/attempts/${attempt.id}`).expect(401);
  });
});
