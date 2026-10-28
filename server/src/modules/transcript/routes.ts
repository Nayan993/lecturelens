import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { objectIdParams } from '../../middleware/objectIdParams.js';
import { requireRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { notImplemented } from '../../utils/errors.js';
import { emptyBody } from '../../utils/schemas.js';

/** Transcript — owner A, PA.1 — CONTRACTS.md §5.4. Ownership (404) is checked in the handler. */
export const transcriptRouter = Router();

const segmentParams = z.object({
  id: z.string(),
  index: z.coerce.number({ invalid_type_error: 'Must be an integer ≥ 0' }).int('Must be an integer ≥ 0').min(0, 'Must be an integer ≥ 0'),
});
const segmentBody = z
  .object({ text: z.string({ required_error: 'Required' }).trim().min(1, 'Must be 1–2000 characters').max(2000, 'Must be 1–2000 characters') })
  .strict('Only "text" can be changed; timing is not editable');

transcriptRouter.get('/lectures/:id/transcript', requireAuth, objectIdParams('id'), () => {
  throw notImplemented('A', 'PA.1', 'Transcript retrieval');
});

transcriptRouter.patch(
  '/lectures/:id/segments/:index',
  requireAuth,
  requireRole('teacher'),
  objectIdParams('id'),
  validate({ params: segmentParams, body: segmentBody }),
  () => {
    throw notImplemented('A', 'PA.1', 'Transcript segment correction');
  },
);

transcriptRouter.post(
  '/lectures/:id/transcript/approve',
  requireAuth,
  requireRole('teacher'),
  objectIdParams('id'),
  validate({ body: emptyBody }),
  () => {
    throw notImplemented('A', 'PA.1', 'Transcript approval');
  },
);
