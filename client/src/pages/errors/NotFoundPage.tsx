import { useNavigate } from 'react-router-dom';
import { FileQuestion } from 'lucide-react';
import { cn } from '../../lib/cn';
import { useDocumentTitle } from '../../lib/useDocumentTitle';
import { EmptyState } from '../../components/ui';

/** 404 for unknown routes, inside the app shell (/app/*) or standalone. */
export function NotFoundPage({ standalone = false }: { standalone?: boolean }) {
  useDocumentTitle('Page not found');
  const navigate = useNavigate();
  return (
    <div className={cn('flex flex-col gap-6', standalone && 'mx-auto min-h-screen max-w-xl justify-center px-6')}>
      <p className="text-sm font-semibold text-ink-3">Error 404</p>
      <EmptyState
        icon={<FileQuestion />}
        title="We couldn’t find that page"
        description="The link may be out of date, or the page may have moved."
        action={{ label: standalone ? 'Go home' : 'Go to dashboard', onClick: () => navigate(standalone ? '/' : '/app/dashboard') }}
      />
    </div>
  );
}
