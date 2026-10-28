import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { requireRole } from '../../middleware/rbac.js';
import {
  discardUpload,
  mediaTypeFor,
  mediaUpload,
  safeOriginalName,
  sniffContainer,
  unsupportedMediaType,
  uploadIdOf,
} from '../../middleware/upload.js';
import { validate, zodDetails } from '../../middleware/validate.js';
import { Lecture } from '../../models/index.js';
import { notFound, unauthenticated, validationFailed } from '../../utils/errors.js';
import {
  listQuery,
  mediaQuery,
  objectIdString,
  reprocessBody,
  reprocessQuery,
  uploadFields,
  uploadFieldsInput,
} from './lectures.schemas.js';
import * as lectures from './lectures.service.js';
import { checkMediaSignature, signedMediaUrl, storedPath, streamMedia } from './media.js';
import { progressPct, stageViews } from './stages.js';

/** /lectures — CONTRACTS.md §5.3. Owner: D. Processing itself is Member A's pipeline. */

/** The signed-in user; requireAuth guarantees it on these routes. */
function viewerOf(req: { user?: lectures.Viewer }): lectures.Viewer {
  if (!req.user) throw unauthenticated();
  return req.user;
}

export const lecturesRouter = Router();

// A malformed id is reported exactly like an unknown one: 404 (§3.1), never 422 or 500.
lecturesRouter.param('id', (_req, _res, next, id: string) => {
  next(objectIdString.safeParse(id).success ? undefined : notFound('Lecture'));
});

/**
 * GET /lectures/:id/media — authorised by the signed URL from GET /lectures/:id, not a Bearer
 * token, because <video src> cannot send headers (§1.5). Supports Range → 206.
 */
lecturesRouter.get(
  '/:id/media',
  asyncHandler(async (req, res) => {
    // The client app is on another origin: every answer here, errors included, must be readable by
    // <video>, which helmet's default same-origin CORP would block (net::ERR_BLOCKED_BY_RESPONSE).
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    // A missing or malformed signature is an invalid link (401), not a validation error.
    const query = mediaQuery.safeParse(req.query);
    if (!query.success) throw unauthenticated('This media link is invalid.');
    checkMediaSignature(req.params.id!, query.data.exp, query.data.sig);
    const lecture = await Lecture.findById(req.params.id).select('mediaPath media');
    if (!lecture) throw notFound('Lecture');
    await streamMedia(res, storedPath(lecture.mediaPath), lecture.media.mimeType, req.get('range'));
  }),
);

lecturesRouter.use(requireAuth);

/** POST /lectures — teacher-only multipart upload with consent → 202 { lecture }. */
lecturesRouter.post(
  '/',
  requireRole('teacher'),
  mediaUpload(),
  asyncHandler(async (req, res) => {
    const uploadId = uploadIdOf(req);
    try {
      const details: Record<string, string> = {};
      const fields = uploadFields.safeParse(uploadFieldsInput(req.body as Record<string, unknown>));
      if (!fields.success) Object.assign(details, zodDetails(fields.error, 'body'));
      if (!req.file) details.file = 'Required';
      // The consent gate: nothing is kept, let alone processed, without all three consents.
      if (!fields.success || !req.file) throw validationFailed(details);

      const type = mediaTypeFor(req.file.originalname);
      if (!type || (await sniffContainer(req.file.path)) !== type.container) {
        throw unsupportedMediaType(req.file.mimetype ?? '');
      }

      const lecture = await lectures.create(
        {
          uploadId,
          fields: fields.data,
          file: {
            storedName: req.file.filename,
            originalFilename: safeOriginalName(req.file.originalname),
            mimeType: type.mimeType,
            sizeBytes: req.file.size,
          },
        },
        viewerOf(req),
      );
      res.status(202).json({ lecture: await lectures.presentOne(lecture, viewerOf(req)) });
    } catch (err) {
      await discardUpload(uploadId);
      throw err;
    }
  }),
);

/** GET /lectures — paginated; teachers see their own, students ready + transcript-approved. */
lecturesRouter.get(
  '/',
  validate({ query: listQuery }),
  asyncHandler(async (req, res) => {
    res.json(await lectures.list(listQuery.parse(req.query), viewerOf(req)));
  }),
);

/** GET /lectures/:id → { lecture, mediaUrl }; 404 if not visible to the caller. */
lecturesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const viewer = viewerOf(req);
    const lecture = await lectures.findVisible(req.params.id!, viewer);
    res.json({ lecture: await lectures.presentOne(lecture, viewer), mediaUrl: signedMediaUrl(lecture.id) });
  }),
);

/** GET /lectures/:id/status — owner only (§6.2), plus progressPct. */
lecturesRouter.get(
  '/:id/status',
  requireRole('teacher'),
  asyncHandler(async (req, res) => {
    const lecture = await lectures.findOwned(req.params.id!, viewerOf(req));
    res.json({
      lectureId: lecture.id,
      status: lecture.status,
      statusDetail: lecture.statusDetail,
      error: lecture.error ? lecture.toJSON().error : null,
      durationSec: lecture.durationSec,
      progressPct: progressPct(lecture),
      stages: stageViews(lecture),
      updatedAt: lecture.updatedAt,
    });
  }),
);

/** POST /lectures/:id/reprocess — owner only; fromStage in the body or query. → 202 { lecture } */
lecturesRouter.post(
  '/:id/reprocess',
  requireRole('teacher'),
  validate({ body: reprocessBody, query: reprocessQuery }),
  asyncHandler(async (req, res) => {
    const fromBody = reprocessBody.parse(req.body ?? {}).fromStage;
    const fromQuery = reprocessQuery.parse(req.query).fromStage;
    if (fromBody && fromQuery && fromBody !== fromQuery) {
      throw validationFailed({ fromStage: 'Body and query disagree' });
    }
    const viewer = viewerOf(req);
    const lecture = await lectures.reprocess(req.params.id!, fromBody ?? fromQuery ?? 'extracting', viewer);
    res.status(202).json({ lecture: await lectures.presentOne(lecture, viewer) });
  }),
);

/** DELETE /lectures/:id — owner only; cascades to derived data and media files → 204. */
lecturesRouter.delete(
  '/:id',
  requireRole('teacher'),
  asyncHandler(async (req, res) => {
    await lectures.remove(req.params.id!, viewerOf(req));
    res.status(204).end();
  }),
);
