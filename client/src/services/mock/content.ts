/** Mock transcript, topics and summaries. Only Lecture 7 (…100001) has fixtures. */
import type { Id, RejectPayload, Summary, TopicSection } from '../../types';
import { REJECTION_REASONS } from '../../types';
import type { SummaryService, TopicService, TranscriptService } from '../types';
import { approvedFor, clone, db, delay, fail, nowIso, ownedLecture, requireUser, visibleLecture } from './db';

function hasFixtures(lectureId: Id): boolean {
  return db.segments.some((s) => s.lectureId === lectureId);
}

function noFixture(): never {
  return fail(404, 'NOT_FOUND', 'Mock data only includes content for “Lecture 7 — Gradient Descent and Backpropagation”.');
}

function validateReject(payload: RejectPayload): void {
  if (!REJECTION_REASONS.includes(payload.rejectionReason)) {
    fail(422, 'VALIDATION_FAILED', 'Request body is invalid.', { rejectionReason: 'Must be a rejection reason' });
  }
}

/** Find a topic/summary by id that the user may review (owner teacher). */
function reviewable<T extends { id: Id; lectureId: Id }>(items: T[], id: Id, what: string): T {
  const user = requireUser();
  const item = items.find((i) => i.id === id);
  if (!item) fail(404, 'NOT_FOUND', `${what} not found.`);
  ownedLecture(user, item.lectureId);
  return item;
}

function markReviewed(item: TopicSection | Summary, status: 'approved' | 'rejected', payload?: RejectPayload) {
  const user = requireUser();
  item.status = status;
  item.rejectionReason = status === 'rejected' ? payload!.rejectionReason : null;
  if ('reviewNote' in item) item.reviewNote = payload?.reviewNote ?? (status === 'approved' ? item.reviewNote : null);
  item.reviewedBy = user.id;
  item.reviewedAt = nowIso();
  if ('updatedAt' in item) item.updatedAt = item.reviewedAt;
}

export const mockTranscriptService: TranscriptService = {
  async get(lectureId) {
    await delay();
    const user = requireUser();
    const lecture = visibleLecture(user, lectureId);
    if (user.role === 'student' && !lecture.transcriptApproved) {
      fail(403, 'FORBIDDEN', 'The teacher has not approved this transcript yet.', { reason: 'TRANSCRIPT_NOT_APPROVED' });
    }
    if (!hasFixtures(lectureId)) noFixture();
    return {
      lectureId,
      transcriptApproved: lecture.transcriptApproved,
      items: clone(db.segments.filter((s) => s.lectureId === lectureId).sort((a, b) => a.index - b.index)),
    };
  },

  async updateSegment(lectureId, index, text) {
    await delay();
    const user = requireUser();
    ownedLecture(user, lectureId);
    const segment = db.segments.find((s) => s.lectureId === lectureId && s.index === index);
    if (!segment) fail(404, 'NOT_FOUND', 'Segment not found.');
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > 2000) fail(422, 'VALIDATION_FAILED', 'Request body is invalid.', { text: 'Must be 1–2000 characters' });
    if (!segment.corrected) segment.originalText = segment.text; // audit trail: set once, never overwritten
    segment.text = trimmed;
    segment.corrected = true;
    segment.correctedBy = user.id;
    segment.correctedAt = nowIso();
    return clone(segment);
  },

  async approve(lectureId) {
    await delay();
    const user = requireUser();
    const lecture = ownedLecture(user, lectureId);
    if (lecture.status !== 'ready') fail(409, 'CONFLICT', 'The lecture must finish processing first.', { status: lecture.status });
    lecture.transcriptApproved = true;
    lecture.transcriptApprovedBy ??= user.id;
    lecture.transcriptApprovedAt ??= nowIso();
    lecture.updatedAt = nowIso();
    return clone(lecture);
  },
};

export const mockTopicService: TopicService = {
  async list(lectureId) {
    await delay();
    const user = requireUser();
    visibleLecture(user, lectureId);
    if (!hasFixtures(lectureId)) noFixture();
    const items = approvedFor(user, db.topics.filter((t) => t.lectureId === lectureId)).sort((a, b) => a.index - b.index);
    return { lectureId, items: clone(items) };
  },

  async update(id, { label, keywords }) {
    await delay();
    const topic = reviewable(db.topics, id, 'Topic');
    const details: Record<string, string> = {};
    if (label !== undefined && (!label.trim() || label.trim().length > 80)) details.label = 'Must be 1–80 characters';
    if (keywords !== undefined && (keywords.length < 3 || keywords.length > 8)) details.keywords = 'Give 3–8 keywords';
    if (Object.keys(details).length) fail(422, 'VALIDATION_FAILED', 'Request body is invalid.', details);
    if (label !== undefined) topic.label = label.trim();
    if (keywords !== undefined) topic.keywords = keywords.map((k) => k.trim());
    return clone(topic);
  },

  async approve(id) {
    await delay();
    const topic = reviewable(db.topics, id, 'Topic');
    markReviewed(topic, 'approved');
    return clone(topic);
  },

  async reject(id, payload) {
    await delay();
    validateReject(payload);
    const topic = reviewable(db.topics, id, 'Topic');
    markReviewed(topic, 'rejected', payload);
    return clone(topic);
  },
};

export const mockSummaryService: SummaryService = {
  async list(lectureId) {
    await delay();
    const user = requireUser();
    visibleLecture(user, lectureId);
    if (!hasFixtures(lectureId)) noFixture();
    const order = new Map(db.topics.map((t) => [t.id, t.index]));
    const items = approvedFor(user, db.summaries.filter((s) => s.lectureId === lectureId)).sort(
      (a, b) => (order.get(a.topicId) ?? 0) - (order.get(b.topicId) ?? 0),
    );
    return { lectureId, items: clone(items) };
  },

  async update(id, { title, text, keyPoints }) {
    await delay();
    const summary = reviewable(db.summaries, id, 'Summary');
    if (title !== undefined) summary.title = title.trim();
    if (text !== undefined) summary.text = text.trim();
    if (keyPoints !== undefined) summary.keyPoints = keyPoints;
    summary.updatedAt = nowIso();
    return clone(summary);
  },

  async approve(id) {
    await delay();
    const summary = reviewable(db.summaries, id, 'Summary');
    markReviewed(summary, 'approved');
    return clone(summary);
  },

  async reject(id, payload) {
    await delay();
    validateReject(payload);
    const summary = reviewable(db.summaries, id, 'Summary');
    markReviewed(summary, 'rejected', payload);
    return clone(summary);
  },
};
