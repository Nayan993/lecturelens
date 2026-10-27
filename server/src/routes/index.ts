import { Router } from 'express';
import { healthRouter } from './health.js';

/**
 * API v1 router. Owned by Member D.
 * Mount new feature routers here. Routes that are not implemented yet must
 * return HTTP 501 with code NOT_IMPLEMENTED (see middleware/errorHandler.ts) —
 * never return fake successful data.
 */
export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
