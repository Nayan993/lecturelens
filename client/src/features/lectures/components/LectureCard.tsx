import { Link } from 'react-router-dom';
import { CalendarDays, Clock, Layers, UserRound } from 'lucide-react';
import { cn } from '../../../lib/cn';
import { formatDate } from '../../../lib/formatDate';
import { formatDuration } from '../../../lib/formatTime';
import { lectureHref } from '../../../lib/lectureLinks';
import type { Lecture } from '../../../types';
import { Card, Skeleton, StatusPill } from '../../../components/ui';

/**
 * Library / dashboard card. The whole card is clickable through one real link (the title).
 * Ready lectures open the reading view; anything else is de-emphasised and opens the status view
 * (the same URL renders the status view while a lecture is not ready).
 */
export function LectureCard({ lecture, className }: { lecture: Lecture; className?: string }) {
  const ready = lecture.status === 'ready';
  return (
    <Card
      className={cn(
        'group relative flex h-full flex-col gap-3 p-4 transition-colors',
        ready ? 'hover:border-brand/40' : 'bg-bg/60 opacity-75 shadow-none hover:opacity-100',
        'has-[a:focus-visible]:outline has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-brand',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[15px] font-semibold leading-snug text-ink-1">
          <Link
            to={lectureHref(lecture.id)}
            className="outline-none after:absolute after:inset-0 after:content-[''] group-hover:text-brand"
            aria-describedby={ready ? undefined : `${lecture.id}-status-note`}
          >
            {lecture.title}
          </Link>
        </h3>
        <StatusPill status={lecture.status} className="relative shrink-0" />
      </div>
      <dl className="mt-auto grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-ink-2">
        <div className="col-span-2 flex items-center gap-1.5">
          <dt className="sr-only">Teacher</dt>
          <UserRound aria-hidden className="h-3.5 w-3.5 shrink-0 text-ink-3" />
          <dd className="truncate">{lecture.uploadedByName}</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">Added</dt>
          <CalendarDays aria-hidden className="h-3.5 w-3.5 shrink-0 text-ink-3" />
          <dd>{formatDate(lecture.createdAt)}</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">Duration</dt>
          <Clock aria-hidden className="h-3.5 w-3.5 shrink-0 text-ink-3" />
          <dd>{lecture.durationSec === null ? 'Duration pending' : formatDuration(lecture.durationSec)}</dd>
        </div>
        <div className="col-span-2 flex items-center gap-1.5">
          <dt className="sr-only">Topics</dt>
          <Layers aria-hidden className="h-3.5 w-3.5 shrink-0 text-ink-3" />
          <dd>
            {lecture.topicCount === null
              ? 'Topics not ready yet'
              : `${lecture.topicCount} ${lecture.topicCount === 1 ? 'topic' : 'topics'}`}
          </dd>
        </div>
      </dl>
      {!ready && (
        <p id={`${lecture.id}-status-note`} className="text-xs text-ink-2">
          {lecture.status === 'failed' ? 'Processing failed — open to see why.' : 'Still processing — open to see progress.'}
        </p>
      )}
    </Card>
  );
}

/** Same footprint as LectureCard, for loading states. */
export function LectureCardSkeleton() {
  return (
    <Card className="flex h-full flex-col gap-3 p-4 shadow-none" aria-hidden>
      <div className="flex items-start justify-between gap-3">
        <Skeleton width="70%" height={18} />
        <Skeleton width={56} height={20} className="rounded-full" />
      </div>
      <Skeleton width="55%" height={12} className="mt-3" />
      <div className="flex gap-3">
        <Skeleton width="35%" height={12} />
        <Skeleton width="25%" height={12} />
      </div>
      <Skeleton width="30%" height={12} />
    </Card>
  );
}
