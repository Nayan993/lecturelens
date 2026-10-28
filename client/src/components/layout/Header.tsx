import { forwardRef, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bell, ChevronRight, Menu as MenuIcon, Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { IconButton, Input, Menu } from '../ui';
import { buildBreadcrumbs } from './navigation';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export interface HeaderProps {
  onOpenNav: () => void;
  navOpen: boolean;
  navId: string;
  /** Unread notification count. No notifications endpoint exists in the contract yet, so this defaults to 0. */
  unreadCount?: number;
}

function Breadcrumbs() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const crumbs = buildBreadcrumbs(pathname, user?.role);
  if (crumbs.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex items-center gap-1 text-sm">
        {crumbs.map((crumb, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={crumb.to} className="flex min-w-0 items-center gap-1">
              {i > 0 && <ChevronRight aria-hidden className="h-3.5 w-3.5 shrink-0 text-ink-3" />}
              {last ? (
                <span aria-current="page" className="truncate font-medium text-ink-1">
                  {crumb.label}
                </span>
              ) : (
                <Link to={crumb.to} className="truncate text-ink-2 hover:text-ink-1 hover:underline">
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Quiet top bar: mobile menu button, breadcrumb, global search (⌘K / Ctrl-K), notifications. */
export const Header = forwardRef<HTMLButtonElement, HeaderProps>(({ onOpenNav, navOpen, navId, unreadCount = 0 }, menuButtonRef) => {
  const navigate = useNavigate();
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const q = query.trim();
    navigate(q ? `/app/search?q=${encodeURIComponent(q)}` : '/app/search');
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-bg/90 px-4 backdrop-blur sm:px-6">
      <IconButton
        ref={menuButtonRef}
        className="lg:hidden"
        aria-label="Open navigation"
        aria-expanded={navOpen}
        aria-controls={navId}
        icon={<MenuIcon />}
        onClick={onOpenNav}
      />
      <div className="min-w-0 flex-1">
        <Breadcrumbs />
      </div>
      <form role="search" onSubmit={onSubmit} className="hidden w-64 md:block lg:w-72">
        <Input
          ref={searchRef}
          type="search"
          aria-label="Search lectures"
          aria-keyshortcuts={isMac ? 'Meta+K' : 'Control+K'}
          placeholder={`Search lectures…  ${isMac ? '⌘K' : 'Ctrl K'}`}
          leftIcon={<Search />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-8 bg-surface"
        />
      </form>
      <Menu
        align="end"
        label="Notifications"
        items={[{ id: 'empty', label: 'No notifications yet', disabled: true }]}
        trigger={(props) => (
          <span className="relative inline-flex">
            <IconButton
              {...props}
              aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
              icon={<Bell />}
            />
            {unreadCount > 0 && (
              <span
                aria-hidden
                data-testid="unread-dot"
                className="pointer-events-none absolute right-2 top-2 h-2 w-2 rounded-full bg-accent ring-2 ring-bg"
              />
            )}
          </span>
        )}
      />
    </header>
  );
});
Header.displayName = 'Header';
