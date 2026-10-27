import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';
import { controlClasses, FieldShell, LeftIconSlot, useFieldIds, type FieldProps } from './Field';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement>, FieldProps {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ id, label, hint, error, leftIcon, required, containerClassName, className, 'aria-describedby': describedBy, ...props }, ref) => {
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
          <input
            {...props}
            ref={ref}
            id={fieldId}
            required={required}
            aria-invalid={invalid || undefined}
            aria-describedby={ariaDescribedBy}
            className={cn(controlClasses, 'h-9 px-3', leftIcon && 'pl-9', className)}
          />
        </div>
      </FieldShell>
    );
  },
);
Input.displayName = 'Input';
