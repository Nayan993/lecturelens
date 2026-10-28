/**
 * Mock search and Q&A. There are no embeddings in mock mode: every retriever value is served by
 * a simple keyword-overlap score over the fixture chunks, labelled with the retriever requested.
 */
import type { GroundedAnswer, Lecture, RetrievedPassage, User } from '../../types';
import type { QaService, SearchService } from '../types';
import { clone, db, deepLink, delay, fail, requireUser } from './db';

const STOPWORDS = new Set(
  'the and for are but not you all any can had her was one our out has have this that with what when why how does from they will would there their into about which been were them then than its it'.split(' '),
);

export const terms = (text: string): string[] =>
  (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => w.length >= 3 && !STOPWORDS.has(w));

/** Lectures whose content the user may search (students: ready + approved transcript). */
function searchable(user: User): Lecture[] {
  return db.lectures.filter((l) =>
    user.role === 'teacher' ? l.uploadedBy === user.id : l.status === 'ready' && l.transcriptApproved,
  );
}

function rank(user: User, query: string, lectureId: string | undefined, topK: number, retriever: RetrievedPassage['retriever']) {
  const lectures = new Map(searchable(user).map((l) => [l.id, l]));
  const queryTerms = [...new Set(terms(query))];
  if (queryTerms.length === 0) return [];
  return db.chunks
    .filter((c) => lectures.has(c.lectureId) && (!lectureId || c.lectureId === lectureId))
    .map((chunk) => {
      const chunkTerms = terms(chunk.text);
      const hits = queryTerms.reduce((n, t) => n + chunkTerms.filter((w) => w === t).length, 0);
      const coverage = queryTerms.filter((t) => chunkTerms.includes(t)).length / queryTerms.length;
      return { chunk, score: Math.round((coverage + Math.min(hits, 10) / 100) * 10000) / 10000 };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(({ chunk, score }, i): RetrievedPassage => ({
      chunkId: chunk.id,
      lectureId: chunk.lectureId,
      lectureTitle: lectures.get(chunk.lectureId)!.title,
      startSec: chunk.startSec,
      endSec: chunk.endSec,
      text: chunk.text,
      score,
      retriever,
      rank: i + 1,
      deepLink: deepLink(chunk.lectureId, chunk.startSec),
    }));
}

export const mockSearchService: SearchService = {
  async search({ query, lectureId, retriever = 'hybrid', topK = 5 }) {
    const started = performance.now();
    await delay();
    const user = requireUser();
    const details: Record<string, string> = {};
    if (!query.trim() || query.length > 500) details.query = 'Must be 1–500 characters';
    if (!Number.isInteger(topK) || topK < 1 || topK > 20) details.topK = 'Must be 1–20';
    if (Object.keys(details).length) fail(422, 'VALIDATION_FAILED', 'Request body is invalid.', details);
    const items = rank(user, query, lectureId, topK, retriever);
    return { query, retriever, items, tookMs: Math.round(performance.now() - started) };
  },
};

/** The answered fixture covers why a too-large learning rate diverges; anything else abstains. */
const ANSWERED_TOPIC = /learning rate|step size|\beta\b|diverg|blow|overshoot|too (large|big|high)|nan\b/i;
const RELEVANCE_THRESHOLD = 0.5;
const CONTEXT_K = 3;

export const mockQaService: QaService = {
  async ask({ question, lectureId, retriever = 'hybrid' }) {
    const started = performance.now();
    await delay();
    const user = requireUser();
    if (question.trim().length < 3 || question.length > 500) {
      fail(422, 'VALIDATION_FAILED', 'Request body is invalid.', { question: 'Must be 3–500 characters' });
    }
    const answered = db.answers.answered;
    // Like a real RAG call, the answer may draw on any of the top-k passages, not only rank 1.
    const top = rank(user, question, lectureId, CONTEXT_K, retriever);
    const citedChunks = new Set(answered.citations.map((c) => c.chunkId));
    const canAnswer =
      ANSWERED_TOPIC.test(question) && top.some((p) => p.score >= RELEVANCE_THRESHOLD && citedChunks.has(p.chunkId));
    const base = canAnswer ? answered : db.answers.abstained;
    const result: GroundedAnswer = {
      ...clone(base),
      question,
      lectureId: lectureId ?? null,
      retriever,
      latencyMs: Math.round(performance.now() - started),
    };
    return result;
  },
};
