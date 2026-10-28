/** Light / dark / system theme, applied as the `.dark` class on <html> (see styles/tokens.css). */
export type ThemePreference = 'light' | 'dark' | 'system';

const KEY = 'll.theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

export function getThemePreference(): ThemePreference {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.(DARK_QUERY).matches === true;
}

export function applyTheme(pref: ThemePreference): void {
  const dark = pref === 'dark' || (pref === 'system' && systemPrefersDark());
  document.documentElement.classList.toggle('dark', dark);
}

export function setThemePreference(pref: ThemePreference): void {
  try {
    if (pref === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {
    // storage unavailable: applies for this page only
  }
  applyTheme(pref);
}

/** Apply the saved preference at startup and follow the OS while on "system". */
export function initTheme(): void {
  applyTheme(getThemePreference());
  window.matchMedia?.(DARK_QUERY).addEventListener?.('change', () => {
    if (getThemePreference() === 'system') applyTheme('system');
  });
}
