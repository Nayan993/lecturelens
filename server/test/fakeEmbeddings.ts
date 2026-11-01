import { createHash } from 'node:crypto';

/**
 * A deterministic stand-in for the @xenova/transformers feature-extraction pipeline, so unit tests
 * never download or run the real model. Use it with
 *
 *   vi.mock('@xenova/transformers', async () => (await import('./fakeEmbeddings.js')).fakeTransformers);
 *
 * and the REAL embed()/embedLecture() code runs on top of it. Vectors are hashed bags of words,
 * L2-normalised, 384 long: texts that share words get a higher cosine, unrelated texts ≈ 0.
 */
export const FAKE_DIMENSIONS = 384;

export function fakeVector(text: string): number[] {
  const v = new Array<number>(FAKE_DIMENSIONS).fill(0);
  for (const word of text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []) {
    const h = createHash('md5').update(word).digest();
    v[h.readUInt16BE(0) % FAKE_DIMENSIONS]! += 1;
  }
  const norm = Math.sqrt(v.reduce((a, x) => a + x * x, 0));
  return norm === 0 ? v.map((_, i) => (i === 0 ? 1 : 0)) : v.map((x) => x / norm);
}

/** Every call the fake extractor received (one entry per batch). */
export const extractorCalls: string[][] = [];

export const fakeTransformers = {
  /** The same array as `extractorCalls`, reachable through the mocked module. */
  calls: extractorCalls,
  pipeline: async () => async (batch: string[] | string) => {
    const texts = Array.isArray(batch) ? batch : [batch];
    extractorCalls.push(texts);
    return { tolist: () => texts.map(fakeVector) };
  },
};
