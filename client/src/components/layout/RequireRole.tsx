import type { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import type { Role } from '../../types';
import { ForbiddenPage } from '../../pages/errors/ForbiddenPage';

/**
 * Access control for a route: the wrong role gets the 403 page, at the same URL.
 * Hiding a nav link is not access control — every role-restricted route must be wrapped in this.
 * (The server enforces roles too; this guard is about not rendering pages that would only 403.)
 */
export function RequireRole({ role, children }: { role: Role; children?: ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== role) return <ForbiddenPage />;
  return children ? <>{children}</> : <Outlet />;
}
