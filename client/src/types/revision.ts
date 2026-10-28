import type { Id, IsoDateTime } from './common';

/** One ranked recommendation — docs/CONTRACTS.md §4.10, §6.12. */
export interface RevisionItem {
  rank: number;
  lectureId: Id;
  topicId: Id;
  topicLabel: string;
  startSec: number;
  endSec: number;
  deepLink: string;
  correct: number;
  attempted: number;
  /** correct / attempted, 3 decimals. */
  accuracy: number;
  /** A sentence built from the student's actual numbers. */
  reason: string;
}

export interface RevisionPlan {
  id: Id;
  studentId: Id;
  /** null = plan across all lectures. */
  lectureId: Id | null;
  generatedAt: IsoDateTime;
  basedOnAttemptIds: Id[];
  lectureAccuracy: number;
  items: RevisionItem[];
}
