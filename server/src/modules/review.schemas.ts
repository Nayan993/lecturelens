import { z } from 'zod';
import { REJECTION_REASONS } from '../models/index.js';

/** Shared by topics and summaries (CONTRACTS.md §5.5): POST …/:id/reject. */
export const rejectBody = z
  .object({
    rejectionReason: z.enum(REJECTION_REASONS, {
      errorMap: () => ({ message: `Must be one of ${REJECTION_REASONS.join(', ')}` }),
    }),
    reviewNote: z.string().trim().max(2000, 'Must be at most 2000 characters').nullable().optional(),
  })
  .strict();
