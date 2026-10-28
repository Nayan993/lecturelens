/**
 * ============================================================================================
 *  THE SERVICE SWITCH — the only entry point to data in the client.
 *
 *  ✗ Components and pages must NOT import from /mocks, services/mock or services/http.
 *  ✓ Components use the TanStack Query hooks in features/<domain>/hooks.ts;
 *    hooks (and AuthContext) use the `services` object exported here.
 *
 *  Enforced by src/services/boundaries.test.ts, which fails the test suite on a violation.
 *
 *  Adapter per domain comes from VITE_USE_MOCKS (parsed once, at module load):
 *    all                       every domain uses services/mock   (default)
 *    none                      every domain uses services/http
 *    auth,lectures,transcript  only the listed domains are mocked; the rest use http
 *  Domains: auth, lectures, transcript, topics, summaries, search, qa, quizzes, revision.
 * ============================================================================================
 */
import { httpServices } from './http';
import { mockServices } from './mock';
import { SERVICE_DOMAINS, type ServiceDomain, type Services } from './types';

export type { Services, ServiceDomain } from './types';
export * from './types';

/** Parse a VITE_USE_MOCKS value into the set of mocked domains. Unknown names are ignored with a warning. */
export function parseMockFlag(raw: string | undefined): Set<ServiceDomain> {
  const value = (raw ?? 'all').trim().toLowerCase();
  if (value === '' || value === 'all') return new Set(SERVICE_DOMAINS);
  if (value === 'none') return new Set();
  const mocked = new Set<ServiceDomain>();
  for (const name of value.split(',').map((s) => s.trim()).filter(Boolean)) {
    if ((SERVICE_DOMAINS as readonly string[]).includes(name)) mocked.add(name as ServiceDomain);
    else console.warn(`[services] VITE_USE_MOCKS: unknown domain "${name}" ignored. Valid: ${SERVICE_DOMAINS.join(', ')}`);
  }
  return mocked;
}

/** Build the services object for a set of mocked domains. */
export function selectServices(mocked: Set<ServiceDomain>): Services {
  const pick = <K extends ServiceDomain>(domain: K): Services[K] => (mocked.has(domain) ? mockServices : httpServices)[domain];
  return {
    auth: pick('auth'),
    lectures: pick('lectures'),
    transcript: pick('transcript'),
    topics: pick('topics'),
    summaries: pick('summaries'),
    search: pick('search'),
    qa: pick('qa'),
    quizzes: pick('quizzes'),
    revision: pick('revision'),
  };
}

export const mockedDomains: ReadonlySet<ServiceDomain> = parseMockFlag(import.meta.env.VITE_USE_MOCKS);

export const services: Services = selectServices(new Set(mockedDomains));

export { DEMO_ACCOUNTS, type DemoAccount } from './demoAccounts';

/** Show the "Demo accounts" block on /login: when auth is mocked, or when the seeded server is used for a demo. */
export const showDemoAccounts: boolean = mockedDomains.has('auth') || import.meta.env.VITE_SHOW_DEMO_ACCOUNTS === 'true';

if (import.meta.env.DEV && mockedDomains.size > 0) {
  console.info(
    `[services] Mock data for: ${[...mockedDomains].join(', ')}. Demo login: teacher@lecturelens.dev or student@lecturelens.dev, password "lecturelens".`,
  );
}
