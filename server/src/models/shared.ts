import {
  Schema,
  Types,
  type HydratedDocument,
  type Model,
  type QueryWithHelpers,
  type ToObjectOptions,
} from 'mongoose';
import { REJECTION_REASONS, REVIEW_STATUSES, type RejectionReason, type ReviewStatus } from './enums.js';

/**
 * Helpers shared by every model in this folder. Owned by Member D.
 */

export type ObjectId = Types.ObjectId;

/**
 * toJSON options for every schema: `_id` → string `id` (first key), no `_id` / `__v`, every
 * ObjectId (nested ones too) as a string, and `hidden` server-only fields removed.
 * Note: `.lean()` results skip this — serialise hydrated documents in responses.
 */
export function clientJson(hidden: readonly string[] = []): ToObjectOptions {
  return {
    versionKey: false,
    virtuals: false,
    flattenObjectIds: true,
    transform(_doc, ret: Record<string, unknown>) {
      if (ret._id === undefined) return ret; // embedded object without its own id
      const { _id, ...rest } = ret;
      for (const field of hidden) delete rest[field];
      return { id: String(_id), ...rest };
    },
  };
}

/** Rejects a document whose `endSec` is not after its `startSec`. */
export function endAfterStart(this: { startSec?: number }, endSec: number): boolean {
  return typeof this.startSec !== 'number' || endSec > this.startSec;
}

/** Media offset fields — float seconds, 3dp — see CONTRACTS.md. */
export const spanFields = {
  /** float seconds, 3dp — see CONTRACTS.md */
  startSec: { type: Number, required: true, min: 0 },
  /** float seconds, 3dp — see CONTRACTS.md */
  endSec: {
    type: Number,
    required: true,
    validate: { validator: endAfterStart, message: 'Must be greater than startSec' },
  },
} as const;

export const lengthBetween = (min: number, max: number) => ({
  validator: (value: unknown[]) => value.length >= min && value.length <= max,
  message: min === max ? `Must have exactly ${min} items` : `Must have ${min}–${max} items`,
});

/** Evidence (§4.6), used by summaries and questions; citations extend it. */
export interface Evidence {
  chunkId: ObjectId;
  /** float seconds, 3dp — see CONTRACTS.md */
  startSec: number;
  /** float seconds, 3dp — see CONTRACTS.md */
  endSec: number;
  quote: string;
}

export const evidenceSchema = new Schema<Evidence>(
  {
    chunkId: { type: Schema.Types.ObjectId, ref: 'Chunk', required: true },
    ...spanFields,
    quote: { type: String, required: true, maxlength: 300 },
  },
  { _id: false, id: false },
);

/* ---------------------------------------------------------------------------
 * Review workflow (topics, summaries, questions) and approval filtering (§4.12)
 * ------------------------------------------------------------------------- */

export interface ReviewFields {
  status: ReviewStatus;
  rejectionReason: RejectionReason | null;
  reviewedBy: ObjectId | null;
  reviewedAt: Date | null;
}

export const reviewFields = {
  status: { type: String, enum: REVIEW_STATUSES, required: true, default: 'pending_review' },
  rejectionReason: { type: String, enum: [...REJECTION_REASONS, null], default: null },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
} as const;

/** Filter for `populate({ match })` and aggregation stages. */
export const APPROVED = Object.freeze({ status: 'approved' as const });

export interface ApprovalQueryHelpers {
  /** Restricts this query to `status: "approved"` — required for every student-facing read. */
  approvedOnly(): this;
}

export type ApprovalQuery<T> = QueryWithHelpers<
  HydratedDocument<T>[],
  HydratedDocument<T>,
  ApprovalQueryHelpers
>;

export interface ApprovalStatics<T> {
  /** `find({ lectureId, status: "approved" })` — so student-facing code cannot forget the filter. */
  approvedFor(lectureId: ObjectId | string): ApprovalQuery<T>;
}

export type ReviewableModel<T> = Model<T, ApprovalQueryHelpers> & ApprovalStatics<T>;

/**
 * Adds `approvedOnly()` / `approvedFor()` and the rule that `rejectionReason` is set
 * iff `status === "rejected"` (§4.5–4.7).
 */
export function applyReviewRules<T extends ReviewFields & { lectureId: ObjectId }>(
  schema: Schema<T, ReviewableModel<T>, object, ApprovalQueryHelpers>,
): void {
  schema.query.approvedOnly = function approvedOnly(this: ApprovalQuery<T>) {
    return this.where(APPROVED);
  } as ApprovalQueryHelpers['approvedOnly'];

  schema.static('approvedFor', function approvedFor(this: ReviewableModel<T>, lectureId: ObjectId | string) {
    return this.find({ lectureId, ...APPROVED });
  });

  schema.pre('validate', function checkRejectionReason(this: HydratedDocument<ReviewFields>) {
    if (this.status === 'rejected' && this.rejectionReason == null) {
      this.invalidate('rejectionReason', 'Required when status is "rejected"');
    } else if (this.status !== 'rejected' && this.rejectionReason != null) {
      this.invalidate('rejectionReason', 'Must be null unless status is "rejected"');
    }
  });
}
