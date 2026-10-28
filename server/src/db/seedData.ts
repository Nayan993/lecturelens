import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { HydratedDocument, Model } from 'mongoose';
import {
  Attempt,
  Chunk,
  Lecture,
  Question,
  Quiz,
  STAGE_NAMES,
  Summary,
  TopicSection,
  TranscriptSegment,
  User,
  type LectureStatus,
  type OptionId,
  type ProcessingStage,
  type StageName,
} from '../models/index.js';
import { BCRYPT_COST, hashPassword } from '../modules/auth/password.js';
import { stageStatesFor } from '../modules/lectures/stages.js';

/**
 * Builds (but does not write) every seed document from the shared fixtures in /mocks, so
 * the database matches the frontend mocks. Kept free of I/O besides reading the fixtures
 * so tests can check the mapping without a database. See seed.ts for the runner.
 */

// /mocks — the same relative path from src/db and dist/db.
const MOCKS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../mocks');

type Fixture = { id: string } & Record<string, unknown>;
interface ListFixture<T = Fixture> {
  items: T[];
}

function readFixture<T>(file: string): T {
  return JSON.parse(readFileSync(path.join(MOCKS_DIR, file), 'utf8')) as T;
}

/** Fixture `id` → Mongo `_id`; every other field is cast by the model. */
function fromFixture({ id, ...fields }: Fixture): Record<string, unknown> {
  return { _id: id, ...fields };
}

/* ---------------------------------------------------------------------------
 * Demo accounts — CONTRACTS.md §9. Demo credentials, not secrets.
 * ------------------------------------------------------------------------- */

export const DEMO_PASSWORD = 'lecturelens';

export const DEMO_USERS = [
  { id: '6650c3a0c3b2e41d8a000001', role: 'teacher', name: 'Dr. Ananya Rao', email: 'teacher@lecturelens.dev' },
  { id: '6650c3a0c3b2e41d8a000002', role: 'student', name: 'Rohan Mehta', email: 'student@lecturelens.dev' },
  { id: '6650c3a0c3b2e41d8a000003', role: 'student', name: 'Meera Iyer', email: 'student2@lecturelens.dev' },
] as const;

const [, ROHAN, MEERA] = DEMO_USERS;

/* ---------------------------------------------------------------------------
 * Lectures — server-only fields the client fixtures do not carry
 * ------------------------------------------------------------------------- */

interface LectureFixture extends Fixture {
  status: LectureStatus;
  error: { stage: StageName } | null;
  uploadedBy: string;
  transcriptApproved: boolean;
  media: { originalFilename: string };
  createdAt: string;
  updatedAt: string;
}

/** Per-stage timings the client mock adapter shows for fixture lectures (services/mock/lectures.ts). */
const DONE_MS: Record<StageName, number> = {
  extracting: 30489,
  transcribing: 412337,
  chunking: 1840,
  segmenting: 6112,
  summarising: 48210,
  indexing: 15873,
};
const RUNNING_MS = 183406;
const FAILED_MS = 7727;

/** Stage history consistent with the lecture's status, laid out from its createdAt. */
function stagesFor(lecture: LectureFixture): ProcessingStage[] {
  const states = stageStatesFor(lecture.status, lecture.error?.stage ?? null);
  let cursor = Date.parse(lecture.createdAt);

  return STAGE_NAMES.map((name, i): ProcessingStage => {
    const state = states[i]!;
    const ms = { done: DONE_MS[name], failed: FAILED_MS, running: RUNNING_MS, pending: null, skipped: null }[state];

    if (ms === null) return { name, state, ms, startedAt: null, finishedAt: null };
    const startedAt = new Date(cursor);
    cursor += ms;
    return { name, state, ms, startedAt, finishedAt: state === 'running' ? null : new Date(cursor) };
  });
}

function lectureDoc(lecture: LectureFixture) {
  return new Lecture({
    ...fromFixture(lecture), // computed fields (uploadedByName, topicCount) are dropped by the schema
    notes: null,
    stages: stagesFor(lecture),
    // The media files themselves are not seeded; playback of seeded lectures needs real files here.
    mediaPath: `lectures/${lecture.id}/${lecture.media.originalFilename}`,
    audioPath: null,
  });
}

/* ---------------------------------------------------------------------------
 * Quiz and attempts — not in /mocks (the client mock starts with none), so they are
 * built here from the approved fixture questions and scored by the same rules as §4.9.
 * ------------------------------------------------------------------------- */

const QUIZ_ID = '6650c3a0c3b2e41d8a700001';

const ATTEMPTS: Array<{
  id: string;
  studentId: string;
  /** One per quiz question, in quiz order; null = skipped. */
  selections: Array<OptionId | null>;
  startedAt: string;
  submittedAt: string;
}> = [
  {
    id: '6650c3a0c3b2e41d8a800001',
    studentId: ROHAN.id,
    selections: ['b', 'a', 'd', 'c', 'a'],
    startedAt: '2026-10-26T18:21:04.000Z',
    submittedAt: '2026-10-26T18:27:41.512Z',
  },
  {
    id: '6650c3a0c3b2e41d8a800002',
    studentId: MEERA.id,
    selections: ['b', 'b', 'd', 'b', null],
    startedAt: '2026-10-27T09:05:30.000Z',
    submittedAt: '2026-10-27T09:09:02.250Z',
  },
];

