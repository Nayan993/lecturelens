import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Types } from 'mongoose';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { DEMO_USERS, buildSeed, type SeedCollection } from '../src/db/seedData.js';
import {
  Attempt,
  Chunk,
  Lecture,
  LlmCache,
  Question,
  Quiz,
  RevisionRecommendation,
  Summary,
  TopicSection,
  TranscriptSegment,
  User,
} from '../src/models/index.js';

const mocksDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../mocks');
const fixture = (file: string) => JSON.parse(readFileSync(path.join(mocksDir, file), 'utf8'));
const json = (value: unknown) => JSON.parse(JSON.stringify(value));
const omit = (obj: Record<string, unknown>, keys: string[]) =>
  Object.fromEntries(Object.entries(obj).filter(([k]) => !keys.includes(k)));

let seed: SeedCollection[];
const seeded = (modelName: string) => seed.find((c) => c.model.modelName === modelName)!.docs;

beforeAll(async () => {
  seed = await buildSeed({ bcryptCost: 4 });
});

afterEach(() => vi.restoreAllMocks());

describe('seed documents', () => {
  it('all pass model validation', async () => {
    for (const { docs } of seed) for (const doc of docs) await expect(doc.validate()).resolves.toBeUndefined();
  });

  it('inserts 3 users, 6 lectures, 45 segments, 15 chunks, 5 topics, 5 summaries, 8 questions, 1 quiz, 2 attempts', () => {
    expect(Object.fromEntries(seed.map((c) => [c.model.collection.collectionName, c.docs.length]))).toEqual({
      users: 3,
      lectures: 6,
      transcriptsegments: 45,
      chunks: 15,
      topicsections: 5,
      summaries: 5,
      questions: 8,
      quizzes: 1,
      attempts: 2,
    });
  });

  it.each([
    ['TopicSection', 'topics.json', ['createdAt', 'updatedAt']],
    ['Summary', 'summaries.json', []],
    ['Question', 'questions.json', []],
    ['TranscriptSegment', 'transcript.json', ['createdAt', 'updatedAt']],
    ['Chunk', 'chunks.json', ['createdAt', 'updatedAt']],
  ])('%s serialises exactly like mocks/%s', (modelName, file, notInFixture) => {
    const out = seeded(modelName).map((d) => omit(json(d), notInFixture));
    expect(out).toEqual(fixture(file).items);
  });

  it('lectures serialise like mocks/lectures.json minus the computed list fields', () => {
    const out = seeded('Lecture').map((d) => json(d));
    const expected = fixture('lectures.json').items.map((l: Record<string, unknown>) =>
      omit(l, ['uploadedByName', 'topicCount']),
    );
    // transcriptApprovedBy/At are contract fields (§4.2) the client fixture does not carry.
    expect(out.map((l: Record<string, unknown>) => omit(l, ['transcriptApprovedBy', 'transcriptApprovedAt']))).toEqual(
      expected,
    );
  });

  it('scores attempts from the fixture answer keys', () => {
    const [first, second] = seeded('Attempt').map((d) => json(d));
    expect(first.score).toEqual({ correct: 3, total: 5, accuracy: 0.6 });
    expect(second.score).toEqual({ correct: 4, total: 5, accuracy: 0.8 });
    expect(second.answers[4]).toMatchObject({ selectedOptionId: null, correct: false });
    expect(first.perTopic.map((t: { topicLabel: string }) => t.topicLabel)).toEqual([
      'Recap: training as minimising a loss over parameters',
      'Gradient descent and the learning rate',
      'Stochastic and mini-batch gradient descent',
      'Chain rule and computational graphs',
    ]);
    expect(first.timeTakenSec).toBe(397.512);
  });

  it('gives every document createdAt (and updatedAt, except immutable attempts)', () => {
    for (const { model, docs } of seed) {
      for (const doc of docs.map((d) => json(d))) {
        expect(doc.createdAt, model.modelName).toEqual(expect.any(String));
        if (model.modelName !== 'Attempt') expect(doc.updatedAt, model.modelName).toEqual(expect.any(String));
      }
    }
  });

  it('gives the demo users the §9 ids', () => {
    expect(seeded('User').map((u) => String(u._id))).toEqual(DEMO_USERS.map((u) => u.id));
  });
});

