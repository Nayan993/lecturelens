import { useState } from 'react';
import { Check, CheckCircle2, Pencil, Sparkles, X } from 'lucide-react';
import { cn } from '../../../lib/cn';
import { formatAge } from '../../../lib/formatDate';
import { formatTimestamp } from '../../../lib/formatTime';
import { Badge, Button, Card, CardContent, CardFooter, CardHeader, CardTitle, Input, Select } from '../../../components/ui';
import {
  useQuestionGeneration,
  useQuestionReview,
  useSummaryReview,
  useTopicReview,
  type PendingQuestion,
  type PendingSummary,
  type PendingTopic,
  type SummaryChange,
} from '../hooks';
import type { Lecture } from '../../../types';
import { EditQuestionDialog, EditSummaryDialog, EvidenceLink, RejectDialog } from './ReviewDialogs';

function Context({ lecture, topicLabel, start, createdAt }: { lecture: string; topicLabel?: string; start?: number; createdAt: string }) {
  return (
    <p className="text-xs text-ink-2">
      {lecture}
      {topicLabel && ` · ${topicLabel}`}
      {start !== undefined && <span className="font-mono tabular-nums text-accent-strong"> · {formatTimestamp(start)}</span>}
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
          <p className="text-eyebrow font-semibold uppercase tracking-wider text-ink-3">Evidence</p>
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
                  <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-success-strong">
                    <CheckCircle2 aria-hidden className="h-4 w-4" />
                    Correct answer
                  </span>
                )}
              </li>
            );
          })}
        </ol>
        <p className="prose-lecture max-w-none text-reading-sm">
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

/** A topic section waiting for approval. Until it is approved students see neither it nor its summary. */
export function TopicReviewCard({ item }: { item: PendingTopic }) {
  const { topic, lecture } = item;
  const review = useTopicReview();
  return (
    <Card id={`review-${topic.id}`} className="scroll-mt-24">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="neutral">Topic</Badge>
          <p className="text-xs text-ink-2">
            {lecture.title}
            <span className="font-mono tabular-nums text-accent-strong">
              {' '}
              · {formatTimestamp(topic.startSec)}–{formatTimestamp(topic.endSec)}
            </span>
          </p>
        </div>
        <CardTitle>{topic.label}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {topic.keywords.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="Keywords">
            {topic.keywords.map((k) => (
              <li key={k}>
                <Badge variant="neutral">{k}</Badge>
              </li>
            ))}
          </ul>
        )}
        <p className="text-sm text-ink-2">Approving shows this section, and its summary once that is approved, to students. It also lets you generate quiz questions from it.</p>
      </CardContent>
      <CardFooter>
        <Button
          size="sm"
          leftIcon={<Check />}
          loading={review.isPending}
          onClick={() => review.mutate(topic)}
          aria-label={`Approve topic: ${topic.label}`}
        >
          Approve
        </Button>
      </CardFooter>
    </Card>
  );
}

/** Generate quiz questions for one of the teacher's ready lectures; they arrive pending review. */
export function GenerateQuestionsCard({ lectures }: { lectures: Lecture[] }) {
  const generate = useQuestionGeneration();
  const [lectureId, setLectureId] = useState(lectures[0]?.id ?? '');
  const [count, setCount] = useState(5);
  const selected = lectures.some((l) => l.id === lectureId) ? lectureId : (lectures[0]?.id ?? '');
  if (lectures.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Generate quiz questions</CardTitle>
        <p className="text-sm text-ink-2">
          Multiple-choice questions are drafted from a lecture’s <strong>approved</strong> topic sections, each with a quote located in the
          transcript. Nothing reaches students until you approve it here.
        </p>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (selected) generate.mutate({ lectureId: selected, count });
          }}
        >
          <Select label="Lecture" value={selected} onChange={(e) => setLectureId(e.target.value)} containerClassName="min-w-56 flex-1">
            {lectures.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </Select>
          <Input
            label="How many"
            type="number"
            min={1}
            max={20}
            value={count}
            onChange={(e) => setCount(Math.min(20, Math.max(1, Number(e.target.value) || 1)))}
            containerClassName="w-28"
          />
          <Button type="submit" leftIcon={<Sparkles />} loading={generate.isPending} disabled={!selected}>
            {generate.isPending ? 'Generating…' : 'Generate questions'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
