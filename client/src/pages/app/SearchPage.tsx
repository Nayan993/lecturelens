import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, SearchX } from 'lucide-react';
import { isNotImplemented } from '../../lib/apiClient';
import { cn } from '../../lib/cn';
import { queryTerms } from '../../lib/highlight';
import { useDocumentTitle } from '../../lib/useDocumentTitle';
import { RETRIEVERS, type Retriever, type TopicSection } from '../../types';
import { Badge, Button, EmptyState, ErrorState, Input, Select } from '../../components/ui';
import { useLectures } from '../../features/lectures/hooks';
import { useSearch } from '../../features/search/hooks';
import { useTopicsForLectures } from '../../features/topics/hooks';
import { PassageCard, PassageCardSkeleton } from '../../features/search/components/PassageCard';

const EXAMPLES = ['learning rate too large', 'epoch vs iteration', 'chain rule upstream gradient', 'vanishing gradients sigmoid'];
const TOP_K = 10;

function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-control border border-border bg-surface p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-[calc(var(--radius-control)-2px)] px-3 py-1.5 text-sm font-medium transition-colors',
            value === o.value ? 'bg-brand-soft text-brand' : 'text-ink-2 hover:text-ink-1',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const topicAt = (topics: TopicSection[], lectureId: string, t: number) =>
  topics.find((s) => s.lectureId === lectureId && s.startSec <= t && t < s.endSec)?.label;

/** /app/search — passages ranked by the retriever, each linking to its moment in the lecture. */
export function SearchPage() {
  useDocumentTitle('Search');
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const scope = params.get('scope') === 'lecture' ? 'lecture' : 'all';
  const retriever = (RETRIEVERS as readonly string[]).includes(params.get('retriever') ?? '') ? (params.get('retriever') as Retriever) : 'hybrid';
  const lecturesQ = useLectures({ limit: 100 });
  const lectures = (lecturesQ.data?.items ?? []).filter((l) => l.status === 'ready');
  const lectureId = params.get('lectureId') ?? lectures[0]?.id ?? '';

  const [draft, setDraft] = useState(q);
  useEffect(() => setDraft(q), [q]); // the header's global search can change ?q=

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setParams(next);
  };

  const scopedId = scope === 'lecture' && lectureId ? lectureId : undefined;
  const results = useSearch({ query: q, lectureId: scopedId, retriever, topK: TOP_K });
  const items = results.data?.items ?? [];
  const topics = useTopicsForLectures(items.map((p) => p.lectureId));
  const terms = queryTerms(q);
  const maxScore = items.reduce((m, p) => Math.max(m, p.score), 0);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    update({ q: draft.trim() || null });
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-1">Search</h1>
        <p className="text-sm text-ink-2">Find the exact moments a topic was explained, across the transcripts of your lectures.</p>
      </header>

      <form role="search" onSubmit={onSubmit} className="flex flex-col gap-3">
        <div className="flex items-end gap-2">
          <Input
            label="Search lecture transcripts"
            type="search"
            leftIcon={<Search />}
            placeholder="e.g. why does the loss blow up"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            containerClassName="flex-1"
            className="h-11 text-base"
          />
          <Button type="submit" size="lg">
            Search
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedControl
            label="Search scope"
            value={scope}
            onChange={(v) => update({ scope: v === 'all' ? null : v })}
            options={[
              { value: 'lecture', label: 'This lecture' },
              { value: 'all', label: 'All lectures' },
            ]}
          />
          {scope === 'lecture' && (
            <Select
              label="Lecture"
              value={lectureId}
              onChange={(e) => update({ lectureId: e.target.value })}
              containerClassName="min-w-0 max-w-sm flex-1 [&>label]:sr-only"
              className="h-9"
            >
              {lectures.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </Select>
          )}
          {import.meta.env.DEV && (
            <div className="flex items-center gap-2">
              <Badge variant="accent">Dev only</Badge>
              <SegmentedControl
                label="Retriever"
                value={retriever}
                onChange={(v) => update({ retriever: v === 'hybrid' ? null : v })}
                options={RETRIEVERS.map((r) => ({ value: r, label: r }))}
              />
            </div>
          )}
        </div>
      </form>

      <section aria-label="Results" aria-busy={results.isFetching || undefined} className="flex flex-col gap-3">
        {!q ? (
          <EmptyState
            icon={<Search />}
            title="Search inside your lectures"
            description="Search by meaning or by the words used in class. Try one of these:"
          />
        ) : results.isPending ? (
          <>
            <PassageCardSkeleton />
            <PassageCardSkeleton />
            <PassageCardSkeleton />
          </>
        ) : results.isError ? (
          isNotImplemented(results.error) ? (
            <ErrorState variant="notImplemented" message="Lecture search isn’t available yet." />
          ) : (
            <ErrorState message={results.error.message} onRetry={() => void results.refetch()} />
          )
        ) : items.length === 0 ? (
          <EmptyState
            icon={<SearchX />}
            title="No passages matched"
            description={scope === 'lecture' ? 'Try other words, or search all lectures.' : 'Try other words, or a broader phrase.'}
            action={scope === 'lecture' ? { label: 'Search all lectures', onClick: () => update({ scope: null }) } : undefined}
          />
        ) : (
          <>
            <p className="text-sm text-ink-2" aria-live="polite">
              {items.length} {items.length === 1 ? 'passage' : 'passages'} for “{results.data.query}”
              <span className="text-ink-3"> · {results.data.tookMs} ms</span>
            </p>
            <ol className={cn('flex flex-col gap-3', results.isPlaceholderData && 'opacity-60')}>
              {items.map((p) => (
                <li key={p.chunkId}>
                  <PassageCard passage={p} terms={terms} topicLabel={topicAt(topics, p.lectureId, p.startSec)} maxScore={maxScore} />
                </li>
              ))}
            </ol>
          </>
        )}
        {!q && (
          <ul className="flex flex-wrap justify-center gap-2">
            {EXAMPLES.map((example) => (
              <li key={example}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setDraft(example);
                    update({ q: example });
                  }}
                >
                  {example}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
