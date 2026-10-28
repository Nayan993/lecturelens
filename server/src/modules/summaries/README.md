# summaries — owner: Member B · prompt PB.2
Routes: `GET /lectures/:id/summaries`, `PATCH /summaries/:id` (teacher, `{ title?, text?, keyPoints? }`), `POST /summaries/:id/approve` (teacher, no body), `POST /summaries/:id/reject` (teacher, `{ rejectionReason, reviewNote? }`).
Output: `{ lectureId, items: Summary[] }` or `{ summary }` — see CONTRACTS.md §5.5, §4.6 (evidence rules) and §6.6. Students: `Summary.approvedFor(lectureId)` only (§4.12).
Replace the handler body only; do not change the path, guards or validation without a contract-change issue.
