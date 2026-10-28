import { memo, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, FileClock, LocateFixed, Search, X } from 'lucide-react';
import { isApiError, isNotImplemented } from '../../../lib/apiClient';
import { cn } from '../../../lib/cn';
import { formatTimestamp } from '../../../lib/formatTime';
import type { Id, TranscriptSegment } from '../../../types';
import { Badge, Button, EmptyState, ErrorState, IconButton, Input, Skeleton, Tooltip } from '../../../components/ui';
import { usePlayer } from '../../../components/player/PlayerContext';
import { useTranscript } from '../hooks';
import { useAutoFollow } from '../useAutoFollow';

/** Index of the segment playing at `t`: the last one starting at or before t (silence gaps belong to it). */
export function activeSegmentIndex(segments: TranscriptSegment[], t: number): number {
  let lo = 0;
  let hi = segments.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (segments[mid].startSec <= t) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function highlight(text: string, query: string, current: boolean): ReactNode {
  if (!query) return text;
  const parts = text.split(new RegExp(`(${escapeRegExp(query)})`, 'gi'));
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className={cn('rounded-sm px-0.5 text-ink-1', current ? 'bg-accent/40 ring-1 ring-accent' : 'bg-warning/25')}>
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

interface SegmentRowProps {
  segment: TranscriptSegment;
  active: boolean;
  query: string;
  currentMatch: boolean;
  showSpeaker: boolean;
  onSeek: (seconds: number) => void;
  rowRef: (index: number, el: HTMLLIElement | null) => void;
}

const SegmentRow = memo(function SegmentRow({ segment, active, query, currentMatch, showSpeaker, onSeek, rowRef }: SegmentRowProps) {
  const time = formatTimestamp(segment.startSec);
  const notes = [segment.lowConfidence && 'low-confidence transcription, may contain errors', segment.corrected && 'edited by the teacher'].filter(Boolean);
  const textButton = (
    <button
      type="button"
      tabIndex={-1}
      onClick={() => onSeek(segment.startSec)}
      className={cn(
        'prose-lecture block w-full max-w-none cursor-pointer rounded-sm text-left',
        segment.lowConfidence && 'underline decoration-ink-3 decoration-dotted decoration-1 underline-offset-4',
      )}
    >
      {highlight(segment.text, query, currentMatch)}
    </button>
  );
  return (
    <li
      ref={(el) => rowRef(segment.index, el)}
      data-index={segment.index}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'grid grid-cols-segment gap-x-3 rounded-r-control border-l-2 py-2 pl-3 pr-2 transition-colors',
        active ? 'border-accent bg-accent-soft' : 'border-transparent hover:bg-ink-1/5',
      )}
    >
      <button
        type="button"
        onClick={() => onSeek(segment.startSec)}
        aria-label={`Play from ${time}${notes.length ? ` (${notes.join('; ')})` : ''}`}
        className="h-fit rounded-sm pt-1 text-left font-mono text-xs font-semibold tabular-nums text-accent-strong hover:underline max-sm:min-h-11 max-sm:items-start"
      >
        {time}
      </button>
      <div className="min-w-0">
        {showSpeaker && segment.speaker && (
          <p className="mb-0.5 font-sans text-eyebrow font-semibold uppercase tracking-wider text-ink-3">Speaker {segment.speaker}</p>
        )}
        {segment.lowConfidence ? <Tooltip content="Low confidence — may contain errors">{textButton}</Tooltip> : textButton}
        {segment.corrected && (
          <Badge variant="neutral" className="mt-1">
            edited
          </Badge>
        )}
      </div>
    </li>
  );
});

export interface FollowRequest {
  /** Float seconds to bring into view. */
  sec: number;
  /** Changes on every request so repeated clicks on the same topic still scroll. */
  nonce: number;
}

/**
 * The transcript: click any timestamp or sentence to seek; the playing segment is highlighted and
 * followed (unless the reader scrolled in the last 5 s); search highlights matches with prev/next.
 */
