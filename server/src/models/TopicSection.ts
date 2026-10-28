import { Schema, model } from 'mongoose';
import { TOPIC_METHODS, type TopicMethod } from './enums.js';
import {
  applyReviewRules,
  clientJson,
  lengthBetween,
  reviewFields,
  spanFields,
  type ApprovalQueryHelpers,
  type ObjectId,
  type ReviewFields,
  type ReviewableModel,
} from './shared.js';

export { TOPIC_METHODS, type TopicMethod };

/**
 * `topicsections` — docs/CONTRACTS.md §4.5. Sections of a lecture tile [0, durationSec)
 * exactly; that invariant spans documents and is enforced in the service on every write.
 */
export interface ITopicSection extends ReviewFields {
  lectureId: ObjectId;
  index: number;
  /** float seconds, 3dp — see CONTRACTS.md */
  startSec: number;
  /** float seconds, 3dp — see CONTRACTS.md */
  endSec: number;
  segmentStart: number;
  segmentEnd: number;
  label: string;
  keywords: string[];
  method: TopicMethod;
  /** 0–1; null for index 0 and for fixed_window. */
  boundaryScore: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export type TopicSectionModel = ReviewableModel<ITopicSection>;

const topicSectionSchema = new Schema<ITopicSection, TopicSectionModel, object, ApprovalQueryHelpers>(
  {
    lectureId: { type: Schema.Types.ObjectId, ref: 'Lecture', required: true },
    index: { type: Number, required: true, min: 0, validate: Number.isInteger },
    ...spanFields,
    segmentStart: { type: Number, required: true, min: 0 },
    segmentEnd: { type: Number, required: true, min: 0 },
    label: { type: String, required: true, trim: true, maxlength: 80 },
    keywords: { type: [String], validate: lengthBetween(3, 8) },
    method: { type: String, enum: TOPIC_METHODS, required: true },
    boundaryScore: { type: Number, min: 0, max: 1, default: null },
    ...reviewFields,
  },
  { timestamps: true, toJSON: clientJson() },
);

applyReviewRules(topicSectionSchema);

topicSectionSchema.index({ lectureId: 1, index: 1 }, { unique: true });
topicSectionSchema.index({ lectureId: 1, status: 1 });

export const TopicSection = model<ITopicSection, TopicSectionModel>('TopicSection', topicSectionSchema);
