import { useNavigate } from 'react-router-dom';
import { ListChecks, Plus } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { isNotImplemented } from '../../../lib/apiClient';
import type { Id } from '../../../types';
import { Button, EmptyState, ErrorState, Skeleton, useToast } from '../../../components/ui';
import { useCreateQuiz, useQuizzes } from '../hooks';
import { QuizSummaryCard } from './QuizSummaryCard';

/** "Start a practice quiz" for a lecture: builds one from approved questions and opens it. */
export function useStartPracticeQuiz() {
  const create = useCreateQuiz();
  const navigate = useNavigate();
  const { toast } = useToast();
  const start = (lectureId: Id, topicIds?: Id[]) =>
    create.mutate(
      { lectureId, topicIds, questionCount: 10 },
      {
        onSuccess: (quiz) => {
          toast({ variant: 'success', title: 'Quiz ready', description: `${quiz.questions.length} ${quiz.questions.length === 1 ? 'question' : 'questions'} from approved content.` });
          navigate(`/app/quizzes/${quiz.id}`);
        },
        onError: (err) =>
          toast({
            variant: isNotImplemented(err) ? 'info' : 'error',
            title: isNotImplemented(err) ? 'Quizzes are coming soon' : 'Couldn’t start a quiz',
            description: err.message,
          }),
      },
    );
  return { start, pending: create.isPending };
}

/** The Quiz tab in the reading view: this lecture's quizzes and a button to start a new one. */
export function QuizPanel({ lectureId }: { lectureId: Id }) {
  const { user } = useAuth();
  const quizzesQ = useQuizzes({ lectureId });
  const { start, pending } = useStartPracticeQuiz();

  if (user?.role === 'teacher') {
    return (
      <EmptyState
        icon={<ListChecks />}
        title="Students take quizzes here"
        description="Quizzes are built from the questions you approve in the Review Queue."
        className="border-0"
      />
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-2">Practice with teacher-approved questions on this lecture.</p>
        <Button size="sm" leftIcon={<Plus />} loading={pending} onClick={() => start(lectureId)}>
          New practice quiz
        </Button>
      </div>
      {quizzesQ.isPending ? (
        <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading quizzes">
          <Skeleton height={120} className="rounded-card" />
          <Skeleton height={120} className="rounded-card" />
        </div>
      ) : quizzesQ.isError ? (
        isNotImplemented(quizzesQ.error) ? (
          <ErrorState variant="notImplemented" message="Quizzes aren’t available yet." />
        ) : (
          <ErrorState message={quizzesQ.error.message} onRetry={() => void quizzesQ.refetch()} />
        )
      ) : quizzesQ.data.items.length === 0 ? (
        <EmptyState icon={<ListChecks />} title="No quizzes for this lecture yet" description="Start a practice quiz to test yourself." className="border-0" />
      ) : (
        <ul className="flex flex-col gap-3">
          {quizzesQ.data.items.map((q) => (
            <li key={q.id}>
              <QuizSummaryCard quiz={q} showLecture={false} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
