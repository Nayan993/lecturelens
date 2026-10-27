import type { Request, Response, NextFunction } from 'express';

/**
 * The single error envelope used by EVERY non-2xx response:
 *   { error: { code, message, details, requestId } }
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details: unknown = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** Helper for routes that are not implemented yet (HTTP 501). */
export function notImplemented(message = 'This endpoint is not implemented yet.'): ApiError {
  return new ApiError(501, 'NOT_IMPLEMENTED', message);
}

/** 404 for unknown routes. */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found`,
      details: null,
      requestId: req.requestId,
    },
  });
}

/** Centralised error handler — must keep all four args so Express treats it as an error handler. */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const apiError = err instanceof ApiError ? err : null;
  const status = apiError?.status ?? 500;
  const code = apiError?.code ?? 'INTERNAL_ERROR';
  const message = apiError?.message ?? 'Unexpected server error';
  const details = apiError?.details ?? null;

  if (!apiError) {
    // Unexpected error — log it server-side for debugging.
    console.error(`[${req.requestId}]`, err);
  }

  res.status(status).json({
    error: { code, message, details, requestId: req.requestId },
  });
}
