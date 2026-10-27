import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { buttonBase, buttonVariantClasses, type ButtonSize, type ButtonVariant } from './Button';
import { Spinner } from './Spinner';

const SQUARE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-8 w-8 [&>svg]:h-4 [&>svg]:w-4',
  md: 'h-9 w-9 [&>svg]:h-[18px] [&>svg]:w-[18px]',
  lg: 'h-11 w-11 [&>svg]:h-5 [&>svg]:w-5',
};

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'children'> {
  /** Required: an icon-only control has no visible text, so this is its accessible name. */
  'aria-label': string;
  icon: ReactNode;
  variant?: Exclude<ButtonVariant, 'link'>;
  size?: ButtonSize;
  loading?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    { icon, variant = 'ghost', size = 'md', loading = false, disabled, type = 'button', className, ...props },
    ref,
  ) => (
    <button
      {...props}
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonBase, buttonVariantClasses[variant], SQUARE_CLASSES[size], 'p-0', className)}
    >
      {loading ? <Spinner size="sm" /> : icon}
    </button>
  ),
);
IconButton.displayName = 'IconButton';
