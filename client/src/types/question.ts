import type { Evidence, Id, IsoDateTime, PageParams } from './common';
import type { Difficulty, RejectionReason, ReviewStatus } from './enums';

export type OptionId = 'a' | 'b' | 'c' | 'd';

export interface QuestionOption {
  id: OptionId;
  text: string;
}

/** Full MCQ as the owning teacher sees it — docs/CONTRACTS.md §4.7, §6.10. */
export interface Question {
  id: Id;
  lectureId: Id;
  topicId: Id;
  type: 'mcq';
  difficulty: Difficulty;
  stem: string;
  /** Exactly four, ids a–d in order. */
  options: QuestionOption[];
  correctOptionId: OptionId;
  explanation: string;
  evidence: Evidence[];
  status: ReviewStatus;
  /** Required iff status is "rejected". */
  rejectionReason: RejectionReason | null;
  reviewNote: string | null;
  reviewedBy: Id | null;
  reviewedAt: IsoDateTime | null;
  model: string;
  promptVersion: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

/** Quiz question as a student sees it before submitting — no answer key, evidence or status (§5.7). */
export interface StudentQuestion {
  id: Id;
  topicId: Id;
  difficulty: Difficulty;
  stem: string;
  options: QuestionOption[];
}

/** GET /questions query. `lectureId` is required. */
export interface ListQuestionsParams extends PageParams {
  lectureId: Id;
  status?: ReviewStatus;
  topicId?: Id;
}

/** POST /lectures/:id/questions/generate body. */
export interface GenerateQuestionsPayload {
  /** 1–20, default 5. */
  count?: number;
  topicIds?: Id[];
  difficulty?: Difficulty;
}

/**
 * PATCH /questions/:id body. status "rejected" requires rejectionReason; "approved" clears it.
 * Editing the content of an approved question resets it to pending_review.
 */
export interface UpdateQuestionPayload {
  stem?: string;
  options?: QuestionOption[];
  correctOptionId?: OptionId;
  explanation?: string;
  difficulty?: Difficulty;
  status?: ReviewStatus;
  rejectionReason?: RejectionReason | null;
  reviewNote?: string | null;
}
