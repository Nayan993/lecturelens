import type { RejectionReason } from './enums';

/** Body of POST /topics/:id/reject and POST /summaries/:id/reject — docs/CONTRACTS.md §5.5. */
export interface RejectPayload {
  rejectionReason: RejectionReason;
  reviewNote?: string | null;
}