describe('toJSON', () => {
  it('exposes id as a string, never _id or __v, and flattens nested ObjectIds', () => {
    const out = json(seeded('Summary')[0]);
    expect(Object.keys(out)[0]).toBe('id');
    expect(out).not.toHaveProperty('_id');
    expect(out).not.toHaveProperty('__v');
    expect(typeof out.evidence[0].chunkId).toBe('string');
  });

  it('never includes passwordHash, even when selected', () => {
    const user = seeded('User')[0]!;
    expect(user.get('passwordHash')).toMatch(/^\$2[aby]\$/);
    expect(json(user)).not.toHaveProperty('passwordHash');
  });

  it('strips server-only lecture fields and chunk embeddings', () => {
    const lecture = json(seeded('Lecture')[0]);
    for (const field of ['notes', 'stages', 'mediaPath', 'audioPath', 'provider']) expect(lecture).not.toHaveProperty(field);
    expect(json(new Chunk({ embedding: new Array(384).fill(0) }))).not.toHaveProperty('embedding');
  });
});

describe('validators', () => {
  const errorsOf = (doc: { validateSync(): { errors: Record<string, { message: string }> } | undefined }) =>
    Object.fromEntries(Object.entries(doc.validateSync()?.errors ?? {}).map(([k, v]) => [k, v.message]));

  it('uses the exact contract enum strings', () => {
    const lecture = seeded('Lecture')[0]!;
    lecture.set('status', 'processing');
    expect(errorsOf(lecture as never)).toHaveProperty('status');
    lecture.set('status', 'uploaded');
  });

  it('accepts an embedding of 0 or 384 numbers only', () => {
    const chunk = seeded('Chunk')[0]!;
    for (const [length, ok] of [[0, true], [384, true], [383, false], [385, false]] as const) {
      chunk.set('embedding', new Array(length).fill(0.1));
      expect('embedding' in errorsOf(chunk as never)).toBe(!ok);
    }
  });

  // pre('validate') rules run on validate()/save(), not validateSync().
  const asyncErrorsOf = (doc: { validate(): Promise<void> }) =>
    doc.validate().then(
      () => ({}) as Record<string, string>,
      (err: { errors: Record<string, { message: string }> }) =>
        Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v.message])),
    );

  it('requires a rejectionReason iff status is rejected', async () => {
    const topic = new TopicSection(json(seeded('TopicSection')[0]));
    topic.set('status', 'rejected');
    expect((await asyncErrorsOf(topic)).rejectionReason).toMatch(/Required/);
    topic.set('rejectionReason', 'AMBIGUOUS');
    expect(await asyncErrorsOf(topic)).not.toHaveProperty('rejectionReason');
    topic.set('status', 'approved');
    expect((await asyncErrorsOf(topic)).rejectionReason).toMatch(/Must be null/);
  });

  it('requires lecture.error iff status is failed', async () => {
    const lecture = new Lecture(json(seeded('Lecture')[0]));
    lecture.set('status', 'failed');
    expect((await asyncErrorsOf(lecture)).error).toMatch(/Required/);
  });

  it('rejects upload consent unless all three booleans are true', () => {
    const lecture = new Lecture(json(seeded('Lecture')[0]));
    lecture.set('consent.processorNamed', false);
    expect(errorsOf(lecture as never)['consent.processorNamed']).toBe('Must be true');
  });

  it('defaults review status to pending_review', () => {
    for (const M of [TopicSection, Summary, Question]) {
      expect((new (M as typeof Summary)({}) as { status: string }).status).toBe('pending_review');
    }
  });
});

