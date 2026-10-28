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