const round3 = (n: number) => Math.round(n * 1000) / 1000;

interface QuestionFixture extends Fixture {
  lectureId: string;
  topicId: string;
  status: string;
  correctOptionId: OptionId;
}
interface TopicFixture extends Fixture {
  index: number;
  label: string;
}

/* ---------------------------------------------------------------------------
 * Everything, in insertion order
 * ------------------------------------------------------------------------- */

export interface SeedCollection {
  model: Model<any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- heterogeneous list
  docs: HydratedDocument<unknown>[];
}

export async function buildSeed({ bcryptCost = BCRYPT_COST } = {}): Promise<SeedCollection[]> {
  const lectures = readFixture<ListFixture<LectureFixture>>('lectures.json').items;
  const transcript = readFixture<ListFixture & { lectureId: string }>('transcript.json');
  const chunks = readFixture<ListFixture>('chunks.json').items;
  const topics = readFixture<ListFixture<TopicFixture>>('topics.json').items;
  const summaries = readFixture<ListFixture>('summaries.json').items;
  const questions = readFixture<ListFixture<QuestionFixture>>('questions.json').items;

  // Segments, chunks and topics carry no timestamps in the fixtures; use their lecture's.
  const lectureTimes = (lectureId: unknown) => {
    const lecture = lectures.find((l) => l.id === lectureId);
    if (!lecture) throw new Error(`Fixture references unknown lecture ${String(lectureId)}`);
    return { createdAt: lecture.createdAt, updatedAt: lecture.createdAt };
  };

  const passwordHash = await hashPassword(DEMO_PASSWORD, bcryptCost);
  // Fixed timestamps (the raw insert in seed.ts does not stamp any) — before every fixture date.
  const accountsCreatedAt = '2026-09-01T08:00:00.000Z';
  const users = DEMO_USERS.map(
    (u) =>
      new User({
        _id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        passwordHash,
        createdAt: accountsCreatedAt,
        updatedAt: accountsCreatedAt,
      }),
  );

  const quizQuestions = questions.filter((q) => q.status === 'approved');
  const lectureId = quizQuestions[0]?.lectureId;
  if (!lectureId) throw new Error('questions.json has no approved questions to build the seed quiz from');
  const quiz = new Quiz({
    _id: QUIZ_ID,
    lectureId,
    createdBy: ROHAN.id,
    title: 'Practice quiz — Lecture 7',
    questionIds: quizQuestions.map((q) => q.id),
    topicIds: [],
    createdAt: '2026-10-26T18:20:51.000Z',
    updatedAt: '2026-10-26T18:20:51.000Z',
  });

  const attempts = ATTEMPTS.map((a) => {
    // String ids here; the model casts them to ObjectIds.
    const answers = quizQuestions.map((q, i) => {
      const selected = a.selections[i] ?? null;
      return { questionId: q.id, topicId: q.topicId, selectedOptionId: selected, correct: selected === q.correctOptionId };
    });
    const correct = answers.filter((x) => x.correct).length;
    const perTopic = topics
      .map((t) => {
        const mine = answers.filter((x) => x.topicId === t.id);
        const ok = mine.filter((x) => x.correct).length;
        return {
          topicId: t.id,
          topicLabel: t.label,
          correct: ok,
          total: mine.length,
          accuracy: mine.length ? round3(ok / mine.length) : 0,
        };
      })
      .filter((t) => t.total > 0); // already in topic index order
    return new Attempt({
      _id: a.id,
      quizId: QUIZ_ID,
      lectureId,
      studentId: a.studentId,
      answers,
      score: { correct, total: answers.length, accuracy: round3(correct / answers.length) },
      perTopic,
      startedAt: a.startedAt,
      submittedAt: a.submittedAt,
      timeTakenSec: round3((Date.parse(a.submittedAt) - Date.parse(a.startedAt)) / 1000),
      createdAt: a.submittedAt,
    });
  });

  return [
    { model: User, docs: users },
    { model: Lecture, docs: lectures.map(lectureDoc) },
    {
      model: TranscriptSegment,
      docs: transcript.items.map((s) => new TranscriptSegment({ ...fromFixture(s), ...lectureTimes(s.lectureId) })),
    },
    {
      // Empty embeddings: Member C's indexing stage fills them.
      model: Chunk,
      docs: chunks.map((c) => new Chunk({ ...fromFixture(c), embedding: [], ...lectureTimes(c.lectureId) })),
    },
    {
      model: TopicSection,
      docs: topics.map((t) => new TopicSection({ ...fromFixture(t), ...lectureTimes(t.lectureId) })),
    },
    { model: Summary, docs: summaries.map((s) => new Summary(fromFixture(s))) },
    { model: Question, docs: questions.map((q) => new Question(fromFixture(q))) },
    { model: Quiz, docs: [quiz] },
    { model: Attempt, docs: attempts },
  ];
}
