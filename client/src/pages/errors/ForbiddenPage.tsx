import { useNavigate } from 'react-router-dom';
import { ShieldX } from 'lucide-react';
import { cn } from '../../lib/cn';
import { useDocumentTitle } from '../../lib/useDocumentTitle';
import { EmptyState } from '../../components/ui';

/** 403. Rendered by RequireRole at the requested URL, and standalone at /403. */
export function ForbiddenPage({ standalone = false }: { standalone?: boolean }) {
  useDocumentTitle('No access');
  const navigate = useNavigate();
  return (
    <div className={cn('flex flex-col gap-6', standalone && 'mx-auto min-h-screen max-w-xl justify-center px-6')}>
      <p className="text-sm font-semibold text-ink-3">Error 403</p>
      <EmptyState
        icon={<ShieldX />}
        title="You don’t have access to this page"
        description="Your account’s role can’t open it. If you think that’s wrong, ask your course administrator."
        action={{ label: 'Go to dashboard', onClick: () => navigate('/app/dashboard') }}
      />
    </div>
  );
}
