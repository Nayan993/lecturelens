# qa — owner: Member C · prompt PC.2
Route: `POST /ask` with `{ question (3–500 chars), lectureId?, retriever? = "hybrid" }`.
Output: a grounded answer with `[n]`-marked citations, or an abstention (still `200`) — see CONTRACTS.md §5.6 and `mocks/answer.json`; provider down is `503 PROVIDER_UNAVAILABLE`.
Replace the handler body only; do not change the path, guards or validation without a contract-change issue.
