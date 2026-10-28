import { Router } from 'express';
import { authRouter, usersRouter } from '../modules/auth/auth.routes.js';
import { lecturesRouter } from '../modules/lectures/lectures.routes.js';
import { qaRouter } from '../modules/qa/routes.js';
import { quizRouter } from '../modules/quiz/routes.js';
import { revisionRouter } from '../modules/revision/routes.js';
import { searchRouter } from '../modules/search/routes.js';
import { summariesRouter } from '../modules/summaries/routes.js';
import { topicsRouter } from '../modules/topics/routes.js';
import { transcriptRouter } from '../modules/transcript/routes.js';
import { healthRouter } from './health.js';

/**
 * ============================================================================
 *  LectureLens API v1 — ROUTE TABLE              (mounted at /api/v1 in app.ts)
 *
 *  THIS FILE IS OWNED BY MEMBER D. Anyone else: open a `contract-change` issue
 *  instead of editing it. Paths, roles and shapes: docs/CONTRACTS.md §5.
 * ============================================================================
 *
 *  Guards: requireAuth everywhere except /health, /auth/register, /auth/login and
 *  the signed media URL; requireRole / ownership per the RBAC matrix (§1.6).
 *  A path id that is not a 24-hex ObjectId → 404, never 422/500 (§3.1).
 *  501 = route mounted with real guards and validation, handler not built yet (§7).
 *
 *  Method  Path                                   Role     Owner  Prompt  State
 *  ------  -------------------------------------  -------  -----  ------  -----
 *  D — infrastructure, auth, lectures
 *  GET     /health                                public   D              live
 *  POST    /auth/register                         public   D              live
 *  POST    /auth/login                            public   D              live
 *  GET     /auth/me                               any      D              live
 *  GET     /users/me                              any      D              live
 *  PATCH   /users/me                              any      D              live
 *  POST    /lectures                              teacher  D              live
 *  GET     /lectures                              any      D              live
 *  GET     /lectures/:id                          any*     D              live
 *  GET     /lectures/:id/status                   owner    D              live
 *  POST    /lectures/:id/reprocess                owner    D              live
 *  DELETE  /lectures/:id                          owner    D              live
 *  GET     /lectures/:id/media                    signed   D              live
 *
 *  A — transcript                                                modules/transcript
 *  GET     /lectures/:id/transcript               any*     A      PA.1    501
 *  PATCH   /lectures/:id/segments/:index          owner    A      PA.1    501
 *  POST    /lectures/:id/transcript/approve       owner    A      PA.1    501
 *
 *  B — topics and summaries                             modules/topics, modules/summaries
 *  GET     /lectures/:id/topics                   any*     B      PB.1    501
 *  PATCH   /topics/:id                            owner    B      PB.1    501
 *  POST    /topics/:id/approve                    owner    B      PB.1    501
 *  POST    /topics/:id/reject                     owner    B      PB.1    501
 *  GET     /lectures/:id/summaries                any*     B      PB.2    501
 *  PATCH   /summaries/:id                         owner    B      PB.2    501
 *  POST    /summaries/:id/approve                 owner    B      PB.2    501
 *  POST    /summaries/:id/reject                  owner    B      PB.2    501
 *
 *  C — search, Q&A, questions, quizzes, revision     modules/search, qa, quiz, revision
 *  POST    /search                                any*     C      PC.1    501
 *  POST    /ask                                   any*     C      PC.2    501
 *  POST    /lectures/:id/questions/generate       owner    C      PC.3    501
 *  GET     /questions                             teacher  C      PC.3    501
 *  PATCH   /questions/:id                         owner    C      PC.3    501
 *  POST    /quizzes                               any      C      PC.3    501
 *  GET     /quizzes                               any      C      PC.3    501
 *  GET     /quizzes/:id                           any**    C      PC.3    501
 *  POST    /quizzes/:id/attempts                  any      C      PC.3    501
 *  GET     /attempts/:id                          self     C      PC.3    501
 *  GET     /revision-plan                         any      C      PC.3    501
 *
 *  owner = teacher who uploaded the lecture (another teacher → 404, a student → 403)
 *  any*  = students see only approved content of ready + transcript-approved lectures
 *  any** = quiz creator or the lecture's owner      self = the attempt's own user only
 */
export const apiRouter = Router();

// D
apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);

// A, B, C — mounted at the root because their paths span /lectures, /topics, /quizzes, …
// Before /lectures so lecture sub-resources reach their own guards directly. These routers
// attach guards per route (no router.use), so they never affect other paths.
apiRouter.use(transcriptRouter); // A
apiRouter.use(topicsRouter); // B
apiRouter.use(summariesRouter); // B
apiRouter.use(searchRouter); // C
apiRouter.use(qaRouter); // C
apiRouter.use(quizRouter); // C
apiRouter.use(revisionRouter); // C

// D (after A/B/C: its router.use(requireAuth) covers every other /lectures path)
apiRouter.use('/lectures', lecturesRouter);
