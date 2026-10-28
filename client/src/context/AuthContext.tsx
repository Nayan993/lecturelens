import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ApiError, httpAuthService, type AuthService } from '../services/auth';
import { queryClient } from '../lib/queryClient';
import type { RegisterPayload, User } from '../types';

export const TOKEN_KEY = 'll.token';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

export interface AuthContextValue {
  user: User | null;
  token: string | null;
  status: AuthStatus;
  login(email: string, password: string): Promise<User>;
  register(payload: RegisterPayload): Promise<User>;
  logout(): void;
  /** Re-fetch the current user with the stored token. */
  refresh(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage unavailable (private mode, blocked): the session simply won't persist.
  }
}

export function AuthProvider({ children, service = httpAuthService }: { children: ReactNode; service?: AuthService }) {
  const [token, setToken] = useState<string | null>(() => readToken());
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>(() => (readToken() ? 'loading' : 'anonymous'));
  const serviceRef = useRef(service);
  serviceRef.current = service;

  const clearSession = useCallback(() => {
    writeToken(null);
    setToken(null);
    setUser(null);
    setStatus('anonymous');
    queryClient.clear(); // never let one user's cached data leak to the next
  }, []);

  const startSession = useCallback((nextToken: string, nextUser: User) => {
    writeToken(nextToken);
    setToken(nextToken);
    setUser(nextUser);
    setStatus('authenticated');
  }, []);

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
      if (err instanceof ApiError && err.status === 401) clearSession();
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
    async (email: string, password: string) => {
      const res = await serviceRef.current.login(email, password);
      startSession(res.token, res.user);
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
    () => ({ user, token, status, login, register, logout: clearSession, refresh }),
    [user, token, status, login, register, clearSession, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
