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
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="text-lg font-semibold tracking-tight text-brand">
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
                  Log in
                </Link>
                <Link to="/register" className={buttonClasses({ size: 'sm' })}>
                  Get started
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <Suspense fallback={<PageSkeleton />}>
          <Outlet />
        </Suspense>
      </main>
      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-ink-3 sm:px-6">
          <span>LectureLens — lectures you can search, ask and revise from.</span>
          <span>Recordings are processed only with lecturer consent.</span>
        </div>
      </footer>
    </div>
  );
}
