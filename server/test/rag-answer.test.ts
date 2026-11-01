import request from 'supertest';
import type { Types } from 'mongoose';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { z } from 'zod';

// Real retrieval, prompt, validation, cache and route; the embedding MODEL and the LLM are fakes.
vi.mock('@xenova/transformers', async () => (await import('./fakeEmbeddings.js')).fakeTransformers);

const llm = vi.hoisted(() => ({ client: null as null | { generateJson: (p: string, s: z.ZodTypeAny) => Promise<unknown> } }));
vi.mock('../src/services/llm/client.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/services/llm/client.js')>()),
  getLlmClient: () => llm.client,
  llmModelName: () => 'test-model',
}));

import { Chunk, Lecture, LlmCache, initialStages, type ILecture } from '../src/models/index.js';
import { LlmError } from '../src/services/llm/client.js';
import { embedLecture } from '../src/services/embeddings/index.js';
import { RAG_DEFAULTS } from '../src/services/rag/settings.js';
import { contentTerms, lexicalCoverage } from '../src/services/rag/gate.js';
import { authHeader, buildApp, makeStudent, makeTeacher, resetDb } from './setup.js';

const app = await buildApp();

const PASSAGES = [
  { startSec: 0, endSec: 42.5, text: 'Today we recap the loss function and why training means minimising it over the parameters.' },
  { startSec: 42.5, endSec: 97.125, text: 'A learning rate that is too large makes the loss diverge and blow up to NaN within a few steps.' },
  { startSec: 97.125, endSec: 160, text: 'Backpropagation applies the chain rule on a computational graph to compute every gradient.' },
];

async function lectureWithChunks(ownerId: Types.ObjectId, overrides: Partial<ILecture> = {}) {
  const lecture = await Lecture.create({
    title: 'Lecture 7 — Gradient Descent',
    uploadedBy: ownerId,
    consent: { lecturerConsent: true, purposeShown: true, processorNamed: true, grantedBy: ownerId, grantedAt: new Date() },
    status: 'ready', statusDetail: 'Ready.', durationSec: 160, transcriptApproved: true,
    stages: initialStages().map((s) => ({ ...s, state: 'done', ms: 10 })),
    mediaPath: 'x/lecture.mp3', media: { originalFilename: 'lecture.mp3', mimeType: 'audio/mpeg', sizeBytes: 1 },
    ...overrides,
  });
  await Chunk.insertMany(PASSAGES.map((p, index) => ({
    lectureId: lecture._id, index, ...p, segmentStart: index, segmentEnd: index, embeddingModel: 'Xenova/all-MiniLM-L6-v2',
  })));
  await embedLecture(String(lecture._id));
  return lecture;
}

/** The passage number the prompt gave the chunk containing `needle` (prompt.ts numbers them [n]). */
function numberOf(prompt: string, needle: string): number {
  for (const block of prompt.split(/\n(?=\[\d+\]\n)/)) {
    const m = /^\[(\d+)\]\n/.exec(block);
    if (m && block.includes(needle)) return Number(m[1]);
  }
  throw new Error(`passage containing "${needle}" not in the prompt`);
}

/** A fake model that answers from the passage containing "diverge", citing it verbatim. */
function answeringModel(overrides: (prompt: string) => Record<string, unknown> = () => ({})) {
  return vi.fn(async (prompt: string, schema: z.ZodTypeAny) => {
    const n = numberOf(prompt, 'diverge');
    return schema.parse({
      answer: `A too-large learning rate makes the loss diverge [${n}].`,
      citedPassages: [n],
      citedQuotes: [{ passageNumber: n, quote: 'makes the loss diverge and blow up to NaN' }],
      answerable: true,
      confidence: 0.9,
      ...overrides(prompt),
    });
  });
}

const ask = (user: Parameters<typeof authHeader>[0], body: object) =>
  request(app).post('/api/v1/ask').set(authHeader(user)).send(body);

let teacher: Awaited<ReturnType<typeof makeTeacher>>;
let student: Awaited<ReturnType<typeof makeStudent>>;
beforeEach(async () => {
  await resetDb();
  teacher = await makeTeacher();
  student = await makeStudent();
  llm.client = null;
});
afterEach(() => vi.restoreAllMocks());

