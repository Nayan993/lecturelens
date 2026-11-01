import { Types } from 'mongoose';
import { Attempt, RevisionRecommendation, TopicSection, type RevisionItem } from '../../models/index.js';
import { deepLinkFor } from '../../utils/deepLink.js';

/**
 * Revision plan (PC.3) — TRANSPARENT RULES, no model. For each topic the student has attempted:
 *   accuracy       = correct / attempted (this student, every attempt in scope)
 *   cohortAccuracy = the same ratio over every student's attempts on that topic (the class average)
 *   recencyFactor  = 1 if the student got a question on the topic wrong in their LATEST attempt
 *                    that covered it, else 0
 *   priorityScore  = 0.6·(1 − accuracy) + 0.3·(accuracy < cohortAccuracy ? 1 : 0) + 0.1·recencyFactor
 * Ranked by priorityScore (ties: lower accuracy, then topic order), top 5. Each `reason` states the
 * actual numbers. Only approved topics are recommended.
 */

export const MAX_ITEMS = 5;
export const WEIGHTS = Object.freeze({ inaccuracy: 0.6, belowCohort: 0.3, recency: 0.1 });

const round3 = (n: number) => Math.round(n * 1000) / 1000;
const pct = (n: number) => `${Math.round(n * 100)}%`;

export function priorityScore(accuracy: number, cohortAccuracy: number, recencyFactor: number): number {
  return round3(
    WEIGHTS.inaccuracy * (1 - accuracy) + WEIGHTS.belowCohort * (accuracy < cohortAccuracy ? 1 : 0) + WEIGHTS.recency * recencyFactor,
  );
}

export function revisionReason(correct: number, attempted: number, cohortAccuracy: number, missedLatest: boolean): string {
  const accuracy = attempted ? correct / attempted : 0;
  return (
    `You answered ${correct} of ${attempted} question${attempted === 1 ? '' : 's'} on this topic correctly ` +
    `(${pct(accuracy)}, class average ${pct(cohortAccuracy)}).` +
    (missedLatest ? ' You missed at least one on your latest attempt.' : '')
  );
}

interface Tally {
  correct: number;
  attempted: number;
  lastMissed: boolean;
}

export interface PlanScope {
  studentId: string;
  /** null = across all lectures. */
  lectureId: string | null;
}

/**
 * Builds and stores the student's plan for the scope; null when they have no attempts in it.
 * Called after every submitted attempt (§5.7), and on read when no plan exists yet.
 */
export async function generateRevisionPlan({ studentId, lectureId }: PlanScope) {
  const scope = { studentId: new Types.ObjectId(studentId), ...(lectureId ? { lectureId: new Types.ObjectId(lectureId) } : {}) };
  const attempts = await Attempt.find(scope).sort({ submittedAt: 1, _id: 1 }).lean();
  if (attempts.length === 0) return null;

  // This student's tallies; attempts are oldest first, so the last write of lastMissed wins.
  const mine = new Map<string, Tally>();
  for (const attempt of attempts) {
    const inThisAttempt = new Map<string, boolean>();
    for (const a of attempt.answers) {
      const key = String(a.topicId);
      const t = mine.get(key) ?? { correct: 0, attempted: 0, lastMissed: false };
      t.attempted += 1;
      if (a.correct) t.correct += 1;
      mine.set(key, t);
      inThisAttempt.set(key, (inThisAttempt.get(key) ?? false) || !a.correct);
    }
    for (const [key, missed] of inThisAttempt) mine.get(key)!.lastMissed = missed;
  }

  const topicIds = [...mine.keys()].map((id) => new Types.ObjectId(id));
  const [topics, cohortRows] = await Promise.all([
    TopicSection.find({ _id: { $in: topicIds } }).approvedOnly().lean(),
    Attempt.aggregate<{ _id: Types.ObjectId; correct: number; total: number }>([
      { $unwind: '$answers' },
      { $match: { 'answers.topicId': { $in: topicIds } } },
      { $group: { _id: '$answers.topicId', correct: { $sum: { $cond: ['$answers.correct', 1, 0] } }, total: { $sum: 1 } } },
    ]),
  ]);
  const cohort = new Map(cohortRows.map((r) => [String(r._id), r.total ? r.correct / r.total : 0]));

  const ranked = topics
    .map((topic) => {
      const t = mine.get(String(topic._id))!;
      const accuracy = t.attempted ? t.correct / t.attempted : 0;
      const cohortAccuracy = cohort.get(String(topic._id)) ?? accuracy;
      return { topic, t, accuracy, cohortAccuracy, priority: priorityScore(accuracy, cohortAccuracy, t.lastMissed ? 1 : 0) };
    })
    .sort((a, b) => b.priority - a.priority || a.accuracy - b.accuracy || a.topic.index - b.topic.index)
    .slice(0, MAX_ITEMS);

  const items: RevisionItem[] = ranked.map(({ topic, t, accuracy, cohortAccuracy }, i) => ({
    rank: i + 1,
    lectureId: topic.lectureId,
    topicId: topic._id,
    topicLabel: topic.label,
    startSec: topic.startSec,
    endSec: topic.endSec,
    deepLink: deepLinkFor(String(topic.lectureId), topic.startSec),
    correct: t.correct,
    attempted: t.attempted,
    accuracy: round3(accuracy),
    reason: revisionReason(t.correct, t.attempted, cohortAccuracy, t.lastMissed),
  }));

  const total = [...mine.values()].reduce((n, t) => n + t.attempted, 0);
  const correct = [...mine.values()].reduce((n, t) => n + t.correct, 0);
  return RevisionRecommendation.create({
    studentId,
    lectureId,
    generatedAt: new Date(),
    basedOnAttemptIds: attempts.map((a) => a._id),
    lectureAccuracy: round3(total ? correct / total : 0),
    items,
  });
}

/** The latest stored plan for the scope; generated when the student has attempts but no plan yet. */
export async function latestRevisionPlan(scope: PlanScope) {
  const stored = await RevisionRecommendation.findOne({
    studentId: scope.studentId,
    lectureId: scope.lectureId,
  }).sort({ generatedAt: -1, _id: -1 });
  return stored ?? generateRevisionPlan(scope);
}
