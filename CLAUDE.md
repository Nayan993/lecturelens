# CLAUDE.md — LectureLens

LectureLens turns recorded lectures into timestamped transcripts, topic sections,
summaries, semantic search, grounded Q&A with timestamp citations, teacher-approved
quizzes and revision recommendations. It is a monorepo with ONE React frontend, ONE
Express backend, MongoDB Atlas, and external HTTP APIs for transcription and LLM calls.

## Stack (pinned — do not substitute)

- **Client:** React 18 + Vite 5 + TypeScript + Tailwind 3 + React Router 6 + TanStack Query 5 + Axios
- **Server:** Node 20 + Express 4 + TypeScript + Mongoose 8
- **Database:** MongoDB Atlas

## NEVER add

Never introduce any of the following — they are explicitly out of scope:

- A Python service
- A vector database
- A job queue
- Docker
- Redis
- A GraphQL layer
- A different UI framework (no Next.js, Vue, Svelte, Angular, etc.)

If a task seems to need one of these, stop and raise it — do not add it silently.

## Hard conventions

- **Time offsets are FLOAT SECONDS with 3 decimals**, named `startSec` / `endSec`
  (e.g. `12.480`). Never `hh:mm:ss`. Never integer milliseconds.
- **All JSON fields are camelCase.**
- **Mongo `_id` is exposed to clients as the string field `id`** (never raw `_id`).
- **Every non-2xx response uses the error envelope** defined in `docs/CONTRACTS.md`:
  `{ error: { code, message, details, requestId } }`.
- **Unimplemented routes return HTTP 501 with code `NOT_IMPLEMENTED`.**
  Never return fake successful data for a feature that does not exist.
- **Secrets come only from environment variables.** Never hardcode a key or URI.

## File ownership — Member D only

The following are owned by **Member D**. Anyone else must open a `contract-change`
issue instead of editing them directly:

- `server/src/models/`
- `server/src/routes/index.ts`
- `server/src/config/env.ts`
- `server/src/services/llm/client.ts`
- both `package.json` files (root + each workspace)
- `client/src/types/`
- `client/src/services/`
- `docs/CONTRACTS.md`
- `mocks/`
- `CLAUDE.md`

## Workflow rules

- **Read `docs/CONTRACTS.md` before implementing any route or model.** It is the
  single source of truth for shapes, field names and error codes.
- **Run `npm run typecheck` before declaring any work finished.**
- **Never claim a test passed without actually executing it** and seeing it pass.
