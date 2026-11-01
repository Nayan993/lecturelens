import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { RETRIEVERS } from '../../models/index.js';
import { retrieve } from '../../services/retrieval/index.js';
import { unauthenticated } from '../../utils/errors.js';
import { objectIdString } from '../../utils/schemas.js';
import { retrievalScope } from './scope.js';

/** Semantic search — owner C, PC.1 — CONTRACTS.md §5.6. */
export const searchRouter = Router();

export const retriever = z.enum(RETRIEVERS, {
  errorMap: () => ({
    message: `Must be one of ${RETRIEVERS.join(', ')}`,
  }),
});

const searchBody = z
  .object({
    query: z
      .string({ required_error: 'Required' })
      .trim()
      .min(1, 'Must be 1–500 characters')
      .max(500, 'Must be 1–500 characters'),
    lectureId: objectIdString.optional(),
    retriever: retriever.default('hybrid'),
    topK: z
      .number({ invalid_type_error: 'Must be an integer 1–20' })
      .int('Must be an integer 1–20')
      .min(1, 'Must be an integer 1–20')
      .max(20, 'Must be an integer 1–20')
      .default(5),
  })
  .strict();

searchRouter.post(
  '/search',
  requireAuth,
  validate({ body: searchBody }),
  asyncHandler(async (req, res) => {
    const startedAt = Date.now();
    if (!req.user) throw unauthenticated();
    const { query, lectureId, retriever: selected, topK } = req.body as z.infer<typeof searchBody>;

    // Visibility is decided in the database query, before any passage is scored.
    const lectures = await retrievalScope(req.user, lectureId);
    const items = await retrieve({ query, lectures, k: topK, retriever: selected });

    res.json({ query, retriever: selected, items, tookMs: Date.now() - startedAt });
  }),
);
