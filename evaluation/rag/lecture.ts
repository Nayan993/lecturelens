/**
 * Shared fixture for evaluation/rag: puts Lecture 7 (mocks/transcript.json) into a THROWAWAY
 * in-memory MongoDB — never Atlas — chunks it with Member B's chunker (default 60 s / 15 s
 * windows) and indexes it with the real shared embedder (Xenova/all-MiniLM-L6-v2, pretrained).
 * So the evaluation runs the same retrieval code the API runs, on the same kind of data.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');

export interface GoldItem {
  id: string;
  question: string;
  lectureId: string;
  relevantStartSec: number | null;
  relevantEndSec: number | null;
  answerable: boolean;
  referenceAnswer?: string;
}

export function loadLabels(): { annotator: string; items: GoldItem[] } {
  return JSON.parse(readFileSync(path.join(here, 'qa_labels.json'), 'utf8')) as { annotator: string; items: GoldItem[] };
}

/** A chunk counts as a hit if its time range OVERLAPS the gold span (open interval overlap). */
export const overlaps = (startSec: number, endSec: number, gold: GoldItem): boolean =>
  gold.relevantStartSec !== null && gold.relevantEndSec !== null && startSec < gold.relevantEndSec && endSec > gold.relevantStartSec;

export async function loadEvalLecture(lectureId: string) {
  const mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { dbName: 'rag-eval' });

  const { Chunk, Lecture, TranscriptSegment, User } = await import('../../server/src/models/index.js');
  const { buildChunks } = await import('../../server/src/services/chunking/chunker.js');
  const { embedLecture } = await import('../../server/src/services/embeddings/index.js');

  const transcript = JSON.parse(readFileSync(path.join(root, 'mocks/transcript.json'), 'utf8')) as {
    items: Array<{ index: number; startSec: number; endSec: number; text: string; confidence: number; lowConfidence: boolean }>;
  };
  const teacher = await User.create({ email: 'eval@example.edu', name: 'Evaluation', role: 'teacher', passwordHash: 'x' });
  const lecture = await Lecture.create({
    _id: lectureId,
    title: 'Lecture 7 — Gradient Descent and Backpropagation',
    uploadedBy: teacher._id,
    consent: { lecturerConsent: true, purposeShown: true, processorNamed: true, grantedBy: teacher._id, grantedAt: new Date() },
    status: 'ready',
    statusDetail: 'Ready.',
    durationSec: 1199.398,
    transcriptApproved: true,
    mediaPath: 'eval/lecture7.mp4',
    media: { originalFilename: 'lecture7.mp4', mimeType: 'video/mp4', sizeBytes: 1 },
  });
  await TranscriptSegment.insertMany(
    transcript.items.map((s) => ({ ...s, lectureId: lecture._id, corrected: false, modelVersion: 'fixture' })),
  );
  const chunks = buildChunks(transcript.items.map((s) => ({ ...s, lectureId })));
  await Chunk.insertMany(chunks.map((c) => ({ ...c, embeddingModel: 'Xenova/all-MiniLM-L6-v2' })));
  const t0 = Date.now();
  const embedded = await embedLecture(lectureId);

  return {
    lecture: { id: lectureId, title: lecture.title },
    chunkCount: chunks.length,
    embedded,
    indexMs: Date.now() - t0,
    async stop() {
      await mongoose.disconnect();
      await mongo.stop();
    },
  };
}
