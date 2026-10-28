import { forwardRef, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/cn';
import { mergeRefs } from '../../lib/mergeRefs';
import { useModalBehavior } from './useModalBehavior';

export interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Accessible name of the drawer. */
  label: string;
  side?: 'left' | 'right';
  id?: string;
  className?: string;
  children: ReactNode;
}

/**
 * Slide-over panel with the same guarantees as Dialog: backdrop click and Escape close it,
 * focus is trapped inside, page scroll is locked, and focus returns to the trigger on close.
 */
export const Drawer = forwardRef<HTMLDivElement, DrawerProps>(
  ({ open, onOpenChange, label, side = 'left', id, className, children }, ref) => {
    const panelRef = useRef<HTMLDivElement>(null);
    useModalBehavior(open, panelRef, () => onOpenChange(false));

    if (!open) return null;

    return createPortal(
      <div className="fixed inset-0 z-50">
        <div data-testid="drawer-backdrop" aria-hidden className="absolute inset-0 bg-black/40" onClick={() => onOpenChange(false)} />
        <div
          ref={mergeRefs(panelRef, ref)}
          id={id}
          role="dialog"
          aria-modal="true"
          aria-label={label}
          tabIndex={-1}
          className={cn(
            'absolute inset-y-0 flex w-72 max-w-drawer flex-col bg-surface shadow-md',
            side === 'left' ? 'left-0 border-r border-border' : 'right-0 border-l border-border',
            className,
          )}
        >
          {children}
        </div>
      </div>,
      document.body,
    );
  },
);
Drawer.displayName = 'Drawer';
