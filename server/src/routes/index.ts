import { Router } from 'express';
import { authRouter, usersRouter } from '../modules/auth/auth.routes.js';
import { lecturesRouter } from '../modules/lectures/lectures.routes.js';
import { healthRouter } from './health.js';

/**
 * ============================================================================
 *  LectureLens API v1 — ROUTE TABLE              (mounted at /api/v1 in app.ts)
 *
 *  THIS FILE IS OWNED BY MEMBER D. Anyone else: open a `contract-change` issue
 *  instead of editing it. Paths, roles and shapes come from docs/CONTRACTS.md §5.
 * ============================================================================
 *
 *  Owner letters: A = ingest/transcript, B = topics/summaries,
 *                 C = search/Q&A/quizzes/revision, D = contracts/auth/lectures/infra.
 *
 *  Mount point              Router (planned file)              Owner
 *  -----------------------  ---------------------------------  -----
 *  /health                  routes/health.ts        (live)      D
 *  /auth                    modules/auth/auth.routes.ts (live)  D   register, login, me
 *  /users                   modules/auth/auth.routes.ts (live)  D   GET/PATCH /users/me
 *  /lectures                modules/lectures/ (live)            D   upload, list, detail, delete,
 *                                                                   status, reprocess, media
 *  /lectures/:id/transcript routes/transcript.routes.ts         A   transcript, approve
 *  /lectures/:id/segments   routes/transcript.routes.ts         A   PATCH /:index correction
 *  /lectures/:id/topics     routes/topics.routes.ts             B   list topics
 *  /topics                  routes/topics.routes.ts             B   edit, approve, reject
 *  /lectures/:id/summaries  routes/summaries.routes.ts          B   list summaries
 *  /summaries               routes/summaries.routes.ts          B   edit, approve, reject
 *  /search                  routes/search.routes.ts             C   ranked passages
 *  /ask                     routes/ask.routes.ts                C   grounded answer / abstain
 *  /lectures/:id/questions  routes/questions.routes.ts          C   POST /generate
 *  /questions               routes/questions.routes.ts          C   bank, edit, approve/reject
 *  /quizzes                 routes/quizzes.routes.ts            C   build, list, get, attempts
 *  /attempts                routes/quizzes.routes.ts            C   GET /:id
 *  /revision-plan           routes/revision.routes.ts           C   latest plan
 *
 *  Access control: requireAuth (middleware/auth.ts) on everything except /health,
 *  /auth/register, /auth/login and the signed media URL; then requireRole /
 *  requireOwnerOrRole (middleware/rbac.ts) per the RBAC matrix in CONTRACTS.md §1.6.
 *
 *  Until a router exists its routes must answer 501 NOT_IMPLEMENTED via
 *  notImplemented(owner, prompt) from utils/errors.ts — never fake success data.
 *  Anything unmatched falls through to middleware/notFound.ts (404).
 */
export const apiRouter = Router();

apiRouter.use('/health', healthRouter); // D
apiRouter.use('/auth', authRouter); // D
apiRouter.use('/users', usersRouter); // D
apiRouter.use('/lectures', lecturesRouter); // D
