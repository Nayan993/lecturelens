import { Link, useNavigate } from 'react-router-dom';
import { Dumbbell, GraduationCap, ListChecks, Play } from 'lucide-react';
import { isApiError, isNotImplemented } from '../../lib/apiClient';
import { formatDate } from '../../lib/formatDate';
import { formatTimestamp } from '../../lib/formatTime';
import { lectureHref } from '../../lib/lectureLinks';
import { useDocumentTitle } from '../../lib/useDocumentTitle';
import type { RevisionItem } from '../../types';
import { Badge, Button, buttonClasses, Card, EmptyState, ErrorState, Skeleton } from '../../components/ui';
import { useLectureTitles } from '../../features/lectures/hooks';
import { useRevisionPlan } from '../../features/revision/hooks';
import { useStartPracticeQuiz } from '../../features/quizzes/components/QuizPanel';
import { PAGE_NARROW } from '../../components/layout/Page';

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Priority from accuracy, always shown as words (never colour alone). */
function priority(accuracy: number): { label: string; variant: 'danger' | 'warning' | 'neutral'; level: number } {
  if (accuracy < 0.5) return { label: 'High priority', variant: 'danger', level: 3 };
  if (accuracy < 0.75) return { label: 'Medium priority', variant: 'warning', level: 2 };
  return { label: 'Low priority', variant: 'neutral', level: 1 };
}

function RevisionCard({ item, lectureTitle, lectureAccuracy }: { item: RevisionItem; lectureTitle?: string; lectureAccuracy: number }) {
  const p = priority(item.accuracy);
  const { start, pending } = useStartPracticeQuiz();
  return (
    <Card className="flex gap-4 p-5">
      <span aria-hidden className="text-3xl font-semibold leading-none tabular-nums text-ink-3">
        {item.rank}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <header className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 className="text-base font-semibold text-ink-1">
              <span className="sr-only">Priority {item.rank}: </span>
              {item.topicLabel}
            </h2>
            <p className="text-sm text-ink-2">
              {lectureTitle ?? 'Lecture'} ·{' '}
              <span className="font-mono tabular-nums text-accent-strong">
                {formatTimestamp(item.startSec)}–{formatTimestamp(item.endSec)}
              </span>
            </p>
          </div>
          <Badge variant={p.variant} icon={<span className="flex gap-0.5">{[1, 2, 3].map((n) => <span key={n} className={n <= p.level ? 'h-2.5 w-1 rounded-sm bg-current' : 'h-2.5 w-1 rounded-sm bg-current opacity-25'} />)}</span>}>
            {p.label}
          </Badge>
        </header>

        {/* The reason is the point of the plan: shown in full, never replaced by a label. */}
        <p className="prose-lecture max-w-none">{item.reason}</p>

        <dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-3">
          <div className="flex gap-1">
            <dt>Quiz accuracy</dt>
            <dd className="font-medium tabular-nums text-ink-2">{pct(item.accuracy)}</dd>
          </div>
          <div className="flex gap-1">
            <dt>Questions attempted</dt>
            <dd className="font-medium tabular-nums text-ink-2">{item.attempted}</dd>
          </div>
          <div className="flex gap-1">
            <dt>Your lecture average</dt>
            <dd className="font-medium tabular-nums text-ink-2">{pct(lectureAccuracy)}</dd>
          </div>
        </dl>

        <div className="flex flex-wrap gap-2">
          <Link to={lectureHref(item.lectureId, item.startSec)} className={buttonClasses({ size: 'sm' })} aria-label={`Watch section: ${item.topicLabel}`}>
            <Play aria-hidden className="h-3.5 w-3.5" />
            Watch section
          </Link>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Dumbbell />}
            loading={pending}
            onClick={() => start(item.lectureId, [item.topicId])}
            aria-label={`Practise ${item.topicLabel}`}
          >
            Practise
          </Button>
        </div>
      </div>
    </Card>
  );
}

/** /app/revision — the ranked plan, each item explaining why it was chosen. */
export function RevisionPage() {
  useDocumentTitle('Revision');
  const navigate = useNavigate();
  const planQ = useRevisionPlan();
  const plan = planQ.data;
  const titles = useLectureTitles(plan?.items.map((i) => i.lectureId) ?? []);

  return (
    <div className={PAGE_NARROW}>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-1">Revision plan</h1>
        {plan && (
          <p className="text-sm text-ink-2">
            Built from your {plan.basedOnAttemptIds.length} quiz {plan.basedOnAttemptIds.length === 1 ? 'attempt' : 'attempts'} · updated{' '}
            {formatDate(plan.generatedAt)}
          </p>
        )}
      </header>

      {planQ.isPending ? (
        <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading revision plan">
          {Array.from({ length: 3 }, (_, i) => (
            <Card key={i} className="flex flex-col gap-3 p-5 shadow-none">
              <Skeleton width="40%" height={18} />
              <Skeleton height={14} />
              <Skeleton width="85%" height={14} />
              <Skeleton width={180} height={30} />
            </Card>
          ))}
        </div>
      ) : planQ.isError ? (
        isNotImplemented(planQ.error) ? (
          <ErrorState variant="notImplemented" message="Personalised revision plans are still being built." />
        ) : isApiError(planQ.error) && planQ.error.status === 403 ? (
          <EmptyState icon={<GraduationCap />} title="Revision plans are for students" description="Each student’s plan is built from their own quiz results." />
        ) : (
          <ErrorState message={planQ.error.message} onRetry={() => void planQ.refetch()} />
        )
      ) : !plan || plan.items.length === 0 ? (
        <EmptyState
          icon={<ListChecks />}
          title="Take a quiz first — your plan is built from your results."
          description="After a quiz, your weakest topics appear here with the reason they were picked."
          action={{ label: 'Go to quizzes', onClick: () => navigate('/app/quizzes') }}
        />
      ) : (
        <ol className="flex flex-col gap-4">
          {[...plan.items]
            .sort((a, b) => a.rank - b.rank)
            .map((item) => (
              <li key={item.topicId}>
                <RevisionCard item={item} lectureTitle={titles.get(item.lectureId)} lectureAccuracy={plan.lectureAccuracy} />
              </li>
            ))}
        </ol>
      )}
    </div>
  );
}
