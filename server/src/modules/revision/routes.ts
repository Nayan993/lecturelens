import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { notImplemented } from '../../utils/errors.js';
import { objectIdString } from '../../utils/schemas.js';

/** Revision plan — owner C, PC.3 — CONTRACTS.md §5.7. Always the caller's own plan (§1.6). */
export const revisionRouter = Router();

const planQuery = z.object({ lectureId: objectIdString.optional() });

revisionRouter.get('/revision-plan', requireAuth, validate({ query: planQuery }), () => {
  throw notImplemented('C', 'PC.3', 'The revision plan');
});
