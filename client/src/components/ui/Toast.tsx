import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { CheckCircle2, CircleAlert, Info, X } from 'lucide-react';
import { cn } from '../../lib/cn';
import { IconButton } from './IconButton';

export type ToastVariant = 'success' | 'error' | 'info';

const VARIANT: Record<ToastVariant, { icon: ReactNode; classes: string }> = {
  success: { icon: <CheckCircle2 className="h-5 w-5 text-success" />, classes: 'border-l-success' },
  error: { icon: <CircleAlert className="h-5 w-5 text-danger" />, classes: 'border-l-danger' },
  info: { icon: <Info className="h-5 w-5 text-info" />, classes: 'border-l-info' },
};

export interface ToastProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  variant?: ToastVariant;
  title: ReactNode;
  description?: ReactNode;
  onDismiss?: () => void;
}

/** Presentational toast. Use useToast() to show one; render this directly only for previews. */
export const Toast = forwardRef<HTMLDivElement, ToastProps>(
  ({ variant = 'info', title, description, onDismiss, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'pointer-events-auto flex w-full items-start gap-3 rounded-card border border-l-4 border-border bg-surface p-3 text-ink-1 shadow-md',
        VARIANT[variant].classes,
        className,
      )}
      {...props}
    >
      <span aria-hidden className="mt-0.5 inline-flex shrink-0">
        {VARIANT[variant].icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-sm font-semibold">{title}</p>
        {description && <p className="text-sm text-ink-2">{description}</p>}
      </div>
      {onDismiss && (
        <IconButton aria-label="Dismiss notification" icon={<X />} size="sm" className="-my-1 -mr-1" onClick={onDismiss} />
      )}
    </div>
  ),
);
Toast.displayName = 'Toast';

export interface ToastOptions {
  title: ReactNode;
  description?: ReactNode;
  variant?: ToastVariant;
  /** Auto-dismiss delay in ms (default 4000). */
  duration?: number;
}

interface ToastRecord extends ToastOptions {
  id: number;
}

interface ToastContextValue {
  toast: (options: ToastOptions) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const MAX_TOASTS = 5;
const DEFAULT_DURATION = 4000;

/** One live toast; its timer pauses while hovered or focused so it can be read and dismissed. */
function ToastItem({ toast, onDismiss }: { toast: ToastRecord; onDismiss: (id: number) => void }) {
  const [paused, setPaused] = useState(false);
  const duration = toast.duration ?? DEFAULT_DURATION;

  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(() => onDismiss(toast.id), duration);
    return () => clearTimeout(timer);
  }, [paused, duration, toast.id, onDismiss]);

  return (
    <Toast
      variant={toast.variant}
      title={toast.title}
      description={toast.description}
      onDismiss={() => onDismiss(toast.id)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    />
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), []);
  const toast = useCallback((options: ToastOptions) => {
    const id = nextId.current++;
    const record: ToastRecord = { variant: 'info', ...options, id };
    setToasts((all) => [...all, record].slice(-MAX_TOASTS));
    return id;
  }, []);
  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        aria-label="Status messages"
        className="pointer-events-none fixed bottom-0 right-0 z-[60] flex w-full max-w-sm flex-col gap-2 p-4"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