export function TranscriptPanel({ lectureId, followRequest }: { lectureId: Id; followRequest?: FollowRequest | null }) {
  const transcript = useTranscript(lectureId);
  const player = usePlayer();
  const rows = useRef(new Map<number, HTMLLIElement>());
  const { containerRef, scrollToElement, markManual, suppressed } = useAutoFollow();

  const segments = useMemo(() => transcript.data?.items ?? [], [transcript.data]);
  const activeIndex = activeSegmentIndex(segments, player.currentTime);

  const [query, setQuery] = useState('');
  const [matchCursor, setMatchCursor] = useState(0);
  const q = query.trim().length >= 2 ? query.trim() : '';
  const matches = useMemo(
    () => (q ? segments.filter((s) => s.text.toLowerCase().includes(q.toLowerCase())).map((s) => s.index) : []),
    [segments, q],
  );
  const currentMatch = matches.length ? matches[Math.min(matchCursor, matches.length - 1)] : -1;

  const rowRef = useCallback((index: number, el: HTMLLIElement | null) => {
    if (el) rows.current.set(index, el);
    else rows.current.delete(index);
  }, []);
  const onSeek = useCallback((seconds: number) => player.seekTo(seconds), [player]);

  // Follow playback.
  useEffect(() => {
    const row = rows.current.get(activeIndex);
    if (row) scrollToElement(row);
  }, [activeIndex, scrollToElement]);

  // Explicit request (topic chip): always scroll, section start at the top.
  useEffect(() => {
    if (!followRequest) return;
    const row = rows.current.get(activeSegmentIndex(segments, followRequest.sec + 0.001));
    if (row) scrollToElement(row, { force: true, align: 'start' });
    // Only the nonce should trigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followRequest?.nonce]);

  const goToMatch = (cursor: number) => {
    if (!matches.length) return;
    const next = (cursor + matches.length) % matches.length;
    setMatchCursor(next);
    const row = rows.current.get(matches[next]);
    if (row) {
      scrollToElement(row, { force: true });
      markManual(); // reading search results: don't snap back to playback for a while
    }
  };

  const onSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      goToMatch(matchCursor + (e.shiftKey ? -1 : 1));
    } else if (e.key === 'Escape' && query) {
      e.preventDefault();
      setQuery('');
    }
  };

  if (transcript.isPending) {
    return (
      <div className="flex flex-col gap-4 py-2" aria-busy="true" aria-label="Loading transcript">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="grid grid-cols-segment gap-3 pl-3">
            <Skeleton width={36} height={12} />
            <div className="flex flex-col gap-2">
              <Skeleton width="95%" height={14} />
              <Skeleton width={`${60 + ((i * 11) % 30)}%`} height={14} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (transcript.isError) {
    const err = transcript.error;
    if (isNotImplemented(err)) return <ErrorState variant="notImplemented" message="Transcripts aren’t available yet." />;
    if (isApiError(err) && err.details.reason === 'TRANSCRIPT_NOT_APPROVED') {
      return (
        <EmptyState
          icon={<FileClock />}
          title="Transcript awaiting teacher approval"
          description="Your teacher is checking the transcript. You can still watch the recording."
        />
      );
    }
    if (isApiError(err) && err.status === 404) return <EmptyState title="No transcript for this lecture" description={err.message} />;
    return <ErrorState message={err.message} onRetry={() => void transcript.refetch()} />;
  }

  const followPaused = suppressed && activeIndex >= 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-col gap-1.5 pb-3">
        <div className="flex items-end gap-1.5">
          <Input
            label="Search this transcript"
            type="search"
            leftIcon={<Search />}
            placeholder="e.g. learning rate"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setMatchCursor(0);
            }}
            onKeyDown={onSearchKeyDown}
            containerClassName="flex-1"
            className="h-8"
            aria-describedby="transcript-match-count"
          />
          <IconButton aria-label="Previous match" icon={<ChevronUp />} size="sm" variant="secondary" disabled={!matches.length} onClick={() => goToMatch(matchCursor - 1)} />
          <IconButton aria-label="Next match" icon={<ChevronDown />} size="sm" variant="secondary" disabled={!matches.length} onClick={() => goToMatch(matchCursor + 1)} />
          {query && <IconButton aria-label="Clear search" icon={<X />} size="sm" onClick={() => setQuery('')} />}
        </div>
        <p id="transcript-match-count" aria-live="polite" className="min-h-4 text-xs text-ink-2">
          {q ? (matches.length ? `Match ${Math.min(matchCursor, matches.length - 1) + 1} of ${matches.length}` : 'No matches') : ''}
        </p>
      </div>

      <div ref={containerRef} tabIndex={0} aria-label="Transcript" role="region" className="relative min-h-0 flex-1 overflow-y-auto pr-1 focus-visible:outline-offset-0">
        {followPaused && (
          <div className="sticky top-1 z-10 flex h-0 justify-center overflow-visible">
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<LocateFixed />}
              className="shadow-md"
              onClick={() => {
                const row = rows.current.get(activeIndex);
                if (row) scrollToElement(row, { force: true });
              }}
            >
              Back to playback
            </Button>
          </div>
        )}
        <ol className="flex flex-col gap-0.5 pb-6">
          {segments.map((segment, i) => (
            <SegmentRow
              key={segment.id}
              segment={segment}
              active={segment.index === activeIndex}
              query={q}
              currentMatch={segment.index === currentMatch}
              showSpeaker={i > 0 && segment.speaker !== segments[i - 1].speaker}
              onSeek={onSeek}
              rowRef={rowRef}
            />
          ))}
        </ol>
      </div>
    </div>
  );
}
