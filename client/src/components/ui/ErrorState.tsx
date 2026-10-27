import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { Hourglass, RefreshCw, TriangleAlert } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Button } from './Button';

export type ErrorStateVariant = 'error' | 'notImplemented';

export interface ErrorStateProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /**
   * `error`: something failed (role="alert", danger styling, optional retry).
   * `notImplemented`: the API answered 501 — a calm "coming soon" panel, never red, no retry.
   */
  variant?: ErrorStateVariant;
  icon?: ReactNode;
  title?: ReactNode;
  message?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
}

const DEFAULTS: Record<ErrorStateVariant, { icon: ReactNode; title: string; message: string }> = {
  error: {
    icon: <TriangleAlert />,
    title: 'Something went wrong',
    message: 'We couldn’t load this. Check your connection and try again.',
  },
  notImplemented: {
    icon: <Hourglass />,
    title: 'Coming soon',
    message: 'This part of LectureLens is still being built. Everything else keeps working — check back soon.',
  },
};

export const ErrorState = forwardRef<HTMLDivElement, ErrorStateProps>(
  ({ variant = 'error', icon, title, message, onRetry, retryLabel = 'Try again', className, ...props }, ref) => {
    const isError = variant === 'error';
    const defaults = DEFAULTS[variant];
    return (
      <div
        ref={ref}
        role={isError ? 'alert' : 'status'}
        className={cn(
          'flex flex-col items-center gap-3 rounded-card border px-6 py-8 text-center',
          isError ? 'border-danger/25 bg-danger/5' : 'border-brand/15 bg-brand-soft',
          className,
        )}
        {...props}
      >
        <span
          aria-hidden
          className={cn(
            'inline-flex h-11 w-11 items-center justify-center rounded-full [&>svg]:h-5 [&>svg]:w-5',
            isError ? 'bg-danger/10 text-danger' : 'bg-surface text-brand',
          )}
        >
          {icon ?? defaults.icon}
        </span>
        <div className="flex max-w-md flex-col gap-1">
          <h3 className="text-base font-semibold text-ink-1">{title ?? defaults.title}</h3>
          <p className="text-sm text-ink-2">{message ?? defaults.message}</p>
        </div>
        {isError && onRetry && (
          <Button variant="secondary" size="sm" leftIcon={<RefreshCw />} onClick={onRetry} className="mt-1">
            {retryLabel}
          </Button>
        )}
      </div>
    );
  },
);
ErrorState.displayName = 'ErrorState';
