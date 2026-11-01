import { z } from 'zod';
import { deepLinkFor } from '../../utils/deepLink.js';
import type { NumberedPassage } from './prompt.js';

/**
 * Server-side validation of the model's answer (PC.2) — nothing the model says is trusted:
 * - output that is not the expected JSON becomes PARSE_FAILED (never a 500);
 * - a cited number that is not one of the retrieved passages is dropped (hallucinated citation);
 * - a citation also needs a quote found verbatim in that passage (case and whitespace aside); a
 *   verbatim quote longer than the 300-character evidence limit is trimmed at a word boundary (still a
 *   substring of the passage) rather than dropped;
 * - every surviving citation takes lectureId, startSec, endSec and the deep link from the retrieved
 *   chunk itself (never from model output), and its quote is the passage's own text;
 * - answerable with zero surviving citations is forced to a LOW_CONFIDENCE abstention.
 */

export interface ModelCitationQuote {
  passageNumber: number;
  quote: string;
}

export const MAX_QUOTE_CHARS = 300;

/** The first ≤ MAX_QUOTE_CHARS characters of a verbatim quote, cut at a word boundary (still verbatim). */
export function trimQuote(quote: string): string {
  if (quote.length <= MAX_QUOTE_CHARS) return quote;
  const cut = quote.slice(0, MAX_QUOTE_CHARS);
  const space = cut.search(/\s\S*$/);
  return (space > 0 ? cut.slice(0, space) : cut).trim();
}

/** The JSON the prompt asks for (services/rag/prompt.ts). */
export const modelAnswerSchema = z.object({
  answer: z.string(),
  citedPassages: z.array(z.number().int()),
  citedQuotes: z.array(z.object({ passageNumber: z.number().int(), quote: z.string() })),
  answerable: z.boolean(),
  confidence: z.number().finite().min(0).max(1),
});

export type ModelAnswer = z.infer<typeof modelAnswerSchema>;

export interface ValidatedCitation {
  marker: number;
  chunkId: string;
  lectureId: string;
  startSec: number;
  endSec: number;
  quote: string;
  deepLink: string;
}

export type ValidationResult =
  | {
      answerable: false;
      abstainReason: 'PARSE_FAILED' | 'LOW_CONFIDENCE';
      answer: null;
      citations: [];
      confidence: null;
    }
  | {
      answerable: true;
      abstainReason: null;
      answer: string;
      citations: ValidatedCitation[];
      confidence: number;
    };

function abstain(reason: 'PARSE_FAILED' | 'LOW_CONFIDENCE'): ValidationResult {
  return { answerable: false, abstainReason: reason, answer: null, citations: [], confidence: null };
}

/** The model output as parsed JSON (a raw string is parsed first); null when it is not a ModelAnswer. */
export function parseModelAnswer(raw: unknown): ModelAnswer | null {
  let value = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  const parsed = modelAnswerSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/**
 * Where `quote` occurs in `text`, comparing case-insensitively with runs of whitespace collapsed.
 * Returns the passage's OWN text for that span (so the stored quote is verbatim transcript), or null.
 */
export function locateQuote(text: string, quote: string): string | null {
  const wanted = quote.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!wanted) return null;
  // Collapse whitespace in the passage while remembering where each kept character came from.
  let collapsed = '';
  const origin: number[] = [];
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;
    if (/\s/.test(ch)) {
      if (collapsed.length === 0 || collapsed.endsWith(' ')) continue;
      collapsed += ' ';
    } else collapsed += ch.toLowerCase();
    origin.push(i);
  }
  const at = collapsed.indexOf(wanted);
  if (at < 0) return null;
  return text.slice(origin[at]!, origin[at + wanted.length - 1]! + 1);
}

export function validateModelAnswer(raw: unknown, passages: NumberedPassage[]): ValidationResult {
  const parsed = parseModelAnswer(raw);
  if (!parsed) return abstain('PARSE_FAILED');
  if (!parsed.answerable || !parsed.answer.trim() || parsed.confidence <= 0) return abstain('LOW_CONFIDENCE');

  const byNumber = new Map(passages.map((p) => [p.number, p]));
  const citations: ValidatedCitation[] = [];
  for (const number of new Set(parsed.citedPassages)) {
    const passage = byNumber.get(number);
    if (!passage) continue; // hallucinated index: not one of the retrieved passages
    const claimed = parsed.citedQuotes.find((q) => q.passageNumber === number)?.quote;
    if (!claimed) continue;
    const located = locateQuote(passage.text, claimed);
    if (!located) continue; // not in that passage: the citation cannot be verified
    const quote = trimQuote(located); // models ignore the length rule; the trimmed text is still verbatim
    citations.push({
      marker: passage.number,
      chunkId: passage.chunkId,
      lectureId: passage.lectureId,
      startSec: passage.startSec,
      endSec: passage.endSec,
      quote,
      deepLink: deepLinkFor(passage.lectureId, passage.startSec),
    });
  }
  // An answer with no verifiable citation is a contract violation (§5.6): abstain instead.
  if (citations.length === 0) return abstain('LOW_CONFIDENCE');

  // Keep [n] markers only for surviving citations; make sure each citation is referenced.
  const kept = new Set(citations.map((c) => c.marker));
  let answer = parsed.answer.replace(/\[(\d+)\]/g, (marker, n: string) => (kept.has(Number(n)) ? marker : ''));
  for (const c of citations) if (!answer.includes(`[${c.marker}]`)) answer = `${answer.trim()} [${c.marker}]`;
  answer = answer.replace(/[ \t]{2,}/g, ' ').replace(/\s+([.,;:!?])/g, '$1').trim();

  citations.sort((a, b) => a.marker - b.marker);
  return { answerable: true, abstainReason: null, answer, citations, confidence: parsed.confidence };
}
