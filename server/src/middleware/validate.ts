import type { NextFunction, Request, Response } from 'express';
import type { ZodError, ZodTypeAny } from 'zod';
import { validationFailed } from '../utils/errors.js';

interface Schemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

/** Zod issues → the contract's field → message map with dotted paths (§3.1). */
export function zodDetails(error: ZodError, fallbackField: string): Record<string, string> {
  const details: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path.length ? issue.path.join('.') : fallbackField;
    details[field] ??= issue.message; // first message per field wins
  }
  return details;
}

/**
 * Validates and replaces req.body / req.query / req.params with the parsed values
 * (so defaults and coercions apply). All parts are checked and reported together;
 * any failure becomes 422 VALIDATION_FAILED.
 */
export function validate(schemas: Schemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const details: Record<string, string> = {};
    for (const part of ['params', 'query', 'body'] as const) {
      const schema = schemas[part];
      if (!schema) continue;
      const result = schema.safeParse(req[part]);
      if (result.success) {
        req[part] = result.data;
      } else {
        Object.assign(details, zodDetails(result.error, part));
      }
    }
    if (Object.keys(details).length > 0) {
      next(validationFailed(details));
      return;
    }
    next();
  };
}
