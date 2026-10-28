import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation, type Location } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { PageSkeleton } from './PageSkeleton';

/** Shape of location.state when RequireAuth sends someone to /login. */
export interface LoginRedirectState {
  from: Pick<Location, 'pathname' | 'search' | 'hash'>;
}

/** Where to go after a successful login: the page that sent the user to /login, else the app home. */
export function getReturnPath(state: unknown): string {
  const from = (state as Partial<LoginRedirectState> | null)?.from;
  if (!from?.pathname || !from.pathname.startsWith('/app')) return '/app';
  return `${from.pathname}${from.search ?? ''}${from.hash ?? ''}`;
}

/** Renders children (or the nested route) only for an authenticated user; otherwise redirects to /login. */
export function RequireAuth({ children }: { children?: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <PageSkeleton fullScreen />;
  if (status === 'anonymous') {
    const state: LoginRedirectState = {
      from: { pathname: location.pathname, search: location.search, hash: location.hash },
    };
    return <Navigate to="/login" replace state={state} />;
  }
  return children ? <>{children}</> : <Outlet />;
}
