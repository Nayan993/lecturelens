import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Button } from './Button';

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
}

export interface EmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: EmptyStateAction;
}

export const EmptyState = forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ icon = <Inbox />, title, description, action, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-border px-6 py-10 text-center',
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-brand [&>svg]:h-6 [&>svg]:w-6"
      >
        {icon}
      </span>
      <div className="flex max-w-sm flex-col gap-1">
        <h3 className="text-base font-semibold text-ink-1">{title}</h3>
        {description && <p className="text-sm text-ink-2">{description}</p>}
      </div>
      {action && (
        <Button variant="secondary" leftIcon={action.icon} onClick={action.onClick} className="mt-1">
          {action.label}
        </Button>
      )}
    </div>
  ),
);
EmptyState.displayName = 'EmptyState';
