import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PartyPopper, ShieldCheck } from 'lucide-react';
import { useDocumentTitle } from '../../lib/useDocumentTitle';
import { Badge, EmptyState, ErrorState, Skeleton, Tabs } from '../../components/ui';
import { useReviewQueue } from '../../features/review/hooks';
import { QuestionReviewCard, SummaryReviewCard } from '../../features/review/components/ReviewCards';

function QueueSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading">
      <Skeleton height={180} className="rounded-card" />
      <Skeleton height={180} className="rounded-card" />
    </div>
  );
}

/** /app/review — approve, edit or reject generated summaries and questions. */
export function ReviewPage() {
  useDocumentTitle('Review Queue');
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'questions' ? 'questions' : 'summaries';
  const focus = params.get('focus');
  const queue = useReviewQueue();

  // Arriving from the dashboard's "Review" link: bring that item into view.
  useEffect(() => {
    if (!focus || queue.isPending) return;
    const el = document.getElementById(`review-${focus}`);
    el?.scrollIntoView({ block: 'center' });
    el?.querySelector<HTMLButtonElement>('button[aria-label^="Approve"]')?.focus({ preventScroll: true });
  }, [focus, queue.isPending, tab]);

  const body = (kind: 'summaries' | 'questions') => {
    if (queue.isPending) return <QueueSkeleton />;
    if (queue.notImplemented) return <ErrorState variant="notImplemented" message="Reviewing generated content isn’t available yet." />;
    if (queue.error) return <ErrorState message={queue.error.message} onRetry={() => void queue.refetch()} />;
    const list = kind === 'summaries' ? queue.summaries : queue.questions;
    if (list.length === 0) {
      return (
        <EmptyState
          icon={<PartyPopper />}
          title={kind === 'summaries' ? 'No summaries waiting' : 'No questions waiting'}
          description="Everything generated so far has been reviewed."
        />
      );
    }
    return (
      <ul className="flex flex-col gap-4 pb-6">
        {kind === 'summaries'
          ? queue.summaries.map((item) => (
              <li key={item.summary.id}>
                <SummaryReviewCard item={item} highlighted={focus === item.summary.id} />
              </li>
            ))
          : queue.questions.map((item) => (
              <li key={item.question.id}>
                <QuestionReviewCard item={item} highlighted={focus === item.question.id} />
              </li>
            ))}
      </ul>
    );
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-1">Review Queue</h1>
        <p className="text-sm text-ink-2">Generated summaries and quiz questions wait here until you decide.</p>
      </header>

      <div role="note" className="flex items-start gap-3 rounded-card border border-brand/25 bg-brand-soft px-4 py-3.5">
        <ShieldCheck aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
        <div>
          <p className="font-semibold text-ink-1">Students only ever see approved content.</p>
          <p className="text-sm text-ink-2">Anything pending or rejected here is invisible to students — in summaries, search, answers and quizzes.</p>
        </div>
      </div>

      <Tabs
        label="Review queue"
        value={tab}
        onValueChange={(v) => setParams(v === 'summaries' ? {} : { tab: v }, { replace: true })}
        items={[
          {
            value: 'summaries',
            label: (
              <span className="flex items-center gap-2">
                Summaries {!queue.isPending && <Badge variant={queue.summaries.length ? 'accent' : 'neutral'}>{queue.summaries.length}</Badge>}
              </span>
            ),
            content: body('summaries'),
          },
          {
            value: 'questions',
            label: (
              <span className="flex items-center gap-2">
                Questions {!queue.isPending && <Badge variant={queue.questions.length ? 'accent' : 'neutral'}>{queue.questions.length}</Badge>}
              </span>
            ),
            content: body('questions'),
          },
        ]}
      />
    </div>
  );
}
