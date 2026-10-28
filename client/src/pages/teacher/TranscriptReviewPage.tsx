import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ShieldCheck } from 'lucide-react';
import { isApiError, isNotImplemented } from '../../lib/apiClient';
import { useDocumentTitle } from '../../lib/useDocumentTitle';
import { Badge, Button, EmptyState, ErrorState, Skeleton, useToast } from '../../components/ui';
import { LecturePlayer } from '../../components/player/LecturePlayer';
import { PlayerProvider, usePlayer } from '../../components/player/PlayerContext';
import { useLecture } from '../../features/lectures/hooks';
import { ProcessingStatusView } from '../../features/lectures/components/ProcessingStatusView';
import { TopicRail } from '../../features/topics/components/TopicRail';
import { useTopics } from '../../features/topics/hooks';
import { useApproveTranscript, useTranscript } from '../../features/transcript/hooks';
import { EditableTranscriptPanel } from '../../features/transcript/components/EditableTranscriptPanel';
import type { LectureDetail } from '../../types';
import { H1 } from '../../components/layout/Page';

const VIEWPORT_HEIGHT = 'h-workspace lg:h-workspace-lg';

function ApproveBar({ lecture }: { lecture: LectureDetail }) {
  const transcript = useTranscript(lecture.id);
  const approve = useApproveTranscript(lecture.id);
  const { toast } = useToast();
  const edited = transcript.data?.items.filter((s) => s.corrected).length ?? 0;
  const approved = transcript.data?.transcriptApproved ?? lecture.transcriptApproved;

  return (
    <div className="sticky bottom-0 flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-surface px-1 py-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-sm font-medium text-ink-1">
          {edited} {edited === 1 ? 'segment' : 'segments'} edited
        </p>
        <p className="text-xs text-ink-2">
          {approved ? 'Approved — students can read this transcript. Later edits are visible to them immediately.' : 'Approving makes this transcript visible to students.'}
        </p>
      </div>
      {approved ? (
        <Badge variant="success" icon={<CheckCircle2 />}>
          Transcript approved
        </Badge>
      ) : (
        <Button
          leftIcon={<ShieldCheck />}
          loading={approve.isPending}
          onClick={() =>
            approve.mutate(undefined, {
              onSuccess: () => toast({ variant: 'success', title: 'Transcript approved', description: 'Students can now read it.' }),
              onError: (err) => toast({ variant: 'error', title: 'Couldn’t approve the transcript', description: err.message }),
            })
          }
        >
          Approve transcript
        </Button>
      )}
    </div>
  );
}

function ReviewLayout({ lecture }: { lecture: LectureDetail }) {
  const player = usePlayer();
  const topicsQ = useTopics(lecture.id);
  const topics = [...(topicsQ.data?.items ?? [])].sort((a, b) => a.index - b.index);
  return (
    <div className={`flex flex-col gap-3 ${VIEWPORT_HEIGHT}`}>
      <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1">
        <Link to={`/app/lectures/${lecture.id}`} className="tap-target inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink-1">
          <ArrowLeft aria-hidden className="h-4 w-4" />
          Reading view
        </Link>
        <h1 className={`${H1} min-w-0 truncate`}>Review transcript · {lecture.title}</h1>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-single grid-rows-stack gap-3 lg:grid-cols-workspace-tight lg:grid-rows-1 xl:grid-cols-workspace lg:gap-5">
        <section aria-label="Recording" className="flex min-h-0 flex-col gap-3 lg:overflow-y-auto">
          <LecturePlayer
            src={lecture.mediaUrl}
            mimeType={lecture.media.mimeType}
            title={lecture.title}
            markers={topics.filter((t) => t.startSec > 0).map((t) => ({ startSec: t.startSec, label: t.label }))}
            videoClassName="max-h-player-compact lg:max-h-none"
          />
          <TopicRail topics={topics} currentTime={player.currentTime} onSelect={(t) => player.seekTo(t.startSec)} />
          <p className="hidden text-sm text-ink-2 lg:block">
            Click a sentence (or Tab to it and press Enter) to correct it. The original transcription is kept as an audit trail on every edited
            segment.
          </p>
        </section>
        <section aria-label="Transcript editor" className="flex min-h-0 flex-col rounded-card border border-border bg-surface px-3 pt-3 shadow-sm sm:px-4">
          <EditableTranscriptPanel lectureId={lecture.id} />
          <ApproveBar lecture={lecture} />
        </section>
      </div>
    </div>
  );
}

/** /app/lectures/:id/review — teacher transcript correction and approval. */
export function TranscriptReviewPage() {
  const { id } = useParams<{ id: string }>();
  const lectureQ = useLecture(id);
  useDocumentTitle(lectureQ.data ? `Review · ${lectureQ.data.title}` : 'Review transcript');

  if (lectureQ.isPending) {
    return (
      <div className={`flex flex-col gap-3 ${VIEWPORT_HEIGHT}`} aria-busy="true" aria-label="Loading">
        <Skeleton width="50%" height={24} />
        <Skeleton height="100%" className="rounded-card" />
      </div>
    );
  }
  if (lectureQ.isError) {
    const err = lectureQ.error;
    if (isNotImplemented(err)) return <ErrorState variant="notImplemented" />;
    if (isApiError(err) && err.status === 404) return <EmptyState title="Lecture not found" description="It may have been deleted." />;
    return <ErrorState message={err.message} onRetry={() => void lectureQ.refetch()} />;
  }
  if (lectureQ.data.status !== 'ready') return <ProcessingStatusView lecture={lectureQ.data} />;
  return (
    <PlayerProvider>
      <ReviewLayout lecture={lectureQ.data} />
    </PlayerProvider>
  );
}
