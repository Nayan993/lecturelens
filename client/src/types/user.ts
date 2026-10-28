import type { Id, IsoDateTime } from './common';
import type { Role } from './enums';

/** `user` object — docs/CONTRACTS.md §5.2. */
export interface User {
  id: Id;
  email: string;
  name: string;
  role: Role;
  lastLoginAt: IsoDateTime | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

/** POST /auth/register body. name 2–80 chars; password 8–128 chars with a letter and a digit. */
export interface RegisterPayload {
  email: string;
  password: string;
  name: string;
  role: Role;
}

/** POST /auth/register and POST /auth/login response. */
export interface AuthResponse {
  token: string;
  user: User;
}

/** PATCH /users/me body — name only (no password change in v1). */
export interface UpdateProfilePayload {
  name: string;
}
