import type { RequestHandler } from 'express';
import { notFound } from '../utils/errors.js';
import { objectIdString } from '../utils/schemas.js';

/**
 * A malformed id in the path is reported exactly like an unknown one: 404 NOT_FOUND
 * (CONTRACTS.md §3.1), never 422 or 500.
 */
export function objectIdParams(...names: string[]): RequestHandler {
  return (req, _res, next) => {
    const bad = names.some((name) => !objectIdString.safeParse(req.params[name]).success);
    next(bad ? notFound() : undefined);
  };
}
