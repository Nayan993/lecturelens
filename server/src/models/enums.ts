/**
 * Enum values from docs/CONTRACTS.md §2 and §4 — exact strings, no synonyms.
 * Models use these in Mongoose `enum` validators; routes and services import the same
 * arrays and types. Changing one is a contract change (owner: Member D).
 * Mirrors client/src/types/enums.ts.
 */

export const LECTURE_STATUSES = [
  'uploaded',
  'extracting',
  'transcribing',
  'chunking',
  'segmenting',
  'summarising',
  'indexing',
  'ready',
  'failed',
] as const;
export type LectureStatus = (typeof LECTURE_STATUSES)[number];

export const ROLES = ['student', 'teacher'] as const;
export type Role = (typeof ROLES)[number];

/** Review status of topics, summaries and questions. */
export const REVIEW_STATUSES = ['pending_review', 'approved', 'rejected'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const REJECTION_REASONS = [
  'FACTUALLY_WRONG',
  'UNSUPPORTED',
  'AMBIGUOUS',
  'TOO_EASY',
  'TOO_HARD',
  'DUPLICATE',
  'OTHER',
] as const;
export type RejectionReason = (typeof REJECTION_REASONS)[number];

export const ABSTAIN_REASONS = ['NO_RELEVANT_PASSAGE', 'LOW_CONFIDENCE', 'PARSE_FAILED'] as const;
export type AbstainReason = (typeof ABSTAIN_REASONS)[number];

export const RETRIEVERS = ['keyword', 'vector', 'hybrid'] as const;
export type Retriever = (typeof RETRIEVERS)[number];

export const TOPIC_METHODS = ['embedding_similarity', 'fixed_window'] as const;
export type TopicMethod = (typeof TOPIC_METHODS)[number];

/** The six processing stages, in pipeline order. */
export const STAGE_NAMES = [
  'extracting',
  'transcribing',
  'chunking',
  'segmenting',
  'summarising',
  'indexing',
] as const;
export type StageName = (typeof STAGE_NAMES)[number];

export const STAGE_STATES = ['pending', 'running', 'done', 'failed', 'skipped'] as const;
export type StageState = (typeof STAGE_STATES)[number];

/** `lecture.error.code` (§4.2). */
export const LECTURE_ERROR_CODES = [
  'NO_AUDIO_STREAM',
  'UNSUPPORTED_CODEC',
  'TRANSCRIPTION_FAILED',
  'PROVIDER_UNAVAILABLE',
  'PIPELINE_INTERRUPTED',
  'INTERNAL_ERROR',
  'NOT_IMPLEMENTED',
] as const;
export type LectureErrorCode = (typeof LECTURE_ERROR_CODES)[number];

export const QUESTION_TYPES = ['mcq'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

/** MCQ option ids — exactly four, in this order. */
export const OPTION_IDS = ['a', 'b', 'c', 'd'] as const;
export type OptionId = (typeof OPTION_IDS)[number];

export const LLM_PURPOSES = ['topic_label', 'summary', 'mcq', 'answer'] as const;
export type LlmPurpose = (typeof LLM_PURPOSES)[number];
