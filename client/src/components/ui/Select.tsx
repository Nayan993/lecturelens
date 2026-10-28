import { forwardRef, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/cn';
import { controlClasses, FieldShell, LeftIconSlot, useFieldIds, type FieldProps } from './Field';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement>, FieldProps {}

/** Native <select> styled to match Input. Pass <option> elements as children. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ id, label, hint, error, leftIcon, required, containerClassName, className, children, 'aria-describedby': describedBy, ...props }, ref) => {
    const { fieldId, hintId, errorId, ariaDescribedBy, invalid } = useFieldIds(id, hint, error, describedBy);
    return (
      <FieldShell
        fieldId={fieldId}
        label={label}
        required={required}
        hint={hint}
        hintId={hintId}
        error={error}
        errorId={errorId}
        className={containerClassName}
      >
        <div className="relative">
          {leftIcon && <LeftIconSlot>{leftIcon}</LeftIconSlot>}
          <select
            {...props}
            ref={ref}
            id={fieldId}
            required={required}
            aria-invalid={invalid || undefined}
            aria-describedby={ariaDescribedBy}
            className={cn(controlClasses, 'h-9 cursor-pointer appearance-none pl-3 pr-9', leftIcon && 'pl-9', className)}
          >
            {children}
          </select>
          <ChevronDown
            aria-hidden
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3"
          />
        </div>
      </FieldShell>
    );
  },
);
Select.displayName = 'Select';
