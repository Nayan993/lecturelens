import { rm } from 'node:fs/promises';
import type { HydratedDocument, Model } from 'mongoose';
import {
  Attempt,
  Chunk,
  Lecture,
  Question,
  Quiz,
  RevisionRecommendation,
  STAGE_NAMES,
  Summary,
  TopicSection,
  TranscriptSegment,
  User,
  type ILecture,
  type Role,
  type StageName,
} from '../../models/index.js';
import { discardUpload, uploadDirOf } from '../../middleware/upload.js';
import { startProcessing } from '../../services/processing/pipeline.js';
import { conflict, internal, notFound } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import type { ListQuery } from './lectures.schemas.js';
import { stagesAfter, stageStatesFor } from './stages.js';

type LectureDoc = HydratedDocument<ILecture>;

export interface Viewer {
  id: string;
  role: Role;
}

/**
 * What `consent.processorNamed: true` attests (§4.2): the upload page named these third-party
 * processors before the teacher consented. Shown to teachers; not stored per lecture.
 */
export const NAMED_PROCESSORS = ['AssemblyAI (transcription)', 'Groq or OpenRouter (language model)'] as const;

/* ------------------------------------------------------------- visibility ---- */

/**
 * Lectures the viewer may see (§1.5, §1.6): teachers their own; students only ready lectures
 * whose transcript is approved. Anything else is reported as 404, never 403.
 */
export function visibleTo(viewer: Viewer) {
  return viewer.role === 'teacher'
    ? { uploadedBy: viewer.id }
    : { status: 'ready' as const, transcriptApproved: true };
}

export async function findVisible(id: string, viewer: Viewer): Promise<LectureDoc> {
  const lecture = await Lecture.findOne({ _id: id, ...visibleTo(viewer) });
  if (!lecture) throw notFound('Lecture');
  return lecture;
}

/** For owner-only routes: another teacher's lecture is a 404 (§1.6). */
export async function findOwned(id: string, viewer: Viewer): Promise<LectureDoc> {
  const lecture = await Lecture.findOne({ _id: id, uploadedBy: viewer.id });
  if (!lecture) throw notFound('Lecture');
  return lecture;
}

/* ------------------------------------------------------------ serialising ---- */

const SEGMENTING = STAGE_NAMES.indexOf('segmenting');

/** Lecture JSON plus the computed `uploadedByName` and `topicCount` (§5.3), in one round of queries. */
export async function present(lectures: LectureDoc[], viewer: Viewer): Promise<Record<string, unknown>[]> {
  if (lectures.length === 0) return [];
  const ids = lectures.map((l) => l._id);
  const [uploaders, topicCounts] = await Promise.all([
    User.find({ _id: { $in: lectures.map((l) => l.uploadedBy) } }).select('name'),
    TopicSection.aggregate<{ _id: unknown; n: number }>([
      { $match: { lectureId: { $in: ids }, ...(viewer.role === 'student' ? { status: 'approved' } : {}) } },
      { $group: { _id: '$lectureId', n: { $sum: 1 } } },
    ]),
  ]);
  const names = new Map(uploaders.map((u) => [String(u._id), u.name]));
  const counts = new Map(topicCounts.map((c) => [String(c._id), c.n]));

  return lectures.map((lecture) => {
    const segmented = stageStatesFor(lecture.status, lecture.error?.stage ?? null)[SEGMENTING] === 'done';
    return {
      ...(lecture.toJSON() as Record<string, unknown>),
      uploadedByName: names.get(String(lecture.uploadedBy)) ?? null,
      topicCount: segmented ? (counts.get(String(lecture._id)) ?? 0) : null,
    };
  });
}

export async function presentOne(lecture: LectureDoc, viewer: Viewer): Promise<Record<string, unknown>> {
  const [json = {}] = await present([lecture], viewer);
  return json;
}

/* ----------------------------------------------------------------- listing ---- */

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function list(query: ListQuery, viewer: Viewer) {
  const filter = {
    $and: [
      visibleTo(viewer),
      query.status ? { status: query.status } : {},
      query.q ? { title: { $regex: escapeRegex(query.q), $options: 'i' } } : {},
    ],
  };
  const [docs, total] = await Promise.all([
    Lecture.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit),
    Lecture.countDocuments(filter),
  ]);
  return { items: await present(docs, viewer), page: query.page, limit: query.limit, total };
}

/* --------------------------------------------------------- derived data ---- */

/** Collections holding data derived from a lecture (§4.2 delete cascade). */
const DERIVED: Array<[string, Model<any>]> = [ // eslint-disable-line @typescript-eslint/no-explicit-any
  ['transcriptsegments', TranscriptSegment],
  ['chunks', Chunk],
  ['topicsections', TopicSection],
  ['summaries', Summary],
  ['questions', Question],
  ['quizzes', Quiz],
  ['attempts', Attempt],
  ['revisionrecommendations', RevisionRecommendation],
];

/** What a rerun from `stage` invalidates (§5.3 reprocess). Quizzes and attempts are kept as history. */
async function discardDerivedFrom(lectureId: string, stage: StageName): Promise<void> {
  const from = STAGE_NAMES.indexOf(stage);
  const at = (s: StageName) => from <= STAGE_NAMES.indexOf(s);
  const ops: Array<Promise<unknown>> = [];
  if (at('transcribing')) ops.push(TranscriptSegment.deleteMany({ lectureId }));
  if (at('chunking')) ops.push(Chunk.deleteMany({ lectureId }));
  if (at('segmenting')) ops.push(TopicSection.deleteMany({ lectureId }), Question.deleteMany({ lectureId }));
  if (at('summarising')) ops.push(Summary.deleteMany({ lectureId }));
  if (stage === 'indexing') ops.push(Chunk.updateMany({ lectureId }, { $set: { embedding: [] } }));
  await Promise.all(ops);
}

