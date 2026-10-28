import { cn } from '../../lib/cn';
import { Skeleton } from '../ui';

/** Suspense / auth-loading fallback shaped like a page: title, intro line, content block. */
export function PageSkeleton({ fullScreen = false }: { fullScreen?: boolean }) {
  return (
    <div
      role="status"
      aria-label="Loading page"
      className={cn('flex w-full flex-col gap-4', fullScreen && 'mx-auto min-h-screen max-w-5xl px-6 py-10')}
    >
      <Skeleton width="40%" height={28} />
      <Skeleton width="65%" />
      <Skeleton height={220} className="mt-2 rounded-card" />
    </div>
  );
}
