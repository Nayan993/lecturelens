import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Wraps an async route handler so a rejected promise reaches the error middleware
 * (Express 4 does not do this by itself).
 */
export function asyncHandler<P = Record<string, string>, ResBody = unknown, ReqBody = unknown, Q = unknown>(
  fn: (req: Request<P, ResBody, ReqBody, Q>, res: Response<ResBody>, next: NextFunction) => Promise<unknown>,
): RequestHandler<P, ResBody, ReqBody, Q> {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
