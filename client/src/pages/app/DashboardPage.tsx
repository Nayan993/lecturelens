import { Link } from 'react-router-dom';
import { ArrowRight, GraduationCap, LibraryBig, Play, Target } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { isNotImplemented } from '../../lib/apiClient';
import { formatDuration, formatTimestamp } from '../../lib/formatTime';
import { lectureHref } from '../../lib/lectureLinks';
import { lastWatched } from '../../lib/playbackProgress';
import { useDocumentTitle } from '../../lib/useDocumentTitle';
import type { Lecture } from '../../types';
import { Badge, buttonClasses, Card, CardContent, CardHeader, CardTitle, EmptyState, ErrorState, Progress, Skeleton } from '../../components/ui';
import { LectureCard, LectureCardSkeleton } from '../../features/lectures/components/LectureCard';
import { useLecture, useLectures } from '../../features/lectures/hooks';
import { useRevisionPlan } from '../../features/revision/hooks';
import { TeacherDashboard } from '../teacher/TeacherDashboard';

/** "Dr. Ananya Rao" → "Ananya"; skips honorifics like "Dr." and "Prof.". */
export function firstName(name: string): string {
  return name.trim().split(/\s+/).find((p) => !p.endsWith('.')) ?? name.trim();
}

function greeting(now = new Date()): string {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

const accuracyVariant = (a: number) => (a < 0.5 ? 'danger' : a < 0.75 ? 'warning' : 'success');

function ContinueCard({ fallback }: { fallback: Lecture | undefined }) {
  const { user } = useAuth();
  const entry = user ? lastWatched(user.id) : null;
  const watchedQ = useLecture(entry?.lectureId);
  // A remembered lecture that no longer opens (removed / not visible) falls back to the newest one.
  const lecture: Lecture | undefined = entry && watchedQ.data ? watchedQ.data : fallback;
  const position = entry && watchedQ.data ? entry.position : 0;

  if (entry && watchedQ.isPending) {
    return (
      <Card className="flex flex-col gap-3 p-5" aria-busy="true" aria-label="Loading your last lecture">
        <Skeleton width="25%" height={12} />
        <Skeleton width="60%" height={20} />
        <Skeleton height={6} className="rounded-full" />
        <Skeleton width={120} height={36} />
      </Card>
    );
  }
  if (!lecture) return null;
  const duration = (entry && watchedQ.data ? entry.duration : 0) || lecture.durationSec || 0;
  const started = position > 0;
  const pct = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 py-5 md:flex-row md:items-center md:justify-between md:gap-8">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">{started ? 'Continue where you left off' : 'Start with the newest lecture'}</p>
          <p className="truncate text-lg font-semibold text-ink-1">{lecture.title}</p>
          <p className="text-sm text-ink-2">
            {lecture.uploadedByName}
            {duration > 0 && ` · ${started ? `${formatTimestamp(position)} of ${formatTimestamp(duration)}` : formatDuration(duration)}`}
          </p>
          <Progress label={`Watched ${Math.round(pct)}% of ${lecture.title}`} value={pct} className="mt-1 [&>div]:h-1" />
        </div>
        <Link to={lectureHref(lecture.id, started ? position : null)} className={buttonClasses({ size: 'lg' })}>
          <Play aria-hidden className="h-4 w-4" />
          {started ? 'Resume' : 'Start lecture'}
        </Link>
      </CardContent>
    </Card>
  );
}

