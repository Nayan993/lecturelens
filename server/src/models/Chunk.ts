import { Schema, model, type Model } from 'mongoose';
import { clientJson, spanFields, type ObjectId } from './shared.js';

/** Dimension of EMBEDDING_MODEL output (Xenova/all-MiniLM-L6-v2). */
export const EMBEDDING_DIMENSIONS = 384;

/** `chunks` — retrieval unit of consecutive whole segments. docs/CONTRACTS.md §4.4. */
export interface IChunk {
  lectureId: ObjectId;
  index: number;
  /** float seconds, 3dp — see CONTRACTS.md */
  startSec: number;
  /** float seconds, 3dp — see CONTRACTS.md */
  endSec: number;
  /** Segment texts joined by a single space. */
  text: string;
  /** Inclusive segment indexes. */
  segmentStart: number;
  segmentEnd: number;
  /**
   * Server-only, `select: false`. L2-normalised on write (the indexing service's job).
   * Empty until the `indexing` stage fills it, otherwise exactly 384 floats.
   */
  embedding: number[];
  embeddingModel: string;
  createdAt: Date;
  updatedAt: Date;
}

const chunkSchema = new Schema<IChunk>(
  {
    lectureId: { type: Schema.Types.ObjectId, ref: 'Lecture', required: true },
    index: { type: Number, required: true, min: 0, validate: Number.isInteger },
    ...spanFields,
    text: { type: String, required: true },
    segmentStart: { type: Number, required: true, min: 0 },
    segmentEnd: { type: Number, required: true, min: 0 },
    embedding: {
      type: [Number],
      select: false,
      default: [],
      validate: {
        validator: (v: number[]) => v.length === 0 || v.length === EMBEDDING_DIMENSIONS,
        message: `Must be empty or have exactly ${EMBEDDING_DIMENSIONS} numbers`,
      },
    },
    embeddingModel: { type: String, required: true },
  },
  { timestamps: true, toJSON: clientJson(['embedding']) },
);

chunkSchema.pre('validate', function checkSegmentRange() {
  if (this.segmentEnd < this.segmentStart) {
    this.invalidate('segmentEnd', 'Must not be less than segmentStart');
  }
});

chunkSchema.index({ lectureId: 1, index: 1 }, { unique: true });
// Used by the `keyword` retriever.
chunkSchema.index({ text: 'text' }, { name: 'chunks_text', default_language: 'english' });
// The Atlas Vector Search index `chunks_embedding_vs` (384 dims, dotProduct, filter lectureId)
// is created on the Atlas cluster, not by Mongoose — see CONTRACTS.md §4.4.

export const Chunk = model<IChunk, Model<IChunk>>('Chunk', chunkSchema);
