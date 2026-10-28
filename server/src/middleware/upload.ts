import { randomUUID } from 'node:crypto';
import { mkdir, open, rm } from 'node:fs/promises';
import path from 'node:path';
import type { Request, RequestHandler } from 'express';
import multer from 'multer';
import { Types } from 'mongoose';
import { env, storageRoot } from '../config/env.js';
import { AppError, ERROR_STATUS, validationFailed } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

/**
 * Lecture media upload (CONTRACTS.md §5.3): one `file` part, stored by multer's diskStorage at
 * STORAGE_DIR/<uploadId>/<uuid><ext>. `uploadId` is a fresh ObjectId that becomes the
 * lecture's _id. The client's filename is never used as a path.
 *
 * Accepted by extension AND content sniffing (magic bytes), not by the declared MIME type
 * alone — browsers often send an empty or generic type (notably for .mkv). A declared type
 * must be generic or one of the accepted media types.
 */

type Container = 'isobmff' | 'ebml' | 'mp3' | 'wav';

export const MEDIA_TYPES: Readonly<Record<string, { mimeType: string; aliases: string[]; container: Container }>> = {
  '.mp4': { mimeType: 'video/mp4', aliases: [], container: 'isobmff' },
  '.mkv': { mimeType: 'video/x-matroska', aliases: ['video/matroska'], container: 'ebml' },
  '.mov': { mimeType: 'video/quicktime', aliases: [], container: 'isobmff' },
  '.webm': { mimeType: 'video/webm', aliases: ['audio/webm'], container: 'ebml' },
  '.mp3': { mimeType: 'audio/mpeg', aliases: ['audio/mp3'], container: 'mp3' },
  '.wav': { mimeType: 'audio/wav', aliases: ['audio/x-wav', 'audio/wave'], container: 'wav' },
  '.m4a': { mimeType: 'audio/mp4', aliases: ['audio/x-m4a'], container: 'isobmff' },
};

export const ACCEPTED_EXTENSIONS = Object.keys(MEDIA_TYPES);
const ACCEPTED_MIME_TYPES = new Set(Object.values(MEDIA_TYPES).flatMap((t) => [t.mimeType, ...t.aliases]));
const GENERIC_MIME_TYPES = new Set(['', 'application/octet-stream', 'binary/octet-stream']);

export function unsupportedMediaType(mimeType: string): AppError {
  return new AppError(
    'UNSUPPORTED_MEDIA_TYPE',
    `Unsupported file type. Upload one of: ${ACCEPTED_EXTENSIONS.join(', ')}.`,
    ERROR_STATUS.UNSUPPORTED_MEDIA_TYPE,
    { mimeType },
  );
}

/** Lower-cased extension of the client's filename, ignoring any directory components. */
function extensionOf(originalName: string): string {
  return path.extname(path.basename(originalName.replace(/\\/g, '/'))).toLowerCase();
}

/** The client's filename as display metadata only: no directories or control characters. */
export function safeOriginalName(originalName: string): string {
  const base = path.basename(originalName.replace(/\\/g, '/')).replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return (base || 'upload').slice(0, 255);
}

export function mediaTypeFor(originalName: string) {
  return MEDIA_TYPES[extensionOf(originalName)];
}

/* ------------------------------------------------------------------ storage ---- */

const uploadIds = new WeakMap<Request, string>();

/** The id (= future lecture _id) under which this request's file is stored. */
export function uploadIdOf(req: Request): string {
  let id = uploadIds.get(req);
  if (!id) {
    id = new Types.ObjectId().toString();
    uploadIds.set(req, id);
  }
  return id;
}

export const uploadDirOf = (uploadId: string) => path.join(storageRoot, uploadId);

/** Removes everything stored for this upload; never throws. */
export async function discardUpload(uploadId: string): Promise<void> {
  try {
    await rm(uploadDirOf(uploadId), { recursive: true, force: true });
  } catch (err) {
    logger.error('Could not remove an upload directory', { uploadId, error: err });
  }
}

