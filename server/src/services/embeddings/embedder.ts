import { pipeline, type FeatureExtractionPipeline } from '@xenova/transformers';
import { Types } from 'mongoose';
import { Chunk, EMBEDDING_DIMENSIONS } from '../../models/Chunk.js';
import { invalidateVectorCache } from '../retrieval/vectorCache.js';

/** Pretrained sentence-embedding model, run in process on CPU (we do not train or fine-tune it). */
export const EMBEDDING_MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';
const MODEL_NAME = EMBEDDING_MODEL_NAME;
const BATCH_SIZE = 32;

let pipelinePromise: Promise<FeatureExtractionPipeline> | null = null;

function getEmbedder(): Promise<FeatureExtractionPipeline> {
  if (!pipelinePromise) {
    pipelinePromise = pipeline('feature-extraction', MODEL_NAME, {
      quantized: true,
    }) as Promise<FeatureExtractionPipeline>;

    pipelinePromise = pipelinePromise.catch((error: unknown) => {
      pipelinePromise = null;
      throw error;
    });
  }

  return pipelinePromise;
}

/**
 * Generate normalized 384-dimensional embeddings.
 * The model is loaded once and input is processed in batches of 32.
 */
export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  if (texts.some((text) => !text.trim())) {
    throw new Error('Cannot embed empty text');
  }

  const extractor = await getEmbedder();
  const embeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    const output = await extractor(batch, {
      pooling: 'mean',
      normalize: true,
    });

    const vectors = output.tolist() as number[][];

    if (
      vectors.length !== batch.length ||
      vectors.some((vector) => vector.length !== EMBEDDING_DIMENSIONS)
    ) {
      throw new Error('Embedding model returned an unexpected shape');
    }

    embeddings.push(...vectors);
  }

  return embeddings;
}

/**
 * The `indexing` stage: embeds every chunk of the lecture that has no valid embedding (missing,
 * empty, or not EMBEDDING_DIMENSIONS long) and saves the vectors. Chunks that are already indexed
 * are left alone, so a rerun only embeds what is missing. Returns the number of chunks embedded.
 * The lecture's cached vectors are dropped afterwards, so search sees the new index at once.
 */
export async function embedLecture(lectureId: string): Promise<number> {
  const chunks = await Chunk.find({
    lectureId: new Types.ObjectId(lectureId),
    embedding: { $not: { $size: EMBEDDING_DIMENSIONS } },
  })
    .select('_id text')
    .sort({ index: 1 })
    .lean()
    .exec();

  try {
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const vectors = await embed(batch.map((chunk) => chunk.text));
      await Chunk.bulkWrite(
        batch.map((chunk, j) => ({
          updateOne: {
            filter: { _id: chunk._id },
            update: { $set: { embedding: vectors[j]!, embeddingModel: MODEL_NAME } },
          },
        })),
      );
    }
  } finally {
    invalidateVectorCache(lectureId);
  }
  return chunks.length;
}
