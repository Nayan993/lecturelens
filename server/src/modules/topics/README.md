# topics — owner: Member B · prompt PB.1
Routes: `GET /lectures/:id/topics`, `PATCH /topics/:id` (teacher, `{ label?, keywords? }`), `POST /topics/:id/approve` (teacher, no body), `POST /topics/:id/reject` (teacher, `{ rejectionReason, reviewNote? }`).
Output: `{ lectureId, items: TopicSection[] }` or `{ topic }` — see CONTRACTS.md §5.5, §4.5 (tiling invariant) and §6.5. Students: `TopicSection.approvedFor(lectureId)` only (§4.12).
Replace the handler body only; do not change the path, guards or validation without a contract-change issue.
