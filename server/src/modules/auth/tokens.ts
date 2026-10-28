import jwt from 'jsonwebtoken';
import { isValidObjectId } from 'mongoose';
import { env } from '../../config/env.js';
import { ROLES, type Role } from '../../models/index.js';
import { unauthenticated } from '../../utils/errors.js';

/** JWT claims (CONTRACTS.md §1.5): ONLY the user id and role — never email or name. */
export interface TokenClaims {
  sub: string;
  role: Role;
}

export function signToken(userId: string, role: Role): string {
  return jwt.sign({ role }, env.JWT_SECRET, {
    algorithm: 'HS256',
    subject: userId,
    // Format checked in config/env.ts.
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

/** Verifies signature, algorithm and expiry; throws 401 (with reason "expired" when it is). */
export function verifyToken(token: string): TokenClaims {
  let payload: string | jwt.JwtPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw unauthenticated('Your session has expired. Please sign in again.', { reason: 'expired' });
    }
    throw unauthenticated('Your session is invalid. Please sign in again.');
  }
  if (
    typeof payload !== 'object' ||
    typeof payload.sub !== 'string' ||
    !isValidObjectId(payload.sub) ||
    !ROLES.includes(payload.role)
  ) {
    throw unauthenticated('Your session is invalid. Please sign in again.');
  }
  return { sub: payload.sub, role: payload.role };
}
