/**
 * In-memory mock backend seeded from /mocks. Shared by every mock adapter so a change made through
 * one service (approve a summary, submit an attempt) is visible through the others. State resets on
 * page reload. Only services/mock/* may import this file.
 */
import lecturesJson from '../../../../mocks/lectures.json';
import transcriptJson from '../../../../mocks/transcript.json';
import chunksJson from '../../../../mocks/chunks.json';
import topicsJson from '../../../../mocks/topics.json';
import summariesJson from '../../../../mocks/summaries.json';
import questionsJson from '../../../../mocks/questions.json';
import answerJson from '../../../../mocks/answer.json';
import revisionJson from '../../../../mocks/revision.json';
import { ApiRequestError, signalUnauthorised } from '../../lib/apiClient';
import { readToken } from '../../lib/tokenStorage';
import { DEMO_ACCOUNTS } from '../demoAccounts';
import type {
  ApiErrorCode,
  Attempt,
  Chunk,
  GroundedAnswer,
  Id,
  Lecture,
  Question,
  Quiz,
  RevisionPlan,
  Role,
  StageName,
  Summary,
  TopicSection,
  TranscriptSegment,
  User,
} from '../../types';

/** JSON imports type enums as `string`; the fixtures are validated against the contract separately. */
const fixture = <T>(data: unknown): T => structuredClone(data) as T;

export const clone = <T>(value: T): T => structuredClone(value);

/** 300–700 ms of artificial latency so loading states are visible; none under test. */
export function delay(): Promise<void> {
  const ms = import.meta.env.MODE === 'test' ? 0 : 300 + Math.random() * 400;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let requestCounter = 0;
export function fail(status: number, code: ApiErrorCode, message: string, details: Record<string, unknown> = {}): never {
  throw new ApiRequestError({ status, code, message, details, requestId: `req_mock${++requestCounter}` });
}

export const nowIso = () => new Date().toISOString();
export const round3 = (x: number) => Math.round(x * 1000) / 1000;
export const deepLink = (lectureId: Id, t: number) => `/lectures/${lectureId}/play?t=${round3(t)}`;

/** 24-char hex ObjectId-like string: 8 hex of epoch seconds + 16 random hex. */
export function newId(): Id {
  const ts = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
  let rest = '';
  for (let i = 0; i < 16; i++) rest += Math.floor(Math.random() * 16).toString(16);
  return ts + rest;
}

// ---- users ----------------------------------------------------------------------------------

export interface MockAccount {
  user: User;
  password: string;
}

const lectures = fixture<{ items: Lecture[] }>(lecturesJson).items;
const revision = fixture<RevisionPlan>(revisionJson);

const stamp = { lastLoginAt: null, createdAt: '2026-09-01T08:00:00.000Z', updatedAt: '2026-09-01T08:00:00.000Z' };

/** Demo accounts from CONTRACTS.md §9; their ids own / took the fixture lectures and attempts. */
export const DEMO_PASSWORD = DEMO_ACCOUNTS[0].password;
const accounts: MockAccount[] = DEMO_ACCOUNTS.map(({ id, role, name, email, password }) => ({
  user: { id, email, name, role, ...stamp },
  password,
}));

// ---- the store ------------------------------------------------------------------------------

export interface MockLectureRuntime {
  /** Pipeline position for lectures processing in this session (created or reprocessed). */
  startedAtMs: number;
  fromStage: StageName;
  /** Object URL of the uploaded file so the player can play it in mock mode. */
  mediaUrl?: string;
}

export const db = {
  accounts,
  lectures,
  runtime: new Map<Id, MockLectureRuntime>(),
  segments: fixture<{ items: TranscriptSegment[] }>(transcriptJson).items,
  chunks: fixture<{ items: Chunk[] }>(chunksJson).items,
  topics: fixture<{ items: TopicSection[] }>(topicsJson).items,
  summaries: fixture<{ items: Summary[] }>(summariesJson).items,
  questions: fixture<{ items: Question[] }>(questionsJson).items,
  answers: fixture<{ answered: GroundedAnswer; abstained: GroundedAnswer }>(answerJson),
  revision,
  quizzes: [] as Array<Omit<Quiz, 'questions'> & { questionIds: Id[] }>,
  attempts: [] as Attempt[],
};

// ---- auth helpers ---------------------------------------------------------------------------

export const tokenFor = (userId: Id) => `mock-token.${userId}`;

export function userForToken(token: string | null): User | null {
  const id = token?.startsWith('mock-token.') ? token.slice('mock-token.'.length) : null;
  return accounts.find((a) => a.user.id === id)?.user ?? null;
}

/** The signed-in mock user, or a 401 that also ends the session exactly like the HTTP adapter. */
export function requireUser(role?: Role): User {
  const token = readToken();
  const user = userForToken(token);
  if (!user) {
    if (token) signalUnauthorised();
    fail(401, 'UNAUTHENTICATED', 'Your session has ended. Please log in again.');
  }
  if (role && user.role !== role) fail(403, 'FORBIDDEN', `Only ${role}s can do this.`);
  return user;
}

/** A lecture the user may see (teacher: own; student: ready only), else 404 like the server. */
export function visibleLecture(user: User, lectureId: Id): Lecture {
  const lecture = lectures.find((l) => l.id === lectureId);
  const visible = lecture && (user.role === 'teacher' ? lecture.uploadedBy === user.id : lecture.status === 'ready' && lecture.transcriptApproved);
  if (!visible) fail(404, 'NOT_FOUND', 'Lecture not found.');
  return lecture;
}

/** A lecture the user owns (teacher), else 403 for students / 404 for other teachers. */
export function ownedLecture(user: User, lectureId: Id): Lecture {
  if (user.role !== 'teacher') fail(403, 'FORBIDDEN', 'Only the lecture’s teacher can do this.');
  return visibleLecture(user, lectureId);
}

/** §4.12: students only ever see approved topics, summaries and questions. */
export const approvedFor = <T extends { status: string }>(user: User, items: T[]): T[] =>
  user.role === 'student' ? items.filter((i) => i.status === 'approved') : items;
