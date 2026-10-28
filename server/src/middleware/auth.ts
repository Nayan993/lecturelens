import { User } from '../models/index.js';
import { verifyToken } from '../modules/auth/tokens.js';
import { unauthenticated } from '../utils/errors.js';
import { asyncHandler } from './asyncHandler.js';

const BEARER = /^Bearer\s+([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/;

/**
 * Requires `Authorization: Bearer <jwt>`. Verifies the token, loads the user (so deleted
 * accounts lose access at once) and sets req.user = { id, role }.
 * 401 UNAUTHENTICATED on a missing, malformed, expired (details.reason "expired") or
 * invalid token.
 */
export const requireAuth = asyncHandler(async (req, _res, next) => {
  const header = req.get('authorization');
  if (!header) throw unauthenticated('You need to sign in to do that.');

  const token = BEARER.exec(header.trim())?.[1];
  if (!token) throw unauthenticated('Your session is invalid. Please sign in again.');

  const claims = verifyToken(token);
  const user = await User.findById(claims.sub).select('role').lean();
  if (!user) throw unauthenticated('Your session is invalid. Please sign in again.');

  // Role from the database, not the token: it is the source of truth.
  req.user = { id: String(user._id), role: user.role };
  next();
});
