import { useEffect, useRef, useState, type FormEvent } from 'react';
import { MessageCircleQuestion, SendHorizontal } from 'lucide-react';
import { isNotImplemented } from '../../../lib/apiClient';
import { cn } from '../../../lib/cn';
import type { GroundedAnswer, Id } from '../../../types';
import { Button, EmptyState, ErrorState, IconButton, Input, Spinner } from '../../../components/ui';
import { useLectureTitles } from '../../lectures/hooks';
import { useAsk } from '../hooks';
import { AnswerCard } from './AnswerCard';

interface Turn {
  id: number;
  question: string;
  /** Scope it was asked in; undefined = all lectures. */
  lectureId?: Id;
  status: 'pending' | 'done' | 'error';
  answer?: GroundedAnswer;
  error?: Error;
}

const EXAMPLES = [
  'Why does a learning rate that is too large make the loss blow up?',
  'What is the difference between an epoch and an iteration?',
  'What did the lecturer recommend for Adam’s beta2?',
];

export interface AskPanelProps {
  /** Scope questions to one lecture (the reading view); omit to ask across all lectures. */
  lectureId?: Id;
  /** Lecture whose player is on screen — its citations seek the player instead of navigating. */
  onScreenLectureId?: Id;
  className?: string;
}

/**
 * Ask questions; answers come only from the lectures, with timestamp citations, or an explicit
 * abstention. The thread lives in component state (no persistence in this phase).
 */
export function AskPanel({ lectureId, onScreenLectureId, className }: AskPanelProps) {
  const ask = useAsk();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const nextId = useRef(1);
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const citedLectureIds = turns.flatMap((t) => t.answer?.citations.map((c) => c.lectureId) ?? []);
  const titles = useLectureTitles(lectureId ? [] : citedLectureIds);

  // Keep the newest exchange in view.
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns]);

  const submit = (question: string, scope: Id | undefined) => {
    const q = question.trim();
    if (q.length < 3) {
      setInputError('Ask a question of at least 3 characters.');
      inputRef.current?.focus();
      return;
    }
    if (q.length > 500) {
      setInputError('Keep questions under 500 characters.');
      return;
    }
    setInputError(null);
    const id = nextId.current++;
    setTurns((all) => [...all, { id, question: q, lectureId: scope, status: 'pending' }]);
    setDraft('');
    const update = (patch: Partial<Turn>) => setTurns((all) => all.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    ask.mutateAsync({ question: q, lectureId: scope }).then(
      (answer) => update({ status: 'done', answer }),
      (error: Error) => update({ status: 'error', error }),
    );
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(draft, lectureId);
  };

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <div ref={threadRef} className="min-h-0 flex-1 overflow-y-auto pb-3">
        {turns.length === 0 ? (
          <EmptyState
            icon={<MessageCircleQuestion />}
            title={lectureId ? 'Ask about this lecture' : 'Ask about your lectures'}
            description="Answers quote the lecture and link to the exact moment. If the lectures don’t cover it, you’ll be told so."
            className="border-0 py-6"
          />
        ) : (
          <ol aria-label="Conversation" aria-live="polite" className="flex flex-col gap-5">
            {turns.map((turn) => (
              <li key={turn.id} className="flex flex-col gap-2.5">
                <p className="max-w-bubble self-end rounded-card rounded-br-sm bg-brand-soft px-3.5 py-2 text-sm text-ink-1">
                  <span className="sr-only">You asked: </span>
                  {turn.question}
                </p>
                {turn.status === 'pending' && (
                  <p className="flex items-center gap-2 text-sm text-ink-2">
                    <Spinner size="sm" className="text-brand" />
                    Looking for the answer in {turn.lectureId ? 'this lecture' : 'your lectures'}…
                  </p>
                )}
                {turn.status === 'done' && turn.answer && (
                  <AnswerCard
                    answer={turn.answer}
                    lectureTitles={titles}
                    onScreenLectureId={onScreenLectureId}
                    scoped={Boolean(turn.lectureId)}
                    onWiden={() => submit(turn.question, undefined)}
                  />
                )}
                {turn.status === 'error' &&
                  (isNotImplemented(turn.error) ? (
                    <ErrorState variant="notImplemented" message="Grounded answers aren’t available yet." className="px-4 py-5" />
                  ) : (
                    <ErrorState
                      message={turn.error?.message ?? 'Something went wrong.'}
                      onRetry={() => submit(turn.question, turn.lectureId)}
                      className="px-4 py-5"
                    />
                  ))}
              </li>
            ))}
          </ol>
        )}
      </div>

      <form onSubmit={onSubmit} className="flex shrink-0 flex-col gap-2 border-t border-border pb-3 pt-3">
        {turns.length === 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-ink-2">Try one of these</p>
            <ul className="flex flex-wrap gap-1.5">
              {EXAMPLES.map((example) => (
                <li key={example}>
                  <Button type="button" variant="secondary" size="sm" className="h-auto whitespace-normal py-1.5 text-left text-xs font-normal" onClick={() => submit(example, lectureId)}>
                    {example}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex items-start gap-2">
          <Input
            ref={inputRef}
            label="Your question"
            placeholder={lectureId ? 'Ask about this lecture…' : 'Ask about any of your lectures…'}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (inputError) setInputError(null);
            }}
            error={inputError ?? undefined}
            maxLength={500}
            containerClassName="flex-1 [&>label]:sr-only"
            autoComplete="off"
          />
          <IconButton type="submit" aria-label="Send question" icon={<SendHorizontal />} variant="primary" disabled={!draft.trim()} />
        </div>
      </form>
    </div>
  );
}
