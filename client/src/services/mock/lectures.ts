import { STAGE_NAMES, type Id, type Lecture, type LectureStatus, type ProcessingStage, type ProcessingStatus, type StageName } from '../../types';
import type { LectureService } from '../types';
import type { User } from '../../types';
import { MAX_UPLOAD_MB, mediaKind } from '../../lib/media';
import { approvedFor, clone, db, delay, fail, newId, nowIso, ownedLecture, requireUser, visibleLecture } from './db';

/**
 * Serialise for the caller: topicCount counts the sections this user may see (§5.3). Lectures with
 * topic fixtures are counted live; others keep their fixture value (mock data has no topics for them).
 */
function serialise(lecture: Lecture, user: User): Lecture {
  const topics = db.topics.filter((t) => t.lectureId === lecture.id);
  const topicCount = topics.length ? approvedFor(user, topics).length : lecture.topicCount;
  return { ...clone(lecture), topicCount };
}

/** Optional local video for fixture lectures in mock mode (they have no real media). */
const MOCK_MEDIA_URL = import.meta.env.VITE_MOCK_MEDIA_URL;

/** Lectures created or reprocessed in mock mode advance one pipeline stage every 4 s. */
const STAGE_MS = 4000;
const MOCK_DURATION_SEC = 3012.736;

const STAGE_DETAIL: Record<StageName, string> = {
  extracting: 'Extracting audio with FFmpeg.',
  transcribing: 'Transcribing audio with AssemblyAI.',
  chunking: 'Splitting the transcript into passages.',
  segmenting: 'Finding topic boundaries.',
  summarising: 'Writing section summaries.',
  indexing: 'Embedding passages for search.',
};

/** Fixed per-stage timings (ms) for fixture lectures that have finished processing. */
const DONE_MS: Record<StageName, number> = {
  extracting: 30489,
  transcribing: 412337,
  chunking: 1840,
  segmenting: 6112,
  summarising: 48210,
  indexing: 15873,
};

/** Move a session-processed lecture along the pipeline according to elapsed time. */
function advance(lecture: Lecture): void {
  const run = db.runtime.get(lecture.id);
  if (!run || lecture.status === 'ready' || lecture.status === 'failed') return;
  const startIndex = STAGE_NAMES.indexOf(run.fromStage);
  const stepsDone = Math.floor((Date.now() - run.startedAtMs) / STAGE_MS);
  if (stepsDone < 0) return; // a fresh upload waits one step in "uploaded" before extraction starts
  const index = startIndex + stepsDone;
  const next: LectureStatus = index >= STAGE_NAMES.length ? 'ready' : STAGE_NAMES[index];
  if (next === lecture.status) return;
  lecture.status = next;
  lecture.statusDetail = next === 'ready' ? 'Ready.' : STAGE_DETAIL[next as StageName];
  if (index > 0 && lecture.durationSec === null) lecture.durationSec = MOCK_DURATION_SEC;
  lecture.updatedAt = nowIso();
}

function stagesFor(lecture: Lecture): ProcessingStage[] {
  const run = db.runtime.get(lecture.id);
  const current = STAGE_NAMES.indexOf(lecture.status as StageName);
  return STAGE_NAMES.map((name, i): ProcessingStage => {
    if (lecture.status === 'ready') {
      const skippedBeforeRun = run && i < STAGE_NAMES.indexOf(run.fromStage);
      return { name, state: 'done', ms: skippedBeforeRun ? DONE_MS[name] : run ? STAGE_MS : DONE_MS[name] };
    }
    if (lecture.status === 'failed') {
      const failedAt = STAGE_NAMES.indexOf(lecture.error?.stage ?? 'extracting');
      if (i < failedAt) return { name, state: 'done', ms: DONE_MS[name] };
      if (i === failedAt) return { name, state: 'failed', ms: 7727 };
      return { name, state: 'skipped', ms: null };
    }
    if (lecture.status === 'uploaded' || i > current) return { name, state: 'pending', ms: null };
    if (i < current) return { name, state: 'done', ms: run ? STAGE_MS : DONE_MS[name] };
    // Running stage: elapsed so far.
    const elapsed = run ? (Date.now() - run.startedAtMs) % STAGE_MS : 183406;
    return { name, state: 'running', ms: Math.round(elapsed) };
  });
}

