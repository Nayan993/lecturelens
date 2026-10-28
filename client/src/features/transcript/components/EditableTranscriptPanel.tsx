import { memo, useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronsDown, Pencil, TriangleAlert } from 'lucide-react';
import { isNotImplemented } from '../../../lib/apiClient';
import { cn } from '../../../lib/cn';
import { formatTimestamp } from '../../../lib/formatTime';
import type { Id, TranscriptSegment } from '../../../types';
import { Badge, Button, ErrorState, Skeleton, Textarea, Tooltip, useToast } from '../../../components/ui';
import { usePlayer } from '../../../components/player/PlayerContext';
import { useTranscript, useUpdateSegment } from '../hooks';
import { useAutoFollow } from '../useAutoFollow';
import { activeSegmentIndex } from './TranscriptPanel';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
export const SAVE_SHORTCUT = isMac ? '⌘ Enter' : 'Ctrl Enter';

interface RowProps {
  segment: TranscriptSegment;
  active: boolean;
  editing: boolean;
  jumped: boolean;
  onSeek: (s: number) => void;
  onEdit: (index: number) => void;
  onSave: (index: number, text: string) => void;
  onCancel: (index: number) => void;
  rowRef: (index: number, el: HTMLLIElement | null) => void;
}

const EditableRow = memo(function EditableRow({ segment, active, editing, jumped, onSeek, onEdit, onSave, onCancel, rowRef }: RowProps) {
  const [draft, setDraft] = useState(segment.text);
  const time = formatTimestamp(segment.startSec);

  useEffect(() => {
    if (editing) setDraft(segment.text);
  }, [editing, segment.text]);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onCancel(segment.index);
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onSave(segment.index, draft);
    }
  };

  return (
    <li
      ref={(el) => rowRef(segment.index, el)}
      data-index={segment.index}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'grid grid-cols-segment gap-x-3 rounded-r-control border-l-2 py-2 pl-3 pr-2 transition-colors',
        active ? 'border-accent bg-accent-soft' : segment.lowConfidence && !segment.corrected ? 'border-warning/60 bg-warning/5' : 'border-transparent',
        jumped && 'ring-2 ring-warning/60',
      )}
    >
      <button
        type="button"
        onClick={() => onSeek(segment.startSec)}
        aria-label={`Play from ${time}`}
        className="h-fit rounded-sm pt-1 text-left font-mono text-xs font-semibold tabular-nums text-accent-strong hover:underline max-sm:min-h-11"
      >
        {time}
      </button>
      <div className="flex min-w-0 flex-col gap-1.5">
        {editing ? (
          <>
            <Textarea
              label={`Edit segment at ${time}`}
              containerClassName="[&>label]:sr-only"
              autoFocus
              rows={4}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              onFocus={(e) => e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length)}
              className="font-serif text-reading leading-relaxed"
              error={draft.trim() ? undefined : 'A segment can’t be empty.'}
              hint={`${SAVE_SHORTCUT} to save · Esc to cancel`}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => onSave(segment.index, draft)} disabled={!draft.trim()}>
                Save
              </Button>
              <Button size="sm" variant="secondary" onClick={() => onCancel(segment.index)}>
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <button
            type="button"
            data-edit-index={segment.index}
            onClick={() => onEdit(segment.index)}
            aria-label={`Edit segment at ${time}: ${segment.text}`}
            className={cn(
              'group prose-lecture block w-full max-w-none rounded-sm text-left hover:bg-ink-1/5',
              segment.lowConfidence && !segment.corrected && 'underline decoration-warning decoration-dotted decoration-2 underline-offset-4',
            )}
          >
            {segment.text}
            <Pencil aria-hidden className="ml-1.5 inline h-3.5 w-3.5 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
          </button>
        )}
        {(segment.lowConfidence || segment.corrected) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {segment.lowConfidence && (
              <Badge variant={segment.corrected ? 'neutral' : 'warning'} icon={<TriangleAlert />}>
                Low confidence ({Math.round(segment.confidence * 100)}%)
              </Badge>
            )}
            {segment.corrected && segment.originalText && (
              <Tooltip
                content={
                  <span className="block whitespace-normal text-left">
                    <span className="font-semibold">Original transcription:</span> {segment.originalText}
                  </span>
                }
                // Right-aligned: centred, it would overflow the panel's right edge and be clipped.
                className="left-auto right-0 w-80 translate-x-0"
              >
                <button type="button" className="inline-flex items-center rounded-full max-sm:min-h-11" aria-label="Edited — show the original transcription">
                  <Badge variant="brand" icon={<Pencil />}>
                    edited
                  </Badge>
                </button>
              </Tooltip>
            )}
          </div>
        )}
      </div>
    </li>
  );
});

