import { z } from 'zod';
import { ROLES } from '../../models/index.js';

/** Request bodies for /auth and /users (CONTRACTS.md §5.2). */

const name = z
  .string({ required_error: 'Required', invalid_type_error: 'Must be text' })
  .trim()
  .min(2, 'Must be 2–80 characters')
  .max(80, 'Must be 2–80 characters');

export const registerBody = z.object({
  name,
  email: z
    .string({ required_error: 'Required', invalid_type_error: 'Must be text' })
    .trim()
    .toLowerCase()
    .email('Must be a valid email address')
    .max(254, 'Must be at most 254 characters'),
  password: z
    .string({ required_error: 'Required', invalid_type_error: 'Must be text' })
    .min(8, 'Must be at least 8 characters')
    .max(128, 'Must be at most 128 characters')
    .regex(/[A-Za-z]/, 'Must contain at least one letter')
    .regex(/\d/, 'Must contain at least one digit'),
  role: z.enum(ROLES, { errorMap: () => ({ message: 'Must be "student" or "teacher"' }) }),
});
export type RegisterBody = z.infer<typeof registerBody>;

// No format rules beyond "present": login must not say more than "invalid email or password".
export const loginBody = z.object({
  email: z.string({ required_error: 'Required' }).trim().toLowerCase().min(1, 'Required'),
  password: z.string({ required_error: 'Required' }).min(1, 'Required'),
});
export type LoginBody = z.infer<typeof loginBody>;

/** PATCH /users/me — name only. */
export const updateMeBody = z.object({ name }).strict('Only "name" can be changed');
export type UpdateMeBody = z.infer<typeof updateMeBody>;
