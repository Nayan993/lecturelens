import type { EmbeddingProvider } from '../topics/segmenter.js';
import { embed } from './embedder.js';

/**
 * THE shared embedding helper (PC.1) — import from here. One implementation in the repo:
 * Xenova/all-MiniLM-L6-v2, in process, pretrained (we do not train or fine-tune it).
 */
export { embed, embedLecture, EMBEDDING_MODEL_NAME } from './embedder.js';

/** The `EmbeddingProvider` Member B's segmenter (and evaluation/topics) takes. */
export const embedder: EmbeddingProvider = { embed };
