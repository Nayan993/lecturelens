import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { embed } from '../src/services/embeddings/index.js';
import { dot } from '../src/services/retrieval/vector.js';

/**
 * The REAL pretrained model (Xenova/all-MiniLM-L6-v2 via @xenova/transformers; not trained by us).
 * Runs only when the model files are already in the local transformers cache, so an ordinary test
 * run never downloads anything. The cache fills the first time the server indexes, searches or
 * answers (or run: npx tsx evaluation/rag/evaluate-retrieval.ts from the repository root).
 */
const require = createRequire(import.meta.url);
const cacheDir = path.join(path.dirname(require.resolve('@xenova/transformers/package.json')), '.cache', 'Xenova', 'all-MiniLM-L6-v2');

describe('embed() with the real model', () => {
  it.skipIf(!existsSync(cacheDir))('384-d vectors with unit norm (within 1e-6); a related sentence scores higher than an unrelated one', async () => {
    const [q, related, unrelated] = await embed([
      'What happens if the learning rate is too large?',
      'With a very large learning rate the loss diverges.',
      'Class diagrams list attributes and methods.',
    ]);
    for (const v of [q!, related!, unrelated!]) {
      expect(v).toHaveLength(384);
      expect(Math.abs(Math.hypot(...v) - 1)).toBeLessThan(1e-6);
    }
    expect(dot(q!, related!)).toBeGreaterThan(dot(q!, unrelated!) + 0.2);
  }, 120_000);
});
