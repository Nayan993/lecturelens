import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Spinner } from './components/ui';

// Dev-only kitchen sink. import.meta.env.DEV is statically false in production builds,
// so the route and its lazy chunk are removed entirely.
const Kitchen = import.meta.env.DEV ? lazy(() => import('./pages/_Kitchen')) : null;

function Placeholder() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg">
      <h1 className="text-4xl font-semibold tracking-tight text-brand">LectureLens</h1>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Placeholder />} />
      {Kitchen && (
        <Route
          path="/_kitchen"
          element={
            <Suspense fallback={<Spinner label="Loading kitchen" className="m-10 text-brand" />}>
              <Kitchen />
            </Suspense>
          }
        />
      )}
    </Routes>
  );
}
