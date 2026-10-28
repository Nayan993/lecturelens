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

/** POST /auth/register body. password 8–128 chars. */
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

/** PATCH /users/me body: a new name, and/or a password change. */
export interface UpdateProfilePayload {
  name?: string;
  currentPassword?: string;
  newPassword?: string;
}