function formField(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

export const mockLectureService: LectureService = {
  async list(params = {}) {
    await delay();
    const user = requireUser();
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    if (!Number.isInteger(page) || page < 1) fail(422, 'VALIDATION_FAILED', 'Query is invalid.', { page: 'Must be an integer ≥ 1' });
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) fail(422, 'VALIDATION_FAILED', 'Query is invalid.', { limit: 'Must be 1–100' });
    db.lectures.forEach(advance);
    const q = params.q?.trim().toLowerCase();
    const visible = db.lectures
      // Students see a lecture only once it is ready AND its transcript is approved (CONTRACTS §1.5).
      .filter((l) => (user.role === 'teacher' ? l.uploadedBy === user.id : l.status === 'ready' && l.transcriptApproved))
      .filter((l) => !params.status || l.status === params.status)
      .filter((l) => !q || l.title.toLowerCase().includes(q))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { items: visible.slice((page - 1) * limit, page * limit).map((l) => serialise(l, user)), page, limit, total: visible.length };
  },

  async get(id) {
    await delay();
    const user = requireUser();
    const lecture = visibleLecture(user, id);
    advance(lecture);
    // Fixture lectures have no media in mock mode (unless VITE_MOCK_MEDIA_URL is set); session uploads play
    // from their object URL. An empty src makes the player show its "can't be played" message without a
    // network request.
    const mediaUrl = db.runtime.get(id)?.mediaUrl ?? MOCK_MEDIA_URL ?? '';
    return { ...serialise(lecture, user), mediaUrl };
  },

  async getStatus(id) {
    await delay();
    const lecture = ownedLecture(requireUser(), id);
    advance(lecture);
    const status: ProcessingStatus = {
      lectureId: lecture.id,
      status: lecture.status,
      statusDetail: lecture.statusDetail,
      error: clone(lecture.error),
      durationSec: lecture.durationSec,
      stages: stagesFor(lecture),
      updatedAt: lecture.updatedAt,
    };
    return status;
  },

  async create(form, options = {}) {
    // Simulated upload progress so the progress bar is demonstrable in mock mode.
    for (const fraction of [0.15, 0.4, 0.65, 0.9, 1]) {
      await delay();
      options.onUploadProgress?.(fraction);
      if (import.meta.env.MODE !== 'test') await new Promise((r) => setTimeout(r, 150));
    }
    const user = requireUser('teacher');
    const file = form.get('file');
    const title = formField(form, 'title');
    const details: Record<string, string> = {};
    if (!(file instanceof Blob)) details.file = 'Required';
    if (!title || title.length > 200) details.title = 'Must be 1–200 characters';
    if (formField(form, 'lecturerConsent') !== 'true') details['consent.lecturerConsent'] = 'Lecturer consent is required';
    if (formField(form, 'purposeShown') !== 'true') details['consent.purposeShown'] = 'The purpose statement must be shown';
    if (formField(form, 'processorNamed') !== 'true') details['consent.processorNamed'] = 'The processors must be named';
    if (Object.keys(details).length) fail(422, 'VALIDATION_FAILED', 'Request body is invalid.', details);
    const blob = file as Blob;
    const filename = file instanceof File ? file.name : '';
    if (!mediaKind({ name: filename, type: blob.type })) fail(415, 'UNSUPPORTED_MEDIA_TYPE', 'This file type is not supported.', { mimeType: blob.type });
    if (blob.size > MAX_UPLOAD_MB * 1024 * 1024) fail(413, 'PAYLOAD_TOO_LARGE', `Files must be ${MAX_UPLOAD_MB} MB or smaller.`, { maxMb: MAX_UPLOAD_MB });
    const recordedOn = formField(form, 'recordedOn');
    if (recordedOn && (!/^\d{4}-\d{2}-\d{2}$/.test(recordedOn) || recordedOn > new Date().toISOString().slice(0, 10))) {
      fail(422, 'VALIDATION_FAILED', 'Request body is invalid.', { recordedOn: 'Use a date that is not in the future' });
    }

    const at = nowIso();
    const id = newId();
    const lecture: Lecture = {
      id,
      title,
      courseCode: formField(form, 'courseCode') || null,
      description: formField(form, 'description') || null,
      recordedOn: recordedOn || null,
      status: 'uploaded',
      statusDetail: 'Upload received; waiting to start audio extraction.',
      error: null,
      durationSec: null,
      transcriptApproved: false,
      topicCount: null,
      uploadedBy: user.id,
      uploadedByName: user.name,
      consent: { lecturerConsent: true, purposeShown: true, processorNamed: true, grantedBy: user.id, grantedAt: at },
      media: { originalFilename: file instanceof File ? file.name : 'upload', mimeType: blob.type, sizeBytes: blob.size },
      createdAt: at,
      updatedAt: at,
    };
    db.lectures.push(lecture);
    db.runtime.set(id, {
      startedAtMs: Date.now() + STAGE_MS, // stays "uploaded" for one step, then extracting
      fromStage: 'extracting',
      mediaUrl: typeof URL.createObjectURL === 'function' ? URL.createObjectURL(blob) : undefined,
    });
    return clone(lecture);
  },

  async remove(id) {
    await delay();
    ownedLecture(requireUser(), id);
    const drop = <T extends { lectureId: Id }>(items: T[]) => {
      for (let i = items.length - 1; i >= 0; i--) if (items[i].lectureId === id) items.splice(i, 1);
    };
    db.lectures.splice(db.lectures.findIndex((l) => l.id === id), 1);
    drop(db.segments);
    drop(db.chunks);
    drop(db.topics);
    drop(db.summaries);
    drop(db.questions);
    drop(db.quizzes);
    drop(db.attempts);
    const mediaUrl = db.runtime.get(id)?.mediaUrl;
    if (mediaUrl?.startsWith('blob:')) URL.revokeObjectURL(mediaUrl);
    db.runtime.delete(id);
  },

  async reprocess(id, fromStage = 'extracting') {
    await delay();
    const lecture = ownedLecture(requireUser(), id);
    if (!STAGE_NAMES.includes(fromStage)) fail(422, 'VALIDATION_FAILED', 'Request body is invalid.', { fromStage: 'Unknown stage' });
    if (lecture.status !== 'ready' && lecture.status !== 'failed') {
      fail(409, 'CONFLICT', 'This lecture is still processing.', { status: lecture.status });
    }
    lecture.status = fromStage;
    lecture.statusDetail = STAGE_DETAIL[fromStage];
    lecture.error = null;
    if (fromStage === 'extracting' || fromStage === 'transcribing') lecture.transcriptApproved = false;
    lecture.updatedAt = nowIso();
    const previous = db.runtime.get(id);
    db.runtime.set(id, { startedAtMs: Date.now(), fromStage, mediaUrl: previous?.mediaUrl });
    return clone(lecture);
  },
};
