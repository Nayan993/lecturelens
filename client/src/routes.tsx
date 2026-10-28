import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useParams, useSearchParams } from 'react-router-dom';
import { parseTimeParam } from './lib/formatTime';
import { lectureHref } from './lib/lectureLinks';
import { AppLayout } from './components/layout/AppLayout';
import { PageSkeleton } from './components/layout/PageSkeleton';
import { PublicLayout } from './components/layout/PublicLayout';
import { RequireAuth } from './components/layout/RequireAuth';
import { RequireRole } from './components/layout/RequireRole';
import { ForbiddenPage } from './pages/errors/ForbiddenPage';
import { NotFoundPage } from './pages/errors/NotFoundPage';

// Page groups are code-split: one chunk each for public, shared app and teacher-only pages.
const publicPages = () => import('./pages/public');
const appPages = () => import('./pages/app');
const teacherPages = () => import('./pages/teacher');

const LandingPage = lazy(() => publicPages().then((m) => ({ default: m.LandingPage })));
const LoginPage = lazy(() => publicPages().then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => publicPages().then((m) => ({ default: m.RegisterPage })));

const DashboardPage = lazy(() => appPages().then((m) => ({ default: m.DashboardPage })));
const LecturesPage = lazy(() => appPages().then((m) => ({ default: m.LecturesPage })));
const LecturePage = lazy(() => appPages().then((m) => ({ default: m.LecturePage })));
const SearchPage = lazy(() => appPages().then((m) => ({ default: m.SearchPage })));
const AskPage = lazy(() => appPages().then((m) => ({ default: m.AskPage })));
const QuizzesPage = lazy(() => appPages().then((m) => ({ default: m.QuizzesPage })));
const QuizPage = lazy(() => appPages().then((m) => ({ default: m.QuizPage })));
const RevisionPage = lazy(() => appPages().then((m) => ({ default: m.RevisionPage })));
const SettingsPage = lazy(() => appPages().then((m) => ({ default: m.SettingsPage })));

const UploadPage = lazy(() => teacherPages().then((m) => ({ default: m.UploadPage })));
const ReviewPage = lazy(() => teacherPages().then((m) => ({ default: m.ReviewPage })));
const StudentsPage = lazy(() => teacherPages().then((m) => ({ default: m.StudentsPage })));
const TranscriptReviewPage = lazy(() => teacherPages().then((m) => ({ default: m.TranscriptReviewPage })));

// Dev-only kitchen sink. import.meta.env.DEV is statically false in production builds,
// so the route and its chunk are removed entirely.
const Kitchen = import.meta.env.DEV ? lazy(() => import('./pages/_Kitchen')) : null;

/** /app → role home. Both roles land on /app/dashboard, which renders per role. */
function RoleHome() {
  return <Navigate to="/app/dashboard" replace />;
}

/**
 * Server-built deepLinks (CONTRACTS.md §5.6) use /lectures/:id/play?t=<sec>. Send them to the
 * reading view, which seeks to `t`. RequireAuth on /app handles signed-out visitors.
 */
function DeepLinkRedirect() {
  const { id = '' } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  return <Navigate to={lectureHref(id, parseTimeParam(params.get('t')))} replace />;
}

/**
 * The full route table.
 * Public: /  /login  /register  ·  Errors: /403, * (404)
 * App (RequireAuth + AppLayout): dashboard, lectures, lectures/:id, search, ask, quizzes, quizzes/:id,
 *   revision, settings  ·  teacher only (RequireRole): upload, review, students, lectures/:id/review
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<LandingPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="403" element={<ForbiddenPage />} />
        <Route path="404" element={<NotFoundPage />} />
      </Route>

      <Route
        path="app"
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<RoleHome />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="lectures" element={<LecturesPage />} />
        <Route path="lectures/:id" element={<LecturePage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="ask" element={<AskPage />} />
        <Route path="quizzes" element={<QuizzesPage />} />
        <Route path="quizzes/:id" element={<QuizPage />} />
        <Route path="revision" element={<RevisionPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route element={<RequireRole role="teacher" />}>
          <Route path="upload" element={<UploadPage />} />
          <Route path="review" element={<ReviewPage />} />
          <Route path="students" element={<StudentsPage />} />
          <Route path="lectures/:id/review" element={<TranscriptReviewPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route path="lectures/:id/play" element={<DeepLinkRedirect />} />
      {Kitchen && (
        <Route
          path="_kitchen"
          element={
            <Suspense fallback={<PageSkeleton fullScreen />}>
              <Kitchen />
            </Suspense>
          }
        />
      )}
      <Route element={<PublicLayout />}>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
