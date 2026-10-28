import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { services, type AuthService } from '../services';
import { isApiError, UNAUTHORISED_EVENT } from '../lib/apiClient';
import { queryClient } from '../lib/queryClient';
import { clearToken, readToken, TOKEN_KEY, writeToken } from '../lib/tokenStorage';
import type { RegisterPayload, User } from '../types';

export { TOKEN_KEY };

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

export interface LoginOptions {
  /** true (default): keep the session across browser restarts; false: end it when the tab closes. */
  remember?: boolean;
}

export interface AuthContextValue {
  user: User | null;
  token: string | null;
  status: AuthStatus;
  /** True after the user logged out themselves (not after an expired/401 session). */
  loggedOut: boolean;
  login(email: string, password: string, options?: LoginOptions): Promise<User>;
  register(payload: RegisterPayload): Promise<User>;
  logout(): void;
  /** Re-fetch the current user with the stored token. */
  refresh(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children, service = services.auth }: { children: ReactNode; service?: AuthService }) {
  const [token, setToken] = useState<string | null>(() => readToken());
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>(() => (readToken() ? 'loading' : 'anonymous'));
  const [loggedOut, setLoggedOut] = useState(false);
  const serviceRef = useRef(service);
  serviceRef.current = service;

  const clearSession = useCallback(() => {
    clearToken();
    setToken(null);
    setUser(null);
    setStatus('anonymous');
    queryClient.clear(); // never let one user's cached data leak to the next
  }, []);

  const startSession = useCallback((nextToken: string, nextUser: User, remember = true) => {
    writeToken(nextToken, remember);
    setToken(nextToken);
    setUser(nextUser);
    setStatus('authenticated');
    setLoggedOut(false);
  }, []);

  // A deliberate logout: the next sign-in (possibly someone else) starts from home, not this page.
  const logout = useCallback(() => {
    setLoggedOut(true);
    clearSession();
  }, [clearSession]);

  const refresh = useCallback(async () => {
    const stored = readToken();
    if (!stored) {
      clearSession();
      return;
    }
    try {
      const me = await serviceRef.current.me(stored);
      setToken(stored);
      setUser(me);
      setStatus('authenticated');
    } catch (err) {
      // An invalid/expired token is discarded; a network failure keeps it so a later refresh can recover.
      if (isApiError(err) && err.status === 401) clearSession();
      else {
        setUser(null);
        setStatus('anonymous');
      }
    }
  }, [clearSession]);

  // Rehydrate on mount.
  useEffect(() => {
    if (readToken()) void refresh();
  }, [refresh]);

  // Any authenticated request that comes back 401 (lib/apiClient.ts) ends the session here.
  useEffect(() => {
    const onUnauthorised = () => clearSession();
    window.addEventListener(UNAUTHORISED_EVENT, onUnauthorised);
    return () => window.removeEventListener(UNAUTHORISED_EVENT, onUnauthorised);
  }, [clearSession]);

  // Logging out (or in) in another tab applies here too.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== TOKEN_KEY) return;
      if (event.newValue) void refresh();
      else {
        setToken(null);
        setUser(null);
        setStatus('anonymous');
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [refresh]);

  const login = useCallback(
    async (email: string, password: string, { remember = true }: LoginOptions = {}) => {
      const res = await serviceRef.current.login(email, password);
      startSession(res.token, res.user, remember);
      return res.user;
    },
    [startSession],
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      const res = await serviceRef.current.register(payload);
      startSession(res.token, res.user);
      return res.user;
    },
    [startSession],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ user, token, status, loggedOut, login, register, logout, refresh }),
    [user, token, status, loggedOut, login, register, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
