import { forwardRef, type SVGProps } from 'react';
import { cn } from '../../lib/cn';

export type SpinnerSize = 'sm' | 'md' | 'lg';

const SIZE_PX: Record<SpinnerSize, number> = { sm: 16, md: 20, lg: 28 };

export interface SpinnerProps extends Omit<SVGProps<SVGSVGElement>, 'ref'> {
  size?: SpinnerSize;
  /** When set, the spinner is announced (role="status"); otherwise it is decorative. */
  label?: string;
}

export const Spinner = forwardRef<SVGSVGElement, SpinnerProps>(
  ({ size = 'md', label, className, ...props }, ref) => (
    <svg
      ref={ref}
      viewBox="0 0 24 24"
      width={SIZE_PX[size]}
      height={SIZE_PX[size]}
      fill="none"
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn('shrink-0 animate-spin', className)}
      {...props}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  ),
);
Spinner.displayName = 'Spinner';
