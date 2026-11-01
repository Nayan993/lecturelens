import { describe, expect, it } from 'vitest';
import { bm25Scores, BM25_B, BM25_K1, tokenize } from '../src/services/retrieval/keyword.js';
import { fuseHybridResults, RRF_K } from '../src/services/retrieval/hybrid.js';
import { dot } from '../src/services/retrieval/vector.js';

/** Direct tests of the retrieval maths (PC.1) — BM25, the dot product, RRF. Nothing is mocked. */

const r = (chunkId: string, score = 0) => ({ chunkId, lectureId: 'L', startSec: 0, endSec: 1, text: chunkId, score });

describe('BM25 (keyword retriever)', () => {
  it('matches a hand computation on a 3-document fixture', () => {
    const docs = ['the cat sat', 'the dog sat on the mat', 'cats and dogs'];
    const [cat, dog, none] = bm25Scores('cat', docs);
    // "cat" occurs once, in doc 0 (|d| = 3); N = 3, df = 1, avgdl = (3 + 6 + 3) / 3 = 4.
    const idf = Math.log(1 + (3 - 1 + 0.5) / (1 + 0.5));
    const expected = (idf * 1 * (BM25_K1 + 1)) / (1 + BM25_K1 * (1 - BM25_B + (BM25_B * 3) / 4));
    expect(cat).toBeCloseTo(expected, 12);
    expect(dog).toBe(0);
    expect(none).toBe(0); // "cats" is not "cat": no stemming
  });

  it('rewards term frequency with saturation, and penalises long documents', () => {
    const [once, twice, many] = bm25Scores('rate', ['rate x x x', 'rate rate x x', 'rate rate rate rate']);
    expect(twice).toBeGreaterThan(once!);
    expect(many! - twice!).toBeLessThan(twice! - once!); // saturates
    const [short, long] = bm25Scores('rate', ['rate x', 'rate x x x x x x x x x']);
    expect(short).toBeGreaterThan(long!);
  });

  it('rarer terms weigh more (IDF), repeated query terms count once, and Devanagari tokenises', () => {
    const docs = ['gradient common', 'gradient common', 'gradient rare common'];
    const [, , withRare] = bm25Scores('rare gradient', docs);
    const [a] = bm25Scores('gradient', docs);
    expect(withRare).toBeGreaterThan(a!);
    expect(bm25Scores('gradient gradient', docs)).toEqual(bm25Scores('gradient', docs));
    expect(tokenize('Class Diagram वो जो है')).toEqual(['class', 'diagram', 'वो', 'जो', 'है']);
  });
});

describe('vector similarity', () => {
  it('dot product of unit vectors is the cosine', () => {
    const a = [0.6, 0.8, 0];
    const b = [0.8, 0.6, 0];
    expect(dot(a, b)).toBeCloseTo(0.96, 12);
    expect(dot(a, a)).toBeCloseTo(1, 12);
    expect(dot([1, 0], [0, 1])).toBe(0);
    expect(dot([1, 0], [-1, 0])).toBe(-1);
  });
});

describe('hybrid = reciprocal-rank fusion (CONTRACTS.md §5.6)', () => {
  it('scores Σ 1/(60 + rank) over both lists and orders by it', () => {
    // vector: A, B, C   keyword: C, A, D
    const fused = fuseHybridResults([r('A'), r('B'), r('C')], [r('C'), r('A'), r('D')], 10);
    const s = (rank: number) => 1 / (RRF_K + rank);
    const byId = Object.fromEntries(fused.map((f) => [f.chunkId, f.score]));
    expect(byId.A).toBeCloseTo(s(1) + s(2), 15);
    expect(byId.C).toBeCloseTo(s(3) + s(1), 15);
    expect(byId.B).toBeCloseTo(s(2), 15);
    expect(byId.D).toBeCloseTo(s(3), 15);
    expect(fused.map((f) => f.chunkId)).toEqual(['A', 'C', 'B', 'D']);
  });

  it('uses ranks, not raw scores; maximum is 2/61; ties are deterministic; k truncates', () => {
    const fused = fuseHybridResults([r('X', 0.99), r('Y', 0.01)], [r('X', 42)], 1);
    expect(fused).toHaveLength(1);
    expect(fused[0]).toMatchObject({ chunkId: 'X' });
    expect(fused[0]!.score).toBeCloseTo(2 / 61, 15);
    expect(fuseHybridResults([r('B')], [r('A')], 5).map((f) => f.chunkId)).toEqual(['A', 'B']);
  });
});
