import {
  BookOpen,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  MessageCircleQuestion,
  PlayCircle,
  Search,
  Settings,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { StubPage } from '../StubPage';

export function DashboardPage() {
  const { user } = useAuth();
  return (
    <StubPage
      title={user?.role === 'teacher' ? 'Teacher dashboard' : 'Dashboard'}
      description={user ? `Signed in as ${user.name}.` : undefined}
      comingIn="P1.6"
      icon={<LayoutDashboard />}
    />
  );
}

export function LecturesPage() {
  const { user } = useAuth();
  return <StubPage title={user?.role === 'teacher' ? 'My Lectures' : 'Lectures'} comingIn="P1.6" icon={<BookOpen />} />;
}

export function LecturePage() {
  return <StubPage title="Lecture" comingIn="P1.6" icon={<PlayCircle />} />;
}

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
