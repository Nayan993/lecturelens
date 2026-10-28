/**
 * Auth service. The AuthService interface is what AuthContext depends on; the full
 * API client (shared axios instance, interceptors, every other route) arrives in P1.4
 * and should replace `httpAuthService` without changing the interface.
 */
import axios, { isAxiosError } from 'axios';
import type { ApiErrorBody, AuthResponse, RegisterPayload, User } from '../types';

export interface AuthService {
  login(email: string, password: string): Promise<AuthResponse>;
  register(payload: RegisterPayload): Promise<AuthResponse>;
  /** GET /auth/me with the given token. */
  me(token: string): Promise<User>;
}

/** A failed API call, carrying the contract's error envelope fields. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: Record<string, unknown> = {},
    readonly requestId: string | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000/api/v1';

function toApiError(err: unknown): ApiError {
  if (isAxiosError<ApiErrorBody>(err)) {
    const body = err.response?.data?.error;
    if (err.response && body) {
      return new ApiError(err.response.status, body.code, body.message, body.details ?? {}, body.requestId ?? null);
    }
    if (err.response) return new ApiError(err.response.status, 'INTERNAL_ERROR', err.message);
    return new ApiError(0, 'NETWORK_ERROR', 'Could not reach the LectureLens server.');
  }
  return new ApiError(0, 'INTERNAL_ERROR', err instanceof Error ? err.message : 'Unexpected error');
}

const http = axios.create({ baseURL: API_BASE_URL, timeout: 15_000 });

async function call<T>(fn: () => Promise<{ data: T }>): Promise<T> {
  try {
    return (await fn()).data;
  } catch (err) {
    throw toApiError(err);
  }
}

export const httpAuthService: AuthService = {
  login: (email, password) => call(() => http.post<AuthResponse>('/auth/login', { email, password })),
  register: (payload) => call(() => http.post<AuthResponse>('/auth/register', payload)),
  me: async (token) =>
    (await call(() => http.get<{ user: User }>('/auth/me', { headers: { Authorization: `Bearer ${token}` } }))).user,
};
