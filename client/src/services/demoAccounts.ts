import type { Id, Role } from '../types';

export interface DemoAccount {
  id: Id;
  role: Role;
  name: string;
  email: string;
  password: string;
}

/**
 * Seeded demo accounts — docs/CONTRACTS.md §9. Demo credentials, not secrets: the mock auth
 * adapter serves exactly these and the server seed creates exactly these (never in production).
 */
export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  { id: '6650c3a0c3b2e41d8a000001', role: 'teacher', name: 'Dr. Ananya Rao', email: 'teacher@lecturelens.dev', password: 'lecturelens' },
  { id: '6650c3a0c3b2e41d8a000002', role: 'student', name: 'Rohan Mehta', email: 'student@lecturelens.dev', password: 'lecturelens' },
];
