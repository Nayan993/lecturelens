import type { Id } from './common';
import type { Retriever } from './enums';

/** POST /search body — docs/CONTRACTS.md §5.6. */
export interface SearchRequest {
  query: string;
  /** Omitted = every lecture visible to the caller. */
  lectureId?: Id;
  /** Default "hybrid". */
  retriever?: Retriever;
  /** 1–20, default 5. */
  topK?: number;
}

/** One ranked chunk — §6.7. `score` is higher-is-better and only comparable within one response. */
export interface RetrievedPassage {
  chunkId: Id;
  lectureId: Id;
  lectureTitle: string;
  startSec: number;
  endSec: number;
  text: string;
  score: number;
  retriever: Retriever;
  /** 1-based. */
  rank: number;
  /** Server-built "/lectures/<id>/play?t=<startSec>". */
  deepLink: string;
}

export interface SearchResponse {
  query: string;
  retriever: Retriever;
  items: RetrievedPassage[];
  /** Server processing time, integer ms. */
  tookMs: number;
}
