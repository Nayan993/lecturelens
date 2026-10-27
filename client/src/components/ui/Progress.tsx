import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export type ProgressTone = 'brand' | 'success' | 'danger';

const TONE_CLASSES: Record<ProgressTone, string> = { brand: 'bg-brand', success: 'bg-success', danger: 'bg-danger' };

export interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  /** Accessible name; also shown above the bar when `showLabel` is set. */
  label: string;
  value?: number;
  max?: number;
  /** Unknown progress: animated bar, no aria-valuenow. */
  indeterminate?: boolean;
  showLabel?: boolean;
  tone?: ProgressTone;
}

export const Progress = forwardRef<HTMLDivElement, ProgressProps>(
  ({ label, value = 0, max = 100, indeterminate = false, showLabel = false, tone = 'brand', className, ...props }, ref) => {
    const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
    const rounded = Math.round(pct);
    return (
      <div ref={ref} className={cn('flex w-full flex-col gap-1.5', className)} {...props}>
        {showLabel && (
          <div className="flex items-baseline justify-between text-xs">
            <span className="font-medium text-ink-1">{label}</span>
            {!indeterminate && <span className="tabular-nums text-ink-2">{rounded}%</span>}
          </div>
        )}
        <div
          role="progressbar"
          aria-label={label}
          aria-valuemin={indeterminate ? undefined : 0}
          aria-valuemax={indeterminate ? undefined : max}
          aria-valuenow={indeterminate ? undefined : value}
          aria-valuetext={indeterminate ? 'In progress' : `${rounded}%`}
          aria-busy={indeterminate || undefined}
          className="relative h-2 w-full overflow-hidden rounded-full bg-ink-1/10"
        >
          {indeterminate ? (
            <div
              className={cn(
                'absolute inset-y-0 left-0 w-2/5 animate-indeterminate rounded-full',
                'motion-reduce:w-full motion-reduce:animate-none motion-reduce:opacity-40',
                TONE_CLASSES[tone],
              )}
            />
          ) : (
            <div
              className={cn('h-full rounded-full transition-[width] duration-300', TONE_CLASSES[tone])}
              style={{ width: `${pct}%` }}
            />
          )}
        </div>
      </div>
    );
  },
);
Progress.displayName = 'Progress';
