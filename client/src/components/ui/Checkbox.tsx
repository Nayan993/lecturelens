import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { FieldError } from './Field';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  containerClassName?: string;
}

/** Native checkbox with a linked label; Space toggles it. */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ id, label, description, error, containerClassName, className, 'aria-describedby': describedBy, ...props }, ref) => {
    const autoId = useId();
    const inputId = id ?? autoId;
    const descriptionId = description ? `${inputId}-description` : undefined;
    const errorId = error ? `${inputId}-error` : undefined;
    return (
      <div className={cn('flex items-start gap-2.5 has-[:disabled]:opacity-60', containerClassName)}>
        <input
          {...props}
          ref={ref}
          id={inputId}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={[describedBy, descriptionId, errorId].filter(Boolean).join(' ') || undefined}
          className={cn('mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-brand disabled:cursor-not-allowed', className)}
        />
        <div className="flex flex-col gap-0.5">
          <label htmlFor={inputId} className="cursor-pointer text-sm font-medium leading-5 text-ink-1">
            {label}
          </label>
          {description && (
            <p id={descriptionId} className="text-xs text-ink-2">
              {description}
            </p>
          )}
          <FieldError id={errorId}>{error}</FieldError>
        </div>
      </div>
    );
  },
);
Checkbox.displayName = 'Checkbox';
