import { useNavigate } from 'react-router-dom';
import { Play } from 'lucide-react';
import { cn } from '../../../lib/cn';
import { formatTimestamp } from '../../../lib/formatTime';
import { deepLinkToHref } from '../../../lib/lectureLinks';
import type { Citation, Id } from '../../../types';
import { Tooltip } from '../../../components/ui';
import { useOptionalPlayer } from '../../../components/player/PlayerContext';

/**
 * Open a citation: seek the on-screen player when it is showing the cited lecture, otherwise go to
 * that lecture's reading view at the cited second.
 */
export function useOpenCitation(onScreenLectureId?: Id) {
  const player = useOptionalPlayer();
  const navigate = useNavigate();
  return (citation: Citation) => {
    if (player?.hasPlayer && onScreenLectureId === citation.lectureId) player.seekTo(citation.startSec);
    else navigate(deepLinkToHref(citation.deepLink));
  };
}

export interface CitationChipProps {
  citation: Citation;
  /** Shown when the answer may draw on several lectures. */
  lectureTitle?: string;
  onScreenLectureId?: Id;
  className?: string;
}

export function CitationChip({ citation, lectureTitle, onScreenLectureId, className }: CitationChipProps) {
  const open = useOpenCitation(onScreenLectureId);
  const time = formatTimestamp(citation.startSec);
  return (
    <Tooltip content={<span className="block max-w-64 whitespace-normal font-serif text-[13px] leading-snug">“{citation.quote}”</span>} className="w-max max-w-72">
      <button
        type="button"
        onClick={() => open(citation)}
        aria-label={`Source ${citation.marker}: ${lectureTitle ? `${lectureTitle}, ` : ''}${time}. Quote: “${citation.quote}”`}
        className={cn(
          'inline-flex max-w-full items-center gap-1.5 rounded-full border border-accent/40 bg-surface py-1 pl-1 pr-2.5 text-xs text-ink-1 transition-colors hover:border-accent hover:bg-accent-soft',
          className,
        )}
      >
        <span aria-hidden className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-soft px-1 font-semibold tabular-nums text-accent">
          {citation.marker}
        </span>
        {lectureTitle && <span className="truncate text-ink-2">{lectureTitle}</span>}
        <Play aria-hidden className="h-3 w-3 shrink-0 fill-accent text-accent" />
        <span className="font-mono font-semibold tabular-nums text-accent">{time}</span>
      </button>
    </Tooltip>
  );
}
