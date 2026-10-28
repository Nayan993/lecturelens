import { Schema, model, type Model, type Query } from 'mongoose';
import { clientJson, spanFields, type ObjectId } from './shared.js';

/** `transcriptsegments` — one ASR utterance. docs/CONTRACTS.md §4.3. */
export interface ITranscriptSegment {
  lectureId: ObjectId;
  /** 0-based, contiguous, ordered by time. */
  index: number;
  /** float seconds, 3dp — see CONTRACTS.md */
  startSec: number;
  /** float seconds, 3dp — see CONTRACTS.md */
  endSec: number;
  /** Current text (corrected if edited). */
  text: string;
  confidence: number;
  /** confidence < 0.75; set at ingest and NOT cleared by correction. */
  lowConfidence: boolean;
  speaker: string | null;
  corrected: boolean;
  /** The ASR text, set once on the first edit and never overwritten. */
  originalText: string | null;
  correctedBy: ObjectId | null;
  correctedAt: Date | null;
  modelVersion: string;
  createdAt: Date;
  updatedAt: Date;
}

const segmentSchema = new Schema<ITranscriptSegment>(
  {
    lectureId: { type: Schema.Types.ObjectId, ref: 'Lecture', required: true },
    index: { type: Number, required: true, min: 0, validate: Number.isInteger },
    ...spanFields,
    text: { type: String, required: true },
    confidence: { type: Number, required: true, min: 0, max: 1 },
    lowConfidence: { type: Boolean, required: true },
    speaker: { type: String, default: null },
    corrected: { type: Boolean, required: true, default: false },
    originalText: { type: String, default: null },
    correctedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    correctedAt: { type: Date, default: null },
    modelVersion: { type: String, required: true },
  },
  { timestamps: true, toJSON: clientJson() },
);

/*
 * AUDIT TRAIL (§4.3). The first time a stored segment's `text` is edited, the text as it
 * was before that edit — the ASR output — is copied into `originalText` and `corrected`
 * becomes true. `originalText` is written once and never overwritten, so the original
 * transcription can always be recovered and shown beside the correction.
 *
 * The rule needs the value loaded from the database, so it is enforced on `doc.save()`;
 * update queries that touch `text` or `originalText` are refused below.
 */

segmentSchema.post('init', function rememberLoadedText() {
  this.$locals.loadedText = this.text;
  this.$locals.loadedOriginalText = this.originalText;
});

segmentSchema.pre('validate', function protectOriginalText() {
  if (this.isNew) return;
  const loaded = this.$locals.loadedOriginalText as string | null | undefined;
  if (loaded != null && this.originalText !== loaded) {
    this.invalidate('originalText', 'Cannot be changed once set: it is the audit trail of the ASR text');
  }
});

segmentSchema.pre('save', function recordFirstCorrection() {
  if (this.isNew || !this.isModified('text')) return;
  if (!this.isSelected('text') || !this.isSelected('originalText')) {
    throw new Error('Load a segment with both text and originalText before editing its text.');
  }
  if (this.originalText == null) this.originalText = this.$locals.loadedText as string;
  this.corrected = true;
});

const AUDITED_PATHS = ['text', 'originalText'];

function touchesAuditedPath(update: unknown): boolean {
  if (update === null || typeof update !== 'object') return false;
  return Object.entries(update).some(([key, value]) =>
    key.startsWith('$') ? touchesAuditedPath(value) : AUDITED_PATHS.includes(key),
  );
}

segmentSchema.pre(
  ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'findOneAndReplace'],
  function refuseUnauditedTextUpdate(this: Query<unknown, ITranscriptSegment>) {
    if (touchesAuditedPath(this.getUpdate())) {
      throw new Error('Segment text must be changed with doc.save() so the audit trail is kept.');
    }
  },
);

segmentSchema.index({ lectureId: 1, index: 1 }, { unique: true });
segmentSchema.index({ lectureId: 1, lowConfidence: 1 });

export const TranscriptSegment = model<ITranscriptSegment, Model<ITranscriptSegment>>(
  'TranscriptSegment',
  segmentSchema,
);
