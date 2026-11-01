import type { Types } from 'mongoose';
import { z } from 'zod';
import {
  Chunk,
  DIFFICULTIES,
  OPTION_IDS,
  Question,
  TopicSection,
  TranscriptSegment,
  type Difficulty,
} from '../../models/index.js';
import { logger } from '../../utils/logger.js';
import { LlmError, type LlmClient } from '../llm/client.js';
import { linkEvidence } from '../summaries/evidence.js';

/**
 * MCQ generation (PC.3). For each APPROVED topic section, the shared LLM client (a pretrained hosted
 * model; we only prompt it) is asked for multiple-choice questions as strict JSON. Each question's
 * supporting quote is located in the section's own transcript with Member B's evidence linker —
 * a question whose quote cannot be found is DISCARDED rather than saved with an unverifiable
 * citation. Every saved question is `pending_review`; nothing is ever saved approved.
 */

export const MCQ_PROMPT_VERSION = 'mcq-v1';
const MAX_QUOTE_WORDS = 30;

export class QuestionProviderError extends Error {
  readonly retryAfterSec: number | null;
  constructor(options?: { cause?: unknown; retryAfterSec?: number | null }) {
    super('The language model provider is unavailable', options);
    this.name = 'QuestionProviderError';
    this.retryAfterSec = options?.retryAfterSec ?? null;
  }
}

const optionSchema = z.object({ id: z.enum(OPTION_IDS), text: z.string().trim().min(1).max(300) });

export const generatedQuestionSchema = z.object({
  stem: z.string().trim().min(10).max(500),
  options: z
    .array(optionSchema)
    .length(4)
    .refine((o) => [...o.map((x) => x.id)].sort().join('') === OPTION_IDS.join(''), 'options must have ids a, b, c, d')
    .refine((o) => new Set(o.map((x) => x.text.toLowerCase())).size === 4, 'options must be distinct'),
  correctOptionId: z.enum(OPTION_IDS),
  explanation: z.string().trim().min(1).max(600),
  quote: z
    .string()
    .trim()
    .min(1)
    .max(300)
    .refine((q) => q.split(/\s+/).length <= MAX_QUOTE_WORDS, `quote must be at most ${MAX_QUOTE_WORDS} words`),
  difficulty: z.enum(DIFFICULTIES).optional(),
});

export const generationResponseSchema = z.object({ questions: z.array(generatedQuestionSchema).min(1).max(10) });
export type GeneratedQuestion = z.infer<typeof generatedQuestionSchema>;

export function questionPrompt(sectionText: string, label: string, count: number, difficulty?: Difficulty): string {
  return [
    `Write ${count} multiple-choice question${count === 1 ? '' : 's'} for students about one section of a recorded lecture ("${label}").`,
    'Rules:',
    '1. Every question must be answerable from the PASSAGE below alone — no outside knowledge.',
    '2. Exactly four options with ids "a", "b", "c", "d"; exactly ONE is correct (correctOptionId).',
    '3. Wrong options must be plausible but clearly wrong according to the passage.',
    '4. "explanation": one sentence saying why the correct option is right, from the passage.',
    `5. "quote": a SHORT quote (at most ${MAX_QUOTE_WORDS} words) copied VERBATIM from the passage that supports the answer.`,
    difficulty ? `6. Difficulty: ${difficulty}.` : '6. "difficulty": one of "easy", "medium", "hard".',
    'Return exactly: {"questions": [{"stem": "...", "options": [{"id": "a", "text": "..."}, {"id": "b", "text": "..."}, {"id": "c", "text": "..."}, {"id": "d", "text": "..."}], "correctOptionId": "a", "explanation": "...", "quote": "...", "difficulty": "medium"}]}',
    '',
    'PASSAGE:',
    sectionText,
  ].join('\n');
}

/** `count` questions spread over `n` topics in order: as even as possible, earlier topics first. */
export function allocate(count: number, n: number): number[] {
  return Array.from({ length: n }, (_, i) => Math.floor(count / n) + (i < count % n ? 1 : 0));
}

