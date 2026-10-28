import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** Number = px, string = any CSS length. Defaults to full width. */
  width?: number | string;
  /** Number = px, string = any CSS length. Defaults to 1rem. */
  height?: number | string;
}

/** Decorative loading placeholder. Announce loading separately (e.g. aria-busy on the region). */
export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(
  ({ width = '100%', height = '1rem', className, style, ...props }, ref) => (
    <div
      ref={ref}
      aria-hidden
      style={{ width, height, ...style }}
      className={cn(
        'relative overflow-hidden rounded-control bg-ink-1/10',
        'before:absolute before:inset-0 before:-translate-x-full before:animate-shimmer',
        'before:bg-gradient-to-r before:from-transparent before:via-surface/60 before:to-transparent',
        className,
      )}
      {...props}
    />
  ),
);
Skeleton.displayName = 'Skeleton';
