import { useId, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CircleAlert, CheckCircle2, Send } from 'lucide-react';
import { cn } from '../../../lib/cn';
import type { Attempt, OptionId, Quiz, StudentQuestion } from '../../../types';
import { Badge, Button, Card, CardContent, Progress, useToast } from '../../../components/ui';
import { useSubmitAttempt } from '../hooks';

const LETTER: Record<OptionId, string> = { a: 'A', b: 'B', c: 'C', d: 'D' };

function QuestionScreen({
  question,
  number,
  selected,
  onSelect,
}: {
  question: StudentQuestion;
  number: number;
  selected: OptionId | undefined;
  onSelect: (id: OptionId) => void;
}) {
  const name = useId();
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="mb-4 text-lg font-semibold leading-snug text-ink-1">
        <span className="sr-only">Question {number}: </span>
        {question.stem}
      </legend>
      <div className="flex flex-col gap-2.5">
        {question.options.map((option) => {
          const checked = selected === option.id;
          return (
            <label
              key={option.id}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-card border bg-surface p-3.5 transition-colors',
                'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand',
                checked ? 'border-brand bg-brand-soft' : 'border-border hover:border-ink-3',
              )}
            >
              <input type="radio" name={name} value={option.id} checked={checked} onChange={() => onSelect(option.id)} className="sr-only" />
              <span
                aria-hidden
                className={cn(
                  'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm font-semibold',
                  checked ? 'border-brand bg-brand text-surface' : 'border-border text-ink-2',
                )}
              >
                {LETTER[option.id]}
              </span>
              <span className="pt-0.5 text-md text-ink-1">{option.text}</span>
              {checked && <span className="sr-only"> (selected)</span>}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** One question per screen, Previous / Next, then a review screen that flags unanswered questions. */
export function QuizTaker({ quiz, onSubmitted }: { quiz: Quiz; onSubmitted: (attempt: Attempt) => void }) {
  // Both shapes carry everything a student needs (id, topicId, difficulty, stem, options).
  const questions: StudentQuestion[] = quiz.questions;
  const [startedAt] = useState(() => new Date().toISOString());
  const [index, setIndex] = useState(0);
  const [reviewing, setReviewing] = useState(false);
  const [answers, setAnswers] = useState<Record<string, OptionId>>({});
  const submit = useSubmitAttempt(quiz.id);
  const { toast } = useToast();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const total = questions.length;
  const unanswered = questions.filter((q) => !answers[q.id]);

  const go = (next: number | 'review') => {
    if (next === 'review') setReviewing(true);
    else {
      setReviewing(false);
      setIndex(next);
    }
    // Move focus to the new screen's heading so keyboard and screen-reader users follow along.
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  const onSubmit = () => {
    submit.mutate(
      { startedAt, answers: questions.map((q) => ({ questionId: q.id, selectedOptionId: answers[q.id] ?? null })) },
      {
        onSuccess: (attempt) => {
          toast({ variant: 'success', title: 'Answers submitted', description: `You scored ${attempt.score.correct} of ${attempt.score.total}.` });
          onSubmitted(attempt);
        },
        onError: (err) => toast({ variant: 'error', title: 'Couldn’t submit your answers', description: err.message }),
      },
    );
  };

  if (reviewing) {
    return (
      <div className="flex flex-col gap-5">
        <h2 ref={headingRef} tabIndex={-1} className="text-lg font-semibold text-ink-1 outline-none">
          Review your answers
        </h2>
        {unanswered.length > 0 ? (
          <p className="flex items-start gap-2 rounded-control border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm text-ink-1">
            <CircleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-warning-strong" />
            {unanswered.length} {unanswered.length === 1 ? 'question is' : 'questions are'} unanswered and will count as wrong.
          </p>
        ) : (
          <p className="flex items-center gap-2 text-sm text-ink-2">
            <CheckCircle2 aria-hidden className="h-4 w-4 text-success-strong" />
            All {total} questions answered.
          </p>
        )}
        <ol className="flex flex-col gap-2">
          {questions.map((q, i) => {
            const answer = answers[q.id];
            return (
              <li key={q.id}>
                <Card className="flex items-center gap-3 p-3 shadow-none">
                  <span className="w-6 shrink-0 text-sm font-semibold tabular-nums text-ink-3">{i + 1}.</span>
                  <p className="min-w-0 flex-1 truncate text-sm text-ink-1">{q.stem}</p>
                  {answer ? (
                    <Badge variant="success" icon={<CheckCircle2 />}>
                      Answer {LETTER[answer]}
                    </Badge>
                  ) : (
                    <Badge variant="warning" icon={<CircleAlert />}>
                      Not answered
                    </Badge>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => go(i)} aria-label={`Change answer to question ${i + 1}`}>
                    Change
                  </Button>
                </Card>
              </li>
            );
          })}
        </ol>
        <div className="flex flex-wrap justify-between gap-2">
          <Button variant="secondary" leftIcon={<ArrowLeft />} onClick={() => go(total - 1)}>
            Back to questions
          </Button>
          <Button leftIcon={<Send />} loading={submit.isPending} onClick={onSubmit}>
            {submit.isPending ? 'Submitting…' : 'Submit answers'}
          </Button>
        </div>
      </div>
    );
  }

  const question = questions[index];
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h2 ref={headingRef} tabIndex={-1} className="text-sm font-medium text-ink-2 outline-none">
          Question {index + 1} of {total}
        </h2>
        <Progress label={`Question ${index + 1} of ${total}`} value={index + 1} max={total} className="[&>div]:h-1.5" />
      </div>
      <Card>
        <CardContent className="py-5">
          <QuestionScreen key={question.id} question={question} number={index + 1} selected={answers[question.id]} onSelect={(id) => setAnswers((a) => ({ ...a, [question.id]: id }))} />
        </CardContent>
      </Card>
      <div className="flex justify-between gap-2">
        <Button variant="secondary" leftIcon={<ArrowLeft />} disabled={index === 0} onClick={() => go(index - 1)}>
          Previous
        </Button>
        {index < total - 1 ? (
          <Button rightIcon={<ArrowRight />} onClick={() => go(index + 1)}>
            Next
          </Button>
        ) : (
          <Button rightIcon={<ArrowRight />} onClick={() => go('review')}>
            Review answers
          </Button>
        )}
      </div>
    </div>
  );
}
