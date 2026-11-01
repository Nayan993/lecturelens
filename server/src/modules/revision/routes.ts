import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { Lecture } from '../../models/index.js';
import { latestRevisionPlan } from '../../services/learning/revisionPlanner.js';
import { notFound, unauthenticated } from '../../utils/errors.js';
import { objectIdString } from '../../utils/schemas.js';
import { visibleTo } from '../lectures/lectures.service.js';

/** Revision plan — owner C, PC.3 — CONTRACTS.md §5.7. Always the caller's own plan (§1.6). */
export const revisionRouter = Router();

const planQuery = z.object({ lectureId: objectIdString.optional() });

revisionRouter.get(
  '/revision-plan',
  requireAuth,
  validate({ query: planQuery }),
  asyncHandler(async (req, res) => {
    if (!req.user) throw unauthenticated();
    const { lectureId } = req.query as z.infer<typeof planQuery>;
    if (lectureId && !(await Lecture.exists({ _id: lectureId, ...visibleTo(req.user) }))) throw notFound('Lecture');
    // Rules, not a model: services/learning/revisionPlanner.ts. { plan: null } before any attempt.
    const plan = await latestRevisionPlan({ studentId: req.user.id, lectureId: lectureId ?? null });
    res.json({ plan: plan ? plan.toJSON() : null });
  }),
);
