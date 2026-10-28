# quiz — owner: Member C · prompt PC.3
Routes: `POST /lectures/:id/questions/generate`, `GET /questions`, `PATCH /questions/:id` (all teacher); `POST /quizzes`, `GET /quizzes`, `GET /quizzes/:id`, `POST /quizzes/:id/attempts`, `GET /attempts/:id` (any signed-in user, own data only).
Output: `{ items: Question[] }`, `Paginated<Question | QuizSummary>`, `{ question }`, `{ quiz }`, `{ attempt }` — see CONTRACTS.md §5.7, §6.10 and §6.11. Students never see unapproved questions or answer keys before submitting.
Replace the handler body only; do not change the path, guards or validation without a contract-change issue.
