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
 * Topic sections — owner B, PB.1 — CONTRACTS.md §5.5. Students get approved topics only
 * (TopicSection.approvedFor); ownership (404) is checked in the handler.
 */
export const topicsRouter = Router();

const updateTopicBody = z
  .object({
    label: z.string().trim().min(1, 'Must be 1–80 characters').max(80, 'Must be 1–80 characters').optional(),
    keywords: z
      .array(z.string().trim().min(1, 'Must not be empty'))
      .min(3, 'Must have 3–8 items')
      .max(8, 'Must have 3–8 items')
      .optional(),
  })
  .strict('Only "label" and "keywords" can be changed')
  .refine((b) => b.label !== undefined || b.keywords !== undefined, 'Send "label" and/or "keywords"');

topicsRouter.get('/lectures/:id/topics', requireAuth, objectIdParams('id'), () => {
  throw notImplemented('B', 'PB.1', 'Topic sections');
});

topicsRouter.patch(
  '/topics/:id',
  requireAuth,
  requireRole('teacher'),
  objectIdParams('id'),
  validate({ body: updateTopicBody }),
  () => {
    throw notImplemented('B', 'PB.1', 'Topic editing');
  },
);

topicsRouter.post('/topics/:id/approve', requireAuth, requireRole('teacher'), objectIdParams('id'), validate({ body: emptyBody }), () => {
  throw notImplemented('B', 'PB.1', 'Topic approval');
});

topicsRouter.post('/topics/:id/reject', requireAuth, requireRole('teacher'), objectIdParams('id'), validate({ body: rejectBody }), () => {
  throw notImplemented('B', 'PB.1', 'Topic rejection');
});
