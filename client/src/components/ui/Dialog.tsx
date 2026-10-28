import { forwardRef, useId, useRef, type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';
import { mergeRefs } from '../../lib/mergeRefs';
import { IconButton } from './IconButton';
import { focusablesIn, useModalBehavior } from './useModalBehavior';

export type DialogSize = 'sm' | 'md' | 'lg';

const SIZE_CLASSES: Record<DialogSize, string> = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' };

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  /** Actions row, typically Cancel + confirm Buttons. */
  footer?: ReactNode;
  children?: ReactNode;
  size?: DialogSize;
  className?: string;
}

/**
 * Accessible modal: focus moves inside on open and is trapped there, Escape and
 * backdrop click close it, page scroll is locked, and focus returns to the
 * element that was focused before opening (normally the trigger).
 */
export const Dialog = forwardRef<HTMLDivElement, DialogProps>(
  ({ open, onOpenChange, title, description, footer, children, size = 'md', className }, ref) => {
    const panelRef = useRef<HTMLDivElement>(null);
    const bodyRef = useRef<HTMLDivElement>(null);
    const pointerDownOnBackdrop = useRef(false);
    const titleId = useId();
    const descriptionId = useId();

    // Initial focus: first focusable in the body, else the first anywhere (close button), else the panel.
    useModalBehavior(open, panelRef, () => onOpenChange(false), () =>
      bodyRef.current ? focusablesIn(bodyRef.current)[0] : undefined,
    );

    if (!open) return null;

    const onBackdropMouseDown = (event: MouseEvent<HTMLDivElement>) => {
      pointerDownOnBackdrop.current = event.target === event.currentTarget;
    };
    // Only close when the press both started and ended on the backdrop (not a drag out of the panel).
    const onBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
      if (pointerDownOnBackdrop.current && event.target === event.currentTarget) onOpenChange(false);
      pointerDownOnBackdrop.current = false;
    };

    return createPortal(
      <div
        data-testid="dialog-backdrop"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        onMouseDown={onBackdropMouseDown}
        onClick={onBackdropClick}
      >
        <div
          ref={mergeRefs(panelRef, ref)}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descriptionId : undefined}
          tabIndex={-1}
          className={cn(
            'flex max-h-[calc(100vh-2rem)] w-full flex-col rounded-card border border-border bg-surface text-ink-1 shadow-md',
            SIZE_CLASSES[size],
            className,
          )}
        >
          <div className="flex items-start gap-3 px-5 pt-5">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <h2 id={titleId} className="text-lg font-semibold leading-snug">
                {title}
              </h2>
              {description && (
                <p id={descriptionId} className="text-sm text-ink-2">
                  {description}
                </p>
              )}
            </div>
            <IconButton
              aria-label="Close dialog"
              icon={<X />}
              size="sm"
              className="-mr-1.5 -mt-1"
              onClick={() => onOpenChange(false)}
            />
          </div>
          <div ref={bodyRef} className="overflow-y-auto px-5 py-4">
            {children}
          </div>
          {footer && (
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>
          )}
        </div>
      </div>,
      document.body,
    );
  },
);
Dialog.displayName = 'Dialog';
