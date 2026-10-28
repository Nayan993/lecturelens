import type { AuthService } from '../types';
import { clone, db, delay, fail, newId, nowIso, requireUser, tokenFor, userForToken } from './db';

/**
 * Demo accounts: teacher@lecturelens.dev and student@lecturelens.dev, password "lecturelens".
 * Registering creates an in-memory account for this page session.
 */
export const mockAuthService: AuthService = {
  async login(email, password) {
    await delay();
    const account = db.accounts.find((a) => a.user.email === email.trim().toLowerCase());
    if (!account || account.password !== password) fail(401, 'UNAUTHENTICATED', 'Invalid email or password');
    account.user.lastLoginAt = nowIso();
    return { token: tokenFor(account.user.id), user: clone(account.user) };
  },

  async register({ email, password, name, role }) {
    await delay();
    const details: Record<string, string> = {};
    const normalised = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalised)) details.email = 'Enter a valid email address';
    if (password.length < 8) details.password = 'Must be at least 8 characters';
    else if (password.length > 128) details.password = 'Must be at most 128 characters';
    else if (!/[A-Za-z]/.test(password)) details.password = 'Must contain at least one letter';
    else if (!/\d/.test(password)) details.password = 'Must contain at least one digit';
    if (name.trim().length < 2 || name.trim().length > 80) details.name = 'Must be 2–80 characters';
    if (role !== 'student' && role !== 'teacher') details.role = 'Must be "student" or "teacher"';
    if (Object.keys(details).length) fail(422, 'VALIDATION_FAILED', 'Request body is invalid.', details);
    if (db.accounts.some((a) => a.user.email === normalised)) fail(409, 'CONFLICT', 'An account with this email already exists.');
    const at = nowIso();
    const user = { id: newId(), email: normalised, name: name.trim(), role, lastLoginAt: at, createdAt: at, updatedAt: at };
    db.accounts.push({ user, password });
    return { token: tokenFor(user.id), user: clone(user) };
  },

  async me(token) {
    await delay();
    const user = userForToken(token);
    if (!user) fail(401, 'UNAUTHENTICATED', 'Your session has ended. Please log in again.');
    return clone(user);
  },

  async updateProfile({ name }) {
    await delay();
    const user = requireUser();
    const account = db.accounts.find((a) => a.user.id === user.id)!;
    if (name.trim().length < 2 || name.trim().length > 80) fail(422, 'VALIDATION_FAILED', 'Request body is invalid.', { name: 'Must be 2–80 characters' });
    account.user.name = name.trim();
    account.user.updatedAt = nowIso();
    return clone(account.user);
  },
};
