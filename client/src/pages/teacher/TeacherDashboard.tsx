import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpenCheck, ClipboardCheck, Loader, PartyPopper, Upload, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { isNotImplemented } from '../../lib/apiClient';
import { formatAge } from '../../lib/formatDate';
import { lectureHref } from '../../lib/lectureLinks';
import { useDocumentTitle } from '../../lib/useDocumentTitle';
import type { Lecture } from '../../types';
import { Badge, buttonClasses, Card, CardContent, CardHeader, CardTitle, EmptyState, ErrorState, Progress, Skeleton, StatusPill } from '../../components/ui';
import { useLectureStatus, useLectures } from '../../features/lectures/hooks';
import { progressPct } from '../../features/lectures/components/ProcessingStatusView';
import { useReviewQueue, type PendingQuestion, type PendingSummary } from '../../features/review/hooks';
import { firstName } from '../app/DashboardPage';
import { PAGE_WIDE } from '../../components/layout/Page';

function StatCard({ icon, value, label, note }: { icon: ReactNode; value: ReactNode; label: string; note?: string }) {
  return (
    <Card className="flex flex-col gap-2 p-4 shadow-none">
      <span aria-hidden className="text-ink-3 [&>svg]:h-5 [&>svg]:w-5">
        {icon}
      </span>
      {/* A div, not a p: while loading, value is a Skeleton (a div). */}
      <div className="text-3xl font-semibold tabular-nums tracking-tight text-ink-1">{value}</div>
      <p className="text-sm text-ink-2">{label}</p>
      {note && <p className="text-xs text-ink-3">{note}</p>}
    </Card>
  );
}

function ProcessingRow({ lecture }: { lecture: Lecture }) {
  const status = useLectureStatus(lecture.id); // polls every 3 s until ready / failed
  const pct = status.data ? progressPct(status.data.stages) : 0;
  return (
    <li className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between gap-3">
        <Link to={lectureHref(lecture.id)} className="tap-target min-w-0 truncate text-sm font-medium text-ink-1 hover:text-brand hover:underline">
          {lecture.title}
        </Link>
        <StatusPill status={status.data?.status ?? lecture.status} className="shrink-0" />
      </div>
      <Progress label={`${lecture.title}: ${pct}% processed`} value={pct} className="[&>div]:h-1" tone={status.data?.status === 'failed' ? 'danger' : 'brand'} />
      {status.data && <p className="text-xs text-ink-3">{status.data.statusDetail}</p>}
      {status.isError && <p className="text-xs text-ink-3">Live status unavailable right now.</p>}
    </li>
  );
}

type QueueItem = PendingSummary | PendingQuestion;
const createdAt = (i: QueueItem) => (i.kind === 'summary' ? i.summary.createdAt : i.question.createdAt);
const itemId = (i: QueueItem) => (i.kind === 'summary' ? i.summary.id : i.question.id);

/** /app/dashboard for teachers. Only real numbers: anything the contract can't provide says so. */
export function TeacherDashboard() {
  const { user } = useAuth();
  useDocumentTitle('Teacher dashboard');
  const lecturesQ = useLectures({ limit: 100 });
  const queue = useReviewQueue();
  const lectures = lecturesQ.data?.items ?? [];
  const published = lectures.filter((l) => l.status === 'ready').length;
  const processing = lectures.filter((l) => l.status !== 'ready' && l.status !== 'failed');
  const items: QueueItem[] = [...queue.summaries, ...queue.questions].sort((a, b) => createdAt(a).localeCompare(createdAt(b)));
  const loadingNumber = <Skeleton width={40} height={30} />;
  const lectureStat = (n: number) => (lecturesQ.isPending ? loadingNumber : lecturesQ.isError ? '—' : n);

  return (
    <div className={PAGE_WIDE}>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-ink-1">Welcome back, {user ? firstName(user.name) : 'there'}</h1>
          <p className="text-sm text-ink-2">Here’s what needs your attention.</p>
        </div>
        <Link to="/app/upload" className={buttonClasses({ size: 'lg' })}>
          <Upload aria-hidden className="h-4 w-4" />
          Upload lecture
        </Link>
      </header>

      {lecturesQ.isError &&
        (isNotImplemented(lecturesQ.error) ? (
          <ErrorState variant="notImplemented" message="Your lectures aren’t available yet." />
        ) : (
          <ErrorState message={lecturesQ.error.message} onRetry={() => void lecturesQ.refetch()} />
        ))}

      <section aria-label="Overview" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={<BookOpenCheck />} value={lectureStat(published)} label="Lectures published" />
        <StatCard icon={<Loader />} value={lectureStat(processing.length)} label="Currently processing" />
        <StatCard icon={<ClipboardCheck />} value={queue.isPending ? loadingNumber : queue.total} label="Items awaiting review" />
        <StatCard icon={<Users />} value="—" label="Student attempts this week" note="Needs class analytics, not in the API yet." />
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-workspace">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              Needs your review
              {queue.total > 0 && <Badge variant="accent">{queue.total}</Badge>}
            </CardTitle>
            {queue.total > 0 && (
              <Link to="/app/review" className="tap-target text-sm font-medium text-brand underline-offset-4 hover:underline">
                Open review queue
              </Link>
            )}
          </CardHeader>
          <CardContent>
            {queue.isPending ? (
              <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading review queue">
                {Array.from({ length: 4 }, (_, i) => (
                  <Skeleton key={i} height={40} />
                ))}
              </div>
            ) : queue.notImplemented ? (
              <ErrorState variant="notImplemented" message="The review queue isn’t available yet." className="border-0 py-4" />
            ) : queue.error ? (
              <ErrorState message={queue.error.message} onRetry={() => void queue.refetch()} className="border-0 py-4" />
            ) : items.length === 0 ? (
              <EmptyState icon={<PartyPopper />} title="All caught up" description="Nothing is waiting for your review. New summaries and questions will appear here." className="border-0 py-6" />
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {items.slice(0, 8).map((item) => (
                  <li key={itemId(item)} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    <Badge variant={item.kind === 'summary' ? 'brand' : 'accent'} className="w-20 justify-center">
                      {item.kind === 'summary' ? 'Summary' : 'Question'}
                    </Badge>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <p className="truncate text-sm font-medium text-ink-1">{item.topic?.label ?? 'Topic'}</p>
                      <p className="truncate text-xs text-ink-2">
                        {item.lecture.title} · {formatAge(createdAt(item))}
                      </p>
                    </div>
                    <Link
                      to={`/app/review?tab=${item.kind === 'summary' ? 'summaries' : 'questions'}&focus=${itemId(item)}`}
                      className={buttonClasses({ variant: 'secondary', size: 'sm' })}
                      aria-label={`Review ${item.kind}: ${item.topic?.label ?? ''} in ${item.lecture.title}`}
                    >
                      Review
                      <ArrowRight aria-hidden className="h-3.5 w-3.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Processing now</CardTitle>
          </CardHeader>
          <CardContent>
            {lecturesQ.isPending ? (
              <Skeleton height={48} />
            ) : processing.length === 0 ? (
              <p className="text-sm text-ink-2">Nothing is processing. New uploads appear here while they’re prepared.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {processing.map((l) => (
                  <ProcessingRow key={l.id} lecture={l} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
