import { forwardRef, useId, useRef, useState, type HTMLAttributes, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface TabItem {
  value: string;
  label: ReactNode;
  content: ReactNode;
  disabled?: boolean;
}

export interface TabsProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'> {
  items: TabItem[];
  /** Accessible name for the tab list. */
  label: string;
  /** Controlled selected value. */
  value?: string;
  /** Initial value when uncontrolled; defaults to the first enabled tab. */
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Extra classes for every tab panel, e.g. to make panels fill and scroll. */
  panelClassName?: string;
}

/**
 * WAI-ARIA tabs with a roving tabindex: only the selected tab is in the Tab order;
 * ArrowLeft/ArrowRight (wrapping), Home and End move focus and select (disabled tabs are skipped).
 */
export const Tabs = forwardRef<HTMLDivElement, TabsProps>(
  ({ items, label, value, defaultValue, onValueChange, panelClassName, className, ...props }, ref) => {
    const baseId = useId();
    const firstEnabled = items.find((item) => !item.disabled)?.value ?? '';
    const [internal, setInternal] = useState(defaultValue ?? firstEnabled);
    const selected = value ?? internal;
    const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

    const select = (next: string) => {
      if (value === undefined) setInternal(next);
      onValueChange?.(next);
    };

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
      const enabled = items.map((item, i) => (item.disabled ? -1 : i)).filter((i) => i >= 0);
      if (enabled.length === 0) return;
      const current = enabled.indexOf(items.findIndex((item) => item.value === selected));
      let target: number | undefined;
      if (event.key === 'ArrowRight') target = enabled[(current + 1) % enabled.length];
      else if (event.key === 'ArrowLeft') target = enabled[(current - 1 + enabled.length) % enabled.length];
      else if (event.key === 'Home') target = enabled[0];
      else if (event.key === 'End') target = enabled[enabled.length - 1];
      if (target === undefined) return;
      event.preventDefault();
      select(items[target].value);
      tabRefs.current[target]?.focus();
    };

    return (
      <div ref={ref} className={cn('flex flex-col', className)} {...props}>
        <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className="flex gap-1 border-b border-border">
          {items.map((item, i) => {
            const isSelected = item.value === selected;
            return (
              <button
                key={item.value}
                ref={(node) => {
                  tabRefs.current[i] = node;
                }}
                type="button"
                role="tab"
                id={`${baseId}-tab-${i}`}
                aria-selected={isSelected}
                aria-controls={`${baseId}-panel-${i}`}
                tabIndex={isSelected ? 0 : -1}
                disabled={item.disabled}
                onClick={() => select(item.value)}
                className={cn(
                  '-mb-px rounded-t-control border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  isSelected
                    ? 'border-brand text-brand'
                    : 'border-transparent text-ink-2 hover:border-border hover:text-ink-1',
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>
        {items.map((item, i) => (
          <div
            key={item.value}
            role="tabpanel"
            id={`${baseId}-panel-${i}`}
            aria-labelledby={`${baseId}-tab-${i}`}
            hidden={item.value !== selected}
            tabIndex={0}
            className={cn('pt-4', panelClassName)}
          >
            {item.content}
          </div>
        ))}
      </div>
    );
  },
);
Tabs.displayName = 'Tabs';
