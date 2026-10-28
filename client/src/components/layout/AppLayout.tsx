import { Suspense, useEffect, useId, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Drawer } from '../ui';
import { Header } from './Header';
import { PageSkeleton } from './PageSkeleton';
import { Sidebar } from './Sidebar';

const DESKTOP_QUERY = '(min-width: 1024px)';

/**
 * Authenticated shell: fixed 240px sidebar ≥1024px; below that the sidebar becomes a slide-over
 * drawer opened from the header (backdrop, Escape, focus returned to the menu button).
 */
export function AppLayout() {
  const [navOpen, setNavOpen] = useState(false);
  const navId = useId();
  const { pathname } = useLocation();

  // Close the drawer after navigating, and if the viewport grows to desktop width.
  useEffect(() => setNavOpen(false), [pathname]);
  useEffect(() => {
    const mql = window.matchMedia?.(DESKTOP_QUERY);
    if (!mql) return;
    const onChange = (e: MediaQueryListEvent) => e.matches && setNavOpen(false);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return (
    <div className="min-h-screen bg-bg">
      <a
        href="#main"
        className="sr-only z-50 rounded-control bg-surface px-3 py-2 text-sm font-medium text-brand shadow-md focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:inline-flex focus:min-h-11 focus:items-center"
      >
        Skip to main content
      </a>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r border-border bg-surface lg:block">
        <Sidebar />
      </aside>

      <Drawer open={navOpen} onOpenChange={setNavOpen} label="Navigation" id={navId}>
        <Sidebar onNavigate={() => setNavOpen(false)} />
      </Drawer>

      <div className="flex min-h-screen flex-col lg:pl-60">
        <Header onOpenNav={() => setNavOpen(true)} navOpen={navOpen} navId={navId} />
        <main id="main" tabIndex={-1} className="flex-1 outline-none">
          <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <Suspense fallback={<PageSkeleton />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
