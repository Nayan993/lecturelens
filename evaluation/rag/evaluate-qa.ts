/**
 * Grounded-QA evaluation (PC.2).   npx tsx evaluation/rag/evaluate-qa.ts
 *
 * Runs the 30 gold questions through answerQuestion() — the same code POST /ask runs: hybrid
 * retrieval, the relevance gate, the shared LLM client (REAL calls to the configured provider,
 * key from server/.env), validation — on Lecture 7 in a throwaway in-memory MongoDB.
 *   citation validity     every returned citation's [startSec, endSec] lies inside its cited chunk
 *   citation correctness  of the answered answerable questions, the share with ≥ 1 citation that
 *                         overlaps the gold span
 *   abstention precision  of the abstentions, the share whose gold label is unanswerable
 *   abstention recall     of the unanswerable questions, the share that abstained
 *   latency               mean and p95 of the end-to-end answerQuestion() time (successful attempt;
 *                         client-side 429 back-off included, the script's own pauses are not)
 * Writes results-qa.csv and qa-details.json (every answer, for the failure cases in README.md).
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadEvalLecture, loadLabels, overlaps } from './lecture.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const round3 = (n: number) => Math.round(n * 1000) / 1000;
const percentile = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)] ?? 0;
};
const ratio = (n: number, d: number) => (d ? round3(n / d) : 'n/a');

async function main(): Promise<void> {
  const labels = loadLabels();
  const fixture = await loadEvalLecture(labels.items[0]!.lectureId);
  const { getLlmClient, llmModelName } = await import('../../server/src/services/llm/client.js');
  const { answerQuestion } = await import('../../server/src/services/rag/answer.js');
  const { ragMinScore, ragTopK } = await import('../../server/src/services/rag/settings.js');
  const { Chunk } = await import('../../server/src/models/index.js');

  const llm = getLlmClient();
  if (!llm) throw new Error('No LLM is configured (GROQ_API_KEY / OPENROUTER_API_KEY in server/.env) — the QA evaluation needs real model calls.');
  const model = llmModelName();
  const chunks = new Map((await Chunk.find().lean()).map((c) => [String(c._id), c]));

  const details: Array<Record<string, unknown>> = [];
  for (const q of labels.items) {
    let result: Awaited<ReturnType<typeof answerQuestion>> | null = null;
    let error: string | null = null;
    let latencyMs = 0;
    // The free tier allows ~8 000 tokens a minute: a question that hits the limit even after the
    // client's own retries is retried here after a pause. Only the successful attempt is timed.
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const t0 = performance.now();
      try {
        result = await answerQuestion({ question: q.question, lectures: [fixture.lecture], retriever: 'hybrid', llm, model });
        error = null;
        latencyMs = performance.now() - t0;
        break;
      } catch (err) {
        error = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
        latencyMs = performance.now() - t0;
        if (attempt < 4) await new Promise((r) => setTimeout(r, 30_000));
      }
    }
    const citations = result?.citations ?? [];
    const valid = citations.every((c) => {
      const chunk = chunks.get(c.chunkId);
      return !!chunk && c.startSec >= chunk.startSec && c.endSec <= chunk.endSec && chunk.text.includes(c.quote);
    });
    details.push({
      id: q.id, question: q.question, goldAnswerable: q.answerable, goldSpan: q.answerable ? [q.relevantStartSec, q.relevantEndSec] : null,
      referenceAnswer: q.referenceAnswer ?? null,
      abstained: result?.abstained ?? null, abstainReason: result?.abstainReason ?? null, answer: result?.answer ?? null,
      confidence: result?.confidence ?? null, topScore: result?.topScore ?? null, topSimilarity: result ? round3(result.topSimilarity ?? -1) : null,
      citations: citations.map((c) => ({ marker: c.marker, startSec: c.startSec, endSec: c.endSec, quote: c.quote, overlapsGold: overlaps(c.startSec, c.endSec, q) })),
      citationsValid: valid, latencyMs: Math.round(latencyMs), error,
    });
    console.log(`${q.id} ${q.answerable ? 'A' : 'U'} → ${error ? `ERROR ${error}` : result!.abstained ? `abstain ${result!.abstainReason}` : `answer (${citations.length} cit.)`} ${Math.round(latencyMs)} ms`);
  }

  const ok = details.filter((d) => d.error === null);
  const abstained = ok.filter((d) => d.abstained === true);
  const answered = ok.filter((d) => d.abstained === false);
  const unanswerable = ok.filter((d) => d.goldAnswerable === false);
  const answeredAnswerable = answered.filter((d) => d.goldAnswerable === true);
  const allCitations = answered.flatMap((d) => d.citations as Array<{ overlapsGold: boolean }>);
  const latencies = ok.map((d) => d.latencyMs as number);

  const summary = {
    model,
    retriever: 'hybrid',
    topK: ragTopK(),
    minScore: ragMinScore(),
    questions: details.length,
    errors: details.length - ok.length,
    answered: answered.length,
    abstained: abstained.length,
    abstainedNoRelevantPassage: abstained.filter((d) => d.abstainReason === 'NO_RELEVANT_PASSAGE').length,
    abstainedLowConfidence: abstained.filter((d) => d.abstainReason === 'LOW_CONFIDENCE').length,
    abstainedParseFailed: abstained.filter((d) => d.abstainReason === 'PARSE_FAILED').length,
    citations: allCitations.length,
    citationValidity: ratio(answered.filter((d) => d.citationsValid).length, answered.length),
    citationCorrectness: ratio(answeredAnswerable.filter((d) => (d.citations as Array<{ overlapsGold: boolean }>).some((c) => c.overlapsGold)).length, answeredAnswerable.length),
    answerableAnswered: ratio(answeredAnswerable.length, ok.filter((d) => d.goldAnswerable === true).length),
    abstentionPrecision: ratio(abstained.filter((d) => d.goldAnswerable === false).length, abstained.length),
    abstentionRecall: ratio(unanswerable.filter((d) => d.abstained === true).length, unanswerable.length),
    meanLatencyMs: latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 'n/a',
    p95LatencyMs: latencies.length ? Math.round(percentile(latencies, 95)) : 'n/a',
  };

  const cols = Object.keys(summary) as Array<keyof typeof summary>;
  writeFileSync(path.join(here, 'results-qa.csv'), `${cols.join(',')}\n${cols.map((c) => summary[c]).join(',')}\n`);
  writeFileSync(path.join(here, 'qa-details.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), summary, details }, null, 2)}\n`);
  console.table([summary]);
  await fixture.stop();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
