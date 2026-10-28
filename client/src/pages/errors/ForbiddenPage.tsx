import { useNavigate } from 'react-router-dom';
import { ShieldX } from 'lucide-react';
import { useDocumentTitle } from '../../lib/useDocumentTitle';
import { EmptyState } from '../../components/ui';
import { PAGE_NARROW, PageHeader } from '../../components/layout/Page';

/** 403. Rendered by RequireRole at the requested URL (inside the app shell), and at /403 (public layout). */
export function ForbiddenPage() {
  useDocumentTitle('No access');
  const navigate = useNavigate();
  return (
    <div className={PAGE_NARROW}>
      <PageHeader title="No access" description="Error 403" />
      <EmptyState
        icon={<ShieldX />}
        title="You don’t have access to this page"
        description="Your account’s role can’t open it. If you think that’s wrong, ask your course administrator."
        action={{ label: 'Back to dashboard', onClick: () => navigate('/app/dashboard') }}
      />
    </div>
  );
}
