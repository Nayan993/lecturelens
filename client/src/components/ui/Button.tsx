import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg';

export const buttonBase =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

// Solid fills use text-surface: white on light, near-black on dark, so contrast holds in both themes.
export const buttonVariantClasses: Record<ButtonVariant, string> = {
  primary: 'rounded-control bg-brand text-surface shadow-sm hover:bg-brand-hover disabled:hover:bg-brand',
  secondary:
    'rounded-control border border-border bg-surface text-ink-1 shadow-sm hover:bg-bg disabled:hover:bg-surface',
  ghost: 'rounded-control text-ink-1 hover:bg-ink-1/5 disabled:hover:bg-transparent',
  danger: 'rounded-control bg-danger text-surface shadow-sm hover:bg-danger/90 disabled:hover:bg-danger',
  link: 'rounded-sm text-brand underline-offset-4 hover:underline disabled:hover:no-underline',
};

export const buttonSizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-9 px-4 text-sm',
  lg: 'h-11 px-5 text-base',
};

const LINK_SIZE_CLASSES: Record<ButtonSize, string> = { sm: 'text-sm', md: 'text-sm', lg: 'text-base' };

/** Button styling for non-button elements, e.g. a router <Link> that should look like a Button. */
export function buttonClasses({ variant = 'primary', size = 'md' }: { variant?: ButtonVariant; size?: ButtonSize } = {}) {
  return cn(buttonBase, buttonVariantClasses[variant], variant === 'link' ? LINK_SIZE_CLASSES[size] : buttonSizeClasses[size]);
}

const iconSlot ='inline-flex shrink-0 [&>svg]:h-4 [&>svg]:w-4';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner in place of leftIcon and disables the button. */
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      type = 'button',
      className,
      children,
      ...props
    },
    ref,
  ) => (
    <button
      {...props}
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        buttonBase,
        buttonVariantClasses[variant],
        variant === 'link' ? LINK_SIZE_CLASSES[size] : buttonSizeClasses[size],
        fullWidth && 'w-full',
        className,
      )}
    >
      {loading ? (
        <Spinner size="sm" />
      ) : (
        leftIcon && (
          <span aria-hidden className={iconSlot}>
            {leftIcon}
          </span>
        )
      )}
      {children}
      {rightIcon && !loading && (
        <span aria-hidden className={iconSlot}>
          {rightIcon}
        </span>
      )}
    </button>
  ),
);
Button.displayName = 'Button';