const storage = multer.diskStorage({
  destination(req, _file, cb) {
    const dir = uploadDirOf(uploadIdOf(req));
    mkdir(dir, { recursive: true }).then(
      () => cb(null, dir),
      (err: Error) => cb(err, dir),
    );
  },
  filename(_req, file, cb) {
    // Our own name: a uuid plus the (already whitelisted) extension.
    cb(null, `${randomUUID()}${extensionOf(file.originalname)}`);
  },
});

const fileFilter: multer.Options['fileFilter'] = (req, file, cb) => {
  // Consent fields sent before the file part are already parsed: refuse early, write nothing.
  const body = req.body as Record<string, unknown> | undefined;
  if (body?.lecturerConsent !== undefined && body.lecturerConsent !== 'true') {
    return cb(validationFailed({ 'consent.lecturerConsent': 'Lecturer consent is required' }));
  }
  const declared = (file.mimetype ?? '').toLowerCase();
  if (!mediaTypeFor(file.originalname) || !(GENERIC_MIME_TYPES.has(declared) || ACCEPTED_MIME_TYPES.has(declared))) {
    return cb(unsupportedMediaType(declared));
  }
  cb(null, true);
};

/* ----------------------------------------------------------------- sniffing ---- */

const ISOBMFF_BOXES = new Set(['ftyp', 'moov', 'mdat', 'free', 'wide', 'skip', 'pnot']);

/** Identifies the container from the first bytes of the file, or null if unrecognised. */
export async function sniffContainer(filePath: string): Promise<Container | null> {
  const handle = await open(filePath, 'r');
  try {
    const head = Buffer.alloc(12);
    const { bytesRead } = await handle.read(head, 0, 12, 0);
    const b = head.subarray(0, bytesRead);
    if (b.length >= 4 && b.readUInt32BE(0) === 0x1a45dfa3) return 'ebml';
    if (b.length >= 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WAVE') return 'wav';
    if (b.length >= 8 && ISOBMFF_BOXES.has(b.toString('latin1', 4, 8))) return 'isobmff';
    if (b.length >= 3 && b.toString('latin1', 0, 3) === 'ID3') return 'mp3';
    if (b.length >= 2 && b[0] === 0xff && ((b[1] ?? 0) & 0xe0) === 0xe0) return 'mp3';
    return null;
  } finally {
    await handle.close();
  }
}

/* --------------------------------------------------------------- middleware ---- */

/** Multer / busboy failures → the standard envelope. */
function translate(err: unknown, maxMb: number): unknown {
  if (err instanceof AppError) return err;
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return new AppError('PAYLOAD_TOO_LARGE', `The file is larger than the ${maxMb} MB limit.`, ERROR_STATUS.PAYLOAD_TOO_LARGE, {
        maxMb,
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return validationFailed({ [err.field ?? 'file']: 'Send exactly one file, in the "file" field' });
    }
    return validationFailed({ body: err.message });
  }
  // Busboy parse errors have no code; filesystem errors (ENOSPC, EACCES…) do and stay 500s.
  if (err instanceof Error && !('code' in err)) return validationFailed({ body: 'Malformed multipart body' });
  return err;
}

/**
 * Parses a multipart lecture upload into req.file / req.body. On any failure the upload's
 * directory is removed before the error reaches the error middleware.
 */
export function mediaUpload({ maxMb = env.MAX_UPLOAD_MB }: { maxMb?: number } = {}): RequestHandler {
  const single = multer({
    storage,
    fileFilter,
    limits: { fileSize: maxMb * 1024 * 1024, files: 1, fields: 20, fieldSize: 64 * 1024, parts: 25 },
  }).single('file');

  return (req, res, next) => {
    single(req, res, (err: unknown) => {
      if (!err) return next();
      void discardUpload(uploadIdOf(req)).then(() => next(translate(err, maxMb)));
    });
  };
}
