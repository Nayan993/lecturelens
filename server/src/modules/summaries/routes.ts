import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { objectIdParams } from '../../middleware/objectIdParams.js';
import { requireRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { notImplemented } from '../../utils/errors.js';
import { emptyBody } from '../../utils/schemas.js';
import { rejectBody } from '../review.schemas.js';

/**
 * Section summaries — owner B, PB.2 — CONTRACTS.md §5.5. Students get approved summaries only
 * (Summary.approvedFor); ownership (404) is checked in the handler.
 */
export const summariesRouter = Router();

const updateSummaryBody = z
  .object({
    title: z.string().trim().min(1, 'Must not be empty').optional(),
    text: z.string().trim().min(1, 'Must not be empty').optional(),
    keyPoints: z
      .array(z.string().trim().min(1, 'Must not be empty'))
      .min(2, 'Must have 2–5 items')
      .max(5, 'Must have 2–5 items')
      .optional(),
  })
  .strict('Only "title", "text" and "keyPoints" can be changed')
  .refine((b) => Object.keys(b).length > 0, 'Send at least one of "title", "text", "keyPoints"');

summariesRouter.get('/lectures/:id/summaries', requireAuth, objectIdParams('id'), () => {
  throw notImplemented('B', 'PB.2', 'Section summaries');
});

summariesRouter.patch(
  '/summaries/:id',
  requireAuth,
  requireRole('teacher'),
  objectIdParams('id'),
  validate({ body: updateSummaryBody }),
  () => {
    throw notImplemented('B', 'PB.2', 'Summary editing');
  },
);

summariesRouter.post('/summaries/:id/approve', requireAuth, requireRole('teacher'), objectIdParams('id'), validate({ body: emptyBody }), () => {
  throw notImplemented('B', 'PB.2', 'Summary approval');
});

summariesRouter.post('/summaries/:id/reject', requireAuth, requireRole('teacher'), objectIdParams('id'), validate({ body: rejectBody }), () => {
  throw notImplemented('B', 'PB.2', 'Summary rejection');
});
