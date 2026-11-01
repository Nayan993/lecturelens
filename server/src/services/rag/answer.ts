import { LlmError, type LlmClient, type LlmUsage } from '../llm/client.js';
import { retrieveWithSimilarity, type ScopedLecture } from '../retrieval/index.js';
import type { Retriever } from '../../models/index.js';
import { getCachedAnswer, setCachedAnswer } from './cache.js';
import { FULL_COVERAGE, lexicalCoverage } from './gate.js';
import { buildAnswerPrompt, RAG_PROMPT_VERSION } from './prompt.js';
import { ragMinScore, ragTopK } from './settings.js';
import { modelAnswerSchema, validateModelAnswer, type ValidationResult } from './validate.js';

/**
 * Grounded question answering (PC.2). Two independent abstention triggers:
 *  1. retrieval side — nothing retrieved, or neither relevance signal holds: the best passage's
 *     cosine similarity is below RAG_MIN_SCORE AND no passage contains all of the question's
 *     content words (gate.ts): abstain with NO_RELEVANT_PASSAGE BEFORE any LLM call;
 *  2. generation side — the model says it cannot answer, its output is unusable (PARSE_FAILED), or
 *     no citation survives validation (LOW_CONFIDENCE).
 * Abstaining is a normal result, never an error. An unreachable provider is an error
 * (ProviderUnavailableError → 503), not an abstention (CONTRACTS.md §5.6).
 */

export class ProviderUnavailableError extends Error {
  constructor(readonly provider: string, options?: { cause?: unknown; retryAfterSec?: number | null }) {
    super(`The language model provider is unavailable (${provider})`, options);
    this.name = 'ProviderUnavailableError';
    this.retryAfterSec = options?.retryAfterSec ?? null;
  }

  readonly retryAfterSec: number | null;
}

export interface AnswerQuestionOptions {
  question: string;
  lectures: readonly ScopedLecture[];
  retriever: Retriever;
  /** The shared client (services/llm/client.ts); null = not configured. */
  llm: LlmClient | null;
  model: string;
}

type NoPassage = { answerable: false; abstainReason: 'NO_RELEVANT_PASSAGE'; answer: null; citations: []; confidence: null };

export type AnswerQuestionResult = (ValidationResult | NoPassage) & {
  abstained: boolean;
  cached: boolean;
  /** Best retrieval score among the passages considered, on the retriever's scale (§5.6); null if none. */
  topScore: number | null;
  /** Best cosine similarity question ↔ passage (the gate's semantic signal); null if none could be computed. */
  topSimilarity: number | null;
  /** Best share of the question's content words found in one passage (the gate's lexical signal). */
  topCoverage: number;
  /** Passages retrieved for the prompt. */
  k: number;
  promptVersion: string;
};

export async function answerQuestion(options: AnswerQuestionOptions): Promise<AnswerQuestionResult> {
  const k = ragTopK();
  const passages = await retrieveWithSimilarity({ query: options.question, lectures: options.lectures, k, retriever: options.retriever });

  const topScore = passages.length ? Math.max(...passages.map((p) => p.score)) : null;
  const similarities = passages.map((p) => p.similarity).filter((s): s is number => s !== null);
  const topSimilarity = similarities.length ? Math.max(...similarities) : null;
  const topCoverage = lexicalCoverage(options.question, passages.map((p) => p.text));
  const meta = { topScore, topSimilarity, topCoverage, k, promptVersion: RAG_PROMPT_VERSION };

  // 1. Retrieval-side gate: nothing relevant enough → abstain without calling the model.
  const semantic = topSimilarity !== null && topSimilarity >= ragMinScore();
  const lexical = topCoverage >= FULL_COVERAGE;
  if (passages.length === 0 || (!semantic && !lexical)) {
    return {
      answerable: false, abstainReason: 'NO_RELEVANT_PASSAGE', answer: null, citations: [], confidence: null,
      abstained: true, cached: false, ...meta,
    };
  }

  const prompt = buildAnswerPrompt(options.question, passages);
  const cacheParams = {
    model: options.model,
    promptVersion: RAG_PROMPT_VERSION,
    input: { system: prompt.system, user: prompt.user },
  };

  const hit = await getCachedAnswer(cacheParams);
  if (hit) {
    const validation = validateModelAnswer(hit.response, prompt.passages);
    return { ...validation, abstained: !validation.answerable, cached: true, ...meta };
  }

  if (!options.llm) throw new ProviderUnavailableError('llm-not-configured');

  let data: unknown;
  let usage: LlmUsage = { promptTokens: 0, completionTokens: 0 };
  const text = `${prompt.system}\n\n${prompt.user}`;
  try {
    if (options.llm.generateJsonWithUsage) {
      ({ data, usage } = await options.llm.generateJsonWithUsage(text, modelAnswerSchema));
    } else {
      data = await options.llm.generateJson(text, modelAnswerSchema);
    }
  } catch (error) {
    // status null = the model answered, but not with usable JSON even after the client's retry.
    if (error instanceof LlmError && error.status === null) {
      const validation = validateModelAnswer(null, prompt.passages); // → PARSE_FAILED
      return { ...validation, abstained: true, cached: false, ...meta };
    }
    throw new ProviderUnavailableError('llm', { cause: error, retryAfterSec: error instanceof LlmError ? error.retryAfterSec : null });
  }

  // 2. Generation-side checks. Any usable model output is cached — an answer, or the model's own
  // "cannot answer" — so asking the same thing again costs no tokens (re-validated on every read).
  const validation = validateModelAnswer(data, prompt.passages);
  await setCachedAnswer(cacheParams, data, usage.promptTokens, usage.completionTokens);
  return { ...validation, abstained: !validation.answerable, cached: false, ...meta };
}
