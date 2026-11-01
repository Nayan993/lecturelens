import request from 'supertest';
import type { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Real retrieval code end to end; only the embedding MODEL is a deterministic fake (no download).
vi.mock('@xenova/transformers', async () => (await import('./fakeEmbeddings.js')).fakeTransformers);

import { Chunk, Lecture, initialStages, type ILecture } from '../src/models/index.js';
import { embedLecture } from '../src/services/embeddings/index.js';
import { authHeader, buildApp, makeStudent, makeTeacher, resetDb } from './setup.js';

const app = await buildApp();

const PASSAGES = [
  { startSec: 0, endSec: 60.5, text: 'Today we recap the loss function and why training means minimising it over the parameters.' },
  { startSec: 45.25, endSec: 120.75, text: 'A learning rate that is too large makes the loss diverge and blow up to NaN within a few steps.' },
  { startSec: 105.125, endSec: 180, text: 'Backpropagation applies the chain rule on a computational graph to compute every gradient.' },
];

async function createLecture(ownerId: Types.ObjectId, overrides: Partial<ILecture> = {}, passages = PASSAGES, index = true) {
  const lecture = await Lecture.create({
    title: 'Lecture 7 — Gradient Descent',
    uploadedBy: ownerId,
    consent: { lecturerConsent: true, purposeShown: true, processorNamed: true, grantedBy: ownerId, grantedAt: new Date() },
    status: 'ready',
    statusDetail: 'Ready.',
    stages: initialStages().map((stage) => ({ ...stage, state: 'done', ms: 1000 })),
    mediaPath: 'placeholder/lecture.mp3',
    media: { originalFilename: 'lecture.mp3', mimeType: 'audio/mpeg', sizeBytes: 2048 },
    transcriptApproved: true,
    durationSec: 180,
    ...overrides,
  });
  await Chunk.insertMany(
    passages.map((p, index) => ({
      lectureId: lecture._id, index, ...p, segmentStart: index, segmentEnd: index, embeddingModel: 'Xenova/all-MiniLM-L6-v2',
    })),
  );
  if (index) await embedLecture(String(lecture._id)); // the real indexing code, on the fake model
  return lecture;
}

const search = (user: Parameters<typeof authHeader>[0] | null, body: object) => {
  const req = request(app).post('/api/v1/search');
  return (user ? req.set(authHeader(user)) : req).send(body);
};

beforeEach(async () => {
  await resetDb();
});

describe('POST /api/v1/search', () => {
  it('requires authentication', async () => {
    const res = await search(null, { query: 'learning rate' }).expect(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it.each([
    [{ query: '' }],
    [{ query: '   ' }],
    [{ query: 'learning rate', topK: 0 }],
    [{ query: 'learning rate', topK: 21 }],
    [{ query: 'learning rate', topK: 1.5 }],
    [{ query: 'learning rate', retriever: 'magic' }],
    [{ query: 'learning rate', unexpected: true }],
  ])('rejects invalid search input: %o', async (body) => {
    const res = await search(await makeStudent(), body).expect(422);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('returns an empty list when no lectures are visible', async () => {
    const res = await search(await makeStudent(), { query: 'learning rate' }).expect(200);
    expect(res.body).toMatchObject({ query: 'learning rate', retriever: 'hybrid', items: [] });
    expect(res.body.tookMs).toEqual(expect.any(Number));
  });

  it.each(['keyword', 'vector', 'hybrid'] as const)('%s: contract-shaped passages (§6.7), ranked, the relevant chunk first', async (retriever) => {
    const lecture = await createLecture((await makeTeacher())._id);
    const res = await search(await makeStudent(), {
      query: 'what happens when the learning rate is too large', lectureId: String(lecture._id), retriever, topK: 5,
    }).expect(200);

    expect(res.body).toMatchObject({ query: 'what happens when the learning rate is too large', retriever });
    const items = res.body.items as Array<Record<string, unknown>>;
    expect(items.length).toBeGreaterThan(0);
    expect(Object.keys(items[0]!).sort()).toEqual(
      ['chunkId', 'deepLink', 'endSec', 'lectureId', 'lectureTitle', 'rank', 'retriever', 'score', 'startSec', 'text'].sort(),
    );
    expect(items[0]).toMatchObject({ lectureId: String(lecture._id), lectureTitle: lecture.title, startSec: 45.25, retriever, rank: 1 });
    expect(items.map((i) => i.rank)).toEqual(items.map((_, i) => i + 1));
    const scores = items.map((i) => i.score as number);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('every deepLink is server-built and carries its own passage startSec', async () => {
    const lecture = await createLecture((await makeTeacher())._id);
    const res = await search(await makeStudent(), { query: 'loss learning rate gradient', retriever: 'hybrid', topK: 10 }).expect(200);
    expect(res.body.items.length).toBe(PASSAGES.length);
    for (const item of res.body.items) {
      expect(item.deepLink).toBe(`/lectures/${lecture._id}/play?t=${item.startSec}`);
    }
  });

  it('defaults retriever to hybrid and topK to 5', async () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ startSec: i * 10, endSec: i * 10 + 10, text: `gradient step number ${i}` }));
    const lecture = await createLecture((await makeTeacher())._id, {}, many);
    const res = await search(await makeStudent(), { query: 'gradient step', lectureId: String(lecture._id) }).expect(200);
    expect(res.body.retriever).toBe('hybrid');
    expect(res.body.items).toHaveLength(5);
  });

  it('a student only ever gets passages from ready lectures with an approved transcript', async () => {
    const teacher = await makeTeacher();
    const visible = await createLecture(teacher._id);
    const unapproved = await createLecture(teacher._id, { title: 'Not approved', transcriptApproved: false });
    const processing = await createLecture(teacher._id, { title: 'Still processing', status: 'transcribing', transcriptApproved: false });

    for (const retriever of ['keyword', 'vector', 'hybrid'] as const) {
      const res = await search(await makeStudent(), { query: 'learning rate loss diverge', retriever, topK: 20 }).expect(200);
      const lectureIds = new Set(res.body.items.map((i: { lectureId: string }) => i.lectureId));
      expect([...lectureIds]).toEqual([String(visible._id)]);
      expect(lectureIds.has(String(unapproved._id)) || lectureIds.has(String(processing._id))).toBe(false);
    }
  });

  it('a teacher searches their own lectures (approved or not), never another teacher\'s', async () => {
    const teacher = await makeTeacher();
    const other = await makeTeacher();
    const own = await createLecture(teacher._id, { transcriptApproved: false });
    const others = await createLecture(other._id);

    const res = await search(teacher, { query: 'learning rate', topK: 20 }).expect(200);
    expect(new Set(res.body.items.map((i: { lectureId: string }) => i.lectureId))).toEqual(new Set([String(own._id)]));
    const named = await search(teacher, { query: 'learning rate', lectureId: String(others._id) }).expect(404);
    expect(named.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 404 for a lecture that is not visible to the student, and for a nonexistent id', async () => {
    const unapproved = await createLecture((await makeTeacher())._id, { transcriptApproved: false });
    const student = await makeStudent();
    await search(student, { query: 'learning rate', lectureId: String(unapproved._id) }).expect(404);
    await search(student, { query: 'learning rate', lectureId: '6650c3a0c3b2e41d8a100001' }).expect(404);
  });

  it('re-indexing invalidates the vector cache: new embeddings are searched at once', async () => {
    const lecture = await createLecture((await makeTeacher())._id);
    const student = await makeStudent();
    const before = await search(student, { query: 'attention transformers', retriever: 'vector', topK: 1 }).expect(200);
    expect(before.body.items[0].text).not.toMatch(/attention/);

    // Re-chunk + re-index (what a reprocess does): the cached vectors must not be served.
    await Chunk.deleteMany({ lectureId: lecture._id });
    await Chunk.create({
      lectureId: lecture._id, index: 0, startSec: 0, endSec: 30, segmentStart: 0, segmentEnd: 0,
      text: 'Attention lets transformers weigh every token.', embeddingModel: 'Xenova/all-MiniLM-L6-v2',
    });
    await embedLecture(String(lecture._id));
    const after = await search(student, { query: 'attention transformers', retriever: 'vector', topK: 1 }).expect(200);
    expect(after.body.items[0].text).toMatch(/Attention lets transformers/);
  });

  it('a lecture whose chunks were never indexed (processed before the indexing stage, or seeded) is indexed on first search', async () => {
    // Regression (real data): such a lecture had 0 vectors, so vector search returned nothing and
    // /ask always abstained with topSimilarity null and an RRF topScore of exactly 1/61.
    const lecture = await createLecture((await makeTeacher())._id, {}, PASSAGES, false);
    expect(await Chunk.countDocuments({ lectureId: lecture._id, embedding: { $size: 384 } })).toBe(0);

    const res = await search(await makeStudent(), { query: 'learning rate too large diverge', retriever: 'vector', topK: 3 }).expect(200);
    expect(res.body.items.length).toBe(3);
    expect(res.body.items[0]).toMatchObject({ startSec: 45.25, retriever: 'vector' });
    expect(await Chunk.countDocuments({ lectureId: lecture._id, embedding: { $size: 384 } })).toBe(PASSAGES.length);
  });
});
