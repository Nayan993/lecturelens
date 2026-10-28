import { Info, Play } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { isApiError, isNotImplemented } from '../../../lib/apiClient';
import { formatTimestamp } from '../../../lib/formatTime';
import type { Id, Summary, TopicSection } from '../../../types';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, ErrorState, Skeleton } from '../../../components/ui';
import { usePlayer } from '../../../components/player/PlayerContext';
import { useSummaries } from '../../summaries/hooks';
import { useTopics } from '../hooks';

/** True when the visible sections don't tile the whole lecture — some are hidden pending review. */
function hasHiddenSections(topics: TopicSection[], durationSec: number | null): boolean {
  if (durationSec === null || topics.length === 0) return false;
  const covered = topics.reduce((n, t) => n + (t.endSec - t.startSec), 0);
  return covered < durationSec - 0.5;
}

function SummaryCard({ topic, summary, showStatus }: { topic: TopicSection; summary: Summary; showStatus: boolean }) {
  const player = usePlayer();
  const range = `${formatTimestamp(topic.startSec)}–${formatTimestamp(topic.endSec)}`;
  return (
    <Card className="shadow-none">
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium text-ink-3">
            Section {topic.index + 1} · <span className="tabular-nums">{range}</span>
          </p>
          <div className="flex items-center gap-2">
            {showStatus && summary.status !== 'approved' && (
              <Badge variant={summary.status === 'rejected' ? 'danger' : 'warning'}>
                {summary.status === 'rejected' ? 'Rejected' : 'Pending review'}
              </Badge>
            )}
            <Button variant="ghost" size="sm" leftIcon={<Play />} onClick={() => player.seekTo(topic.startSec)} aria-label={`Play section from ${formatTimestamp(topic.startSec)}`}>
              Play
            </Button>
          </div>
        </div>
        <CardTitle>{topic.label}</CardTitle>
        {topic.keywords.length > 0 && (
          <ul aria-label="Keywords" className="flex flex-wrap gap-1.5">
            {topic.keywords.map((k) => (
              <li key={k}>
                <Badge variant="brand">{k}</Badge>
              </li>
            ))}
          </ul>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="prose-lecture max-w-none">{summary.text}</p>
        {summary.keyPoints.length > 0 && (
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-ink-1 marker:text-ink-3">
            {summary.keyPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        )}
        {summary.evidence.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">Evidence</p>
            <ul className="flex flex-wrap gap-2">
              {summary.evidence.map((ev) => (
                <li key={`${ev.chunkId}-${ev.startSec}`} className="min-w-0 max-w-full">
                  <button
                    type="button"
                    onClick={() => player.seekTo(ev.startSec)}
                    aria-label={`Play evidence at ${formatTimestamp(ev.startSec)}: “${ev.quote}”`}
                    className="flex max-w-full items-center gap-1.5 rounded-full border border-accent/40 bg-surface px-2.5 py-1 text-left text-xs text-ink-2 transition-colors hover:border-accent hover:bg-accent-soft"
                  >
                    <Play aria-hidden className="h-3 w-3 shrink-0 fill-accent text-accent" />
                    <span className="shrink-0 font-mono font-semibold tabular-nums text-accent">{formatTimestamp(ev.startSec)}</span>
                    <span className="truncate">“{ev.quote}”</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * One card per topic section, in order. Students never see unapproved summaries (the server filters
 * them, and this panel filters again); a note explains when some sections are awaiting review.
 */
export function SummaryPanel({ lectureId, durationSec }: { lectureId: Id; durationSec: number | null }) {
  const { user } = useAuth();
  const topicsQ = useTopics(lectureId);
  const summariesQ = useSummaries(lectureId);
  const isStudent = user?.role !== 'teacher';

  if (topicsQ.isPending || summariesQ.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading summaries">
        {Array.from({ length: 3 }, (_, i) => (
          <Card key={i} className="flex flex-col gap-3 p-5 shadow-none">
            <Skeleton width="30%" height={12} />
            <Skeleton width="60%" height={18} />
            <Skeleton height={14} />
            <Skeleton width="85%" height={14} />
          </Card>
        ))}
      </div>
    );
  }
  const error = topicsQ.error ?? summariesQ.error;
  if (error) {
    if (isNotImplemented(error)) return <ErrorState variant="notImplemented" message="Section summaries aren’t available yet." />;
    if (isApiError(error) && error.status === 404) return <EmptyState title="No summaries for this lecture" description={error.message} />;
    return <ErrorState message={error.message} onRetry={() => void Promise.all([topicsQ.refetch(), summariesQ.refetch()])} />;
  }

  const topics = [...(topicsQ.data?.items ?? [])].sort((a, b) => a.index - b.index);
  const visible = (summariesQ.data?.items ?? []).filter((s) => !isStudent || s.status === 'approved');
  const byTopic = new Map(visible.map((s) => [s.topicId, s]));
  const awaiting = topics.filter((t) => !byTopic.has(t.id)).length;
  const hidden = isStudent && (awaiting > 0 || hasHiddenSections(topics, durationSec));
  const cards = topics.filter((t) => byTopic.has(t.id));

  return (
    <div className="flex flex-col gap-4 pb-6">
      {hidden && (
        <p className="flex items-start gap-2 rounded-control border border-info/25 bg-info/5 px-3 py-2.5 text-sm text-ink-1">
          <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-info" />
          <span>
            Some sections are awaiting teacher review, so their summaries aren’t shown yet. The full transcript is always
            available.
          </span>
        </p>
      )}
      {cards.length === 0 ? (
        <EmptyState title="No summaries yet" description="Summaries appear here once your teacher has reviewed them." />
      ) : (
        cards.map((topic) => <SummaryCard key={topic.id} topic={topic} summary={byTopic.get(topic.id)!} showStatus={!isStudent} />)
      )}
    </div>
  );
}
