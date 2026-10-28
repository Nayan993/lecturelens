import { LogIn, Sparkles, UserPlus } from 'lucide-react';
import { StubPage } from '../StubPage';

export function LandingPage() {
  return (
    <StubPage
      title="LectureLens"
      description="Turn recorded lectures into searchable transcripts, summaries, grounded answers and quizzes."
      comingIn="P1.5"
      icon={<Sparkles />}
    />
  );
}

export function LoginPage() {
  return <StubPage title="Log in" comingIn="P1.5" icon={<LogIn />} />;
}

export function RegisterPage() {
  return <StubPage title="Create an account" comingIn="P1.5" icon={<UserPlus />} />;
}
