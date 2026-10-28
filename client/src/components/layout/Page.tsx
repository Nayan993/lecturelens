import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

/**
 * One page rhythm for the whole app: the same h1, the same vertical gap between page sections,
 * and two content widths — wide (lists, dashboards, tables) and narrow (forms, reading, single items).
 * Workspace pages that fill the viewport (reading view, transcript review, Ask) use the same h1.
 */
export const PAGE_WIDE = 'mx-auto flex w-full flex-col gap-6';
export const PAGE_NARROW = `${PAGE_WIDE} max-w-3xl`;
export const H1 = 'text-2xl font-semibold tracking-tight text-ink-1';

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('flex flex-wrap items-end justify-between gap-x-4 gap-y-3', className)}>
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className={H1}>{title}</h1>
        {description && <div className="text-sm text-ink-2">{description}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
