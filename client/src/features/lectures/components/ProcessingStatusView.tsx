import { CheckCircle2, Circle, CircleSlash, XCircle } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { isNotImplemented } from '../../../lib/apiClient';
import { cn } from '../../../lib/cn';
import { formatTimestamp } from '../../../lib/formatTime';
import type { Lecture, ProcessingStage, ProcessingStatus, StageName } from '../../../types';
import { Card, CardContent, ErrorState, Progress, Skeleton, Spinner, StatusPill, useToast } from '../../../components/ui';
import { useLectureStatus, useReprocessLecture } from '../hooks';
import { PAGE_NARROW } from '../../../components/layout/Page';

const STAGE_LABEL: Record<StageName, string> = {
  extracting: 'Extract audio',
  transcribing: 'Transcribe',
  chunking: 'Split into passages',
  segmenting: 'Find topics',
  summarising: 'Write summaries',
  indexing: 'Index for search',
};

/**
 * Overall progress, derived on the client (the contract's ProcessingStatus has no percentage):
 * each done or skipped stage counts 1, the running stage ½.
 */
export function progressPct(stages: ProcessingStage[]): number {
  if (stages.length === 0) return 0;
  const units = stages.reduce((n, s) => n + (s.state === 'done' || s.state === 'skipped' ? 1 : s.state === 'running' ? 0.5 : 0), 0);
  return Math.round((units / stages.length) * 100);
}

/** One sentence for the live region: changes only when the stage or status detail changes. */
export function liveStatusText(status: ProcessingStatus): string {
  if (status.status === 'ready') return 'Processing complete — the lecture is ready.';
  if (status.status === 'failed') return 'Processing failed — see the details below.';
  const running = status.stages.find((s) => s.state === 'running');
  return running ? `Now: ${STAGE_LABEL[running.name]} — ${status.statusDetail}` : status.statusDetail;
}

/** Processing time so far: sum of stage `ms` (integer ms of wall-clock work, not a media offset). */
const elapsedSec = (stages: ProcessingStage[]) => stages.reduce((n, s) => n + (s.ms ?? 0), 0) / 1000;

function StageIcon({ state }: { state: ProcessingStage['state'] }) {
  if (state === 'done') return <CheckCircle2 aria-hidden className="h-5 w-5 text-success-strong" />;
  if (state === 'running') return <Spinner size="sm" className="m-0.5 text-brand" />;
  if (state === 'failed') return <XCircle aria-hidden className="h-5 w-5 text-danger" />;
  if (state === 'skipped') return <CircleSlash aria-hidden className="h-5 w-5 text-ink-3" />;
  return <Circle aria-hidden className="h-5 w-5 text-ink-3" />;
}

const STATE_TEXT: Record<ProcessingStage['state'], string> = {
  done: 'done',
  running: 'in progress',
  pending: 'waiting',
  failed: 'failed',
  skipped: 'skipped',
};

function Stepper({ status }: { status: ProcessingStatus }) {
  return (
    <ol aria-label="Processing steps" className="flex flex-col">
      {status.stages.map((stage, i) => {
        const last = i === status.stages.length - 1;
        return (
          <li key={stage.name} className="relative flex gap-3 pb-5 last:pb-0" aria-current={stage.state === 'running' ? 'step' : undefined}>
            {!last && (
              <span
                aria-hidden
                className={cn('absolute bottom-0 left-2.5 top-6 w-0.5 -translate-x-1/2', stage.state === 'done' ? 'bg-success/50' : 'bg-border')}
              />
            )}
            <span className="relative z-10 flex h-5 w-5 shrink-0 items-center justify-center bg-surface">
              <StageIcon state={stage.state} />
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className={cn('text-sm font-medium', stage.state === 'pending' || stage.state === 'skipped' ? 'text-ink-3' : 'text-ink-1')}>
                {STAGE_LABEL[stage.name]}
                <span className="sr-only"> — {STATE_TEXT[stage.state]}</span>
              </p>
              {stage.state === 'running' && <p className="text-sm text-ink-2">{status.statusDetail}</p>}
              {stage.state === 'done' && stage.ms !== null && (
                <p className="text-xs text-ink-3">Took {formatTimestamp(stage.ms / 1000)}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Shown at /app/lectures/:id while a lecture is not ready. Polls every 3 s until ready or failed. */
export function ProcessingStatusView({ lecture }: { lecture: Lecture }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const statusQuery = useLectureStatus(lecture.id);
  const reprocess = useReprocessLecture();
  const status = statusQuery.data;
  const isTeacher = user?.role === 'teacher';

  const retry = () => {
    const fromStage = status?.error?.stage ?? lecture.error?.stage ?? 'extracting';
    reprocess.mutate(
      { id: lecture.id, fromStage },
      {
        onSuccess: () => toast({ variant: 'info', title: 'Processing restarted', description: `Starting again from “${STAGE_LABEL[fromStage]}”.` }),
        onError: (err) => toast({ variant: 'error', title: 'Couldn’t restart processing', description: err.message }),
      },
    );
  };

  return (
    <div className={PAGE_NARROW}>
      <header className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-ink-1">{lecture.title}</h1>
          <StatusPill status={status?.status ?? lecture.status} />
        </div>
        <p className="text-sm text-ink-2">This lecture is being prepared. The page updates on its own — you can leave and come back.</p>
      </header>

      <Card>
        <CardContent className="flex flex-col gap-5 py-5">
          {statusQuery.isPending ? (
            <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading processing status">
              <Skeleton height={8} className="rounded-full" />
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} width={`${40 + ((i * 13) % 30)}%`} height={16} />
              ))}
            </div>
          ) : statusQuery.isError ? (
            isNotImplemented(statusQuery.error) ? (
              <ErrorState variant="notImplemented" message="Live processing status isn’t available yet." />
            ) : (
              <ErrorState message={statusQuery.error.message} onRetry={() => void statusQuery.refetch()} />
            )
          ) : status ? (
            <>
              <div className="flex flex-col gap-1.5">
                <Progress
                  label="Overall progress"
                  value={progressPct(status.stages)}
                  showLabel
                  tone={status.status === 'failed' ? 'danger' : status.status === 'ready' ? 'success' : 'brand'}
                />
                <p className="text-xs text-ink-2">Processing time so far: {formatTimestamp(elapsedSec(status.stages))}</p>
                <p aria-live="polite" className="text-sm text-ink-1">
                  {liveStatusText(status)}
                </p>
              </div>
              <Stepper status={status} />
              {status.status === 'failed' && (
                <ErrorState
                  title={`Processing failed${status.error ? ` at “${STAGE_LABEL[status.error.stage]}”` : ''}`}
                  message={status.error?.message ?? status.statusDetail}
                  onRetry={isTeacher ? retry : undefined}
                  retryLabel={reprocess.isPending ? 'Restarting…' : 'Retry processing'}
                />
              )}
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