/**
 * Teacher's correction view: every segment is editable inline, low-confidence segments are flagged,
 * and "Jump to next low-confidence segment" walks through them (seeking so you can hear the audio).
 */
export function EditableTranscriptPanel({ lectureId }: { lectureId: Id }) {
  const transcript = useTranscript(lectureId);
  const update = useUpdateSegment(lectureId);
  const player = usePlayer();
  const { toast } = useToast();
  const { containerRef, scrollToElement } = useAutoFollow();
  const rows = useRef(new Map<number, HTMLLIElement>());
  const [editing, setEditing] = useState<number | null>(null);
  const [jumped, setJumped] = useState<number | null>(null);

  const segments = transcript.data?.items ?? [];
  const activeIndex = activeSegmentIndex(segments, player.currentTime);
  const lowConfidence = segments.filter((s) => s.lowConfidence);
  const remaining = lowConfidence.filter((s) => !s.corrected);

  const rowRef = useCallback((index: number, el: HTMLLIElement | null) => {
    if (el) rows.current.set(index, el);
    else rows.current.delete(index);
  }, []);
  const focusEditButton = (index: number) =>
    requestAnimationFrame(() => rows.current.get(index)?.querySelector<HTMLButtonElement>(`[data-edit-index="${index}"]`)?.focus());

  // Follow playback, but never while the teacher is editing.
  useEffect(() => {
    const row = rows.current.get(activeIndex);
    if (row && editing === null) scrollToElement(row);
  }, [activeIndex, editing, scrollToElement]);

  const onSeek = useCallback((s: number) => player.seekTo(s), [player]);
  const onEdit = useCallback((index: number) => setEditing(index), []);
  const onCancel = useCallback((index: number) => {
    setEditing(null);
    focusEditButton(index);
  }, []);
  const onSave = useCallback(
    (index: number, text: string) => {
      const trimmed = text.trim();
      const current = segments.find((s) => s.index === index);
      setEditing(null);
      focusEditButton(index);
      if (!trimmed || !current || trimmed === current.text) return;
      update.mutate(
        { index, text: trimmed },
        {
          onSuccess: () => toast({ variant: 'success', title: 'Segment saved', description: `The correction at ${formatTimestamp(current.startSec)} is saved.` }),
          onError: (err) => toast({ variant: 'error', title: 'Couldn’t save — your edit was undone', description: err.message }),
        },
      );
    },
    [segments, update, toast],
  );

  const jumpToNextLowConfidence = () => {
    if (lowConfidence.length === 0) return;
    const from = jumped ?? activeIndex;
    const pool = remaining.length ? remaining : lowConfidence;
    const next = pool.find((s) => s.index > from) ?? pool[0];
    setJumped(next.index);
    const row = rows.current.get(next.index);
    if (row) scrollToElement(row, { force: true, align: 'reading' });
    player.seekTo(next.startSec);
    player.pause();
    focusEditButton(next.index);
  };

  if (transcript.isPending) {
    return (
      <div className="flex flex-col gap-4 py-2" aria-busy="true" aria-label="Loading transcript">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} height={44} />
        ))}
      </div>
    );
  }
  if (transcript.isError) {
    return isNotImplemented(transcript.error) ? (
      <ErrorState variant="notImplemented" message="Transcript editing isn’t available yet." />
    ) : (
      <ErrorState message={transcript.error.message} onRetry={() => void transcript.refetch()} />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 pb-3">
        <p className="text-sm text-ink-2">
          <span className="font-medium text-ink-1">{remaining.length}</span> of {lowConfidence.length} low-confidence{' '}
          {lowConfidence.length === 1 ? 'segment' : 'segments'} still to check
        </p>
        <Button
          size="sm"
          variant="secondary"
          leftIcon={<ChevronsDown />}
          onClick={jumpToNextLowConfidence}
          disabled={lowConfidence.length === 0}
          className="h-auto min-h-8 whitespace-normal py-1.5 text-left"
        >
          Jump to next low-confidence segment
        </Button>
      </div>
      <div ref={containerRef} role="region" aria-label="Editable transcript" tabIndex={-1} className="relative min-h-0 flex-1 overflow-y-auto pr-1">
        <ol className="flex flex-col gap-0.5 pb-6">
          {segments.map((s) => (
            <EditableRow
              key={s.id}
              segment={s}
              active={s.index === activeIndex}
              editing={editing === s.index}
              jumped={jumped === s.index}
              onSeek={onSeek}
              onEdit={onEdit}
              onSave={onSave}
              onCancel={onCancel}
              rowRef={rowRef}
            />
          ))}
        </ol>
      </div>
    </div>
  );
}
