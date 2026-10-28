import { Schema, model, type Model } from 'mongoose';
import { clientJson, type ObjectId } from './shared.js';

/** `quizzes` — docs/CONTRACTS.md §4.8. */
export interface IQuiz {
  lectureId: ObjectId;
  /** Student or teacher. */
  createdBy: ObjectId;
  title: string;
  /** Drawn only from approved questions at creation (enforced by the service). */
  questionIds: ObjectId[];
  /** Topics requested; [] = all. */
  topicIds: ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const quizSchema = new Schema<IQuiz>(
  {
    lectureId: { type: Schema.Types.ObjectId, ref: 'Lecture', required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    questionIds: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Question' }],
      validate: { validator: (ids: ObjectId[]) => ids.length > 0, message: 'Must have at least one question' },
    },
    topicIds: { type: [{ type: Schema.Types.ObjectId, ref: 'TopicSection' }], default: [] },
  },
  { timestamps: true, toJSON: clientJson() },
);

quizSchema.index({ createdBy: 1, createdAt: -1 });
quizSchema.index({ lectureId: 1 });

export const Quiz = model<IQuiz, Model<IQuiz>>('Quiz', quizSchema);
