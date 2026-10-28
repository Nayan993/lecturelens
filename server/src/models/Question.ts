import { Schema, model } from 'mongoose';
import {
  DIFFICULTIES,
  OPTION_IDS,
  QUESTION_TYPES,
  REJECTION_REASONS,
  type Difficulty,
  type OptionId,
  type QuestionType,
  type RejectionReason,
} from './enums.js';
import {
  applyReviewRules,
  clientJson,
  evidenceSchema,
  lengthBetween,
  reviewFields,
  type ApprovalQueryHelpers,
  type Evidence,
  type ObjectId,
  type ReviewFields,
  type ReviewableModel,
} from './shared.js';

export {
  DIFFICULTIES,
  OPTION_IDS,
  QUESTION_TYPES,
  REJECTION_REASONS,
  type Difficulty,
  type OptionId,
  type QuestionType,
  type RejectionReason,
};

export interface QuestionOption {
  id: OptionId;
  text: string;
}

/** `questions` — docs/CONTRACTS.md §4.7. */
export interface IQuestion extends ReviewFields {
  lectureId: ObjectId;
  topicId: ObjectId;
  type: QuestionType;
  difficulty: Difficulty;
  stem: string;
  /** Exactly four, ids a, b, c, d in order. */
  options: QuestionOption[];
  correctOptionId: OptionId;
  explanation: string;
  /** Must lie inside the topic section (validated by the service). */
  evidence: Evidence[];
  reviewNote: string | null;
  model: string;
  promptVersion: string;
  createdAt: Date;
  updatedAt: Date;
}

export type QuestionModel = ReviewableModel<IQuestion>;

const optionSchema = new Schema<QuestionOption>(
  {
    id: { type: String, enum: OPTION_IDS, required: true },
    text: { type: String, required: true, trim: true },
  },
  { _id: false, id: false },
);

const questionSchema = new Schema<IQuestion, QuestionModel, object, ApprovalQueryHelpers>(
  {
    lectureId: { type: Schema.Types.ObjectId, ref: 'Lecture', required: true },
    topicId: { type: Schema.Types.ObjectId, ref: 'TopicSection', required: true },
    type: { type: String, enum: QUESTION_TYPES, required: true, default: 'mcq' },
    difficulty: { type: String, enum: DIFFICULTIES, required: true },
    stem: { type: String, required: true, trim: true },
    options: {
      type: [optionSchema],
      validate: {
        validator: (options: QuestionOption[]) =>
          options.length === OPTION_IDS.length && options.every((o, i) => o.id === OPTION_IDS[i]),
        message: 'Must be exactly four options with ids a, b, c, d in order',
      },
    },
    correctOptionId: { type: String, enum: OPTION_IDS, required: true },
    explanation: { type: String, required: true },
    evidence: { type: [evidenceSchema], validate: lengthBetween(1, 3) },
    ...reviewFields,
    reviewNote: { type: String, default: null },
    model: { type: String, required: true },
    promptVersion: { type: String, required: true },
  },
  { timestamps: true, toJSON: clientJson() },
);

applyReviewRules(questionSchema);

// Its { lectureId, status } prefix also serves lecture + status queries.
questionSchema.index({ lectureId: 1, status: 1, topicId: 1 });

export const Question = model<IQuestion, QuestionModel>('Question', questionSchema);
