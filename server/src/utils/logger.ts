import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Tiny structured logger: one JSON object per line on stdout (info/debug) or
 * stderr (warn/error). Any field whose key matches SENSITIVE_KEY is redacted at
 * every depth. Level: LOG_LEVEL (debug|info|warn|error|silent) if set; otherwise debug in
 * development, silent under tests (NODE_ENV=test), info elsewhere.
 *
 * Reads process.env.NODE_ENV directly (not config/env) so it can be used while the
 * environment itself is being validated.
 */

type Level = 'debug' | 'info' | 'warn' | 'error';
const LEVELS = ['debug', 'info', 'warn', 'error', 'silent'] as const;

function threshold(): number {
  const configured = LEVELS.indexOf(process.env.LOG_LEVEL as (typeof LEVELS)[number]);
  if (configured >= 0) return configured;
  if (process.env.NODE_ENV === 'development') return 0;
  return process.env.NODE_ENV === 'test' ? LEVELS.indexOf('silent') : LEVELS.indexOf('info');
}
export type LogFields = Record<string, unknown>;

const SENSITIVE_KEY = /password|token|secret|key|authorization/i;
const REDACTED = '[REDACTED]';
const MAX_DEPTH = 6;

/** Per-request context; the requestId middleware runs each request inside it. */
export const requestContext = new AsyncLocalStorage<{ requestId: string }>();

function sanitize(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';
  if (depth >= MAX_DEPTH) return '[Truncated]';
  seen.add(value);
  if (Array.isArray(value)) return value.map((v) => sanitize(v, depth + 1, seen));
  const out: LogFields = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = SENSITIVE_KEY.test(k) ? REDACTED : sanitize(v, depth + 1, seen);
  }
  return out;
}

/** Exported for tests: the redaction applied to every log line's fields. */
export function redact(fields: LogFields): LogFields {
  return sanitize(fields, 0, new WeakSet()) as LogFields;
}

function write(level: Level, message: string, fields: LogFields = {}): void {
  if (LEVELS.indexOf(level) < threshold()) return;
  const requestId = requestContext.getStore()?.requestId;
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(requestId ? { requestId } : {}),
    ...redact(fields),
  });
  (level === 'warn' || level === 'error' ? process.stderr : process.stdout).write(`${line}\n`);
}

export const logger = {
  debug: (message: string, fields?: LogFields) => write('debug', message, fields),
  info: (message: string, fields?: LogFields) => write('info', message, fields),
  warn: (message: string, fields?: LogFields) => write('warn', message, fields),
  error: (message: string, fields?: LogFields) => write('error', message, fields),
};
