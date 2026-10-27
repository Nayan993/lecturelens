import { useId, type ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import { cn } from '../../lib/cn';

/** Props shared by Input, Textarea and Select. */
export interface FieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  leftIcon?: ReactNode;
  /** Classes for the outer wrapper; `className` styles the control itself. */
  containerClassName?: string;
}

export const controlClasses =
  'w-full rounded-control border border-border bg-surface text-sm text-ink-1 shadow-sm transition-colors ' +
  'placeholder:text-ink-3 hover:border-ink-3 focus-visible:border-brand ' +
  'aria-[invalid=true]:border-danger disabled:cursor-not-allowed disabled:bg-bg disabled:text-ink-3 disabled:hover:border-border';

/** Stable ids and ARIA wiring for a labelled control with optional hint and error. */
export function useFieldIds(
  id: string | undefined,
  hint: ReactNode,
  error: ReactNode,
  describedBy: string | undefined,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const ariaDescribedBy = [describedBy, hintId, errorId].filter(Boolean).join(' ') || undefined;
  return { fieldId, hintId, errorId, ariaDescribedBy, invalid: Boolean(error) };
}

interface FieldShellProps {
  fieldId: string;
  label?: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  hintId?: string;
  error?: ReactNode;
  errorId?: string;
  className?: string;
  children: ReactNode;
}

/** Label above, control, then hint and error below. */
export function FieldShell({ fieldId, label, required, hint, hintId, error, errorId, className, children }: FieldShellProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && <FieldLabel htmlFor={fieldId} required={required}>{label}</FieldLabel>}
      {children}
      {hint && (
        <p id={hintId} className="text-xs text-ink-2">
          {hint}
        </p>
      )}
      <FieldError id={errorId}>{error}</FieldError>
    </div>
  );
}

export function FieldLabel({ htmlFor, required, children }: { htmlFor: string; required?: boolean; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-medium text-ink-1">
      {children}
      {required && (
        <span aria-hidden className="ml-0.5 text-danger">
          *
        </span>
      )}
    </label>
  );
}

export function FieldError({ id, children }: { id?: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} className="flex items-start gap-1 text-xs font-medium text-danger">
      <CircleAlert aria-hidden className="mt-px h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/** Decorative icon placed inside the left edge of a control. */
export function LeftIconSlot({ children, top = false }: { children: ReactNode; top?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'pointer-events-none absolute left-3 inline-flex text-ink-3 [&>svg]:h-4 [&>svg]:w-4',
        top ? 'top-2.5' : 'top-1/2 -translate-y-1/2',
      )}
    >
      {children}
    </span>
  );
}
