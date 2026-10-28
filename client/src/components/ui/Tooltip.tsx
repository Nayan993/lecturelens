import {
  Children,
  cloneElement,
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { cn } from '../../lib/cn';

export interface TooltipProps {
  content: ReactNode;
  /** A single focusable element (e.g. a Button or IconButton). */
  children: ReactElement<{ 'aria-describedby'?: string }>;
  side?: 'top' | 'bottom';
  /** Show delay in ms. */
  delay?: number;
  className?: string;
}

/**
 * Shows on hover and on keyboard focus after `delay`, hides immediately on leave/blur
 * or Escape. The trigger is linked with aria-describedby. Supplementary text only —
 * never put the only accessible name of a control in a tooltip.
 */
export const Tooltip = forwardRef<HTMLSpanElement, TooltipProps>(
  ({ content, children, side = 'top', delay = 300, className }, ref) => {
    const [open, setOpen] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout>>();
    const tooltipId = useId();

    const clear = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = undefined;
    };
    const show = () => {
      clear();
      timer.current = setTimeout(() => setOpen(true), delay);
    };
    const hide = () => {
      clear();
      setOpen(false);
    };

    useEffect(() => clear, []);

    useEffect(() => {
      if (!open) return;
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') setOpen(false);
      };
      document.addEventListener('keydown', onKeyDown);
      return () => document.removeEventListener('keydown', onKeyDown);
    }, [open]);

    const child = Children.only(children);
    const describedBy = [child.props['aria-describedby'], tooltipId].filter(Boolean).join(' ');

    return (
      <span
        ref={ref}
        className="relative inline-flex"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        {cloneElement(child, { 'aria-describedby': describedBy })}
        <span
          id={tooltipId}
          role="tooltip"
          hidden={!open}
          className={cn(
            'pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-control',
            'bg-ink-1 px-2 py-1 text-xs font-medium text-surface shadow-md',
            side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
            className,
          )}
        >
          {content}
        </span>
      </span>
    );
  },
);
Tooltip.displayName = 'Tooltip';
