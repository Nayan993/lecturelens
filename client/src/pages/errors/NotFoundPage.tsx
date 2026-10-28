import { useNavigate } from 'react-router-dom';
import { FileQuestion } from 'lucide-react';
import { useDocumentTitle } from '../../lib/useDocumentTitle';
import { EmptyState } from '../../components/ui';
import { PAGE_NARROW, PageHeader } from '../../components/layout/Page';

/** 404 for unknown routes, inside the app shell (/app/*) or the public layout (/404 and the catch-all). */
export function NotFoundPage() {
  useDocumentTitle('Page not found');
  const navigate = useNavigate();
  return (
    <div className={PAGE_NARROW}>
      <PageHeader title="Page not found" description="Error 404" />
      <EmptyState
        icon={<FileQuestion />}
        title="We couldn’t find that page"
        description="The link may be out of date, or the page may have moved."
        action={{ label: 'Back to dashboard', onClick: () => navigate('/app/dashboard') }}
      />
    </div>
  );
}