/* ------------------------------------------------------------------ create ---- */

export interface NewLecture {
  uploadId: string;
  fields: {
    title: string;
    courseCode?: string;
    description?: string;
    recordedOn?: string;
    notes?: string;
  };
  file: { storedName: string; originalFilename: string; mimeType: string; sizeBytes: number };
}

/** Saves the lecture (status "uploaded") and starts the pipeline without awaiting it. */
export async function create({ uploadId, fields, file }: NewLecture, viewer: Viewer): Promise<LectureDoc> {
  const now = new Date();
  let lecture: LectureDoc;
  try {
    lecture = await Lecture.create({
      _id: uploadId,
      title: fields.title,
      courseCode: fields.courseCode ?? null,
      description: fields.description ?? null,
      recordedOn: fields.recordedOn ?? null,
      notes: fields.notes ?? null,
      uploadedBy: viewer.id,
      // Validated as "true" by the route — no media is processed without all three.
      consent: { lecturerConsent: true, purposeShown: true, processorNamed: true, grantedBy: viewer.id, grantedAt: now },
      status: 'uploaded',
      statusDetail: 'Upload received; waiting to start audio extraction.',
      mediaPath: `${uploadId}/${file.storedName}`,
      media: { originalFilename: file.originalFilename, mimeType: file.mimeType, sizeBytes: file.sizeBytes },
    });
  } catch (err) {
    await discardUpload(uploadId);
    throw err;
  }
  kickOff(lecture.id);
  return lecture;
}

function kickOff(lectureId: string, fromStage?: StageName): void {
  startProcessing(lectureId, fromStage ? { fromStage } : undefined).catch((err: unknown) =>
    logger.error('Processing pipeline rejected', { lectureId, error: err }),
  );
}

/* --------------------------------------------------------------- reprocess ---- */

const HUMAN_STAGE: Record<StageName, string> = {
  extracting: 'audio extraction',
  transcribing: 'transcription',
  chunking: 'passage splitting',
  segmenting: 'topic segmentation',
  summarising: 'summarising',
  indexing: 'search indexing',
};

/**
 * Restarts processing from `fromStage` (§5.3). Allowed from `ready`, or from `failed` at or
 * before the failing stage. Idempotent: a repeat while the same restart is still queued
 * returns the lecture without starting a second run. Concurrent calls cannot both claim it.
 */
export async function reprocess(id: string, fromStage: StageName, viewer: Viewer, attempt = 1): Promise<LectureDoc> {
  const lecture = await findOwned(id, viewer);
  const from = STAGE_NAMES.indexOf(fromStage);

  const queuedSameRestart =
    lecture.status === fromStage && lecture.stages.find((s) => s.name === fromStage)?.state === 'running';
  if (queuedSameRestart) return lecture;

  if (lecture.status !== 'ready' && lecture.status !== 'failed') {
    throw conflict('This lecture is still processing.', { status: lecture.status });
  }
  if (lecture.status === 'failed' && lecture.error && from > STAGE_NAMES.indexOf(lecture.error.stage)) {
    throw conflict(`Processing failed at ${lecture.error.stage}; reprocess from that stage or an earlier one.`, {
      status: lecture.status,
      failedStage: lecture.error.stage,
    });
  }

  const resetsTranscript = fromStage === 'extracting' || fromStage === 'transcribing';
  const claimed = await Lecture.findOneAndUpdate(
    { _id: lecture._id, uploadedBy: viewer.id, status: lecture.status, updatedAt: lecture.updatedAt },
    {
      $set: {
        status: fromStage,
        statusDetail: `Reprocessing from ${HUMAN_STAGE[fromStage]}.`,
        error: null,
        stages: stagesAfter(lecture.stages, fromStage, null),
        ...(resetsTranscript ? { transcriptApproved: false, transcriptApprovedBy: null, transcriptApprovedAt: null } : {}),
      },
    },
    { new: true },
  );
  if (!claimed) {
    // Another request changed it in between: re-read and answer as that request's repeat.
    if (attempt >= 3) throw conflict('This lecture is changing right now; try again.', { status: lecture.status });
    return reprocess(id, fromStage, viewer, attempt + 1);
  }

  await discardDerivedFrom(id, fromStage);
  kickOff(id, fromStage);
  return claimed;
}

/* ------------------------------------------------------------------ delete ---- */

/**
 * Deletes derived documents first, then the lecture, then its media directory. If any derived
 * collection fails the lecture is kept (so the delete can be retried) and the failures logged.
 */
export async function remove(id: string, viewer: Viewer): Promise<void> {
  const lecture = await findOwned(id, viewer);
  const results = await Promise.allSettled(DERIVED.map(([, model]) => model.deleteMany({ lectureId: lecture._id })));
  const failed = results.flatMap((r, i) => (r.status === 'rejected' ? [{ collection: DERIVED[i]![0], error: r.reason }] : []));
  if (failed.length) {
    logger.error('Lecture delete partially failed; lecture kept so it can be retried', { lectureId: id, failed });
    throw internal();
  }

  await Lecture.deleteOne({ _id: lecture._id });
  try {
    await rm(uploadDirOf(id), { recursive: true, force: true });
  } catch (err) {
    logger.error('Lecture deleted but its media directory could not be removed', { lectureId: id, error: err });
  }
}
