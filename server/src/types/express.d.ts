// Augments Express.Request for the whole server.
export {};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** "req_" + nanoid; set by middleware/requestId.ts, echoed in X-Request-Id. */
      id: string;
      /** Set by the auth middleware once a valid JWT is verified. */
      user?: { id: string; role: 'student' | 'teacher' };
    }
  }
}
