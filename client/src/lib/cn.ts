import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * tailwind-merge must know the custom type scale from tailwind.config.js; otherwise it reads
 * `text-reading` as a text *colour* and drops it when combined with e.g. `text-ink-1`.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['eyebrow', 'md', 'reading', 'reading-sm'] }],
    },
  },
});

/** Compose class names; later Tailwind classes win over conflicting earlier ones. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