describe('POST /ask — grounded answers', () => {
  it('answers a relevant question with a validated citation, in the exact §6.8 shape', async () => {
    const lecture = await lectureWithChunks(teacher._id);
    const generateJson = answeringModel();
    llm.client = { generateJson };

    const res = await ask(student, { question: 'What happens when the learning rate is too large?', lectureId: String(lecture._id) }).expect(200);
    expect(Object.keys(res.body).sort()).toEqual([
      'abstainReason', 'abstained', 'answer', 'answerable', 'cached', 'citations', 'confidence', 'latencyMs',
      'lectureId', 'model', 'promptVersion', 'question', 'retriever', 'topScore',
    ]);
    expect(res.body).toMatchObject({
      answerable: true, abstained: false, abstainReason: null, confidence: 0.9, retriever: 'hybrid',
      lectureId: String(lecture._id), model: 'test-model', cached: false,
    });
    expect(res.body.topScore).toBeGreaterThan(0);
    expect(res.body.latencyMs).toEqual(expect.any(Number));
    expect(res.body.citations).toHaveLength(1);
    const [c] = res.body.citations;
    // Citation fields come from the retrieved chunk, never from the model.
    expect(c).toMatchObject({ lectureId: String(lecture._id), startSec: 42.5, endSec: 97.125, deepLink: `/lectures/${lecture._id}/play?t=42.5` });
    expect(c.quote).toBe('makes the loss diverge and blow up to NaN');
    expect(res.body.answer).toContain(`[${c.marker}]`);
    expect(generateJson).toHaveBeenCalledOnce();
  });

  it('every citation\'s startSec/endSec lie within its cited chunk', async () => {
    const lecture = await lectureWithChunks(teacher._id);
    llm.client = { generateJson: answeringModel() };
    const res = await ask(student, { question: 'learning rate too large loss', lectureId: String(lecture._id) }).expect(200);
    const chunks = await Chunk.find({ lectureId: lecture._id }).lean();
    for (const c of res.body.citations) {
      const chunk = chunks.find((k) => String(k._id) === c.chunkId)!;
      expect(c.startSec).toBeGreaterThanOrEqual(chunk.startSec);
      expect(c.endSec).toBeLessThanOrEqual(chunk.endSec);
      expect(chunk.text).toContain(c.quote);
    }
  });

  it('retrieval-side abstention: an out-of-scope question abstains (NO_RELEVANT_PASSAGE) WITHOUT calling the LLM', async () => {
    await lectureWithChunks(teacher._id);
    const generateJson = answeringModel();
    llm.client = { generateJson };
    const res = await ask(student, { question: 'Who won the football world cup?' }).expect(200);
    expect(res.body).toMatchObject({
      answerable: false, abstained: true, abstainReason: 'NO_RELEVANT_PASSAGE', answer: null, citations: [], confidence: null,
    });
    expect(generateJson).not.toHaveBeenCalled();
  });

  it('nothing visible to retrieve → NO_RELEVANT_PASSAGE, topScore null, still 200', async () => {
    const generateJson = answeringModel();
    llm.client = { generateJson };
    const res = await ask(student, { question: 'What is a learning rate?' }).expect(200);
    expect(res.body).toMatchObject({ abstained: true, abstainReason: 'NO_RELEVANT_PASSAGE', topScore: null });
    expect(generateJson).not.toHaveBeenCalled();
  });

  it('generation-side abstention: the model declares it cannot answer → LOW_CONFIDENCE', async () => {
    await lectureWithChunks(teacher._id);
    llm.client = { generateJson: answeringModel(() => ({ answer: '', citedPassages: [], citedQuotes: [], answerable: false, confidence: 0 })) };
    const res = await ask(student, { question: 'What happens when the learning rate is too large?' }).expect(200);
    expect(res.body).toMatchObject({ abstained: true, abstainReason: 'LOW_CONFIDENCE', citations: [], answer: null });
  });

  it('a hallucinated citation index is dropped; answerable with zero surviving citations is forced to LOW_CONFIDENCE', async () => {
    await lectureWithChunks(teacher._id);
    llm.client = {
      generateJson: answeringModel(() => ({
        answer: 'It diverges [42].', citedPassages: [42], citedQuotes: [{ passageNumber: 42, quote: 'diverge' }],
      })),
    };
    const res = await ask(student, { question: 'What happens when the learning rate is too large?' }).expect(200);
    expect(res.body).toMatchObject({ answerable: false, abstained: true, abstainReason: 'LOW_CONFIDENCE', citations: [] });
  });

  it('a citation whose quote is not in the cited passage is dropped (never trusted)', async () => {
    await lectureWithChunks(teacher._id);
    llm.client = {
      generateJson: answeringModel((p) => ({
        citedQuotes: [{ passageNumber: numberOf(p, 'diverge'), quote: 'the optimiser always converges' }],
      })),
    };
    const res = await ask(student, { question: 'What happens when the learning rate is too large?' }).expect(200);
    expect(res.body).toMatchObject({ abstained: true, abstainReason: 'LOW_CONFIDENCE' });
  });

  it('unusable model output → PARSE_FAILED abstention with HTTP 200, never a 500', async () => {
    await lectureWithChunks(teacher._id);
    llm.client = { generateJson: vi.fn(async () => { throw new LlmError('LLM output was not valid JSON'); }) };
    const res = await ask(student, { question: 'What happens when the learning rate is too large?' }).expect(200);
    expect(res.body).toMatchObject({ abstained: true, abstainReason: 'PARSE_FAILED', answer: null, citations: [] });
  });

  it('an unreachable provider is 503 PROVIDER_UNAVAILABLE (not an abstention); no provider configured too', async () => {
    await lectureWithChunks(teacher._id);
    llm.client = { generateJson: vi.fn(async () => { throw new LlmError('LLM request failed (HTTP 503)', 503); }) };
    const down = await ask(student, { question: 'What happens when the learning rate is too large?' }).expect(503);
    expect(down.body.error.code).toBe('PROVIDER_UNAVAILABLE');

    llm.client = null;
    const none = await ask(student, { question: 'What happens when the learning rate is too large?' }).expect(503);
    expect(none.body.error.code).toBe('PROVIDER_UNAVAILABLE');
  });

  it('caches a validated answer (sha256 key over model + prompt): the repeat is served from LlmCache without an LLM call', async () => {
    await lectureWithChunks(teacher._id);
    const generateJson = answeringModel();
    llm.client = { generateJson };
    const body = { question: 'What happens when the learning rate is too large?' };
    const first = await ask(student, body).expect(200);
    const second = await ask(student, body).expect(200);
    expect(generateJson).toHaveBeenCalledOnce();
    expect(first.body.cached).toBe(false);
    expect(second.body).toMatchObject({ cached: true, answer: first.body.answer, citations: first.body.citations });
    const entries = await LlmCache.find().lean();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ purpose: 'answer', model: 'test-model', hits: 1 });
    expect(entries[0]!.key).toMatch(/^[0-9a-f]{64}$/);
  });

  it('visibility: a student cannot ask about an unapproved lecture (404), and never gets a citation from one', async () => {
    const hidden = await lectureWithChunks(teacher._id, { transcriptApproved: false });
    const generateJson = answeringModel();
    llm.client = { generateJson };
    const named = await ask(student, { question: 'What happens when the learning rate is too large?', lectureId: String(hidden._id) }).expect(404);
    expect(named.body.error.code).toBe('NOT_FOUND');
    const all = await ask(student, { question: 'What happens when the learning rate is too large?' }).expect(200);
    expect(all.body).toMatchObject({ abstained: true, abstainReason: 'NO_RELEVANT_PASSAGE' });
    expect(generateJson).not.toHaveBeenCalled();
  });

  it('validates input and requires a token', async () => {
    await request(app).post('/api/v1/ask').send({ question: 'What is a gradient?' }).expect(401);
    const res = await ask(student, { question: 'hi' }).expect(422);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('the relevance gate is a cosine threshold, not the RRF topScore (RRF never exceeds 2/61)', () => {
    expect(RAG_DEFAULTS.minScore).toBeGreaterThan(2 / 61);
  });

  it('a rate-limited provider is a 503 that says when to retry (Retry-After), never an answer', async () => {
    await lectureWithChunks(teacher._id);
    llm.client = { generateJson: vi.fn(async () => { throw new LlmError('LLM request failed (HTTP 429): tokens per day', 429, 521); }) };
    const res = await ask(student, { question: 'What happens when the learning rate is too large?' }).expect(503);
    expect(res.headers['retry-after']).toBe('521');
    expect(res.body.error).toMatchObject({ code: 'PROVIDER_UNAVAILABLE', details: { provider: 'llm', retryAfterSec: 521 } });
    expect(res.body.error.message).toMatch(/try again in about 9 minutes/);
  });

  it('a model abstention is cached too: asking again costs no tokens', async () => {
    await lectureWithChunks(teacher._id);
    const generateJson = answeringModel(() => ({ answer: '', citedPassages: [], citedQuotes: [], answerable: false, confidence: 0 }));
    llm.client = { generateJson };
    const body = { question: 'What happens when the learning rate is too large?' };
    const first = await ask(student, body).expect(200);
    const second = await ask(student, body).expect(200);
    expect(first.body).toMatchObject({ abstained: true, abstainReason: 'LOW_CONFIDENCE', cached: false });
    expect(second.body).toMatchObject({ abstained: true, abstainReason: 'LOW_CONFIDENCE', cached: true });
    expect(generateJson).toHaveBeenCalledOnce();
  });
});

