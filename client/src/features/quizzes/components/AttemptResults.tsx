import { Link } from 'react-router-dom';
import { CheckCircle2, GraduationCap, Play, RotateCcw, XCircle } from 'lucide-react';
import { cn } from '../../../lib/cn';
import { formatDuration, formatTimestamp, parseTimeParam } from '../../../lib/formatTime';
import { deepLinkToHref } from '../../../lib/lectureLinks';
import type { Attempt, OptionId, Quiz } from '../../../types';
import { buttonClasses, Card, CardContent, CardHeader, CardTitle, Table, Tbody, Td, Th, Thead, Tr } from '../../../components/ui';

const LETTER: Record<OptionId, string> = { a: 'A', b: 'B', c: 'C', d: 'D' };

/** Overall score as a ring; the number is in text, the ring is decoration. */
export function ScoreRing({ accuracy, size = 96 }: { accuracy: number; size?: number }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const tone = accuracy >= 0.75 ? 'text-success' : accuracy >= 0.5 ? 'text-warning' : 'text-danger';
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden className="shrink-0 -rotate-90">
      <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeWidth="9" className="text-ink-1/10" />
      <circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={`${c * accuracy} ${c}`}
        className={tone}
      />
    </svg>
  );
}

const optionText = (quiz: Quiz | undefined, questionId: string, id: OptionId | null) =>
  id === null ? null : quiz?.questions.find((q) => q.id === questionId)?.options.find((o) => o.id === id)?.text ?? null;

/**
 * A scored attempt: overall score, per-topic breakdown, then every question with your answer, the
 * correct answer, the explanation and an evidence link to the moment in the lecture.
 */
export function AttemptResults({ attempt, quiz }: { attempt: Attempt; quiz?: Quiz }) {
  const pct = Math.round(attempt.score.accuracy * 100);
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-col items-start gap-5 py-5 sm:flex-row sm:items-center">
          <div className="relative">
            <ScoreRing accuracy={attempt.score.accuracy} />
            <span className="absolute inset-0 flex items-center justify-center text-xl font-semibold tabular-nums text-ink-1">{pct}%</span>
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <h2 className="text-xl font-semibold text-ink-1">
              {attempt.score.correct} of {attempt.score.total} correct
            </h2>
            <p className="text-sm text-ink-2">
              Finished in {formatDuration(attempt.timeTakenSec)}. Each answer below links to the moment in the lecture that explains it.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/app/revision" className={buttonClasses()}>
              <GraduationCap aria-hidden className="h-4 w-4" />
              Revise weak topics
            </Link>
            <Link to={`/app/quizzes/${attempt.quizId}`} className={buttonClasses({ variant: 'secondary' })}>
              <RotateCcw aria-hidden className="h-4 w-4" />
              Retake
            </Link>
          </div>
        </CardContent>
      </Card>

      <section aria-labelledby="per-topic-title" className="flex flex-col gap-3">
        <h2 id="per-topic-title" className="text-sm font-semibold text-ink-2">
          By topic
        </h2>
        <Table>
          <Thead>
            <Tr>
              <Th>Topic</Th>
              <Th className="text-right">Score</Th>
              <Th className="w-1/3">Accuracy</Th>
            </Tr>
          </Thead>
          <Tbody>
            {attempt.perTopic.map((t) => (
              <Tr key={t.topicId}>
                <Td className="font-medium">{t.topicLabel}</Td>
                <Td className="text-right tabular-nums text-ink-2">
                  {t.correct} / {t.total}
                </Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-ink-1/10" aria-hidden>
                      <span
                        className={cn('absolute inset-y-0 left-0 rounded-full', t.accuracy >= 0.75 ? 'bg-success' : t.accuracy >= 0.5 ? 'bg-warning' : 'bg-danger')}
                        style={{ width: `${Math.round(t.accuracy * 100)}%` }}
                      />
                    </span>
                    <span className="w-10 text-right text-xs tabular-nums text-ink-1">{Math.round(t.accuracy * 100)}%</span>
                  </div>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </section>

      <section aria-labelledby="answers-title" className="flex flex-col gap-3">
        <h2 id="answers-title" className="text-sm font-semibold text-ink-2">
          Your answers
        </h2>
        <ol className="flex flex-col gap-3">
          {attempt.answers.map((a, i) => {
            const stem = quiz?.questions.find((q) => q.id === a.questionId)?.stem;
            const yours = optionText(quiz, a.questionId, a.selectedOptionId);
            const correct = optionText(quiz, a.questionId, a.correctOptionId);
            const t = parseTimeParam(new URL(a.deepLink, 'http://x').searchParams.get('t'));
            return (
              <li key={a.questionId}>
                <Card className="shadow-none">
                  <CardHeader>
                    <div className="flex items-start gap-2">
                      {a.correct ? (
                        <CheckCircle2 aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                      ) : (
                        <XCircle aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
                      )}
                      <CardTitle className="font-medium">
                        <span className="sr-only">{a.correct ? 'Correct. ' : 'Incorrect. '}</span>
                        {i + 1}. {stem ?? 'This question is no longer available.'}
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    <dl className="grid gap-1.5 text-sm sm:grid-cols-[8rem_1fr]">
                      <dt className="text-ink-2">Your answer</dt>
                      <dd className={cn('font-medium', a.correct ? 'text-success' : 'text-ink-1')}>
                        {a.selectedOptionId ? `${LETTER[a.selectedOptionId]}. ${yours ?? ''}` : 'Not answered'}
                        {a.correct ? ' — correct' : ' — incorrect'}
                      </dd>
                      {!a.correct && (
                        <>
                          <dt className="text-ink-2">Correct answer</dt>
                          <dd className="font-medium text-ink-1">
                            {LETTER[a.correctOptionId]}. {correct ?? ''}
                          </dd>
                        </>
                      )}
                    </dl>
                    <p className="prose-lecture max-w-none text-[15.5px]">{a.explanation}</p>
                    <Link
                      to={deepLinkToHref(a.deepLink)}
                      className="inline-flex w-fit items-center gap-1.5 rounded-full border border-accent/40 bg-surface px-2.5 py-1 text-xs text-ink-1 transition-colors hover:border-accent hover:bg-accent-soft"
                    >
                      <Play aria-hidden className="h-3 w-3 fill-accent text-accent" />
                      Watch the explanation
                      {t !== null && <span className="font-mono font-semibold tabular-nums text-accent">at {formatTimestamp(t)}</span>}
                    </Link>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
