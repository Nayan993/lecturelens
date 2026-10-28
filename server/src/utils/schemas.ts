import { z } from 'zod';

/** Zod building blocks shared by every module's validation (CONTRACTS.md §1.4). */

/** A 24-hex-char ObjectId string. */
export const objectIdString = z.string().regex(/^[0-9a-f]{24}$/i, 'Must be a 24-character hex id');

/** An integer query parameter in [min, max], defaulting when absent. */
export const intInRange = (min: number, max: number, fallback: number) =>
  z.preprocess(
    (v) => (v === undefined || v === '' ? fallback : Number(v)),
    z
      .number({ invalid_type_error: `Must be an integer ${min}–${max}` })
      .int(`Must be an integer ${min}–${max}`)
      .min(min, `Must be an integer ${min}–${max}`)
      .max(max, `Must be an integer ${min}–${max}`),
  );

/** `?page&limit` — defaults 1 and 20, limit ≤ 100; out of range → 422 (§1.4). */
export const paging = {
  page: intInRange(1, Number.MAX_SAFE_INTEGER, 1),
  limit: intInRange(1, 100, 20),
};

/** For routes that take no body: `{}` (or no body at all) only. */
export const emptyBody = z.object({}).strict('This endpoint takes no request body');
