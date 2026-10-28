import { Link } from 'react-router-dom';
import { ListChecks, Trophy } from 'lucide-react';
import { formatDate } from '../../../lib/formatDate';
import type { QuizSummary } from '../../../types';
import { Badge, buttonClasses, Card } from '../../../components/ui';

const pct = (accuracy: number) => `${Math.round(accuracy * 100)}%`;

export function QuizSummaryCard({ quiz, showLecture = true }: { quiz: QuizSummary; showLecture?: boolean }) {
  const shownTopics = quiz.topics.slice(0, 3);
  const more = quiz.topics.length - shownTopics.length;
  return (
    <Card className="flex h-full flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="text-[15px] font-semibold leading-snug text-ink-1">{quiz.title}</h3>
          {showLecture && <p className="truncate text-xs text-ink-2">{quiz.lectureTitle}</p>}
        </div>
        {quiz.bestScore ? (
          <Badge variant={quiz.bestScore.accuracy >= 0.75 ? 'success' : quiz.bestScore.accuracy >= 0.5 ? 'warning' : 'danger'} icon={<Trophy />}>
            Best {quiz.bestScore.correct}/{quiz.bestScore.total} · {pct(quiz.bestScore.accuracy)}
          </Badge>
        ) : (
          <Badge variant="neutral">Not attempted</Badge>
        )}
      </div>
      <p className="flex items-center gap-1.5 text-xs text-ink-2">
        <ListChecks aria-hidden className="h-3.5 w-3.5 text-ink-3" />
        {quiz.questionCount} {quiz.questionCount === 1 ? 'question' : 'questions'}
        {quiz.attemptCount > 0 && ` · ${quiz.attemptCount} ${quiz.attemptCount === 1 ? 'attempt' : 'attempts'}`}
        {quiz.lastAttemptAt && ` · last ${formatDate(quiz.lastAttemptAt)}`}
      </p>
      {quiz.topics.length > 0 && (
        <ul aria-label="Topics covered" className="flex flex-wrap gap-1.5">
          {shownTopics.map((t) => (
            <li key={t.id}>
              <Badge variant="brand" className="max-w-[14rem] truncate">
                {t.label}
              </Badge>
            </li>
          ))}
          {more > 0 && (
            <li>
              <Badge variant="neutral">+{more} more</Badge>
            </li>
          )}
        </ul>
      )}
      <div className="mt-auto flex flex-wrap gap-2 pt-1">
        <Link to={`/app/quizzes/${quiz.id}`} className={buttonClasses({ size: 'sm' })} aria-label={`${quiz.attemptCount ? 'Retake' : 'Start'} ${quiz.title}`}>
          {quiz.attemptCount ? 'Retake' : 'Start quiz'}
        </Link>
        {quiz.lastAttemptId && (
          <Link
            to={`/app/quizzes/${quiz.id}?attempt=${quiz.lastAttemptId}`}
            className={buttonClasses({ variant: 'secondary', size: 'sm' })}
            aria-label={`Last results for ${quiz.title}`}
          >
            Last results
          </Link>
        )}
      </div>
    </Card>
  );
}
