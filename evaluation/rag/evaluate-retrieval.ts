/**
 * Retrieval evaluation (PC.1).   npx tsx evaluation/rag/evaluate-retrieval.ts
 *
 * For the 20 answerable gold questions and all three retrievers — through the ONE entrypoint the
 * API uses, retrieve() — computes Recall@1/5/10 and MRR (first hit within the top 10). A retrieved
 * chunk is a hit if its time range OVERLAPS the gold span. Writes results.csv and
 * retrieval-details.csv, and, for the /ask relevance gate, gate-calibration.csv: the best cosine
 * similarity between each of the 30 questions and its top RAG_TOP_K (8) hybrid passages.
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadEvalLecture, loadLabels, overlaps } from './lecture.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const RETRIEVERS = ['keyword', 'vector', 'hybrid'] as const;
const round3 = (n: number) => Math.round(n * 1000) / 1000;
const percentile = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)] ?? 0;
};

async function main(): Promise<void> {
  const labels = loadLabels();
  const lectureId = labels.items[0]!.lectureId;
  const fixture = await loadEvalLecture(lectureId);
  const { retrieve, retrieveWithSimilarity } = await import('../../server/src/services/retrieval/index.js');
  const lectures = [fixture.lecture];
  const answerable = labels.items.filter((q) => q.answerable);

  const rows: Array<Record<string, string | number>> = [];
  const details: string[] = ['retriever,id,firstHitRank,top1StartSec,top1EndSec,goldStartSec,goldEndSec'];
  for (const retriever of RETRIEVERS) {
    // Warm-up (model load, vector cache) is not part of the latency measured below.
    await retrieve({ query: 'warm up', lectures, k: 10, retriever });
    const ranks: Array<number | null> = [];
    const latencies: number[] = [];
    for (const q of answerable) {
      const t0 = performance.now();
      const passages = await retrieve({ query: q.question, lectures, k: 10, retriever });
      latencies.push(performance.now() - t0);
      const hit = passages.findIndex((p) => overlaps(p.startSec, p.endSec, q));
      ranks.push(hit >= 0 ? hit + 1 : null);
      details.push([retriever, q.id, hit >= 0 ? hit + 1 : '', passages[0]?.startSec ?? '', passages[0]?.endSec ?? '', q.relevantStartSec, q.relevantEndSec].join(','));
    }
    const at = (k: number) => round3(ranks.filter((r) => r !== null && r <= k).length / ranks.length);
    rows.push({
      retriever,
      questions: ranks.length,
      'recall@1': at(1),
      'recall@5': at(5),
      'recall@10': at(10),
      mrr: round3(ranks.reduce<number>((s, r) => s + (r ? 1 / r : 0), 0) / ranks.length),
      meanLatencyMs: round3(latencies.reduce((a, b) => a + b, 0) / latencies.length),
      p95LatencyMs: round3(percentile(latencies, 95)),
    });
  }

  // The /ask relevance gate's signal for every question (answerable or not).
  const calibration: string[] = ['id,answerable,topSimilarity'];
  const sims: Array<{ answerable: boolean; sim: number }> = [];
  for (const q of labels.items) {
    const passages = await retrieveWithSimilarity({ query: q.question, lectures, k: 8, retriever: 'hybrid' });
    const sim = Math.max(...passages.map((p) => p.similarity ?? -1));
    sims.push({ answerable: q.answerable, sim });
    calibration.push(`${q.id},${q.answerable},${round3(sim)}`);
  }

  const cols = Object.keys(rows[0]!);
  writeFileSync(path.join(here, 'results.csv'), `${[cols.join(','), ...rows.map((r) => cols.map((c) => r[c]).join(','))].join('\n')}\n`);
  writeFileSync(path.join(here, 'retrieval-details.csv'), `${details.join('\n')}\n`);
  writeFileSync(path.join(here, 'gate-calibration.csv'), `${calibration.join('\n')}\n`);

  console.log(`Lecture 7 (synthetic fixture): ${fixture.chunkCount} chunks, ${fixture.embedded} embedded in ${fixture.indexMs} ms; ${answerable.length} answerable / ${labels.items.length} questions; annotator ${labels.annotator}`);
  console.table(rows);
  const fmt = (xs: number[]) => xs.sort((a, b) => a - b).map((x) => x.toFixed(3)).join(' ');
  console.log(`gate signal (max cosine, top-8 hybrid) — answerable:   ${fmt(sims.filter((s) => s.answerable).map((s) => s.sim))}`);
  console.log(`gate signal (max cosine, top-8 hybrid) — unanswerable: ${fmt(sims.filter((s) => !s.answerable).map((s) => s.sim))}`);
  for (const t of [0.3, 0.35, 0.4, 0.45, 0.5]) {
    const passed = sims.filter((s) => s.answerable && s.sim >= t).length;
    const blocked = sims.filter((s) => !s.answerable && s.sim < t).length;
    console.log(`  threshold ${t}: answerable reach the LLM ${passed}/20 · unanswerable stopped before the LLM ${blocked}/10`);
  }
  await fixture.stop();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
