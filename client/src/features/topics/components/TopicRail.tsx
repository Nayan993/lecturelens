import { useEffect, useRef } from 'react';
import { cn } from '../../../lib/cn';
import { formatTimestamp } from '../../../lib/formatTime';
import type { TopicSection } from '../../../types';

/** Topic containing `t` (sections are half-open [startSec, endSec)). */
export function activeTopicId(topics: TopicSection[], t: number): string | null {
  return topics.find((s) => s.startSec <= t && t < s.endSec)?.id ?? null;
}

/**
 * Horizontal strip of topic chips under the player. The chip for the current playback position is
 * highlighted in accent; clicking a chip seeks there (the page also scrolls the transcript).
 */
export function TopicRail({
  topics,
  currentTime,
  onSelect,
}: {
  topics: TopicSection[];
  currentTime: number;
  onSelect: (topic: TopicSection) => void;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  const activeId = activeTopicId(topics, currentTime);

  // Keep the active chip visible horizontally without scrolling the page.
  useEffect(() => {
    const list = listRef.current;
    const chip = activeId ? list?.querySelector<HTMLElement>(`[data-topic="${activeId}"]`) : null;
    if (!list || !chip) return;
    const left = chip.offsetLeft;
    const right = left + chip.offsetWidth;
    if (left < list.scrollLeft || right > list.scrollLeft + list.clientWidth) {
      if (typeof list.scrollTo === 'function') list.scrollTo({ left: Math.max(0, left - 16), behavior: 'smooth' });
      else list.scrollLeft = Math.max(0, left - 16);
    }
  }, [activeId]);

  if (topics.length === 0) return null;
  return (
    <nav aria-label="Topics">
      <ul ref={listRef} className="relative flex gap-2 overflow-x-auto pb-1">
        {topics.map((topic) => {
          const active = topic.id === activeId;
          return (
            <li key={topic.id} className="shrink-0">
              <button
                type="button"
                data-topic={topic.id}
                aria-current={active ? 'true' : undefined}
                onClick={() => onSelect(topic)}
                className={cn(
                  'flex max-w-64 items-center gap-2 rounded-full border px-3 py-1.5 text-left text-xs transition-colors max-sm:min-h-11',
                  active ? 'border-accent bg-accent-soft text-ink-1' : 'border-border bg-surface text-ink-2 hover:border-ink-3 hover:text-ink-1',
                )}
              >
                <span className={cn('font-mono font-semibold tabular-nums', active ? 'text-accent-strong' : 'text-ink-3')}>
                  {formatTimestamp(topic.startSec)}
                </span>
                <span className="truncate font-medium">{topic.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
