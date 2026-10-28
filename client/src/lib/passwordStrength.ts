export type StrengthLabel = 'Too short' | 'Weak' | 'Fair' | 'Good' | 'Strong';

export interface PasswordStrength {
  /** 0–4. */
  score: number;
  label: StrengthLabel;
}

const LABELS: StrengthLabel[] = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];

/**
 * Simple length + variety score — deliberately not a breach or dictionary check.
 * +1 for ≥ 8 chars, +1 for ≥ 12 chars, +1 for ≥ 2 character classes, +1 for ≥ 3 classes
 * (classes: lowercase, uppercase, digits, symbols). Under 8 chars is always "Too short".
 */
export function passwordStrength(password: string): PasswordStrength {
  if (password.length < 8) return { score: 0, label: 'Too short' };
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  const score = 1 + (password.length >= 12 ? 1 : 0) + (classes >= 2 ? 1 : 0) + (classes >= 3 ? 1 : 0);
  return { score, label: LABELS[score] };
}
