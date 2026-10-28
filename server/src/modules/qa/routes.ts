import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { notImplemented } from '../../utils/errors.js';
import { objectIdString } from '../../utils/schemas.js';
import { retriever } from '../search/routes.js';

/** Grounded Q&A — owner C, PC.2 — CONTRACTS.md §5.6. Abstaining is a normal 200, not an error. */
export const qaRouter = Router();

const askBody = z
  .object({
    question: z.string({ required_error: 'Required' }).trim().min(3, 'Must be 3–500 characters').max(500, 'Must be 3–500 characters'),
    lectureId: objectIdString.optional(),
    retriever: retriever.default('hybrid'),
  })
  .strict();

qaRouter.post('/ask', requireAuth, validate({ body: askBody }), () => {
  throw notImplemented('C', 'PC.2', 'Grounded Q&A');
});
