# search — owner: Member C · prompt PC.1
Route: `POST /search` with `{ query, lectureId?, retriever? = "hybrid", topK? = 5 (1–20) }`.
Output: `{ query, retriever, items: Passage[], tookMs }` — see CONTRACTS.md §5.6 and §6.7. Students only search lectures they can see (ready + transcript approved, §1.6).
Replace the handler body only; do not change the path, guards or validation without a contract-change issue.
