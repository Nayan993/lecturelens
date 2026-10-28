/** Shared primitives — docs/CONTRACTS.md §1. */

/** MongoDB ObjectId serialised as a 24-char lowercase hex string (§1.1). */
export type Id = string;

/** ISO-8601 UTC with milliseconds and Z, e.g. "2026-10-20T09:14:22.418Z" (§1.2). */
export type IsoDateTime = string;

/** Paginated list response (§1.4). */
export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

/** `?page=&limit=` query params (§1.4). Defaults 1 / 20; limit max 100. */
export interface PageParams {
  page?: number;
  limit?: number;
}

/** Unpaginated per-lecture collection: transcript, topics, summaries (§1.4). */
export interface LectureCollection<T> {
  lectureId: Id;
  items: T[];
}

/**
 * Evidence object shared by summaries and questions (§4.6). `quote` is verbatim from the
 * chunk; startSec/endSec is the span of the segment containing it.
 */
export interface Evidence {
  chunkId: Id;
  startSec: number;
  endSec: number;
  quote: string;
}
