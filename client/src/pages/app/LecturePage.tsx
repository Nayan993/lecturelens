import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { NotebookText } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { isApiError, isNotImplemented } from '../../lib/apiClient';
import { formatDuration, parseTimeParam } from '../../lib/formatTime';
import { savePlayback } from '../../lib/playbackProgress';
import { useDocumentTitle } from '../../lib/useDocumentTitle';
import type { LectureDetail, TopicSection } from '../../types';
import { EmptyState, ErrorState, Skeleton, Tabs } from '../../components/ui';
import { LecturePlayer } from '../../components/player/LecturePlayer';
import { PlayerProvider, usePlayer } from '../../components/player/PlayerContext';
import { useLecture } from '../../features/lectures/hooks';
import { ProcessingStatusView } from '../../features/lectures/components/ProcessingStatusView';
import { TranscriptPanel, type FollowRequest } from '../../features/transcript/components/TranscriptPanel';
import { SummaryPanel } from '../../features/topics/components/SummaryPanel';
import { TopicRail } from '../../features/topics/components/TopicRail';
import { useTopics } from '../../features/topics/hooks';
import { AskPanel } from '../../features/qa/components/AskPanel';
import { QuizPanel } from '../../features/quizzes/components/QuizPanel';

/** Save "where I stopped" at most every 5 s of playback movement, and on leaving the page. */
const SAVE_EVERY_SEC = 5;

/**
 * Fills the viewport below the header: 6.5rem = 3.5rem header + 3rem (py-6) main padding on mobile;
 * 7.5rem = header + 4rem (lg:py-8) on desktop.
 */
const VIEWPORT_HEIGHT = 'h-[calc(100dvh-6.5rem)] lg:h-[calc(100dvh-7.5rem)]';

function ReadingSkeleton() {
  return (
    <div className={`flex flex-col gap-3 ${VIEWPORT_HEIGHT}`} aria-busy="true" aria-label="Loading lecture">
      <Skeleton width="45%" height={26} />
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr]">
        <div className="flex flex-col gap-3">
          <Skeleton className="aspect-video rounded-card" height="auto" />
          <div className="flex gap-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} width={120} height={28} className="rounded-full" />
            ))}
          </div>
        </div>
        <Skeleton height="100%" className="hidden rounded-card lg:block" />
      </div>
    </div>
  );
}

function ReadingView({ lecture, startAt }: { lecture: LectureDetail; startAt: number | null }) {
  const { user } = useAuth();
  const player = usePlayer();
  const topicsQ = useTopics(lecture.id);
  const topics = [...(topicsQ.data?.items ?? [])].sort((a, b) => a.index - b.index);
  const [tab, setTab] = useState('transcript');
  const [followRequest, setFollowRequest] = useState<FollowRequest | null>(null);
  const lastSaved = useRef(startAt ?? 0);

  const markers = topics.filter((t) => t.startSec > 0).map((t) => ({ startSec: t.startSec, label: t.label }));

  const onTimeUpdate = useCallback(
    (seconds: number) => {
      if (user && Math.abs(seconds - lastSaved.current) >= SAVE_EVERY_SEC) {
        lastSaved.current = seconds;
        savePlayback(user.id, lecture.id, seconds, lecture.durationSec ?? 0);
      }
    },
    [user, lecture.id, lecture.durationSec],
  );

  // Remember the exact position when leaving.
  const getTime = player.getCurrentTime;
  useEffect(
    () => () => {
      const t = getTime();
      if (user && t > 0) savePlayback(user.id, lecture.id, t, lecture.durationSec ?? 0);
    },
    [getTime, user, lecture.id, lecture.durationSec],
  );

  const selectTopic = (topic: TopicSection) => {
    player.seekTo(topic.startSec);
    setTab('transcript');
    setFollowRequest({ sec: topic.startSec, nonce: Date.now() });
  };

  return (
    <div className={`flex flex-col gap-3 ${VIEWPORT_HEIGHT}`}>
      <header className="flex shrink-0 flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <h1 className="min-w-0 truncate text-lg font-semibold tracking-tight text-ink-1 lg:text-xl">{lecture.title}</h1>
        <p className="hidden text-sm text-ink-2 sm:block">
          {[lecture.courseCode, lecture.uploadedByName, lecture.durationSec !== null && formatDuration(lecture.durationSec)].filter(Boolean).join(' · ')}
        </p>
      </header>

      {/* minmax(0,1fr) on mobile: an implicit auto column would grow to the topic rail's unwrapped width. */}
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:grid-rows-1 lg:gap-5">
        <section aria-label="Recording" className="flex min-h-0 flex-col gap-3 lg:overflow-y-auto">
          <LecturePlayer
            src={lecture.mediaUrl}
            mimeType={lecture.media.mimeType}
            title={lecture.title}
            markers={markers}
            startAt={startAt}
            onTimeUpdate={onTimeUpdate}
            videoClassName="max-h-[24dvh] lg:max-h-none"
          />
          <TopicRail topics={topics} currentTime={player.currentTime} onSelect={selectTopic} />
        </section>

        <section aria-label="Lecture content" className="flex min-h-0 flex-col rounded-card border border-border bg-surface px-3 pt-1 shadow-sm sm:px-4">
          <Tabs
            label="Lecture content"
            value={tab}
            onValueChange={setTab}
            className="min-h-0 flex-1"
            panelClassName="flex min-h-0 flex-1 flex-col overflow-y-auto pt-3"
            items={[
              { value: 'transcript', label: 'Transcript', content: <TranscriptPanel lectureId={lecture.id} followRequest={followRequest} /> },
              { value: 'summary', label: 'Summary', content: <SummaryPanel lectureId={lecture.id} durationSec={lecture.durationSec} /> },
              { value: 'ask', label: 'Ask', content: <AskPanel lectureId={lecture.id} onScreenLectureId={lecture.id} /> },
              { value: 'quiz', label: 'Quiz', content: <QuizPanel lectureId={lecture.id} /> },
            ]}
          />
        </section>
      </div>
    </div>
  );
}

/** /app/lectures/:id — the reading view when ready, the processing status view otherwise. */
export function LecturePage() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const startAt = parseTimeParam(params.get('t'));
  const lectureQ = useLecture(id);
  useDocumentTitle(lectureQ.data?.title ?? 'Lecture');

  if (lectureQ.isPending) return <ReadingSkeleton />;
  if (lectureQ.isError) {
    const err = lectureQ.error;
    if (isNotImplemented(err)) return <ErrorState variant="notImplemented" />;
    if (isApiError(err) && err.status === 404) {
      return <EmptyState icon={<NotebookText />} title="Lecture not found" description="It may have been removed, or it isn’t available to your account yet." />;
    }
    return <ErrorState message={err.message} onRetry={() => void lectureQ.refetch()} />;
  }
  const lecture = lectureQ.data;
  if (lecture.status !== 'ready') return <ProcessingStatusView lecture={lecture} />;
  return (
    <PlayerProvider>
      <ReadingView key={lecture.id} lecture={lecture} startAt={startAt} />
    </PlayerProvider>
  );
}

