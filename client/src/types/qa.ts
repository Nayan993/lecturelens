import type { Evidence, Id } from './common';
import type { AbstainReason, Retriever } from './enums';

/** POST /ask body — docs/CONTRACTS.md §5.6. question 3–500 chars. */
export interface AskRequest {
  question: string;
  lectureId?: Id;
  retriever?: Retriever;
}

/** A citation: Evidence plus the [n] marker used in the answer text and a server-built deep link. */
export interface Citation extends Evidence {
  marker: number;
  lectureId: Id;
  deepLink: string;
}

interface GroundedAnswerBase {
  question: string;
  lectureId: Id | null;
  retriever: Retriever;
  model: string;
  promptVersion: string;
  cached: boolean;
  /** Server processing time, integer ms. */
  latencyMs: number;
}

/** §6.8 — at least one citation; `answer` uses [n] markers. */
export interface AnsweredAnswer extends GroundedAnswerBase {
  answerable: true;
  abstained: false;
  abstainReason: null;
  answer: string;
  citations: Citation[];
  confidence: number;
}

/** §6.9 — abstaining is a normal HTTP 200, not an error. */
export interface AbstainedAnswer extends GroundedAnswerBase {
  answerable: false;
  abstained: true;
  abstainReason: AbstainReason;
  answer: null;
  citations: [];
  confidence: null;
}

/** POST /ask response. Narrow with `if (a.abstained)`. */
export type GroundedAnswer = AnsweredAnswer | AbstainedAnswer;
