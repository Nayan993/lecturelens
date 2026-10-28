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
  | 'INTERNAL_ERROR';

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
  status: LectureStatus;
  statusDetail: string;
  error: LectureError | null;
  /** Float seconds; null until extraction has probed the file. */
  durationSec: number | null;
  transcriptApproved: boolean;
  uploadedBy: Id;
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
  stages: ProcessingStage[];
  updatedAt: IsoDateTime;
}
