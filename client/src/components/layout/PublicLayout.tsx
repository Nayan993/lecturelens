import { Suspense } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { buttonClasses } from '../ui';
import { PageSkeleton } from './PageSkeleton';

/** Landing, login and register: slim top bar, content, minimal footer. */
export function PublicLayout() {
  const { status } = useAuth();
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <a
        href="#main"
        className="sr-only z-50 rounded-control bg-surface px-3 py-2 text-sm font-medium text-brand shadow-md focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:inline-flex focus:min-h-11 focus:items-center"
      >
        Skip to main content
      </a>
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="tap-target text-lg font-semibold tracking-tight text-brand">
            LectureLens
          </Link>
          <nav aria-label="Account" className="flex items-center gap-2">
            {status === 'authenticated' ? (
              <Link to="/app" className={buttonClasses({ size: 'sm' })}>
                Open app
              </Link>
            ) : (
              <>
                <Link to="/login" className={buttonClasses({ variant: 'ghost', size: 'sm' })}>
                  Sign in
                </Link>
                <Link to="/register" className={buttonClasses({ size: 'sm' })}>
                  Get started
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 outline-none sm:px-6">
        <Suspense fallback={<PageSkeleton />}>
          <Outlet />
        </Suspense>
      </main>
      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-6 text-xs leading-relaxed text-ink-2 sm:px-6">
          <p>
            <span className="font-semibold text-ink-1">LectureLens</span> is an academic project built by a student team. It is
            not a commercial product, and recordings are processed only with the lecturer’s consent.
          </p>
          {/* TODO(team): add the team members' names here, e.g. "Built by A. Name, B. Name, C. Name and D. Name." */}
        </div>
      </footer>
    </div>
  );
}
