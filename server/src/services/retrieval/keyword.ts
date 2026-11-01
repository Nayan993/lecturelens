import { Types } from 'mongoose';
import { Chunk } from '../../models/index.js';

export interface KeywordResult {
  chunkId: string;
  lectureId: string;
  startSec: number;
  endSec: number;
  text: string;
  /** BM25 score: > 0, unbounded, only comparable within one query. */
  score: number;
}

interface KeywordSearchOptions {
  query: string;
  allowedLectureIds: string[];
  k: number;
}

/** BM25 parameters (the usual Lucene defaults). */
export const BM25_K1 = 1.5;
export const BM25_B = 0.75;

/** Lower-cased Unicode letter/number runs, so Devanagari and code-mixed text tokenise too. */
export function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{M}\p{N}]+/gu) ?? [];
}

/**
 * Okapi BM25 of each document for the query, over the given document set (the lectures in scope):
 *   idf(t)  = ln(1 + (N − df + 0.5) / (df + 0.5))
 *   score   = Σ_t idf(t) · tf · (k1 + 1) / (tf + k1 · (1 − b + b · |d| / avgdl))
 * Repeated query terms count once. Returns one score per document, in input order (0 = no match).
 */
export function bm25Scores(query: string, documents: readonly string[]): number[] {
  const queryTerms = [...new Set(tokenize(query))];
  const docs = documents.map(tokenize);
  if (queryTerms.length === 0 || docs.length === 0) return docs.map(() => 0);

  const df = new Map<string, number>();
  for (const terms of docs) for (const term of new Set(terms)) df.set(term, (df.get(term) ?? 0) + 1);
  const n = docs.length;
  const avgdl = docs.reduce((sum, terms) => sum + terms.length, 0) / n || 1;

  return docs.map((terms) => {
    const tf = new Map<string, number>();
    for (const term of terms) tf.set(term, (tf.get(term) ?? 0) + 1);
    let score = 0;
    for (const term of queryTerms) {
      const f = tf.get(term) ?? 0;
      if (f === 0) continue;
      const d = df.get(term)!;
      const idf = Math.log(1 + (n - d + 0.5) / (d + 0.5));
      score += (idf * f * (BM25_K1 + 1)) / (f + BM25_K1 * (1 - BM25_B + (BM25_B * terms.length) / avgdl));
    }
    return score;
  });
}

/** BM25 over the chunk text of the lectures in scope; the index is built per query scope. */
export async function keywordSearch({ query, allowedLectureIds, k }: KeywordSearchOptions): Promise<KeywordResult[]> {
  const lectureIds = allowedLectureIds.filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id));
  if (lectureIds.length === 0 || k <= 0 || tokenize(query).length === 0) return [];

  const chunks = await Chunk.find({ lectureId: { $in: lectureIds } }).select('lectureId startSec endSec text').lean().exec();
  const scores = bm25Scores(query, chunks.map((chunk) => chunk.text));

  return chunks
    .map((chunk, i) => ({
      chunkId: String(chunk._id),
      lectureId: String(chunk.lectureId),
      startSec: chunk.startSec,
      endSec: chunk.endSec,
      text: chunk.text,
      score: scores[i]!,
    }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.chunkId.localeCompare(b.chunkId))
    .slice(0, k);
}
