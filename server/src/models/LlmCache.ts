import { Schema, model, type Model } from 'mongoose';
import { LLM_PURPOSES, type LlmPurpose } from './enums.js';
import { clientJson } from './shared.js';

export { LLM_PURPOSES, type LlmPurpose };

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** `llmcache` — server-only, never exposed. docs/CONTRACTS.md §4.11. */
export interface ILlmCache {
  /** sha256 hex of JSON.stringify({ purpose, model, promptVersion, input }). */
  key: string;
  purpose: LlmPurpose;
  model: string;
  promptVersion: string;
  /** Parsed, validated JSON output. */
  response: unknown;
  tokensIn: number;
  tokensOut: number;
  hits: number;
  /** createdAt + 30 days; the TTL index deletes the entry then. */
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const llmCacheSchema = new Schema<ILlmCache>(
  {
    key: { type: String, required: true, match: [/^[0-9a-f]{64}$/, 'Must be a sha256 hex digest'] },
    purpose: { type: String, enum: LLM_PURPOSES, required: true },
    model: { type: String, required: true },
    promptVersion: { type: String, required: true },
    response: { type: Schema.Types.Mixed, required: true },
    tokensIn: { type: Number, required: true, min: 0 },
    tokensOut: { type: Number, required: true, min: 0 },
    hits: { type: Number, required: true, min: 0, default: 0 },
    expiresAt: { type: Date, required: true, default: () => new Date(Date.now() + CACHE_TTL_MS) },
  },
  { timestamps: true, collection: 'llmcache', toJSON: clientJson() },
);

llmCacheSchema.index({ key: 1 }, { unique: true });
llmCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const LlmCache = model<ILlmCache, Model<ILlmCache>>('LlmCache', llmCacheSchema);
