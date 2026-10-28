import { useDocumentTitle } from '../../lib/useDocumentTitle';
import { AskPanel } from '../../features/qa/components/AskPanel';

/** /app/ask — questions across all lectures. Fills the viewport like the reading view. */
export function AskPage() {
  useDocumentTitle('Ask');
  return (
    <div className="mx-auto flex h-[calc(100dvh-6.5rem)] w-full max-w-3xl flex-col gap-3 lg:h-[calc(100dvh-7.5rem)]">
      <header className="flex shrink-0 flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-1">Ask</h1>
        <p className="text-sm text-ink-2">Answers come only from your lectures, with a link to the moment each point was made.</p>
      </header>
      <section aria-label="Questions and answers" className="flex min-h-0 flex-1 flex-col rounded-card border border-border bg-surface px-4 pt-4 shadow-sm">
        <AskPanel />
      </section>
    </div>
  );
}
