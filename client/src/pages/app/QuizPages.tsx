import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ListChecks, Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { isApiError, isNotImplemented } from '../../lib/apiClient';
import { useDocumentTitle } from '../../lib/useDocumentTitle';
import type { Question, Quiz } from '../../types';
import { Button, Card, CardContent, EmptyState, ErrorState, Select, Skeleton } from '../../components/ui';
import { useLectures } from '../../features/lectures/hooks';
import { useAttempt, useQuiz, useQuizzes } from '../../features/quizzes/hooks';
import { AttemptResults } from '../../features/quizzes/components/AttemptResults';
import { useStartPracticeQuiz } from '../../features/quizzes/components/QuizPanel';
import { QuizSummaryCard } from '../../features/quizzes/components/QuizSummaryCard';
import { QuizTaker } from '../../features/quizzes/components/QuizTaker';

/** /app/quizzes — your quizzes with coverage and best score, and a way to start a new one. */
export function QuizzesPage() {
  useDocumentTitle('Quizzes');
  const quizzesQ = useQuizzes();
  const lecturesQ = useLectures({ limit: 100 });
  const ready = (lecturesQ.data?.items ?? []).filter((l) => l.status === 'ready');
  const [lectureId, setLectureId] = useState('');
  const chosen = lectureId || ready[0]?.id || '';
  const { start, pending } = useStartPracticeQuiz();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-1">Quizzes</h1>
        <p className="text-sm text-ink-2">Short practice quizzes built only from questions your teacher has approved.</p>
      </header>

      <Card>
        <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-end">
          <Select label="Start a practice quiz on" value={chosen} onChange={(e) => setLectureId(e.target.value)} containerClassName="flex-1" disabled={ready.length === 0}>
            {ready.length === 0 && <option value="">No lectures ready yet</option>}
            {ready.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </Select>
          <Button leftIcon={<Plus />} loading={pending} disabled={!chosen} onClick={() => start(chosen)}>
            Start quiz
          </Button>
        </CardContent>
      </Card>

      <section aria-labelledby="your-quizzes" className="flex flex-col gap-3">
        <h2 id="your-quizzes" className="text-sm font-semibold text-ink-2">
          Your quizzes
        </h2>
        {quizzesQ.isPending ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2" aria-busy="true" aria-label="Loading quizzes">
            <Skeleton height={150} className="rounded-card" />
            <Skeleton height={150} className="rounded-card" />
          </div>
        ) : quizzesQ.isError ? (
          isNotImplemented(quizzesQ.error) ? (
            <ErrorState variant="notImplemented" message="Quizzes aren’t available yet." />
          ) : (
            <ErrorState message={quizzesQ.error.message} onRetry={() => void quizzesQ.refetch()} />
          )
        ) : quizzesQ.data.items.length === 0 ? (
          <EmptyState icon={<ListChecks />} title="No quizzes yet" description="Start one above — it takes about five minutes." />
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {quizzesQ.data.items.map((q) => (
              <li key={q.id}>
                <QuizSummaryCard quiz={q} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Teachers can open a quiz on their lecture but only students submit attempts (§5.7). */
function TeacherPreview({ quiz }: { quiz: Quiz }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-2">Preview — only students can submit attempts.</p>
      <ol className="flex flex-col gap-2">
        {(quiz.questions as Question[]).map((q, i) => (
          <li key={q.id}>
            <Card className="p-4 shadow-none">
              <p className="font-medium text-ink-1">
                {i + 1}. {q.stem}
              </p>
              <p className="mt-1 text-sm text-ink-2">Answer: {q.options.find((o) => o.id === q.correctOptionId)?.text}</p>
            </Card>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** /app/quizzes/:id — take the quiz, or see an attempt's results with ?attempt=<id>. */
export function QuizPage() {
  const { id } = useParams<{ id: string }>();
  const [params, setParams] = useSearchParams();
  const attemptId = params.get('attempt') ?? undefined;
  const { user } = useAuth();
  const quizQ = useQuiz(id);
  const attemptQ = useAttempt(attemptId);
  useDocumentTitle(quizQ.data?.title ?? 'Quiz');

  const loading = quizQ.isPending || (attemptId !== undefined && attemptQ.isPending);
  const error = quizQ.error ?? attemptQ.error;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div className="flex flex-col gap-1">
        <Link to="/app/quizzes" className="inline-flex w-fit items-center gap-1 text-sm text-ink-2 hover:text-ink-1">
          <ArrowLeft aria-hidden className="h-4 w-4" />
          All quizzes
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-1">{quizQ.data?.title ?? 'Quiz'}</h1>
        {attemptQ.data && <p className="text-sm text-ink-2">Results</p>}
      </div>

      {loading ? (
        <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading quiz">
          <Skeleton width="30%" height={14} />
          <Skeleton height={6} className="rounded-full" />
          <Skeleton height={260} className="rounded-card" />
        </div>
      ) : error ? (
        isNotImplemented(error) ? (
          <ErrorState variant="notImplemented" message="Quizzes aren’t available yet." />
        ) : isApiError(error) && error.status === 404 ? (
          <EmptyState icon={<ListChecks />} title="Quiz not found" description="It may have been removed." />
        ) : (
          <ErrorState message={error.message} onRetry={() => void Promise.all([quizQ.refetch(), attemptQ.refetch()])} />
        )
      ) : attemptQ.data ? (
        <AttemptResults attempt={attemptQ.data} quiz={quizQ.data} />
      ) : !quizQ.data ? null : quizQ.data.questions.length === 0 ? (
        <EmptyState icon={<ListChecks />} title="This quiz has no questions available" description="Its questions may have been withdrawn by your teacher." />
      ) : user?.role === 'teacher' ? (
        <TeacherPreview quiz={quizQ.data} />
      ) : (
        <QuizTaker quiz={quizQ.data} onSubmitted={(attempt) => setParams({ attempt: attempt.id })} />
      )}
    </div>
  );
}