export interface GenerateOptions {
  lectureId: string;
  count: number;
  topicIds?: string[];
  difficulty?: Difficulty;
  llm: LlmClient;
  model: string;
}

export interface GenerationReport {
  created: Array<NonNullable<Awaited<ReturnType<typeof Question.findById>>>>;
  /** Questions the model returned whose quote could not be located in the section. */
  discardedUnlocatable: number;
  /** Topics whose model output was unusable even after the client's retry. */
  failedTopics: number;
}

/** Throws NoApprovedTopicsError when nothing approved matches; QuestionProviderError when the LLM is down. */
export class NoApprovedTopicsError extends Error {}

export async function generateQuestions(options: GenerateOptions): Promise<GenerationReport> {
  const topics = await TopicSection.approvedFor(options.lectureId)
    .where(options.topicIds?.length ? { _id: { $in: options.topicIds } } : {})
    .sort({ index: 1 })
    .exec();
  if (topics.length === 0) throw new NoApprovedTopicsError();

  const [segments, chunks] = await Promise.all([
    TranscriptSegment.find({ lectureId: options.lectureId }).sort({ index: 1 }).lean(),
    Chunk.find({ lectureId: options.lectureId }).sort({ index: 1 }).select('segmentStart segmentEnd text').lean(),
  ]);
  const chunkInputs = chunks.map((c) => ({ id: c._id as Types.ObjectId, segmentStart: c.segmentStart, segmentEnd: c.segmentEnd, text: c.text }));

  const report: GenerationReport = { created: [], discardedUnlocatable: 0, failedTopics: 0 };
  const shares = allocate(options.count, topics.length);

  for (const [i, topic] of topics.entries()) {
    const wanted = shares[i]!;
    if (wanted === 0) continue;
    const sectionSegments = segments
      .filter((s) => s.index >= topic.segmentStart && s.index <= topic.segmentEnd)
      .map((s) => ({ id: s._id, index: s.index, startSec: s.startSec, endSec: s.endSec, text: s.text }));
    const sectionText = sectionSegments.map((s) => s.text).join(' ');
    if (!sectionText.trim()) continue;

    let generated: GeneratedQuestion[];
    try {
      ({ questions: generated } = await options.llm.generateJson(
        questionPrompt(sectionText, topic.label, wanted, options.difficulty),
        generationResponseSchema,
      ));
    } catch (error) {
      if (error instanceof LlmError && error.status === null) {
        report.failedTopics += 1;
        logger.warn('Question generation: model output unusable for a topic; skipped', { lectureId: options.lectureId, topicId: String(topic._id), error });
        continue;
      }
      throw new QuestionProviderError({ cause: error, retryAfterSec: error instanceof LlmError ? error.retryAfterSec : null });
    }

    for (const q of generated.slice(0, wanted)) {
      // The quote must be found in THIS section's transcript; the evidence span is the segment's.
      const [evidence] = linkEvidence([q.quote], sectionSegments, chunkInputs, 1);
      if (!evidence) {
        report.discardedUnlocatable += 1;
        logger.warn('Question generation: quote not found in the section; question discarded', {
          lectureId: options.lectureId, topicId: String(topic._id), quote: q.quote.slice(0, 120),
        });
        continue;
      }
      report.created.push(
        await Question.create({
          lectureId: options.lectureId,
          topicId: topic._id,
          type: 'mcq',
          difficulty: q.difficulty ?? options.difficulty ?? 'medium',
          stem: q.stem,
          options: [...q.options].sort((a, b) => a.id.localeCompare(b.id)),
          correctOptionId: q.correctOptionId,
          explanation: q.explanation,
          evidence: [{ chunkId: evidence.chunkId, startSec: evidence.startSec, endSec: evidence.endSec, quote: evidence.quote }],
          status: 'pending_review', // NEVER saved approved — a teacher must review it
          rejectionReason: null,
          reviewedBy: null,
          reviewedAt: null,
          reviewNote: null,
          model: options.model,
          promptVersion: MCQ_PROMPT_VERSION,
        }),
      );
    }
  }
  return report;
}
