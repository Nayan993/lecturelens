/**
 * Enum values from docs/CONTRACTS.md §2 — exact strings, no synonyms.
 * Change these only through a contract change (owner: Member D).
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

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];
