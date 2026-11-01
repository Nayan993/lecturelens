import { Types } from 'mongoose';
import { Chunk, EMBEDDING_DIMENSIONS } from '../../models/index.js';
import { embed, embedLecture } from '../embeddings/embedder.js';
import { logger } from '../../utils/logger.js';
import { getCachedVectors, setCachedVectors, type CachedVector } from './vectorCache.js';

export interface VectorResult {
  chunkId: string;
  lectureId: string;
  startSec: number;
  endSec: number;
  text: string;
  /** Cosine similarity in [-1, 1] (a dot product: both vectors are L2-normalised). */
  score: number;
}

interface VectorSearchOptions {
  query: string;
  allowedLectureIds: string[];
  k: number;
}

/** Cosine similarity of two L2-normalised vectors is their dot product. */
export function dot(a: readonly number[], b: readonly number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += a[i]! * b[i]!;
  return sum;
}

/** One indexing run per lecture at a time, shared by concurrent requests. */
const indexing = new Map<string, Promise<number>>();

/**
 * Embeds the lecture's chunks that have no valid vector yet — lectures processed before the
 * `indexing` stage existed, seeded data, or a failed indexing run. The pipeline's indexing stage is
 * the normal path; this only catches up. A model failure is logged and searching continues with
 * whatever vectors exist (keyword search is unaffected; /ask's relevance gate then abstains).
 */
export async function ensureLectureIndexed(lectureId: string): Promise<boolean> {
  const missing = await Chunk.exists({ lectureId: new Types.ObjectId(lectureId), embedding: { $not: { $size: EMBEDDING_DIMENSIONS } } });
  if (!missing) return true;
  let run = indexing.get(lectureId);
  if (!run) {
    run = embedLecture(lectureId).finally(() => indexing.delete(lectureId));
    indexing.set(lectureId, run);
  }
  try {
    const embedded = await run;
    logger.info('Indexed a lecture on first search (its chunks had no embeddings)', { lectureId, embedded });
    return true;
  } catch (error) {
    logger.error('Could not index the lecture for vector search; continuing without its vectors', { lectureId, error });
    return false;
  }
}

/** A lecture's indexed chunk vectors, from the cache or loaded once from MongoDB (indexing it first if needed). */
export async function lectureVectors(lectureId: string): Promise<CachedVector[]> {
  const cached = getCachedVectors(lectureId);
  if (cached) return cached;
  const complete = await ensureLectureIndexed(lectureId);
  const chunks = await Chunk.find({ lectureId: new Types.ObjectId(lectureId), embedding: { $size: EMBEDDING_DIMENSIONS } })
    .select('+embedding lectureId startSec endSec text')
    .lean()
    .exec();
  const vectors = chunks.map((chunk) => ({
    chunkId: String(chunk._id),
    lectureId: String(chunk.lectureId),
    startSec: chunk.startSec,
    endSec: chunk.endSec,
    text: chunk.text,
    vector: chunk.embedding,
  }));
  if (complete) setCachedVectors(lectureId, vectors); // a failed run is retried on the next search
  return vectors;
}

/** Embeds the query once; callers that also need it (the RAG relevance gate) can pass it in. */
export async function embedQuery(query: string): Promise<number[]> {
  const [vector] = await embed([query]);
  if (!vector) throw new Error('The embedding model returned no vector for the query');
  return vector;
}

/**
 * Brute-force cosine search over the lectures in scope. At our scale (hundreds of chunks) this is
 * microseconds; no vector database (CLAUDE.md). At larger scale this swaps to Atlas Vector Search.
 */
export async function vectorSearch(
  { query, allowedLectureIds, k }: VectorSearchOptions,
  queryVector?: number[],
): Promise<VectorResult[]> {
  const lectureIds = allowedLectureIds.filter((id) => Types.ObjectId.isValid(id));
  if (lectureIds.length === 0 || k <= 0) return [];

  const q = queryVector ?? (await embedQuery(query));
  const results: VectorResult[] = [];
  for (const lectureId of lectureIds) {
    for (const { vector, ...chunk } of await lectureVectors(lectureId)) {
      results.push({ ...chunk, score: dot(vector, q) });
    }
  }
  return results.sort((a, b) => b.score - a.score || a.chunkId.localeCompare(b.chunkId)).slice(0, k);
}
