import { Schema, model, type Model } from 'mongoose';
import {
  LECTURE_ERROR_CODES,
  LECTURE_STATUSES,
  STAGE_NAMES,
  STAGE_STATES,
  type LectureErrorCode,
  type LectureStatus,
  type StageName,
  type StageState,
} from './enums.js';
import { clientJson, type ObjectId } from './shared.js';

export {
  LECTURE_ERROR_CODES,
  LECTURE_STATUSES,
  STAGE_NAMES,
  STAGE_STATES,
  type LectureErrorCode,
  type LectureStatus,
  type StageName,
  type StageState,
};

/** `lectures` — docs/CONTRACTS.md §4.2. */

export interface LectureConsent {
  lecturerConsent: boolean;
  purposeShown: boolean;
  processorNamed: boolean;
  /** The user who ticked consent (= uploader). */
  grantedBy: ObjectId;
  /** Server time of upload. */
  grantedAt: Date;
}

export interface LectureError {
  stage: StageName;
  code: LectureErrorCode;
  message: string;
  at: Date;
}

export interface ProcessingStage {
  name: StageName;
  state: StageState;
  /** Elapsed ms: final for done/failed, so far for running, null for pending/skipped. */
  ms: number | null;
  startedAt: Date | null;
  finishedAt: Date | null;
}

export interface LectureMedia {
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
}

/** Which ASR provider/job produced the transcript. Server-only. */
export interface LectureProvider {
  asr: string | null;
  asrModel: string | null;
  externalId: string | null;
}

export interface ILecture {
  title: string;
  courseCode: string | null;
  description: string | null;
  /** Calendar date `YYYY-MM-DD`. */
  recordedOn: string | null;
  /** Server-only. */
  notes: string | null;
  uploadedBy: ObjectId;
  consent: LectureConsent;
  status: LectureStatus;
  statusDetail: string;
  /** null unless status is "failed". */
  error: LectureError | null;
  /** Server-only; exposed only via GET /lectures/:id/status. */
  stages: ProcessingStage[];
  /** float seconds, 3dp — see CONTRACTS.md */
  durationSec: number | null;
  /** Server-only; relative to STORAGE_DIR. */
  mediaPath: string;
  /** Server-only; relative to STORAGE_DIR. */
  audioPath: string | null;
  media: LectureMedia;
  /** Server-only. */
  provider: LectureProvider;
  transcriptApproved: boolean;
  transcriptApprovedBy: ObjectId | null;
  transcriptApprovedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Server-only fields (§4.2, marked S) — never serialised to clients. */
export const LECTURE_SERVER_ONLY = ['notes', 'stages', 'mediaPath', 'audioPath', 'provider'] as const;

const mustBeTrue = { validator: (v: boolean) => v === true, message: 'Must be true' };

const consentSchema = new Schema<LectureConsent>(
  {
    lecturerConsent: { type: Boolean, required: true, validate: mustBeTrue },
    purposeShown: { type: Boolean, required: true, validate: mustBeTrue },
    processorNamed: { type: Boolean, required: true, validate: mustBeTrue },
    grantedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    grantedAt: { type: Date, required: true },
  },
  { _id: false, id: false },
);

const errorSchema = new Schema<LectureError>(
  {
    stage: { type: String, enum: STAGE_NAMES, required: true },
    code: { type: String, enum: LECTURE_ERROR_CODES, required: true },
    message: { type: String, required: true },
    at: { type: Date, required: true },
  },
  { _id: false, id: false },
);

const stageSchema = new Schema<ProcessingStage>(
  {
    name: { type: String, enum: STAGE_NAMES, required: true },
    state: { type: String, enum: STAGE_STATES, required: true, default: 'pending' },
    ms: { type: Number, min: 0, default: null },
    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
  },
  { _id: false, id: false },
);

const mediaSchema = new Schema<LectureMedia>(
  {
    originalFilename: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true, min: 0 },
  },
  { _id: false, id: false },
);

const providerSchema = new Schema<LectureProvider>(
  {
    asr: { type: String, default: null },
    asrModel: { type: String, default: null },
    externalId: { type: String, default: null },
  },
  { _id: false, id: false },
);

/** One pending entry per stage, in pipeline order. */
export const initialStages = (): ProcessingStage[] =>
  STAGE_NAMES.map((name) => ({ name, state: 'pending', ms: null, startedAt: null, finishedAt: null }));

const lectureSchema = new Schema<ILecture>(
  {
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 200 },
    courseCode: { type: String, trim: true, default: null },
    description: { type: String, maxlength: 2000, default: null },
    recordedOn: { type: String, match: [/^\d{4}-\d{2}-\d{2}$/, 'Must be a date as YYYY-MM-DD'], default: null },
    notes: { type: String, default: null },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    consent: { type: consentSchema, required: true },
    status: { type: String, enum: LECTURE_STATUSES, required: true, default: 'uploaded' },
    statusDetail: { type: String, required: true },
    error: { type: errorSchema, default: null },
    stages: {
      type: [stageSchema],
      default: initialStages,
      validate: {
        validator: (stages: ProcessingStage[]) =>
          stages.length === STAGE_NAMES.length && stages.every((s, i) => s.name === STAGE_NAMES[i]),
        message: 'Must have one entry per stage, in pipeline order',
      },
    },
    /** float seconds, 3dp — see CONTRACTS.md */
    durationSec: { type: Number, min: 0, default: null },
    mediaPath: { type: String, required: true },
    audioPath: { type: String, default: null },
    media: { type: mediaSchema, required: true },
    provider: { type: providerSchema, default: () => ({}) },
    transcriptApproved: { type: Boolean, required: true, default: false },
    transcriptApprovedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    transcriptApprovedAt: { type: Date, default: null },
  },
  { timestamps: true, toJSON: clientJson(LECTURE_SERVER_ONLY) },
);

// `error` is set exactly when the lecture has failed (§4.2).
lectureSchema.pre('validate', function checkError() {
  if (this.status === 'failed' && this.error == null) {
    this.invalidate('error', 'Required when status is "failed"');
  } else if (this.status !== 'failed' && this.error != null) {
    this.invalidate('error', 'Must be null unless status is "failed"');
  }
});

// From CONTRACTS.md §4.2 …
lectureSchema.index({ uploadedBy: 1, createdAt: -1 });
lectureSchema.index({ status: 1, createdAt: -1 });
// … and the minimum set requested for the backend models.
lectureSchema.index({ uploadedBy: 1, status: 1 });
lectureSchema.index({ createdAt: -1 });

export const Lecture = model<ILecture, Model<ILecture>>('Lecture', lectureSchema);
