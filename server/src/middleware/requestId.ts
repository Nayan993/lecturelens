import type { NextFunction, Request, Response } from 'express';
import { nanoid } from 'nanoid';
import { requestContext } from '../utils/logger.js';

/**
 * Gives every request a "req_" + nanoid id (docs/CONTRACTS.md §3), exposes it in the
 * X-Request-Id header and runs the rest of the chain inside the logger's request
 * context so every log line for this request carries it.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  req.id = `req_${nanoid(12)}`;
  res.setHeader('X-Request-Id', req.id);
  requestContext.run({ requestId: req.id }, next);
}
