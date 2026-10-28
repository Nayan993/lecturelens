import { NavLink } from 'react-router-dom';
import { ChevronsUpDown, LogOut, Settings } from 'lucide-react';
import { cn } from '../../lib/cn';
import { useAuth } from '../../context/AuthContext';
import { Badge, Menu } from '../ui';
import { NAVIGATION, type NavItem } from './navigation';

const linkClasses = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex items-center gap-2.5 rounded-r-control border-l-2 py-2 pl-3 pr-2 text-sm font-medium transition-colors [&>svg]:h-4 [&>svg]:w-4 [&>svg]:shrink-0',
    isActive
      ? 'border-brand bg-brand-soft text-brand'
      : 'border-transparent text-ink-2 hover:bg-ink-1/5 hover:text-ink-1',
  );

function SidebarLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <NavLink to={item.to} className={linkClasses} onClick={onNavigate}>
      <Icon aria-hidden />
      {item.label}
    </NavLink>
  );
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter((p) => /\p{L}/u.test(p) && !p.endsWith('.'));
  const picked = parts.length > 1 ? [parts[0], parts[parts.length - 1]] : parts;
  return picked.map((p) => p[0]!.toUpperCase()).join('') || '?';
}

/** Role-aware navigation. Used in the fixed desktop sidebar and inside the mobile drawer. */
export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  if (!user) return null;
  const groups = NAVIGATION[user.role];

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center px-5">
        <NavLink to="/app/dashboard" onClick={onNavigate} className="text-lg font-semibold tracking-tight text-brand">
          LectureLens
        </NavLink>
      </div>

      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 py-2">
        {groups.map((group) => (
          <div key={group.label} className="mb-5">
            <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-ink-3">{group.label}</p>
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <SidebarLink item={item} onNavigate={onNavigate} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-border px-3 py-3">
        <SidebarLink item={{ label: 'Settings', to: '/app/settings', icon: Settings }} onNavigate={onNavigate} />
        <Menu
          className="mt-2 w-full"
          side="top"
          label="Account"
          items={[{ id: 'logout', label: 'Log out', icon: <LogOut />, tone: 'danger', onSelect: logout }]}
          trigger={(props) => (
            <button
              {...props}
              type="button"
              className="flex w-full items-center gap-2.5 rounded-control px-2 py-2 text-left transition-colors hover:bg-ink-1/5"
            >
              <span
                aria-hidden
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand"
              >
                {initials(user.name)}
              </span>
              <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
                <span className="w-full truncate text-sm font-medium text-ink-1">{user.name}</span>
                <Badge variant={user.role === 'teacher' ? 'accent' : 'brand'} className="px-1.5 py-0 capitalize">
                  {user.role}
                </Badge>
              </span>
              <ChevronsUpDown aria-hidden className="h-4 w-4 shrink-0 text-ink-3" />
            </button>
          )}
        />
      </div>
    </div>
  );
}
