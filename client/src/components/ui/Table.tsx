import {
  createContext,
  forwardRef,
  useContext,
  type HTMLAttributes,
  type TableHTMLAttributes,
  type TdHTMLAttributes,
  type ThHTMLAttributes,
} from 'react';
import { cn } from '../../lib/cn';

const TableContext = createContext({ stickyHeader: false, zebra: true });

export interface TableProps extends TableHTMLAttributes<HTMLTableElement> {
  /** Keep the header visible while the container scrolls (give the container a max height). */
  stickyHeader?: boolean;
  /** Alternate row shading (default on). */
  zebra?: boolean;
  /** Classes for the scroll container, e.g. `max-h-80`. */
  containerClassName?: string;
}

export const Table = forwardRef<HTMLTableElement, TableProps>(
  ({ stickyHeader = false, zebra = true, containerClassName, className, ...props }, ref) => (
    <TableContext.Provider value={{ stickyHeader, zebra }}>
      <div className={cn('relative w-full overflow-auto rounded-card border border-border bg-surface', containerClassName)}>
        <table ref={ref} className={cn('w-full border-collapse text-left text-sm', className)} {...props} />
      </div>
    </TableContext.Provider>
  ),
);
Table.displayName = 'Table';

export const Thead = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => {
    const { stickyHeader } = useContext(TableContext);
    return (
      <thead
        ref={ref}
        // Inset shadow instead of a border: collapsed borders do not travel with a sticky header.
        className={cn('bg-surface shadow-[inset_0_-1px_0_var(--border)]', stickyHeader && 'sticky top-0 z-10', className)}
        {...props}
      />
    );
  },
);
Thead.displayName = 'Thead';

export const Tbody = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => {
    const { zebra } = useContext(TableContext);
    return <tbody ref={ref} className={cn(zebra && '[&>tr:nth-child(even)]:bg-bg', className)} {...props} />;
  },
);
Tbody.displayName = 'Tbody';

export const Tr = forwardRef<HTMLTableRowElement, HTMLAttributes<HTMLTableRowElement>>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn('border-b border-border transition-colors last:border-0 hover:!bg-brand-soft/60', className)}
    {...props}
  />
));
Tr.displayName = 'Tr';

export const Th = forwardRef<HTMLTableCellElement, ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, scope = 'col', ...props }, ref) => (
    <th
      ref={ref}
      scope={scope}
      className={cn('h-10 whitespace-nowrap px-3 text-xs font-semibold uppercase tracking-wide text-ink-2', className)}
      {...props}
    />
  ),
);
Th.displayName = 'Th';

export const Td = forwardRef<HTMLTableCellElement, TdHTMLAttributes<HTMLTableCellElement>>(({ className, ...props }, ref) => (
  <td ref={ref} className={cn('px-3 py-2.5 align-middle text-ink-1', className)} {...props} />
));
Td.displayName = 'Td';
