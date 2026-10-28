import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, LibraryBig, Search, Upload } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { isNotImplemented } from '../../lib/apiClient';
import { cn } from '../../lib/cn';
import { useDocumentTitle } from '../../lib/useDocumentTitle';
import type { Lecture } from '../../types';
import { Button, buttonClasses, EmptyState, ErrorState, Input, Select, Skeleton } from '../../components/ui';
import { LectureCard, LectureCardSkeleton } from '../../features/lectures/components/LectureCard';
import { useLectures } from '../../features/lectures/hooks';
import { TeacherLecturesTable } from '../../features/lectures/components/TeacherLecturesTable';
import { useReviewQueue } from '../../features/review/hooks';

export const PAGE_SIZE = 12;

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'ready', label: 'Ready' },
  { value: 'processing', label: 'Processing' },
] as const;
type Filter = (typeof FILTERS)[number]['value'];

const SORTS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'longest', label: 'Longest first' },
  { value: 'title', label: 'Title A–Z' },
] as const;
type Sort = (typeof SORTS)[number]['value'];

const matchesFilter = (l: Lecture, f: Filter) =>
  f === 'all' || (f === 'ready' ? l.status === 'ready' : l.status !== 'ready' && l.status !== 'failed');

const SORTERS: Record<Sort, (a: Lecture, b: Lecture) => number> = {
  newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
  longest: (a, b) => (b.durationSec ?? -1) - (a.durationSec ?? -1),
  title: (a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }),
};

/**
 * /app/lectures. Search, filter and sort apply client-side to the fetched page; pagination uses the
 * Paginated<T> envelope. State lives in the URL so back/forward and shared links keep it.
 */
export function LecturesPage() {
  const { user } = useAuth();
  const isTeacher = user?.role === 'teacher';
  const title = user?.role === 'teacher' ? 'My Lectures' : 'Lectures';
  useDocumentTitle(title);
  const [params, setParams] = useSearchParams();

  const q = params.get('q') ?? '';
  const filter = (FILTERS.some((f) => f.value === params.get('filter')) ? params.get('filter') : 'all') as Filter;
  const sort = (SORTS.some((s) => s.value === params.get('sort')) ? params.get('sort') : 'newest') as Sort;
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1);

  const lecturesQ = useLectures({ page, limit: PAGE_SIZE });
  const data = lecturesQ.data;

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '' || (k === 'page' && v === '1') || (k === 'filter' && v === 'all') || (k === 'sort' && v === 'newest')) next.delete(k);
      else next.set(k, v);
    }
    setParams(next, { replace: isSearchTyping(patch) });
  };

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data?.items ?? [])
      .filter((l) => matchesFilter(l, filter) && (!needle || l.title.toLowerCase().includes(needle)))
      .sort(SORTERS[sort]);
  }, [data, q, filter, sort]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-ink-1">{title}</h1>
          <p className="text-sm text-ink-2">
            {data ? `${data.total} ${data.total === 1 ? 'lecture' : 'lectures'} ${isTeacher ? 'uploaded' : 'available'}` : 'Loading your lectures…'}
          </p>
        </div>
        {isTeacher && (
          <Link to="/app/upload" className={buttonClasses()}>
            <Upload aria-hidden className="h-4 w-4" />
            Upload lecture
          </Link>
        )}
      </header>

      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <Input
          label="Search by title"
          type="search"
          leftIcon={<Search />}
          placeholder="e.g. backpropagation"
          value={q}
          onChange={(e) => update({ q: e.target.value })}
          containerClassName="flex-1"
          hint={data && data.total > data.limit ? 'Searches the lectures on this page.' : undefined}
        />
        <div className="flex flex-col gap-1.5">
          <span id="status-filter-label" className="text-sm font-medium text-ink-1">
            Status
          </span>
          <div role="group" aria-labelledby="status-filter-label" className="flex gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                aria-pressed={filter === f.value}
                onClick={() => update({ filter: f.value })}
                className={cn(
                  'h-9 rounded-full border px-3.5 text-sm font-medium transition-colors',
                  filter === f.value ? 'border-brand bg-brand-soft text-brand' : 'border-border bg-surface text-ink-2 hover:border-ink-3 hover:text-ink-1',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <Select label="Sort by" value={sort} onChange={(e) => update({ sort: e.target.value })} containerClassName="md:w-44">
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
      </div>

      {lecturesQ.isPending && isTeacher ? (
        <div aria-busy="true" aria-label="Loading lectures" className="flex flex-col gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} height={44} />
          ))}
        </div>
      ) : lecturesQ.isPending ? (
        <ul aria-busy="true" aria-label="Loading lectures" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i}>
              <LectureCardSkeleton />
            </li>
          ))}
        </ul>
      ) : lecturesQ.isError ? (
        isNotImplemented(lecturesQ.error) ? (
          <ErrorState variant="notImplemented" />
        ) : (
          <ErrorState message={lecturesQ.error.message} onRetry={() => void lecturesQ.refetch()} />
        )
      ) : data!.total === 0 ? (
        isTeacher ? (
          <EmptyState icon={<Upload />} title="No lectures yet" description="Upload your first recording to get a transcript, topics and summaries." />
        ) : (
          <EmptyState icon={<LibraryBig />} title="No lectures yet — ask your teacher to upload one" description="Lectures appear here as soon as they’re ready." />
        )
      ) : shown.length === 0 ? (
        <EmptyState
          icon={<Search />}
          title="No lectures match"
          description="Try a different title or status."
          action={{ label: 'Clear search and filters', onClick: () => update({ q: null, filter: null }) }}
        />
      ) : isTeacher ? (
        <TeacherLectureList lectures={shown} />
      ) : (
        <ul className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3', lecturesQ.isPlaceholderData && 'opacity-60')}>
          {shown.map((lecture) => (
            <li key={lecture.id}>
              <LectureCard lecture={lecture} />
            </li>
          ))}
        </ul>
      )}

      {data && data.total > 0 && (
        <nav aria-label="Pagination" className="flex items-center justify-between gap-3 border-t border-border pt-4">
          <Button variant="secondary" size="sm" leftIcon={<ChevronLeft />} disabled={page <= 1} onClick={() => update({ page: String(page - 1) })}>
            Previous
          </Button>
          <p className="text-sm text-ink-2" aria-live="polite">
            Page {Math.min(page, totalPages)} of {totalPages}
          </p>
          <Button variant="secondary" size="sm" rightIcon={<ChevronRight />} disabled={page >= totalPages} onClick={() => update({ page: String(page + 1) })}>
            Next
          </Button>
        </nav>
      )}
    </div>
  );
}

/** Typing in the search box replaces the history entry instead of adding one per keystroke. */
function isSearchTyping(patch: Record<string, string | null>): boolean {
  return Object.keys(patch).length === 1 && 'q' in patch;
}

/** Teacher variant: a table with per-lecture review counts (only teachers can query those). */
function TeacherLectureList({ lectures }: { lectures: Lecture[] }) {
  const queue = useReviewQueue();
  return <TeacherLecturesTable lectures={lectures} pendingCount={queue.pendingCount} />;
}
