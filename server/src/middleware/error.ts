import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { AppError, internal, notFound, unauthenticated, validationFailed } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

/** Errors thrown by express.json() (body-parser) carry a `type`. */
function bodyParserType(err: unknown): string | undefined {
  return typeof err === 'object' && err !== null && 'type' in err && typeof err.type === 'string'
    ? err.type
    : undefined;
}

/** Maps any thrown value to an AppError. Unknown errors become INTERNAL_ERROR. */
function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;

  if (err instanceof mongoose.Error.ValidationError) {
    const details: Record<string, string> = {};
    for (const [field, fieldError] of Object.entries(err.errors)) details[field] = fieldError.message;
    return validationFailed(details);
  }
  if (err instanceof mongoose.Error.CastError) {
    // A malformed id is indistinguishable from an unknown one (§3.1).
    if (err.kind === 'ObjectId') return notFound();
    return validationFailed({ [err.path]: `Invalid value for ${err.path}.` });
  }

  // TokenExpiredError and NotBeforeError both extend JsonWebTokenError.
  if (err instanceof jwt.JsonWebTokenError) {
    return unauthenticated(
      err instanceof jwt.TokenExpiredError
        ? 'Your session has expired. Please sign in again.'
        : 'Your session is invalid. Please sign in again.',
    );
  }

  switch (bodyParserType(err)) {
    case 'entity.parse.failed': // there is no 400 in this API
      return validationFailed({ body: 'Malformed JSON.' }, 'Request body is not valid JSON.');
    case 'entity.too.large':
      return new AppError('PAYLOAD_TOO_LARGE', 'Request body is too large.', 413, { maxMb: 1 });
  }

  return internal();
}

/** The single error handler. Must keep four parameters so Express treats it as one. */
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(err);
    return;
  }

  const appError = toAppError(err);

  if (appError.status >= 500) {
    // The stack only ever goes to the server log, never to the client.
    logger.error('Request failed', {
      method: req.method,
      path: req.originalUrl,
      status: appError.status,
      code: appError.code,
      error: err,
    });
  } else {
    logger.debug('Request rejected', {
      method: req.method,
      path: req.originalUrl,
      status: appError.status,
      code: appError.code,
    });
  }

  res.status(appError.status).json({
    error: {
      code: appError.code,
      message: appError.message,
      details: appError.details,
      requestId: req.id,
    },
  });
}