describe('approval filtering', () => {
  const lectureId = new Types.ObjectId('6650c3a0c3b2e41d8a100001');

  it.each([TopicSection, Summary, Question])('%o.approvedFor(lectureId) filters to approved', (M) => {
    expect(M.approvedFor(lectureId).getFilter()).toEqual({ lectureId, status: 'approved' });
  });

  it('approvedOnly() adds the filter to any query', () => {
    expect(Question.find({ topicId: lectureId }).approvedOnly().getFilter()).toEqual({
      topicId: lectureId,
      status: 'approved',
    });
  });
});

describe('transcript segment audit trail', () => {
  // A stored segment, as loaded from MongoDB (runs post-init hooks).
  const stored = (over: Record<string, unknown> = {}) =>
    TranscriptSegment.hydrate({ ...omit(json(seeded('TranscriptSegment')[3]), ['id']), _id: new Types.ObjectId(), ...over });

  // save() runs the real middleware; only the driver write is stubbed.
  const stubWrite = () =>
    vi.spyOn(TranscriptSegment.collection, 'updateOne').mockResolvedValue({ acknowledged: true, matchedCount: 1, modifiedCount: 1 } as never);

  it('copies the previous text into originalText on the first edit and sets corrected', async () => {
    const write = stubWrite();
    const segment = stored();
    const asr = segment.text;
    segment.text = 'Corrected text.';
    await segment.save();
    expect(segment.originalText).toBe(asr);
    expect(segment.corrected).toBe(true);
    expect(write).toHaveBeenCalledOnce();
  });

  it('never overwrites originalText on later edits', async () => {
    stubWrite();
    const segment = stored({ originalText: 'the ASR text', corrected: true, text: 'first correction' });
    segment.text = 'second correction';
    await segment.save();
    expect(segment.originalText).toBe('the ASR text');
  });

  it('refuses a direct change to an already-set originalText', async () => {
    stubWrite();
    const segment = stored({ originalText: 'the ASR text', corrected: true });
    segment.originalText = 'rewritten history';
    await expect(segment.save()).rejects.toThrow(/Cannot be changed once set/);
  });

  it('refuses update queries that bypass the hook', async () => {
    await expect(
      TranscriptSegment.updateOne({ _id: new Types.ObjectId() }, { $set: { text: 'x' } }),
    ).rejects.toThrow(/doc.save\(\)/);
  });
});

describe('indexes', () => {
  const keys = (M: { schema: { indexes(): Array<[Record<string, unknown>, Record<string, unknown>]> } }) =>
    M.schema.indexes().map(([fields, options]) => ({ fields, unique: Boolean(options.unique) }));

  it.each([
    [User, { email: 1 }, true],
    [Lecture, { uploadedBy: 1, status: 1 }, false],
    [Lecture, { createdAt: -1 }, false],
    [TranscriptSegment, { lectureId: 1, index: 1 }, true],
    [Chunk, { lectureId: 1, index: 1 }, true],
    [TopicSection, { lectureId: 1, index: 1 }, true],
    [Question, { lectureId: 1, status: 1, topicId: 1 }, false],
    [Attempt, { studentId: 1, quizId: 1 }, false],
    [LlmCache, { key: 1 }, true],
  ])('%o has %o (unique: %s)', (M, fields, unique) => {
    expect(keys(M as never)).toContainEqual({ fields, unique });
  });

  it('sets the llmcache TTL and the chunk text index', () => {
    expect(LlmCache.schema.indexes()).toContainEqual([{ expiresAt: 1 }, expect.objectContaining({ expireAfterSeconds: 0 })]);
    expect(Chunk.schema.indexes()).toContainEqual([{ text: 'text' }, expect.objectContaining({ name: 'chunks_text' })]);
  });

  it('registers every model', () => {
    for (const M of [Quiz, RevisionRecommendation]) expect(M.modelName).toBeTruthy();
  });
});
