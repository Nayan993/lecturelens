import {
  BookOpen,
  ClipboardCheck,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  MessageCircleQuestion,
  Search,
  Upload,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '../../types';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAVIGATION: Record<Role, NavGroup[]> = {
  student: [
    {
      label: 'Learn',
      items: [
        { label: 'Dashboard', to: '/app/dashboard', icon: LayoutDashboard },
        { label: 'Lectures', to: '/app/lectures', icon: BookOpen },
      ],
    },
    {
      label: 'Study',
      items: [
        { label: 'Search', to: '/app/search', icon: Search },
        { label: 'Ask', to: '/app/ask', icon: MessageCircleQuestion },
        { label: 'Quizzes', to: '/app/quizzes', icon: ListChecks },
        { label: 'Revision', to: '/app/revision', icon: GraduationCap },
      ],
    },
  ],
  teacher: [
    {
      label: 'Overview',
      items: [{ label: 'Dashboard', to: '/app/dashboard', icon: LayoutDashboard }],
    },
    {
      label: 'Teach',
      items: [
        { label: 'My Lectures', to: '/app/lectures', icon: BookOpen },
        { label: 'Upload', to: '/app/upload', icon: Upload },
        { label: 'Review Queue', to: '/app/review', icon: ClipboardCheck },
        { label: 'Students', to: '/app/students', icon: Users },
      ],
    },
  ],
};

/** Breadcrumb labels for /app path segments. `lectures` is relabelled per role. */
const SEGMENT_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  lectures: 'Lectures',
  search: 'Search',
  ask: 'Ask',
  quizzes: 'Quizzes',
  revision: 'Revision',
  settings: 'Settings',
  upload: 'Upload',
  review: 'Review Queue',
  students: 'Students',
};

const DETAIL_LABELS: Record<string, string> = { lectures: 'Lecture', quizzes: 'Quiz' };

export interface Crumb {
  label: string;
  to: string;
}

/** /app/lectures/6650… → [{Lectures, /app/lectures}, {Lecture, /app/lectures/6650…}]. */
export function buildBreadcrumbs(pathname: string, role: Role | undefined): Crumb[] {
  const segments = pathname.split('/').filter(Boolean);
  if (segments[0] !== 'app') return [];
  const crumbs: Crumb[] = [];
  for (let i = 1; i < segments.length; i++) {
    const segment = segments[i];
    const to = `/${segments.slice(0, i + 1).join('/')}`;
    const parent = segments[i - 1];
    let label = SEGMENT_LABELS[segment] ?? DETAIL_LABELS[parent] ?? 'Not found';
    if (segment === 'lectures' && role === 'teacher') label = 'My Lectures';
    crumbs.push({ label, to });
  }
  return crumbs;
}
