import { env } from '../../config/env.js';

/**
 * Grounded-Q&A settings (PC.2), validated in config/env.ts.
 *
 * minScore is the RETRIEVAL-SIDE relevance gate: the minimum cosine similarity (question vs. the
 * best retrieved passage, both embedded with the shared model) below which /ask abstains with
 * NO_RELEVANT_PASSAGE without calling the LLM. It is deliberately not compared with `topScore`:
 * hybrid RRF scores depend only on ranks (the top hit always scores ≥ 1/61) and BM25 is unbounded,
 * so neither says whether anything relevant was found. Cosine does, on one scale for all three
 * retrievers. The default is calibrated on evaluation/rag (see its README).
 */
export const RAG_DEFAULTS = Object.freeze({ topK: 8, minScore: 0.35 });

export const ragTopK = (): number => env.RAG_TOP_K ?? RAG_DEFAULTS.topK;
export const ragMinScore = (): number => env.RAG_MIN_SCORE ?? RAG_DEFAULTS.minScore;
