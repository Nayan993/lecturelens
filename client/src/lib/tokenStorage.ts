/**
 * Where the JWT lives. "Remember me" → localStorage (survives restarts); otherwise
 * sessionStorage (cleared when the tab closes). Every read checks both.
 */
export const TOKEN_KEY = 'll.token';

export function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function writeToken(token: string, remember = true): void {
  try {
    clearToken();
    (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
  } catch {
    // Storage unavailable (private mode, blocked): the session simply won't persist.
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // storage unavailable
  }
}
