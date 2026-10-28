import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { Check } from 'lucide-react';
import { cn } from '../../lib/cn';

export interface MenuItem {
  /** Stable key. */
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  onSelect?: () => void;
  disabled?: boolean;
  /** When defined the item is a menuitemradio with this checked state. */
  checked?: boolean;
  tone?: 'default' | 'danger';
}

export interface MenuTriggerProps {
  id: string;
  'aria-haspopup': 'menu';
  'aria-expanded': boolean;
  'aria-controls': string;
  onClick: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}

export interface MenuProps {
  /** Render the trigger, spreading the provided props onto a button. */
  trigger: (props: MenuTriggerProps) => ReactNode;
  items: MenuItem[];
  /** Accessible name of the menu when the trigger's text is not enough. */
  label?: string;
  align?: 'start' | 'end';
  side?: 'bottom' | 'top';
  className?: string;
}

/**
 * WAI-ARIA menu button. Enter/Space/ArrowDown open and focus the first item, ArrowUp opens on the
 * last; Arrow keys, Home and End move between items; Escape or Tab closes; Escape returns focus to
 * the trigger; clicking outside closes.
 */
export const Menu = forwardRef<HTMLDivElement, MenuProps>(
  ({ trigger, items, label, align = 'start', side = 'bottom', className }, ref) => {
    const [open, setOpen] = useState(false);
    const [focusIndex, setFocusIndex] = useState(0);
    const baseId = useId();
    const triggerId = `${baseId}-trigger`;
    const menuId = `${baseId}-menu`;
    const wrapperRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

    const enabled = items.map((item, i) => (item.disabled ? -1 : i)).filter((i) => i >= 0);

    const openAt = (index: number) => {
      setFocusIndex(index);
      setOpen(true);
    };
    const close = (returnFocus: boolean) => {
      setOpen(false);
      if (returnFocus) document.getElementById(triggerId)?.focus();
    };

    useEffect(() => {
      if (open) itemRefs.current[focusIndex]?.focus();
    }, [open, focusIndex]);

    useEffect(() => {
      if (!open) return;
      const onPointerDown = (event: PointerEvent) => {
        if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
      };
      document.addEventListener('pointerdown', onPointerDown);
      return () => document.removeEventListener('pointerdown', onPointerDown);
    }, [open]);

    const onTriggerKeyDown = (event: KeyboardEvent<HTMLElement>) => {
      if (enabled.length === 0) return;
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openAt(enabled[0]);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        openAt(enabled[enabled.length - 1]);
      }
    };

    const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
      const pos = enabled.indexOf(focusIndex);
      const move = (to: number) => {
        event.preventDefault();
        setFocusIndex(enabled[(to + enabled.length) % enabled.length]);
      };
      if (event.key === 'ArrowDown') move(pos + 1);
      else if (event.key === 'ArrowUp') move(pos - 1);
      else if (event.key === 'Home') move(0);
      else if (event.key === 'End') move(enabled.length - 1);
      else if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close(true);
      } else if (event.key === 'Tab') setOpen(false);
    };

    return (
      <div ref={wrapperRef} className={cn('relative inline-flex', className)}>
        {trigger({
          id: triggerId,
          'aria-haspopup': 'menu',
          'aria-expanded': open,
          'aria-controls': menuId,
          onClick: () => (open ? close(false) : enabled.length > 0 && openAt(enabled[0])),
          onKeyDown: onTriggerKeyDown,
        })}
        <div
          ref={ref}
          id={menuId}
          role="menu"
          aria-label={label}
          aria-labelledby={label ? undefined : triggerId}
          hidden={!open}
          onKeyDown={onMenuKeyDown}
          className={cn(
            'absolute z-40 min-w-44 rounded-card border border-border bg-surface p-1 shadow-md',
            align === 'end' ? 'right-0' : 'left-0',
            side === 'top' ? 'bottom-full mb-1' : 'top-full mt-1',
          )}
        >
          {items.map((item, i) => (
            <button
              key={item.id}
              ref={(node) => {
                itemRefs.current[i] = node;
              }}
              type="button"
              role={item.checked === undefined ? 'menuitem' : 'menuitemradio'}
              aria-checked={item.checked}
              aria-disabled={item.disabled || undefined}
              tabIndex={i === focusIndex ? 0 : -1}
              onClick={() => {
                if (item.disabled) return;
                close(true);
                item.onSelect?.();
              }}
              className={cn(
                'flex w-full items-center gap-2 rounded-control px-2.5 py-1.5 text-left text-sm max-sm:min-h-11',
                'focus-visible:outline-offset-0 [&>svg]:h-4 [&>svg]:w-4',
                item.disabled
                  ? 'cursor-default text-ink-3'
                  : item.tone === 'danger'
                    ? 'text-danger hover:bg-danger/10 focus:bg-danger/10'
                    : 'text-ink-1 hover:bg-ink-1/5 focus:bg-ink-1/5',
              )}
            >
              {item.checked !== undefined && (
                <Check aria-hidden className={cn('shrink-0', !item.checked && 'invisible')} />
              )}
              {item.icon && (
                <span aria-hidden className="inline-flex shrink-0 [&>svg]:h-4 [&>svg]:w-4">
                  {item.icon}
                </span>
              )}
              <span className="flex-1">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  },
);
Menu.displayName = 'Menu';
