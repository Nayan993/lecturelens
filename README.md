# LectureLens

LectureLens turns recorded lectures into timestamped transcripts, topic sections,
summaries, semantic search, grounded Q&A with timestamp citations, teacher-approved
quizzes and revision recommendations.

## Architecture (5 lines)

1. **Client** — one React 18 + Vite SPA (TypeScript, Tailwind, React Router, TanStack Query, Axios).
2. **Server** — one Express 4 API (TypeScript, Mongoose 8) exposing `/api/v1/*`.
3. **Database** — MongoDB Atlas (single cluster), accessed only through the server.
4. **External APIs** — transcription (AssemblyAI) and LLM calls (Groq / OpenRouter) over plain HTTP.
5. **No** Python service, vector DB, job queue, Redis, GraphQL or Docker requirement.

## Prerequisites

- **Node.js 20+** and npm 10+
- **FFmpeg** on your PATH (audio/video processing)
- A **MongoDB Atlas** connection URI

## Setup

```bash
# 1. install all workspaces from the repo root
npm install

# 2. create local env files from the examples and fill in real values
cp server/.env.example server/.env
cp client/.env.example client/.env

# 3. run both apps
npm run dev
```

Client dev server: http://localhost:5173 · API: http://localhost:5000/api/v1
Health check: `curl -s localhost:5000/api/v1/health`

## npm scripts (run from repo root)

| Script | What it does |
| --- | --- |
| `npm run dev` | Run client + server together (concurrently) |
| `npm run dev:client` | Run only the client |
| `npm run dev:server` | Run only the server |
| `npm run build` | Build both workspaces |
| `npm test` | Run server tests |
| `npm run typecheck` | `tsc --noEmit` in both workspaces |

## Team ownership

| Member | Area | Primary paths |
| --- | --- | --- |
| **A** | Ingest & transcription | `server/src/services/transcription/`, upload routes, FFmpeg |
| **B** | Frontend | `client/src/pages/`, `client/src/components/`, routing, UI |
| **C** | Search, Q&A & LLM features | summaries, semantic search, grounded Q&A, quizzes |
| **D** | Contracts, models & shared infra | **owns the shared files below** |

**Member D owns (others must open a `contract-change` issue instead of editing):**
`server/src/models/`, `server/src/routes/index.ts`, `server/src/config/env.ts`,
`server/src/services/llm/client.ts`, both `package.json` files,
`client/src/types/`, `client/src/services/`, `docs/CONTRACTS.md`, `mocks/`, `CLAUDE.md`.

## Must-read docs

- **[CLAUDE.md](./CLAUDE.md)** — conventions, hard rules and file ownership. Read it first.
- **[docs/CONTRACTS.md](./docs/CONTRACTS.md)** — API & data contracts (authored by Member D). Read before implementing any route or model.
