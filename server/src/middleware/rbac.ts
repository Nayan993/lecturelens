import type { Request, RequestHandler } from 'express';
import type { Types } from 'mongoose';
import type { Role } from '../models/index.js';
import { forbidden, notFound, unauthenticated } from '../utils/errors.js';
import { asyncHandler } from './asyncHandler.js';

/*
 * Role-based access control, enforced on the SERVER (CONTRACTS.md §1.6). Hiding a button
 * in the UI is not access control: every teacher-only route must reject a student token
 * even if the client would never call it. Always mount after requireAuth.
 */

/** 403 FORBIDDEN unless the signed-in user has one of `roles`. */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(unauthenticated());
    if (!roles.includes(req.user.role)) return next(forbidden(`Requires the ${roles.join(' or ')} role.`));
    next();
  };
}

type OwnerId = Types.ObjectId | string | null | undefined;

/**
 * Allows the request if the signed-in user owns the resource OR has one of `roles`.
 * `getOwnerId` returns the owner's id, or null/undefined when the resource does not exist
 * (→ 404). Pass no roles for owner-only resources such as attempts.
 */
export function requireOwnerOrRole(
  getOwnerId: (req: Request) => OwnerId | Promise<OwnerId>,
  ...roles: Role[]
): RequestHandler {
  return asyncHandler(async (req, _res, next) => {
    if (!req.user) throw unauthenticated();
    if (roles.includes(req.user.role)) return next();
    const ownerId = await getOwnerId(req);
    if (ownerId == null) throw notFound();
    if (String(ownerId) !== req.user.id) throw forbidden();
    next();
  });
}
