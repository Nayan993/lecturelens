import { Link } from 'react-router-dom';
import { Play } from 'lucide-react';
import { formatTimestamp } from '../../../lib/formatTime';
import { highlightTerms } from '../../../lib/highlight';
import { lectureHref } from '../../../lib/lectureLinks';
import type { RetrievedPassage } from '../../../types';
import { buttonClasses, Card, Skeleton } from '../../../components/ui';

export interface PassageCardProps {
  passage: RetrievedPassage;
  terms: string[];
  topicLabel?: string;
  /** Best score in this response: scores are only comparable within one response (§5.6). */
  maxScore: number;
}

/** Relevance relative to the best match in this result set, 0–100. */
export function relativeRelevance(score: number, maxScore: number): number {
  if (maxScore <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((score / maxScore) * 100)));
}

export function PassageCard({ passage, terms, topicLabel, maxScore }: PassageCardProps) {
  const relevance = relativeRelevance(passage.score, maxScore);
  return (
    <Card className="flex flex-col gap-3 p-4">
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-sm font-semibold text-ink-1">{passage.lectureTitle}</p>
          <p className="text-xs text-ink-2">
            {topicLabel && <span>{topicLabel} · </span>}
            <span className="font-mono font-semibold tabular-nums text-accent-strong">
              {formatTimestamp(passage.startSec)}–{formatTimestamp(passage.endSec)}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2" title={`Raw ${passage.retriever} score ${passage.score}`}>
          <span className="text-xs text-ink-3">Relevance</span>
          <span
            role="meter"
            aria-label={`Relevance: ${relevance}% of the best match`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={relevance}
            className="relative h-1.5 w-20 overflow-hidden rounded-full bg-ink-1/10"
          >
            <span className="absolute inset-y-0 left-0 rounded-full bg-brand" style={{ width: `${relevance}%` }} />
          </span>
        </div>
      </header>
      <p className="prose-lecture max-w-none">{highlightTerms(passage.text, terms)}</p>
      <div className="flex justify-end">
        <Link
          to={lectureHref(passage.lectureId, passage.startSec)}
          className={buttonClasses({ variant: 'secondary', size: 'sm' })}
          aria-label={`Play from ${formatTimestamp(passage.startSec)} in ${passage.lectureTitle}`}
        >
          <Play aria-hidden className="h-3.5 w-3.5" />
          Play from here
        </Link>
      </div>
    </Card>
  );
}

export function PassageCardSkeleton() {
  return (
    <Card className="flex flex-col gap-3 p-4 shadow-none" aria-hidden>
      <div className="flex justify-between gap-4">
        <div className="flex flex-1 flex-col gap-1.5">
          <Skeleton width="45%" height={14} />
          <Skeleton width="30%" height={12} />
        </div>
        <Skeleton width={100} height={8} className="rounded-full" />
      </div>
      <Skeleton height={14} />
      <Skeleton width="92%" height={14} />
      <Skeleton width="70%" height={14} />
    </Card>
  );
}
