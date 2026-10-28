import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { CheckCircle2, CircleAlert, Upload } from 'lucide-react';
import type { LectureStatus } from '../../types';
import { Badge, type BadgeVariant } from './Badge';

const PulsingDot = () => (
  <span className="relative flex h-2 w-2">
    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
    <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
  </span>
);

const STATUS_CONFIG: Record<LectureStatus, { label: string; variant: BadgeVariant; icon: ReactNode }> = {
  uploaded: { label: 'Uploaded', variant: 'neutral', icon: <Upload /> },
  extracting: { label: 'Extracting audio', variant: 'warning', icon: <PulsingDot /> },
  transcribing: { label: 'Transcribing', variant: 'warning', icon: <PulsingDot /> },
  chunking: { label: 'Chunking', variant: 'warning', icon: <PulsingDot /> },
  segmenting: { label: 'Finding topics', variant: 'warning', icon: <PulsingDot /> },
  summarising: { label: 'Summarising', variant: 'warning', icon: <PulsingDot /> },
  indexing: { label: 'Indexing', variant: 'warning', icon: <PulsingDot /> },
  ready: { label: 'Ready', variant: 'success', icon: <CheckCircle2 /> },
  failed: { label: 'Failed', variant: 'danger', icon: <CircleAlert /> },
};

export interface StatusPillProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  status: LectureStatus;
}

export const StatusPill = forwardRef<HTMLSpanElement, StatusPillProps>(({ status, ...props }, ref) => {
  // An unknown value (e.g. a newer server) degrades to a neutral pill instead of crashing the page.
  const { label, variant, icon } = STATUS_CONFIG[status] ?? { label: String(status), variant: 'neutral' as const, icon: null };
  return (
    <Badge ref={ref} variant={variant} icon={icon} data-status={status} {...props}>
      {label}
    </Badge>
  );
});
StatusPill.displayName = 'StatusPill';
