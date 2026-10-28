# revision — owner: Member C · prompt PC.3
Route: `GET /revision-plan?lectureId=` — the caller's own latest plan.
Output: `{ plan }` or `{ plan: null }` before any attempt — see CONTRACTS.md §5.7, §4.10 and §6.12; every `reason` must quote the student's real numbers.
Replace the handler body only; do not change the path, guards or validation without a contract-change issue.
