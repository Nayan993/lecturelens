import type { Id, IsoDateTime } from './common';
import type { RejectionReason, ReviewStatus, TopicMethod } from './enums';

/**
 * Topic section — docs/CONTRACTS.md §4.5, §6.5. Sections of a lecture tile [0, durationSec)
 * exactly, half-open, no gaps or overlaps.
 */
export interface TopicSection {
  id: Id;
  lectureId: Id;
  index: number;
  startSec: number;
  endSec: number;
  segmentStart: number;
  segmentEnd: number;
  label: string;
  keywords: string[];
  method: TopicMethod;
  /** 0–1; null for index 0 and for fixed_window. */
  boundaryScore: number | null;
  status: ReviewStatus;
  /** Set iff status is "rejected"; null otherwise. */
  rejectionReason: RejectionReason | null;
  reviewedBy: Id | null;
  reviewedAt: IsoDateTime | null;
}

/** PATCH /topics/:id body. Boundaries are not editable in v1. */
export interface UpdateTopicPayload {
  label?: string;
  keywords?: string[];
}
