import type { Id, IsoDateTime } from './common';

/** One ASR utterance — docs/CONTRACTS.md §4.3, §6.3. */
export interface TranscriptSegment {
  id: Id;
  lectureId: Id;
  /** 0-based, contiguous, ordered by time. */
  index: number;
  startSec: number;
  endSec: number;
  /** Current text (corrected if edited). */
  text: string;
  /** 0–1 from ASR. */
  confidence: number;
  /** confidence < 0.75; not cleared by correction. */
  lowConfidence: boolean;
  speaker: string | null;
  corrected: boolean;
  /** ASR text, set once on the first edit; null until then. */
  originalText: string | null;
  correctedBy: Id | null;
  correctedAt: IsoDateTime | null;
  modelVersion: string;
}

/** GET /lectures/:id/transcript. */
export interface Transcript {
  lectureId: Id;
  transcriptApproved: boolean;
  items: TranscriptSegment[];
}
