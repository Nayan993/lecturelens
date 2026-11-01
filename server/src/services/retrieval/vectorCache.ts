/**
 * In-memory cache of chunk vectors, one entry per lecture (the server is a single process; §2).
 * Kept in its own module, free of the embedding model, so the pipeline, the lecture service and
 * the test harness can invalidate it without loading @xenova/transformers.
 *
 * Invalidated whenever a lecture's chunks or embeddings change: after indexing (embedLecture),
 * when chunking replaces the chunks, on reprocess and on delete.
 */
export interface CachedVector {
  chunkId: string;
  lectureId: string;
  startSec: number;
  endSec: number;
  text: string;
  /** L2-normalised, EMBEDDING_DIMENSIONS long. */
  vector: number[];
}

const cache = new Map<string, CachedVector[]>();

export function getCachedVectors(lectureId: string): CachedVector[] | undefined {
  return cache.get(lectureId);
}

export function setCachedVectors(lectureId: string, vectors: CachedVector[]): void {
  cache.set(lectureId, vectors);
}

/** Drop one lecture's vectors, or every lecture's when called without an id. */
export function invalidateVectorCache(lectureId?: string): void {
  if (lectureId === undefined) cache.clear();
  else cache.delete(String(lectureId));
}
