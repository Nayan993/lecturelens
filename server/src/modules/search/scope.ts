import { Lecture } from '../../models/index.js';
import type { ScopedLecture } from '../../services/retrieval/index.js';
import { notFound } from '../../utils/errors.js';
import { visibleTo, type Viewer } from '../lectures/lectures.service.js';

/**
 * The lectures a caller may retrieve from — the same visibility rule as reading a lecture
 * (CONTRACTS.md §1.5, §1.6), applied in the MongoDB query: students only `ready` lectures whose
 * transcript is approved; teachers their own lectures. Used by POST /search and POST /ask.
 * A named lecture the caller cannot see is a 404 (existence is not revealed).
 */
export async function retrievalScope(viewer: Viewer, lectureId?: string): Promise<ScopedLecture[]> {
  const lectures = await Lecture.find({ ...visibleTo(viewer), ...(lectureId ? { _id: lectureId } : {}) })
    .select('_id title')
    .lean()
    .exec();
  if (lectureId && lectures.length === 0) throw notFound('Lecture');
  return lectures.map((lecture) => ({ id: String(lecture._id), title: lecture.title }));
}
