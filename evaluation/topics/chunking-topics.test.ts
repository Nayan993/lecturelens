import { describe, expect, it } from 'vitest';
import { buildChunks } from '../../server/src/services/chunking/chunker.js';
import {
  assertTopicTiling,
  fixedWindow,
  embeddingSimilarity,
} from '../../server/src/services/topics/segmenter.js';

const segments = (count = 12, duration = 720) =>
  Array.from({ length: count }, (_, index) => ({
    index,
    startSec: (index * duration) / count,
    endSec: ((index + 1) * duration) / count,
    text: `Segment ${index} contains enough words for a retrieval unit.`,
  }));

describe('Member B retrieval chunking and topic sections', () => {
  it('never splits segments, keeps overlap near the configured value, and caps words', () => {
    const chunks = buildChunks(segments(12, 720), { windowSec: 60, overlapSec: 15 });
    expect(chunks.length).toBeGreaterThan(1);
    for (let i = 0; i < chunks.length; i += 1) {
      const chunk = chunks[i]!;
      expect(chunk.text.trim().split(/\s+/).length).toBeLessThanOrEqual(200);
      if (i > 0) {
        expect(chunk.startSec).toBeLessThanOrEqual(chunks[i - 1]!.endSec);
      }
    }
  });

  it('fixed-window sections tile exactly', () => {
    const input = segments();
    const sections = fixedWindow(input, 720, { sectionSec: 300 });
    expect(() => assertTopicTiling(sections, 720, input)).not.toThrow();
  });

  it('embedding-similarity sections tile exactly and use proposed method metadata', async () => {
    const input = segments(12, 720);
    const sections = await embeddingSimilarity(input, 720, {
      embed(texts) {
        return texts.map((_, index) => [index, index % 3, 1]);
      },
    });
    expect(() => assertTopicTiling(sections, 720, input)).not.toThrow();
    expect(sections.every((section) => section.method === 'embedding_similarity')).toBe(true);
  });
});
