import { GraduationCap, ListChecks, MessageCircleQuestion, Search, Settings } from 'lucide-react';
import { StubPage } from '../StubPage';

export { DashboardPage } from './DashboardPage';
export { LecturesPage } from './LecturesPage';
export { LecturePage } from './LecturePage';

export function SearchPage() {
  return <StubPage title="Search" comingIn="P1.7" icon={<Search />} />;
}

export function AskPage() {
  return <StubPage title="Ask" comingIn="P1.7" icon={<MessageCircleQuestion />} />;
}

export function QuizzesPage() {
  return <StubPage title="Quizzes" comingIn="P1.7" icon={<ListChecks />} />;
}

export function QuizPage() {
  return <StubPage title="Quiz" comingIn="P1.7" icon={<ListChecks />} />;
}

export function RevisionPage() {
  return <StubPage title="Revision" comingIn="P1.7" icon={<GraduationCap />} />;
}

export function SettingsPage() {
  return <StubPage title="Settings" comingIn="P1.6" icon={<Settings />} />;
}
