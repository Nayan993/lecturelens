import { BarChart3 } from 'lucide-react';
import { useDocumentTitle } from '../../lib/useDocumentTitle';
import { EmptyState } from '../../components/ui';
import { PAGE_WIDE } from '../../components/layout/Page';

export { UploadPage } from './UploadPage';
export { ReviewPage } from './ReviewPage';
export { TranscriptReviewPage } from './TranscriptReviewPage';

/**
 * /app/students. The contract has no endpoint for a teacher to list students or their attempts,
 * so this says so plainly rather than showing invented numbers.
 */
export function StudentsPage() {
  useDocumentTitle('Students');
  return (
    <div className={PAGE_WIDE}>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-1">Students</h1>
        <p className="text-sm text-ink-2">Class progress across your lectures.</p>
      </header>
      <EmptyState
        icon={<BarChart3 />}
        title="Student analytics are planned"
        description="A table of students with their attempts, average scores and weakest topics will appear here once the API provides class-level results. Nothing is shown until then, so no numbers here are made up."
      />
    </div>
  );
}
