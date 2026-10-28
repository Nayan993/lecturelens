import { createHmac, timingSafeEqual } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import type { Response } from 'express';
import { env, storageRoot } from '../../config/env.js';
import { notFound, unauthenticated } from '../../utils/errors.js';

/**
 * Signed media URLs (CONTRACTS.md §5.3): `<video src>` cannot send an Authorization header,
 * so GET /lectures/:id returns a URL carrying an expiry and an HMAC instead.
 */

export const MEDIA_URL_TTL_SEC = 6 * 3600;

const signature = (lectureId: string, exp: number) =>
  createHmac('sha256', env.JWT_SECRET).update(`${lectureId}.${exp}`).digest('hex');

export function signedMediaUrl(lectureId: string, nowMs = Date.now()): string {
  const exp = Math.floor(nowMs / 1000) + MEDIA_URL_TTL_SEC;
  return `/api/v1/lectures/${lectureId}/media?exp=${exp}&sig=${signature(lectureId, exp)}`;
}

/** 401 unless `sig` is this lecture's signature for `exp` and `exp` is still in the future. */
export function checkMediaSignature(lectureId: string, exp: number, sig: string, nowMs = Date.now()): void {
  const expected = Buffer.from(signature(lectureId, exp), 'hex');
  const given = Buffer.from(sig, 'hex');
  const valid = given.length === expected.length && timingSafeEqual(given, expected);
  if (!valid) throw unauthenticated('This media link is invalid.');
  if (exp * 1000 <= nowMs) throw unauthenticated('This media link has expired. Reload the lecture.', { reason: 'expired' });
}

/** Absolute path of a stored media file; refuses anything outside STORAGE_DIR. */
export function storedPath(relativePath: string): string {
  const full = path.resolve(storageRoot, relativePath);
  if (!full.startsWith(storageRoot + path.sep)) throw notFound('Media file');
  return full;
}

/** Streams a file with single-range `Range` support (206); an unusable range gets the whole file. */
export async function streamMedia(res: Response, filePath: string, mimeType: string, range: string | undefined) {
  const info = await stat(filePath).catch(() => null);
  if (!info?.isFile()) throw notFound('Media file');
  const size = info.size;

  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  // The client app is on another origin; helmet's default same-origin CORP would block <video>.
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

  const match = range ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null;
  if (match && (match[1] || match[2]) && size > 0) {
    // "a-b", "a-" or the suffix form "-n" (last n bytes).
    const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
    const end = Math.min(match[1] && match[2] ? Number(match[2]) : size - 1, size - 1);
    if (start <= end) {
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
      res.setHeader('Content-Length', String(end - start + 1));
      createReadStream(filePath, { start, end }).pipe(res);
      return;
    }
  }
  res.setHeader('Content-Length', String(size));
  createReadStream(filePath).pipe(res);
}
