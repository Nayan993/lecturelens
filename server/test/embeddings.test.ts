import { describe, expect, it, vi } from 'vitest';

// The real embed() code on a deterministic fake model; the real model is tested in embeddings-model.test.ts.
vi.mock('@xenova/transformers', async () => (await import('./fakeEmbeddings.js')).fakeTransformers);

import * as transformers from '@xenova/transformers';
import { embed } from '../src/services/embeddings/index.js';
import type { fakeTransformers } from './fakeEmbeddings.js';

/** The fake model's call log, read through the mocked module (the instance embed() really uses). */
const extractorCalls = (transformers as unknown as typeof fakeTransformers).calls;

describe('embed() (shared embedding helper)', () => {
  it('batches by 32 and returns one 384-d unit vector per text, in order', async () => {
    extractorCalls.length = 0;
    const texts = Array.from({ length: 70 }, (_, i) => `sentence ${i}`);
    const vectors = await embed(texts);
    expect(extractorCalls.map((b) => b.length)).toEqual([32, 32, 6]);
    expect(extractorCalls.flat()).toEqual(texts);
    expect(vectors).toHaveLength(70);
    for (const v of vectors) {
      expect(v).toHaveLength(384);
      expect(Math.abs(Math.hypot(...v) - 1)).toBeLessThan(1e-6);
    }
  });

  it('returns [] for no texts and rejects empty text instead of embedding it', async () => {
    expect(await embed([])).toEqual([]);
    await expect(embed(['ok', '  '])).rejects.toThrow(/empty text/);
  });
});
