import type { Id } from './common';

/** Retrieval unit, client serialisation (no `embedding`) — docs/CONTRACTS.md §4.4, §6.4. */
export interface Chunk {
  id: Id;
  lectureId: Id;
  index: number;
  startSec: number;
  endSec: number;
  text: string;
  /** Inclusive segment indexes. */
  segmentStart: number;
  segmentEnd: number;
  embeddingModel: string;
}
