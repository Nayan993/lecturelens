import { useState } from 'react';
import { Check, CheckCircle2, Pencil, X } from 'lucide-react';
import { cn } from '../../../lib/cn';
import { formatAge } from '../../../lib/formatDate';
import { formatTimestamp } from '../../../lib/formatTime';
import { Badge, Button, Card, CardContent, CardFooter, CardHeader, CardTitle } from '../../../components/ui';
import { useQuestionReview, useSummaryReview, type PendingQuestion, type PendingSummary, type SummaryChange } from '../hooks';
import { EditQuestionDialog, EditSummaryDialog, EvidenceLink, RejectDialog } from './ReviewDialogs';

function Context({ lecture, topicLabel, start, createdAt }: { lecture: string; topicLabel?: string; start?: number; createdAt: string }) {
  return (
    <p className="text-xs text-ink-2">
      {lecture}
      {topicLabel && ` · ${topicLabel}`}
      {start !== undefined && <span className="font-mono tabular-nums text-accent"> · {formatTimestamp(start)}</span>}
      <span className="text-ink-3"> · generated {formatAge(createdAt)}</span>
    </p>
  );
}

export function SummaryReviewCard({ item, highlighted }: { item: PendingSummary; highlighted?: boolean }) {
  const { summary, lecture, topic } = item;
  const review = useSummaryReview();
  const [rejecting, setRejecting] = useState(false);
  const [editing, setEditing] = useState(false);

  // Optimistic: close any dialog straight away; the hook toasts the outcome (and undoes on error).
  const run = (change: SummaryChange, successMessage: string) => {
    setRejecting(false);
    setEditing(false);
    review.mutate({ ...change, successMessage });
  };

  return (
    <Card id={`review-${summary.id}`} className={cn('scroll-mt-24', highlighted && 'ring-2 ring-accent')}>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="brand">Summary</Badge>
          <Context lecture={lecture.title} topicLabel={topic?.label} start={topic?.startSec} createdAt={summary.createdAt} />
        </div>
        <CardTitle>{topic?.label ?? summary.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="prose-lecture max-w-none">{summary.text}</p>
        {summary.keyPoints.length > 0 && (
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-ink-1 marker:text-ink-3">
            {summary.keyPoints.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">Evidence</p>
          <ul className="flex flex-wrap gap-2">
            {summary.evidence.map((ev) => (
              <li key={`${ev.chunkId}-${ev.startSec}`} className="min-w-0 max-w-full">
                <EvidenceLink lectureId={summary.lectureId} evidence={ev} />
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
      <CardFooter>
        <Button variant="ghost" size="sm" leftIcon={<X />} onClick={() => setRejecting(true)} aria-label={`Reject summary: ${topic?.label ?? summary.title}`}>
          Reject
        </Button>
        <Button variant="secondary" size="sm" leftIcon={<Pencil />} onClick={() => setEditing(true)} aria-label={`Edit summary: ${topic?.label ?? summary.title}`}>
          Edit
        </Button>
        <Button
          size="sm"
          leftIcon={<Check />}
          onClick={() => run({ action: 'approve', summary }, 'Summary approved — students can now see it')}
          aria-label={`Approve summary: ${topic?.label ?? summary.title}`}
        >
          Approve
        </Button>
      </CardFooter>
      <RejectDialog
        open={rejecting}
        onOpenChange={setRejecting}
        what="this summary"
        pending={review.isPending}
        onConfirm={(payload) => run({ action: 'reject', summary, payload }, 'Summary rejected')}
      />
      <EditSummaryDialog
        summary={summary}
        open={editing}
        onOpenChange={setEditing}
        pending={review.isPending}
        onSave={(text) => run({ action: 'edit', summary, payload: { text } }, 'Summary updated')}
      />
    </Card>
  );
}

export function QuestionReviewCard({ item, highlighted }: { item: PendingQuestion; highlighted?: boolean }) {
  const { question, lecture, topic } = item;
  const review = useQuestionReview();
  const [rejecting, setRejecting] = useState(false);
  const [editing, setEditing] = useState(false);

  const run = (patch: Parameters<typeof review.mutate>[0]['patch'], successMessage: string) => {
    setRejecting(false);
    setEditing(false);
    review.mutate({ question, patch, successMessage });
  };

  return (
    <Card id={`review-${question.id}`} className={cn('scroll-mt-24', highlighted && 'ring-2 ring-accent')}>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="accent">Question</Badge>
          <Badge variant="neutral" className="capitalize">
            {question.difficulty}
          </Badge>
          <Context lecture={lecture.title} topicLabel={topic?.label} createdAt={question.createdAt} />
        </div>
        <CardTitle className="font-medium">{question.stem}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ol className="flex flex-col gap-1.5">
          {question.options.map((o) => {
            const correct = o.id === question.correctOptionId;
            return (
              <li
                key={o.id}
                className={cn(
                  'flex items-start gap-2.5 rounded-control border px-3 py-2 text-sm',
                  correct ? 'border-success/40 bg-success/5 text-ink-1' : 'border-border text-ink-2',
                )}
              >
                <span className="font-semibold uppercase text-ink-3">{o.id}</span>
                <span className="flex-1">{o.text}</span>
                {correct && (
                  <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-success">
                    <CheckCircle2 aria-hidden className="h-4 w-4" />
                    Correct answer
                  </span>
                )}
              </li>
            );
          })}
        </ol>
        <p className="prose-lecture max-w-none text-[15.5px]">
          <span className="font-sans text-xs font-semibold uppercase tracking-wider text-ink-3">Explanation · </span>
          {question.explanation}
        </p>
        <ul className="flex flex-wrap gap-2">
          {question.evidence.map((ev) => (
            <li key={`${ev.chunkId}-${ev.startSec}`} className="min-w-0 max-w-full">
              <EvidenceLink lectureId={question.lectureId} evidence={ev} />
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        <Button variant="ghost" size="sm" leftIcon={<X />} onClick={() => setRejecting(true)} aria-label={`Reject question: ${question.stem}`}>
          Reject
        </Button>
        <Button variant="secondary" size="sm" leftIcon={<Pencil />} onClick={() => setEditing(true)} aria-label={`Edit question: ${question.stem}`}>
          Edit
        </Button>
        <Button size="sm" leftIcon={<Check />} onClick={() => run({ status: 'approved' }, 'Question approved — it can now appear in quizzes')} aria-label={`Approve question: ${question.stem}`}>
          Approve
        </Button>
      </CardFooter>
      <RejectDialog
        open={rejecting}
        onOpenChange={setRejecting}
        what="this question"
        pending={review.isPending}
        onConfirm={(payload) => run({ status: 'rejected', ...payload }, 'Question rejected')}
      />
      <EditQuestionDialog question={question} open={editing} onOpenChange={setEditing} pending={review.isPending} onSave={(patch) => run(patch, 'Question updated')} />
    </Card>
  );
}
