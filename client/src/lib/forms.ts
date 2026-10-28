import type { ZodError } from 'zod';

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

/** First zod issue message per top-level field. */
export function zodFieldErrors<K extends string>(error: ZodError): FieldErrors<K> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? '');
    if (key && !(key in out)) out[key] = issue.message;
  }
  return out as FieldErrors<K>;
}

/** Pick the server's VALIDATION_FAILED field map (§3.1) entries that belong to this form's fields. */
export function apiFieldErrors<K extends string>(details: Record<string, unknown>, fields: readonly K[]): FieldErrors<K> {
  const out: FieldErrors<K> = {};
  for (const [path, message] of Object.entries(details)) {
    const key = path.split('.')[0] as K;
    if (fields.includes(key) && typeof message === 'string' && !out[key]) out[key] = message;
  }
  return out;
}

/** The first field, in form order, that has an error. */
export function firstErrorField<K extends string>(errors: FieldErrors<K>, order: readonly K[]): K | undefined {
  return order.find((k) => errors[k]);
}
