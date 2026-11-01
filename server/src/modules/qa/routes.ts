import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { getLlmClient, llmModelName } from '../../services/llm/client.js';
import { answerQuestion, ProviderUnavailableError } from '../../services/rag/answer.js';
import { logger } from '../../utils/logger.js';
import { providerUnavailable, unauthenticated } from '../../utils/errors.js';
import { objectIdString } from '../../utils/schemas.js';
import { retriever } from '../search/routes.js';
import { retrievalScope } from '../search/scope.js';

/** Grounded Q&A — owner C, PC.2 — CONTRACTS.md §5.6. Abstaining is a normal 200, not an error. */
export const qaRouter = Router();

const askBody = z
  .object({
    question: z.string({ required_error: 'Required' }).trim().min(3, 'Must be 3–500 characters').max(500, 'Must be 3–500 characters'),
    lectureId: objectIdString.optional(),
    retriever: retriever.default('hybrid'),
  })
  .strict();

qaRouter.post(
  '/ask',
  requireAuth,
  validate({ body: askBody }),
  asyncHandler(async (req, res) => {
    const startedAt = Date.now();
    if (!req.user) throw unauthenticated();
    const { question, lectureId, retriever: selected } = req.body as z.infer<typeof askBody>;

    // Same visibility as POST /search, applied in the database query (404 for a hidden lecture).
    const lectures = await retrievalScope(req.user, lectureId);
    const model = llmModelName();
    let result;
    try {
      result = await answerQuestion({ question, lectures, retriever: selected, llm: getLlmClient(), model });
    } catch (error) {
      if (error instanceof ProviderUnavailableError) {
        logger.error('Grounded Q&A: LLM provider unavailable', { error, retryAfterSec: error.retryAfterSec });
        if (error.retryAfterSec !== null) res.set('Retry-After', String(Math.ceil(error.retryAfterSec)));
        throw providerUnavailable(error.provider, error.retryAfterSec);
      }
      throw error;
    }

    const latencyMs = Date.now() - startedAt;
    // Provenance for every generated output (TRACE): what was retrieved, by which retriever, with
    // what scores, which model and prompt version, and how long it took.
    logger.info('Grounded Q&A', {
      lectureId: lectureId ?? null, retriever: selected, k: result.k, topScore: result.topScore,
      topSimilarity: result.topSimilarity, topCoverage: result.topCoverage, abstained: result.abstained, abstainReason: result.abstainReason,
      citations: result.citations.length, cached: result.cached, model, latencyMs,
    });

    // CONTRACTS.md §6.8 / §6.9 — abstaining is a normal 200.
    res.json({
      question,
      lectureId: lectureId ?? null,
      answerable: result.answerable,
      abstained: result.abstained,
      abstainReason: result.abstainReason,
      answer: result.answer,
      citations: result.citations,
      confidence: result.confidence,
      retriever: selected,
      topScore: result.topScore,
      model,
      promptVersion: result.promptVersion,
      cached: result.cached,
      latencyMs,
    });
  }),
);
