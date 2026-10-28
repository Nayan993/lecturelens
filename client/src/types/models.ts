import type { Role } from './enums';

/** `user` object — docs/CONTRACTS.md §5.2. */
export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Body of POST /auth/register. */
export interface RegisterPayload {
  email: string;
  password: string;
  name: string;
  role: Role;
}

/** Response of POST /auth/register and POST /auth/login. */
export interface AuthResponse {
  token: string;
  user: User;
}

/** The error envelope every non-2xx response uses — docs/CONTRACTS.md §3. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
    requestId: string;
  };
}
