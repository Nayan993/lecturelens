import type { Retriever } from '../../models/index.js';
import { deepLinkFor } from '../../utils/deepLink.js';
import { hybridSearch } from './hybrid.js';
import { keywordSearch } from './keyword.js';
import { dot, embedQuery, lectureVectors, vectorSearch } from './vector.js';

/**
 * THE retrieval entrypoint (PC.1). keyword, vector and hybrid all go through `retrieve()`, so search,
 * grounded Q&A and the evaluation compare them on exactly the same path.
 */

/** A lecture the caller may retrieve from (scope is decided by the caller — see modules/search/scope.ts). */
export interface ScopedLecture {
  id: string;
  title: string;
}

/** CONTRACTS.md §6.7. */
export interface RetrievedPassage {
  chunkId: string;
  lectureId: string;
  lectureTitle: string;
  startSec: number;
  endSec: number;
  text: string;
  /** Higher is better, on the retriever's own scale (§5.6): cosine, BM25, or RRF. */
  score: number;
  retriever: Retriever;
  /** 1-based. */
  rank: number;
  deepLink: string;
}

/** A passage plus its cosine similarity to the query — the retriever-independent relevance signal
 *  the RAG gate uses (null when the chunk has no embedding yet). Server-internal, never serialised. */
export interface RankedPassage extends RetrievedPassage {
  similarity: number | null;
}

export interface RetrieveOptions {
  query: string;
  lectures: readonly ScopedLecture[];
  k: number;
  retriever: Retriever;
}

export async function retrieve(options: RetrieveOptions): Promise<RetrievedPassage[]> {
  return (await rank(options, false)).map(({ similarity: _similarity, ...passage }) => passage);
}

/** `retrieve()` plus each passage's cosine similarity to the query. */
export async function retrieveWithSimilarity(options: RetrieveOptions): Promise<RankedPassage[]> {
  return rank(options, true);
}

async function rank({ query, lectures, k, retriever }: RetrieveOptions, withSimilarity: boolean): Promise<RankedPassage[]> {
  if (lectures.length === 0 || k <= 0) return [];
  const titles = new Map(lectures.map((l) => [l.id, l.title]));
  const scope = { query, allowedLectureIds: [...titles.keys()], k };

  const needsVector = retriever !== 'keyword' || withSimilarity;
  const queryVector = needsVector ? await embedQuery(query) : undefined;

  const results =
    retriever === 'keyword'
      ? await keywordSearch(scope)
      : retriever === 'vector'
        ? await vectorSearch(scope, queryVector)
        : await hybridSearch(scope, queryVector);

  // Cosine of each returned chunk, from the cached lecture vectors (no extra embedding calls).
  const vectorOf = new Map<string, number[]>();
  if (withSimilarity) {
    for (const lectureId of new Set(results.map((r) => r.lectureId))) {
      for (const v of await lectureVectors(lectureId)) vectorOf.set(v.chunkId, v.vector);
    }
  }

  return results.flatMap((result, i) => {
    const lectureTitle = titles.get(result.lectureId);
    if (lectureTitle === undefined) return []; // never return a passage outside the caller's scope
    const vector = vectorOf.get(result.chunkId);
    return [
      {
        chunkId: result.chunkId,
        lectureId: result.lectureId,
        lectureTitle,
        startSec: result.startSec,
        endSec: result.endSec,
        text: result.text,
        score: result.score,
        retriever,
        rank: i + 1,
        deepLink: deepLinkFor(result.lectureId, result.startSec),
        similarity: vector && queryVector ? dot(vector, queryVector) : null,
      },
    ];
  });
}
