import { forwardRef, useId, type FieldsetHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { FieldError } from './Field';

export interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
  description?: ReactNode;
  containerClassName?: string;
}

/** Native radio with a linked label. Radios sharing a `name` get native arrow-key navigation. */
export const Radio = forwardRef<HTMLInputElement, RadioProps>(
  ({ id, label, description, containerClassName, className, 'aria-describedby': describedBy, ...props }, ref) => {
    const autoId = useId();
    const inputId = id ?? autoId;
    const descriptionId = description ? `${inputId}-description` : undefined;
    return (
      <div className={cn('flex items-start gap-2.5 has-[:disabled]:opacity-60', containerClassName)}>
        <input
          {...props}
          ref={ref}
          id={inputId}
          type="radio"
          aria-describedby={[describedBy, descriptionId].filter(Boolean).join(' ') || undefined}
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
        </div>
      </div>
    );
  },
);
Radio.displayName = 'Radio';

export interface RadioGroupProps extends FieldsetHTMLAttributes<HTMLFieldSetElement> {
  legend: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
}

/** Groups Radio options under a <fieldset>/<legend> so the group has an accessible name. */
export const RadioGroup = forwardRef<HTMLFieldSetElement, RadioGroupProps>(
  ({ legend, hint, error, required, className, children, ...props }, ref) => {
    const id = useId();
    const hintId = hint ? `${id}-hint` : undefined;
    const errorId = error ? `${id}-error` : undefined;
    return (
      <fieldset
        ref={ref}
        aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
        aria-invalid={error ? true : undefined}
        aria-required={required || undefined}
        className={cn('flex flex-col gap-2', className)}
        {...props}
      >
        <legend className="mb-1 text-sm font-medium text-ink-1">
          {legend}
          {required && (
            <span aria-hidden className="ml-0.5 text-danger">
              *
            </span>
          )}
        </legend>
        {children}
        {hint && (
          <p id={hintId} className="text-xs text-ink-2">
            {hint}
          </p>
        )}
        <FieldError id={errorId}>{error}</FieldError>
      </fieldset>
    );
  },
);
RadioGroup.displayName = 'RadioGroup';
