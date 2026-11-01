import { tokenize } from '../retrieval/keyword.js';

/**
 * The retrieval-side relevance gate's second signal (PC.2): LEXICAL COVERAGE — the share of the
 * question's content words that occur in a retrieved passage (exact tokens; Unicode-aware).
 *
 * Why: the embedding model (all-MiniLM-L6-v2) is English-only, so on Hindi–English lectures the
 * cosine similarity of genuinely relevant passages is squashed (e.g. 0.215 for "what is
 * association" on a lecture that explains association). Coverage is independent of the script
 * and of the model. A question passes the gate when its best cosine ≥ RAG_MIN_SCORE OR some passage
 * contains ALL of its content words. Calibrated on evaluation/rag: no unanswerable gold question
 * reaches full coverage (max 0.75), so the gate stays as strict for them as before; anything that
 * passes still faces the generation-side checks (model abstention, verbatim citations).
 */

const STOP = new Set(
  (
    'a an the of in on at to for with by from and or but is are was were be been being do does did what which who whom ' +
    'whose when where why how this that these those it its as can could should would will may might must about into than ' +
    'then so if not no yes i you we they he she me my your our their there here lecture lecturer explain describe tell ' +
    'mean means meaning please give example examples'
  ).split(' '),
);

/** The question's content words (stop words and one-character tokens removed), de-duplicated. */
export function contentTerms(question: string): string[] {
  return [...new Set(tokenize(question).filter((t) => t.length > 1 && !STOP.has(t)))];
}

/** Best share of the question's content words found in any one passage; 0 when there are none. */
export function lexicalCoverage(question: string, passageTexts: readonly string[]): number {
  const terms = contentTerms(question);
  if (terms.length === 0) return 0;
  let best = 0;
  for (const text of passageTexts) {
    const words = new Set(tokenize(text));
    best = Math.max(best, terms.filter((t) => words.has(t)).length / terms.length);
  }
  return best;
}

/** Full coverage: every content word of the question appears in one retrieved passage. */
export const FULL_COVERAGE = 1;
