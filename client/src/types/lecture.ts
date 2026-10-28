import type { Id, IsoDateTime, PageParams } from './common';
import type { LectureStatus, StageName, StageState } from './enums';

/** Embedded consent record — docs/CONTRACTS.md §4.2. */
export interface Consent {
  lecturerConsent: boolean;
  purposeShown: boolean;
  processorNamed: boolean;
  grantedBy: Id;
  grantedAt: IsoDateTime;
}

/** Known `lecture.error.code` values (§4.2). */
export type LectureErrorCode =
  | 'NO_AUDIO_STREAM'
  | 'UNSUPPORTED_CODEC'
  | 'TRANSCRIPTION_FAILED'
  | 'PROVIDER_UNAVAILABLE'
  | 'PIPELINE_INTERRUPTED'
  | 'INTERNAL_ERROR'
  | 'NOT_IMPLEMENTED';

/** Set only when status is "failed". */
export interface LectureError {
  stage: StageName;
  code: LectureErrorCode;
  message: string;
  at: IsoDateTime;
}

export interface MediaInfo {
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
}

/** Lecture summary object — §6.1. `mediaPath` / `audioPath` / `stages` are server-only. */
export interface Lecture {
  id: Id;
  title: string;
  courseCode: string | null;
  description: string | null;
  /** Calendar date the lecture was given, "YYYY-MM-DD" (a date, not a time); null if not supplied. */
  recordedOn: string | null;
  status: LectureStatus;
  statusDetail: string;
  error: LectureError | null;
  /** Float seconds; null until extraction has probed the file. */
  durationSec: number | null;
  transcriptApproved: boolean;
  /** Who approved the transcript, and when; null until approved (CONTRACTS §4.2). */
  transcriptApprovedBy: Id | null;
  transcriptApprovedAt: IsoDateTime | null;
  /** Computed: topic sections visible to the caller (students: approved only); null before segmenting. */
  topicCount: number | null;
  uploadedBy: Id;
  /** Computed: the uploader's display name. */
  uploadedByName: string;
  consent: Consent;
  media: MediaInfo;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

/**
 * GET /lectures/:id, flattened by the service: the contract returns `{ lecture, mediaUrl }`.
 * `mediaUrl` is a signed, 6-hour URL usable directly as <video src> (§5.3).
 */
export interface LectureDetail extends Lecture {
  mediaUrl: string;
}

/** Client-side options for POST /lectures. */
export interface CreateLectureOptions {
  /** Upload progress as a fraction 0–1 (from the browser's upload events). */
  onUploadProgress?: (fraction: number) => void;
}

export interface ListLecturesParams extends PageParams {
  status?: LectureStatus;
  /** Title search. */
  q?: string;
}

/** One pipeline stage. `ms` is processing time in integer ms (not a media offset); null when pending/skipped. */
export interface ProcessingStage {
  name: StageName;
  state: StageState;
  ms: number | null;
}

/** GET /lectures/:id/status — §6.2. */
export interface ProcessingStatus {
  lectureId: Id;
  status: LectureStatus;
  statusDetail: string;
  error: LectureError | null;
  durationSec: number | null;
  /** Share of the six stages done, 0–100 (100 only when ready). */
  progressPct: number;
  stages: ProcessingStage[];
  updatedAt: IsoDateTime;
}
