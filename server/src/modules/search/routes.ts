import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { RETRIEVERS } from '../../models/index.js';
import { notImplemented } from '../../utils/errors.js';
import { objectIdString } from '../../utils/schemas.js';

/** Semantic search — owner C, PC.1 — CONTRACTS.md §5.6. Students search visible lectures only. */
export const searchRouter = Router();

export const retriever = z.enum(RETRIEVERS, { errorMap: () => ({ message: `Must be one of ${RETRIEVERS.join(', ')}` }) });

const searchBody = z
  .object({
    query: z.string({ required_error: 'Required' }).trim().min(1, 'Must be 1–500 characters').max(500, 'Must be 1–500 characters'),
    lectureId: objectIdString.optional(),
    retriever: retriever.default('hybrid'),
    topK: z.number({ invalid_type_error: 'Must be an integer 1–20' }).int('Must be an integer 1–20').min(1, 'Must be an integer 1–20').max(20, 'Must be an integer 1–20').default(5),
  })
  .strict();

searchRouter.post('/search', requireAuth, validate({ body: searchBody }), () => {
  throw notImplemented('C', 'PC.1', 'Semantic search');
});
