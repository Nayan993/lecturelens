import { useEffect, type ReactNode } from 'react';
import { Info, Search } from 'lucide-react';
import { formatLatency } from '../../../lib/formatTime';
import type { AbstainReason, Citation, GroundedAnswer, Id } from '../../../types';
import { Button } from '../../../components/ui';
import { CitationChip, useOpenCitation } from './CitationChip';

/** Why the assistant abstained, in plain English. UNGROUNDED = the client-side contract guard. */
const REASON_TEXT: Record<AbstainReason | 'UNGROUNDED', string> = {
  NO_RELEVANT_PASSAGE: 'Nothing in the lecture closely matched your question, so there was nothing to quote.',
  LOW_CONFIDENCE: 'Some passages looked related, but not clearly enough to answer without guessing.',
  PARSE_FAILED: 'An answer was drafted but couldn’t be checked against the lecture, so it isn’t shown.',
  UNGROUNDED: 'The answer came back without any sources, so it can’t be shown as a grounded answer.',
};

/** True only for an answer that may be presented as grounded: answered AND at least one citation. */
export function isGrounded(answer: GroundedAnswer): answer is Extract<GroundedAnswer, { abstained: false }> {
  return !answer.abstained && answer.answerable && answer.citations.length > 0;
}

const formatScore = (score: number) => String(Number(score.toPrecision(3)));

function MetaLine({ answer }: { answer: GroundedAnswer }) {
  const parts = [
    `Retriever: ${answer.retriever}`,
    `top score ${answer.topScore === null ? '—' : formatScore(answer.topScore)}`,
    formatLatency(answer.latencyMs),
    answer.cached ? 'cached' : null,
  ].filter(Boolean);
  return <p className="text-xs text-ink-3">{parts.join(' · ')}</p>;
}

/** Answer text with [n] markers turned into small buttons that open citation n. */
function AnswerText({ text, citations, onOpen }: { text: string; citations: Citation[]; onOpen: (c: Citation) => void }) {
  const byMarker = new Map(citations.map((c) => [c.marker, c]));
  const nodes: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(/\[(\d+)\]/g)) {
    const citation = byMarker.get(Number(m[1]));
    nodes.push(text.slice(last, m.index));
    nodes.push(
      citation ? (
        <button
          key={m.index}
          type="button"
          onClick={() => onOpen(citation)}
          aria-label={`Source ${citation.marker}`}
          className="mx-0.5 rounded-sm px-0.5 align-super font-sans text-[11px] font-semibold text-accent hover:bg-accent-soft"
        >
          [{citation.marker}]
        </button>
      ) : (
        m[0]
      ),
    );
    last = (m.index ?? 0) + m[0].length;
  }
  nodes.push(text.slice(last));
  return <p className="prose-lecture max-w-none">{nodes}</p>;
}

export interface AbstainedPanelProps {
  reason: AbstainReason | 'UNGROUNDED';
  /** Asked within one lecture (offer to widen the scope). */
  scoped: boolean;
  onWiden?: () => void;
  answer: GroundedAnswer;
}

/** Abstention is a first-class, deliberate outcome — calm and neutral, never styled as an error. */
export function AbstainedPanel({ reason, scoped, onWiden, answer }: AbstainedPanelProps) {
  return (
    <div data-testid="abstained-panel" className="flex flex-col gap-3 rounded-card border border-border bg-bg px-4 py-4">
      <div className="flex items-start gap-3">
        <span aria-hidden className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-info/10 text-info">
          <Info className="h-4 w-4" />
        </span>
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="font-serif text-[16.5px] leading-relaxed text-ink-1">
            I couldn’t find this in {scoped ? 'this lecture' : 'the lectures'}.
          </p>
          <p className="text-sm text-ink-2">
            <span className="font-medium text-ink-1">Why: </span>
            {REASON_TEXT[reason]}
          </p>
          <p className="text-sm text-ink-2">
            Try rephrasing with words the lecturer would use{scoped ? ', or search across all lectures' : ''}. LectureLens only answers from
            what was actually said, so it says so rather than guess.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 pl-11">
        <MetaLine answer={answer} />
        {scoped && onWiden && (
          <Button variant="secondary" size="sm" leftIcon={<Search />} onClick={onWiden}>
            Ask across all lectures
          </Button>
        )}
      </div>
    </div>
  );
}

export interface AnswerCardProps {
  answer: GroundedAnswer;
  /** id → title, for chips when the question was asked across lectures. */
  lectureTitles?: Map<Id, string>;
  /** The lecture whose player is on screen, so its citations seek instead of navigating. */
  onScreenLectureId?: Id;
  scoped: boolean;
  onWiden?: () => void;
}

export function AnswerCard({ answer, lectureTitles, onScreenLectureId, scoped, onWiden }: AnswerCardProps) {
  const open = useOpenCitation(onScreenLectureId);
  const grounded = isGrounded(answer);
  const violation = !answer.abstained && !grounded;

  useEffect(() => {
    if (violation) {
      console.warn(
        '[LectureLens] Contract violation: /ask returned answerable=true without citations. Rendering it as an abstention instead of an ungrounded answer.',
        answer,
      );
    }
  }, [violation, answer]);

  if (!grounded) {
    return <AbstainedPanel reason={answer.abstained ? answer.abstainReason : 'UNGROUNDED'} scoped={scoped} onWiden={onWiden} answer={answer} />;
  }

  return (
    <article className="flex flex-col gap-3 rounded-card border border-border bg-surface px-4 py-4">
      <AnswerText text={answer.answer} citations={answer.citations} onOpen={open} />
      <div className="flex flex-col gap-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">Sources</p>
        <ul className="flex flex-wrap gap-2">
          {answer.citations.map((c) => (
            <li key={`${c.marker}-${c.chunkId}`} className="min-w-0 max-w-full">
              <CitationChip citation={c} lectureTitle={scoped ? undefined : lectureTitles?.get(c.lectureId)} onScreenLectureId={onScreenLectureId} />
            </li>
          ))}
        </ul>
      </div>
      <MetaLine answer={answer} />
    </article>
  );
}