describe('relevance gate on code-mixed lectures (lexical coverage)', () => {
  it('a mostly-Devanagari passage that contains the question\'s term reaches the LLM even when cosine is low; off-topic still abstains', async () => {
    // Regression (real Hindi–English lecture): "what is association" scored cosine 0.215 against a
    // passage that explains association, so the cosine-only gate abstained.
    const lecture = await Lecture.create({
      title: 'UML (Hindi–English)', uploadedBy: teacher._id,
      consent: { lecturerConsent: true, purposeShown: true, processorNamed: true, grantedBy: teacher._id, grantedAt: new Date() },
      status: 'ready', statusDetail: 'Ready.', durationSec: 60, transcriptApproved: true,
      stages: initialStages().map((s) => ({ ...s, state: 'done', ms: 10 })),
      mediaPath: 'x/u.mp4', media: { originalFilename: 'u.mp4', mimeType: 'video/mp4', sizeBytes: 1 },
    });
    const text = 'अब हम association की बात करते हैं, यहाँ पर दो classes के बीच relation होता है और हम उसे line से दिखाते हैं जैसे customer और account के बीच';
    await Chunk.create({ lectureId: lecture._id, index: 0, startSec: 0, endSec: 60, segmentStart: 0, segmentEnd: 0, text, embeddingModel: 'Xenova/all-MiniLM-L6-v2' });
    await embedLecture(String(lecture._id));
    const generateJson = vi.fn(async (prompt: string, schema: z.ZodTypeAny) => schema.parse({
      answer: 'Association is a relation between two classes [1].', citedPassages: [numberOf(prompt, 'association')],
      citedQuotes: [{ passageNumber: numberOf(prompt, 'association'), quote: 'दो classes के बीच relation होता है' }], answerable: true, confidence: 0.8,
    }));
    llm.client = { generateJson };

    const res = await ask(student, { question: 'What is association?', lectureId: String(lecture._id) }).expect(200);
    expect(res.body).toMatchObject({ abstained: false, citations: [{ startSec: 0, endSec: 60, quote: 'दो classes के बीच relation होता है' }] });
    expect(generateJson).toHaveBeenCalledOnce();

    const off = await ask(student, { question: 'How do you deploy a Docker container?', lectureId: String(lecture._id) }).expect(200);
    expect(off.body).toMatchObject({ abstained: true, abstainReason: 'NO_RELEVANT_PASSAGE' });
    expect(generateJson).toHaveBeenCalledOnce();
  });

  it('contentTerms drops stop words; lexicalCoverage is the best per-passage share', () => {
    expect(contentTerms('What is the difference between aggregation and composition?')).toEqual(['difference', 'between', 'aggregation', 'composition']);
    expect(contentTerms('What is this lecture about?')).toEqual([]);
    expect(lexicalCoverage('What is association?', ['यहाँ association है', 'nothing'])).toBe(1);
    expect(lexicalCoverage('aggregation and composition', ['aggregation only', 'composition only'])).toBe(0.5);
    expect(lexicalCoverage('What is this lecture about?', ['anything'])).toBe(0);
  });
});
