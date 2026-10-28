import { Schema, model, type Model } from 'mongoose';
import { clientJson, spanFields, type ObjectId } from './shared.js';

/** `revisionrecommendations` — one document per generated plan. docs/CONTRACTS.md §4.10. */

export interface RevisionItem {
  rank: number;
  lectureId: ObjectId;
  /** Only approved topics may be referenced (enforced by the service). */
  topicId: ObjectId;
  topicLabel: string;
  /** float seconds, 3dp — see CONTRACTS.md */
  startSec: number;
  /** float seconds, 3dp — see CONTRACTS.md */
  endSec: number;
  deepLink: string;
  correct: number;
  attempted: number;
  accuracy: number;
  reason: string;
}

export interface IRevisionRecommendation {
  studentId: ObjectId;
  /** null = plan across all lectures. */
  lectureId: ObjectId | null;
  generatedAt: Date;
  basedOnAttemptIds: ObjectId[];
  lectureAccuracy: number;
  /** Ranked. */
  items: RevisionItem[];
  createdAt: Date;
  updatedAt: Date;
}

const itemSchema = new Schema<RevisionItem>(
  {
    rank: { type: Number, required: true, min: 1 },
    lectureId: { type: Schema.Types.ObjectId, ref: 'Lecture', required: true },
    topicId: { type: Schema.Types.ObjectId, ref: 'TopicSection', required: true },
    topicLabel: { type: String, required: true },
    ...spanFields,
    deepLink: { type: String, required: true },
    correct: { type: Number, required: true, min: 0 },
    attempted: { type: Number, required: true, min: 0 },
    accuracy: { type: Number, required: true, min: 0, max: 1 },
    // MUST be a sentence built from this student's actual numbers (counts, percentages,
    // dates), e.g. "you got 1 of 3 answers on … right (33%)". Template labels such as
    // "weak_topic" are forbidden by CONTRACTS.md §4.10.
    reason: { type: String, required: true, trim: true },
  },
  { _id: false, id: false },
);

const revisionSchema = new Schema<IRevisionRecommendation>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    lectureId: { type: Schema.Types.ObjectId, ref: 'Lecture', default: null },
    generatedAt: { type: Date, required: true },
    basedOnAttemptIds: { type: [{ type: Schema.Types.ObjectId, ref: 'Attempt' }], default: [] },
    lectureAccuracy: { type: Number, required: true, min: 0, max: 1 },
    items: { type: [itemSchema], default: [] },
  },
  { timestamps: true, toJSON: clientJson() },
);

revisionSchema.index({ studentId: 1, lectureId: 1, generatedAt: -1 });

export const RevisionRecommendation = model<IRevisionRecommendation, Model<IRevisionRecommendation>>(
  'RevisionRecommendation',
  revisionSchema,
);
