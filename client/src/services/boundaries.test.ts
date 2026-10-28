import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Architecture rule (see the banner in services/index.ts):
 * outside src/services, no source file may import /mocks, services/mock or services/http.
 * Components use feature hooks; hooks use `services`. Test files are exempt.
 */
const SRC = join(__dirname, '..');
const FORBIDDEN = [
  { pattern: /from\s+['"][^'"]*\/mocks\/[^'"]*['"]/, label: '/mocks fixtures' },
  { pattern: /from\s+['"][^'"]*services\/mock(\/[^'"]*)?['"]/, label: 'services/mock' },
  { pattern: /from\s+['"][^'"]*services\/http(\/[^'"]*)?['"]/, label: 'services/http' },
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe('import boundaries', () => {
  it('only src/services touches mocks and adapters', () => {
    const violations: string[] = [];
    for (const file of sourceFiles(SRC)) {
      const rel = relative(SRC, file);
      if (rel.startsWith(`services${sep}`)) continue;
      const text = readFileSync(file, 'utf8');
      for (const { pattern, label } of FORBIDDEN) if (pattern.test(text)) violations.push(`${rel} imports ${label}`);
    }
    expect(violations).toEqual([]);
  });

  it('the rule itself catches a violation', () => {
    expect(FORBIDDEN.some(({ pattern }) => pattern.test(`import x from '../../../mocks/lectures.json';`))).toBe(true);
    expect(FORBIDDEN.some(({ pattern }) => pattern.test(`import { mockServices } from '../services/mock';`))).toBe(true);
    expect(FORBIDDEN.some(({ pattern }) => pattern.test(`import { services } from '../services';`))).toBe(false);
  });
});
