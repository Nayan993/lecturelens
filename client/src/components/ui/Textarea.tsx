import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';
import { controlClasses, FieldShell, LeftIconSlot, useFieldIds, type FieldProps } from './Field';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, FieldProps {}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ id, label, hint, error, leftIcon, required, containerClassName, className, rows = 4, 'aria-describedby': describedBy, ...props }, ref) => {
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
          {leftIcon && <LeftIconSlot top>{leftIcon}</LeftIconSlot>}
          <textarea
            {...props}
            ref={ref}
            id={fieldId}
            rows={rows}
            required={required}
            aria-invalid={invalid || undefined}
            aria-describedby={ariaDescribedBy}
            className={cn(controlClasses, 'block resize-y px-3 py-2 leading-relaxed', leftIcon && 'pl-9', className)}
          />
        </div>
      </FieldShell>
    );
  },
);
Textarea.displayName = 'Textarea';
