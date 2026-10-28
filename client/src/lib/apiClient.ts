import axios, { isAxiosError, type AxiosError } from 'axios';
import type { ApiError, ApiErrorBody, ApiErrorCode } from '../types';
import { clearToken, readToken, TOKEN_KEY } from './tokenStorage';

export { TOKEN_KEY };

/** Fired on window when an authenticated request gets a 401; AuthContext listens and signs out. */
export const UNAUTHORISED_EVENT = 'll:unauthorised';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000/api/v1';

/** Every failed API call (HTTP adapters and mock adapters alike) rejects with one of these. */
export class ApiRequestError extends Error implements ApiError {
  readonly code: ApiErrorCode;
  readonly details: Record<string, unknown>;
  readonly requestId: string | null;
  readonly status: number;

  constructor({ code, message, details = {}, requestId = null, status }: Omit<ApiError, 'details' | 'requestId'> & Partial<Pick<ApiError, 'details' | 'requestId'>>) {
    super(message);
    this.name = 'ApiRequestError';
    this.code = code;
    this.details = details;
    this.requestId = requestId;
    this.status = status;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiRequestError;
}

/** True for HTTP 501 / NOT_IMPLEMENTED — render the calm "coming soon" state, not a red error. */
export function isNotImplemented(e: unknown): boolean {
  return isApiError(e) && (e.status === 501 || e.code === 'NOT_IMPLEMENTED');
}

/** Map any Axios failure onto the contract's error envelope. */
export function normaliseError(err: unknown): ApiRequestError {
  if (err instanceof ApiRequestError) return err;
  if (isAxiosError<ApiErrorBody>(err)) {
    const res = err.response;
    const body = res?.data?.error;
    if (res && body?.code) {
      return new ApiRequestError({
        status: res.status,
        code: body.code,
        message: body.message,
        details: body.details ?? {},
        requestId: body.requestId ?? null,
      });
    }
    if (res) {
      // A non-contract body (proxy error page, etc.): keep the status, use the matching reserved code.
      const code: ApiErrorCode =
        res.status === 401 ? 'UNAUTHENTICATED'
        : res.status === 403 ? 'FORBIDDEN'
        : res.status === 404 ? 'NOT_FOUND'
        : res.status === 422 ? 'VALIDATION_FAILED'
        : res.status === 501 ? 'NOT_IMPLEMENTED'
        : res.status === 503 ? 'PROVIDER_UNAVAILABLE'
        : 'INTERNAL_ERROR';
      return new ApiRequestError({ status: res.status, code, message: `Request failed with status ${res.status}` });
    }
    return new ApiRequestError({ status: 0, code: 'NETWORK_ERROR', message: 'Could not reach the LectureLens server.' });
  }
  return new ApiRequestError({
    status: 0,
    code: 'INTERNAL_ERROR',
    message: err instanceof Error ? err.message : 'Unexpected error',
  });
}

/** Session ended: drop the token and tell AuthContext. Used by the HTTP interceptor and the mock adapters. */
export function signalUnauthorised(requestId: string | null = null): void {
  clearToken();
  window.dispatchEvent(new CustomEvent(UNAUTHORISED_EVENT, { detail: { requestId } }));
}

export const apiClient = axios.create({ baseURL: API_BASE_URL, timeout: 30_000 });

apiClient.interceptors.request.use((config) => {
  const token = readToken();
  if (token && !config.headers.has('Authorization')) config.headers.set('Authorization', `Bearer ${token}`);
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (err: AxiosError) => {
    const error = normaliseError(err);
    // Only a request that carried a token means "your session ended"; a failed login is just a 401.
    if (error.status === 401 && err.config?.headers?.has('Authorization')) signalUnauthorised(error.requestId);
    return Promise.reject(error);
  },
);
