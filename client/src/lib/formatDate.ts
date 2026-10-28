/**
 * Wall-clock dates (createdAt, generatedAt …) for display. Media offsets are NOT dates —
 * those go through lib/formatTime.ts only.
 */
const DAY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** "2026-10-20T09:14:22.418Z" → "20 Oct 2026". Invalid input → "". */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : DAY.format(d);
}

/**
 * Age of a wall-clock time for queues: "just now", "12 min ago", "5 h ago", "3 days ago",
 * then the date. `now` is injectable for tests.
 */
export function formatAge(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const minutes = Math.floor((now.getTime() - then) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  return formatDate(iso);
}
