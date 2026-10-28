/** Error envelope — docs/CONTRACTS.md §3. */

/** Reserved (§3.1) and additional (§3.2) codes. */
export type ContractErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_FAILED'
  | 'NOT_IMPLEMENTED'
  | 'PROVIDER_UNAVAILABLE'
  | 'INTERNAL_ERROR'
  | 'CONFLICT'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE';

/** Client-only code for requests that never got an HTTP response (offline, DNS, CORS, timeout). */
export type ClientErrorCode = 'NETWORK_ERROR';

export type ApiErrorCode = ContractErrorCode | ClientErrorCode;

/** Body of every non-2xx response. */
export interface ApiErrorBody {
  error: {
    code: ContractErrorCode;
    message: string;
    /** Always an object; for VALIDATION_FAILED a field → message map. */
    details: Record<string, unknown>;
    requestId: string;
  };
}

/** A failed API call as seen by the UI, normalised by lib/apiClient.ts. `status` is 0 for NETWORK_ERROR. */
export interface ApiError {
  code: ApiErrorCode;
  message: string;
  details: Record<string, unknown>;
  requestId: string | null;
  status: number;
}

/** `details` of a 501 NOT_IMPLEMENTED (§7). */
export interface NotImplementedDetails {
  owner: 'A' | 'B' | 'C' | 'D';
  prompt: string;
}
