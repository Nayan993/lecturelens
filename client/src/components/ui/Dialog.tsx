import { forwardRef, useEffect, useId, useRef, type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';
import { mergeRefs } from '../../lib/mergeRefs';
import { IconButton } from './IconButton';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',');

const focusablesIn = (root: HTMLElement): HTMLElement[] =>
  Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => !el.hasAttribute('hidden'));

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
    const onOpenChangeRef = useRef(onOpenChange);
    onOpenChangeRef.current = onOpenChange;
    const titleId = useId();
    const descriptionId = useId();

    useEffect(() => {
      if (!open) return;
      const panel = panelRef.current;
      if (!panel) return;
      const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;

      // Scroll lock, compensating for the scrollbar so the page does not shift.
      const { overflow, paddingRight } = document.body.style;
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = 'hidden';
      if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;

      // Initial focus: first focusable in the body, else first anywhere (close button), else the panel.
      const initial = (bodyRef.current && focusablesIn(bodyRef.current)[0]) ?? focusablesIn(panel)[0] ?? panel;
      initial.focus();

      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onOpenChangeRef.current(false);
          return;
        }
        if (event.key !== 'Tab') return;
        const items = focusablesIn(panel);
        if (items.length === 0) {
          event.preventDefault();
          panel.focus();
          return;
        }
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement;
        if (event.shiftKey && (active === first || !panel.contains(active))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (active === last || !panel.contains(active))) {
          event.preventDefault();
          first.focus();
        }
      };
      // Pull focus back if it escapes (e.g. a click on the backdrop area of another layer).
      const onFocusIn = (event: FocusEvent) => {
        if (event.target instanceof Node && !panel.contains(event.target)) {
          (focusablesIn(panel)[0] ?? panel).focus();
        }
      };

      document.addEventListener('keydown', onKeyDown);
      document.addEventListener('focusin', onFocusIn);
      return () => {
        document.removeEventListener('keydown', onKeyDown);
        document.removeEventListener('focusin', onFocusIn);
        document.body.style.overflow = overflow;
        document.body.style.paddingRight = paddingRight;
        if (trigger && document.contains(trigger)) trigger.focus();
      };
    }, [open]);

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
