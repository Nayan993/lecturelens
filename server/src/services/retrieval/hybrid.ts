import { keywordSearch, type KeywordResult } from './keyword.js';
import { vectorSearch, type VectorResult } from './vector.js';

/** The RRF constant (CONTRACTS.md §5.6: hybrid = Σ 1/(60 + rank)). */
export const RRF_K = 60;

/** Each list contributes this many candidates before fusion, so a chunk ranked just outside one
 *  list's top k can still win on agreement between the two. */
export const HYBRID_CANDIDATES = 20;

export type HybridResult = {
  chunkId: string;
  lectureId: string;
  startSec: number;
  endSec: number;
  text: string;
  /** Reciprocal-rank fusion score: at most 2/61 ≈ 0.0328 (rank 1 in both lists). */
  score: number;
};

interface HybridSearchOptions {
  query: string;
  allowedLectureIds: string[];
  k: number;
}

/**
 * Reciprocal Rank Fusion (CONTRACTS.md §5.6): score = Σ over the lists containing the chunk of
 * 1 / (60 + rank), rank 1-based. Ties break on chunkId so the order is deterministic.
 */
export function fuseHybridResults(vectorResults: VectorResult[], keywordResults: KeywordResult[], k: number): HybridResult[] {
  const fused = new Map<string, HybridResult>();
  for (const results of [vectorResults, keywordResults]) {
    results.forEach((result, index) => {
      const rrf = 1 / (RRF_K + index + 1);
      const existing = fused.get(result.chunkId);
      if (existing) existing.score += rrf;
      else {
        const { chunkId, lectureId, startSec, endSec, text } = result;
        fused.set(chunkId, { chunkId, lectureId, startSec, endSec, text, score: rrf });
      }
    });
  }
  return [...fused.values()]
    .sort((a, b) => b.score - a.score || a.chunkId.localeCompare(b.chunkId))
    .slice(0, Math.max(0, k));
}

export async function hybridSearch(
  { query, allowedLectureIds, k }: HybridSearchOptions,
  queryVector?: number[],
): Promise<HybridResult[]> {
  if (allowedLectureIds.length === 0 || k <= 0) return [];
  const depth = Math.max(k, HYBRID_CANDIDATES);
  const [vectorResults, keywordResults] = await Promise.all([
    vectorSearch({ query, allowedLectureIds, k: depth }, queryVector),
    keywordSearch({ query, allowedLectureIds, k: depth }),
  ]);
  return fuseHybridResults(vectorResults, keywordResults, k);
}
