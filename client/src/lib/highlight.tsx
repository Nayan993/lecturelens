import type { ReactNode } from 'react';

const STOPWORDS = new Set(
  'the and for are but not you all any can had her was one our out has have this that with what when why how does from they will would there their into about which been were them then than its it'.split(' '),
);

/** Meaningful query terms (≥ 3 letters, no stopwords), longest first so overlaps prefer the longer match. */
export function queryTerms(query: string): string[] {
  const words = query.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu) ?? [];
  return [...new Set(words.filter((w) => w.length >= 3 && !STOPWORDS.has(w)))].sort((a, b) => b.length - a.length);
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Wrap each occurrence of the terms (case-insensitive, word-prefix) in <mark>. */
export function highlightTerms(text: string, terms: string[], markClassName = 'rounded-sm bg-warning/25 px-0.5 text-ink-1'): ReactNode {
  if (terms.length === 0) return text;
  const pattern = new RegExp(`\\b(${terms.map(escapeRegExp).join('|')})`, 'gi');
  const parts = text.split(pattern);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className={markClassName}>
        {part}
      </mark>
    ) : (
      part
    ),
  );
}
