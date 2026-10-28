import { Schema, model, type Model } from 'mongoose';
import { OPTION_IDS, type OptionId } from './enums.js';
import { clientJson, type ObjectId } from './shared.js';

/** `attempts` — docs/CONTRACTS.md §4.9. Immutable once written, so there is no updatedAt. */

export interface AttemptAnswer {
  questionId: ObjectId;
  topicId: ObjectId;
  /** null = skipped, counts as wrong. */
  selectedOptionId: OptionId | null;
  correct: boolean;
}

export interface AttemptScore {
  correct: number;
  total: number;
  /** correct / total, 0–1, 3 decimals. */
  accuracy: number;
}

export interface AttemptTopicScore extends AttemptScore {
  topicId: ObjectId;
  topicLabel: string;
}

export interface IAttempt {
  quizId: ObjectId;
  lectureId: ObjectId;
  studentId: ObjectId;
  answers: AttemptAnswer[];
  score: AttemptScore;
  /** Ordered by topic index. */
  perTopic: AttemptTopicScore[];
  startedAt: Date;
  submittedAt: Date;
  /** submittedAt − startedAt, in seconds. */
  timeTakenSec: number;
  createdAt: Date;
}

const scoreFields = {
  correct: { type: Number, required: true, min: 0 },
  total: { type: Number, required: true, min: 0 },
  accuracy: { type: Number, required: true, min: 0, max: 1 },
} as const;

const answerSchema = new Schema<AttemptAnswer>(
  {
    questionId: { type: Schema.Types.ObjectId, ref: 'Question', required: true },
    topicId: { type: Schema.Types.ObjectId, ref: 'TopicSection', required: true },
    selectedOptionId: { type: String, enum: [...OPTION_IDS, null], default: null },
    correct: { type: Boolean, required: true },
  },
  { _id: false, id: false },
);

const scoreSchema = new Schema<AttemptScore>(scoreFields, { _id: false, id: false });

const topicScoreSchema = new Schema<AttemptTopicScore>(
  {
    topicId: { type: Schema.Types.ObjectId, ref: 'TopicSection', required: true },
    topicLabel: { type: String, required: true },
    ...scoreFields,
  },
  { _id: false, id: false },
);

const attemptSchema = new Schema<IAttempt>(
  {
    quizId: { type: Schema.Types.ObjectId, ref: 'Quiz', required: true },
    lectureId: { type: Schema.Types.ObjectId, ref: 'Lecture', required: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    answers: {
      type: [answerSchema],
      validate: { validator: (a: AttemptAnswer[]) => a.length > 0, message: 'Must have at least one answer' },
    },
    score: { type: scoreSchema, required: true },
    perTopic: { type: [topicScoreSchema], default: [] },
    startedAt: { type: Date, required: true },
    submittedAt: { type: Date, required: true },
    timeTakenSec: { type: Number, required: true, min: 0 },
  },
  // CONTRACTS.md §4.9: attempts are immutable — createdAt only.
  { timestamps: { createdAt: true, updatedAt: false }, toJSON: clientJson() },
);

attemptSchema.pre('validate', function checkScore() {
  if (this.score && this.score.correct > this.score.total) {
    this.invalidate('score.correct', 'Must not exceed score.total');
  }
});

attemptSchema.index({ studentId: 1, submittedAt: -1 });
attemptSchema.index({ quizId: 1, studentId: 1 });
attemptSchema.index({ studentId: 1, quizId: 1 });

export const Attempt = model<IAttempt, Model<IAttempt>>('Attempt', attemptSchema);