function WeakTopicsCard() {
  const planQ = useRevisionPlan();
  const items = planQ.data?.items.slice(0, 3) ?? [];
  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Target aria-hidden className="h-4 w-4 text-accent" />
          Your weak topics
        </CardTitle>
        {items.length > 0 && (
          <Link to="/app/revision" className="text-sm font-medium text-brand underline-offset-4 hover:underline">
            Full plan
          </Link>
        )}
      </CardHeader>
      <CardContent className="flex-1">
        {planQ.isPending ? (
          <ul className="flex flex-col gap-3" aria-busy="true" aria-label="Loading weak topics">
            {Array.from({ length: 3 }, (_, i) => (
              <li key={i} className="flex items-center justify-between gap-3">
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton width="70%" height={14} />
                  <Skeleton width={70} height={18} className="rounded-full" />
                </div>
                <Skeleton width={84} height={32} />
              </li>
            ))}
          </ul>
        ) : planQ.isError ? (
          isNotImplemented(planQ.error) ? (
            <ErrorState variant="notImplemented" message="Your personalised revision plan is still being built." className="border-0 px-2 py-4" />
          ) : (
            <ErrorState message={planQ.error.message} onRetry={() => void planQ.refetch()} className="border-0 px-2 py-4" />
          )
        ) : items.length === 0 ? (
          <EmptyState icon={<GraduationCap />} title="Nothing to revise yet" description="Take a quiz and your weakest topics will show up here." className="border-0 py-6" />
        ) : (
          <ol className="flex flex-col divide-y divide-border">
            {items.map((item) => (
              <li key={item.topicId} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="text-sm font-medium text-ink-1">{item.topicLabel}</p>
                  <div className="flex items-center gap-2">
                    <Badge variant={accuracyVariant(item.accuracy)}>{Math.round(item.accuracy * 100)}% correct</Badge>
                    <span className="text-xs text-ink-2">
                      {item.correct} of {item.attempted} answers
                    </span>
                  </div>
                </div>
                <Link
                  to={lectureHref(item.lectureId, item.startSec)}
                  aria-label={`Revise ${item.topicLabel} from ${formatTimestamp(item.startSec)}`}
                  className={buttonClasses({ variant: 'secondary', size: 'sm' })}
                >
                  Revise
                  <ArrowRight aria-hidden className="h-3.5 w-3.5" />
                </Link>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function StudentDashboard() {
  const { user } = useAuth();
  useDocumentTitle('Dashboard');
  const lecturesQ = useLectures({ limit: 6 });
  const lectures = lecturesQ.data?.items ?? [];
  const total = lecturesQ.data?.total;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-1">
          {greeting()}, {user ? firstName(user.name) : 'there'}
        </h1>
        {lecturesQ.isPending ? (
          <Skeleton width={180} height={16} />
        ) : (
          total !== undefined && (
            <p className="text-sm text-ink-2">
              {total === 0 ? 'No lectures are available yet.' : `${total} ${total === 1 ? 'lecture is' : 'lectures are'} ready for you.`}
            </p>
          )
        )}
      </header>

      {lecturesQ.isError ? (
        isNotImplemented(lecturesQ.error) ? (
          <ErrorState variant="notImplemented" />
        ) : (
          <ErrorState message={lecturesQ.error.message} onRetry={() => void lecturesQ.refetch()} />
        )
      ) : total === 0 ? (
        <EmptyState icon={<LibraryBig />} title="No lectures yet — ask your teacher to upload one" description="Once a lecture is ready it appears here." />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <section aria-labelledby="continue-title" className="flex flex-col gap-3">
              <h2 id="continue-title" className="text-sm font-semibold text-ink-2">
                Continue
              </h2>
              {/* A remembered lecture doesn't need the list, so its card starts loading immediately. */}
              {lecturesQ.isPending && !(user && lastWatched(user.id)) ? (
                <Card className="flex flex-col gap-3 p-5" aria-busy="true" aria-label="Loading">
                  <Skeleton width="25%" height={12} />
                  <Skeleton width="60%" height={20} />
                  <Skeleton height={6} className="rounded-full" />
                  <Skeleton width={120} height={36} />
                </Card>
              ) : (
                <ContinueCard fallback={lectures[0]} />
              )}
            </section>
            <section aria-label="Weak topics" className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-ink-2">Revision</h2>
              <WeakTopicsCard />
            </section>
          </div>

          <section aria-labelledby="recent-title" className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 id="recent-title" className="text-sm font-semibold text-ink-2">
                Recent lectures
              </h2>
              <Link to="/app/lectures" className="text-sm font-medium text-brand underline-offset-4 hover:underline">
                All lectures
              </Link>
            </div>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy={lecturesQ.isPending || undefined}>
              {lecturesQ.isPending
                ? Array.from({ length: 3 }, (_, i) => (
                    <li key={i}>
                      <LectureCardSkeleton />
                    </li>
                  ))
                : lectures.map((lecture) => (
                    <li key={lecture.id}>
                      <LectureCard lecture={lecture} />
                    </li>
                  ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

/** /app/dashboard: per role. */
export function DashboardPage() {
  const { user } = useAuth();
  if (user?.role === 'teacher') return <TeacherDashboard />;
  return <StudentDashboard />;
}
