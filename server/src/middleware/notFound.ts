import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/errors.js';

/** Unmatched routes → 404 NOT_FOUND in the standard envelope (via the error middleware). */
export function notFound(req: Request, _res: Response, next: NextFunction): void {
  next(new AppError('NOT_FOUND', `Route ${req.method} ${req.originalUrl} not found.`));
}
