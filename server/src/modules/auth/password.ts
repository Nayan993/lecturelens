import bcrypt from 'bcryptjs';

/** bcrypt cost factor (CONTRACTS.md §4.1). */
export const BCRYPT_COST = 10;

/** Hash on create and on password change only. Never log or return the result. */
export function hashPassword(password: string, cost = BCRYPT_COST): Promise<string> {
  return bcrypt.hash(password, cost);
}

// Compared against when the email is unknown, so a login for a missing account costs the
// same bcrypt work as a wrong password and response timing does not reveal which it was.
let dummyHash: Promise<string> | undefined;

/** Constant-work check: `hash` may be undefined (unknown user); the result is then false. */
export async function verifyPassword(password: string, hash: string | undefined): Promise<boolean> {
  dummyHash ??= bcrypt.hash('not-a-real-password', BCRYPT_COST);
  const matches = await bcrypt.compare(password, hash ?? (await dummyHash));
  return hash !== undefined && matches;
}
