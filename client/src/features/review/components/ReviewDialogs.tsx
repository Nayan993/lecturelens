import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Play } from 'lucide-react';
import { formatTimestamp } from '../../../lib/formatTime';
import { lectureHref } from '../../../lib/lectureLinks';
import { REJECTION_REASONS, type Evidence, type Id, type OptionId, type Question, type RejectionReason, type RejectPayload, type Summary } from '../../../types';
import { Button, Dialog, Input, Radio, RadioGroup, Select, Textarea } from '../../../components/ui';

/** Plain-English labels for the contract's rejectionReason enum (§2). */
export const REJECTION_LABEL: Record<RejectionReason, string> = {
  FACTUALLY_WRONG: 'Factually wrong',
  UNSUPPORTED: 'Not supported by the lecture',
  AMBIGUOUS: 'Ambiguous or unclear',
  TOO_EASY: 'Too easy',
  TOO_HARD: 'Too hard',
  DUPLICATE: 'Duplicate',
  OTHER: 'Other',
};

/** Deep link to the evidence moment in the lecture's reading view. */
export function EvidenceLink({ lectureId, evidence }: { lectureId: Id; evidence: Evidence }) {
  const time = formatTimestamp(evidence.startSec);
  return (
    <Link
      to={lectureHref(lectureId, evidence.startSec)}
      aria-label={`Open the lecture at ${time}: “${evidence.quote}”`}
      className="flex max-w-full items-center gap-1.5 rounded-full border border-accent/40 bg-surface px-2.5 py-1 text-xs text-ink-2 transition-colors hover:border-accent hover:bg-accent-soft"
    >
      <Play aria-hidden className="h-3 w-3 shrink-0 fill-accent text-accent" />
      <span className="shrink-0 font-mono font-semibold tabular-nums text-accent">{time}</span>
      <span className="truncate">“{evidence.quote}”</span>
    </Link>
  );
}

/** Reject with a REQUIRED reason from the enum, plus an optional note. */
export function RejectDialog({
  open,
  onOpenChange,
  what,
  onConfirm,
  pending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  what: string;
  onConfirm: (payload: RejectPayload) => void;
  pending?: boolean;
}) {
  const [reason, setReason] = useState<RejectionReason | ''>('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setReason('');
      setNote('');
      setError(null);
    }
  }, [open]);

  const confirm = () => {
    if (!reason) {
      setError('Choose a reason — it is required to reject.');
      return;
    }
    onConfirm({ rejectionReason: reason, reviewNote: note.trim() || null });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title={`Reject ${what}?`}
      description="Rejected items are never shown to students. The reason is recorded for the evaluation."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={confirm} disabled={!reason} loading={pending}>
            Reject
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Select
          label="Reason"
          required
          value={reason}
          onChange={(e) => {
            setReason(e.target.value as RejectionReason);
            setError(null);
          }}
          error={error ?? undefined}
          hint={!reason && !error ? 'Required.' : undefined}
        >
          <option value="" disabled>
            Choose a reason…
          </option>
          {REJECTION_REASONS.map((r) => (
            <option key={r} value={r}>
              {REJECTION_LABEL[r]}
            </option>
          ))}
        </Select>
        <Textarea label="Note (optional)" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What should change?" />
      </div>
    </Dialog>
  );
}

export function EditSummaryDialog({
  summary,
  open,
  onOpenChange,
  onSave,
  pending,
}: {
  summary: Summary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (text: string) => void;
  pending?: boolean;
}) {
  const [text, setText] = useState(summary.text);
  useEffect(() => {
    if (open) setText(summary.text);
  }, [open, summary.text]);
  const error = text.trim() ? undefined : 'The summary can’t be empty.';
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="Edit summary"
      description="Edits keep the summary in review until you approve it."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onSave(text.trim())} disabled={Boolean(error) || text.trim() === summary.text} loading={pending}>
            Save changes
          </Button>
        </>
      }
    >
      <Textarea label="Summary" rows={8} value={text} onChange={(e) => setText(e.target.value)} error={error} className="font-serif text-[15.5px]" />
    </Dialog>
  );
}

export function EditQuestionDialog({
  question,
  open,
  onOpenChange,
  onSave,
  pending,
}: {
  question: Question;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (patch: Pick<Question, 'stem' | 'options' | 'correctOptionId' | 'explanation'>) => void;
  pending?: boolean;
}) {
  const [stem, setStem] = useState(question.stem);
  const [options, setOptions] = useState(question.options);
  const [correct, setCorrect] = useState<OptionId>(question.correctOptionId);
  const [explanation, setExplanation] = useState(question.explanation);
  useEffect(() => {
    if (open) {
      setStem(question.stem);
      setOptions(question.options);
      setCorrect(question.correctOptionId);
      setExplanation(question.explanation);
    }
  }, [open, question]);
  const invalid = !stem.trim() || !explanation.trim() || options.some((o) => !o.text.trim());
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="Edit question"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => onSave({ stem: stem.trim(), options: options.map((o) => ({ ...o, text: o.text.trim() })), correctOptionId: correct, explanation: explanation.trim() })}
            disabled={invalid}
            loading={pending}
          >
            Save changes
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Textarea label="Question" rows={2} value={stem} onChange={(e) => setStem(e.target.value)} error={stem.trim() ? undefined : 'Required'} />
        {options.map((o, i) => (
          <Input
            key={o.id}
            label={`Option ${o.id.toUpperCase()}`}
            value={o.text}
            onChange={(e) => setOptions((all) => all.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
            error={o.text.trim() ? undefined : 'Required'}
          />
        ))}
        <RadioGroup legend="Correct answer">
          <div className="flex gap-4">
            {options.map((o) => (
              <Radio key={o.id} name={`correct-${question.id}`} value={o.id} label={o.id.toUpperCase()} checked={correct === o.id} onChange={() => setCorrect(o.id)} />
            ))}
          </div>
        </RadioGroup>
        <Textarea label="Explanation" rows={3} value={explanation} onChange={(e) => setExplanation(e.target.value)} error={explanation.trim() ? undefined : 'Required'} />
      </div>
    </Dialog>
  );
}
