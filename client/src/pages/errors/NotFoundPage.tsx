import { useNavigate } from 'react-router-dom';
import { FileQuestion } from 'lucide-react';
import { cn } from '../../lib/cn';
import { useDocumentTitle } from '../../lib/useDocumentTitle';
import { EmptyState } from '../../components/ui';

/** 404 for unknown routes, inside the app shell (/app/*) or standalone (/404 and the catch-all). */
export function NotFoundPage({ standalone = false }: { standalone?: boolean }) {
  useDocumentTitle('Page not found');
  const navigate = useNavigate();
  return (
    <div className={cn('flex flex-col gap-4', standalone && 'mx-auto min-h-screen max-w-xl justify-center px-6')}>
      <h1 className="text-sm font-semibold text-ink-2">Error 404 — page not found</h1>
      <EmptyState
        icon={<FileQuestion />}
        title="We couldn’t find that page"
        description="The link may be out of date, or the page may have moved."
        action={{ label: 'Back to dashboard', onClick: () => navigate('/app/dashboard') }}
      />
    </div>
  );
}
