import type { ReactNode } from 'react';
import { Construction } from 'lucide-react';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import { EmptyState } from '../components/ui';

export interface StubPageProps {
  title: string;
  description?: string;
  /** Playbook prompt that builds the real page, e.g. "P1.5". */
  comingIn: string;
  icon?: ReactNode;
  children?: ReactNode;
}

/** Placeholder until the real page lands: title plus an honest empty state — no fake data. */
export function StubPage({ title, description, comingIn, icon = <Construction />, children }: StubPageProps) {
  useDocumentTitle(title);
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-1">{title}</h1>
        {description && <p className="text-sm text-ink-2">{description}</p>}
      </header>
      {children}
      <EmptyState icon={icon} title="This page is being built" description={`It arrives in ${comingIn}.`} />
    </div>
  );
}
