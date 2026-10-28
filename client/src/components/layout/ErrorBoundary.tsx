import { Component, type ErrorInfo, type ReactNode } from 'react';
import { RefreshCw, TriangleAlert } from 'lucide-react';
import { buttonClasses } from '../ui';

interface State {
  error: Error | null;
}

/**
 * Last line of defence around the router: a render error anywhere shows a readable page with a
 * reload action instead of a blank screen, and the error is logged for debugging.
 * Lives outside the router, so it uses plain links rather than router components.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[LectureLens] Unhandled render error:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main id="main" className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
        <div role="alert" className="flex w-full max-w-md flex-col items-center gap-4 rounded-card border border-border bg-surface px-6 py-8 text-center shadow-sm">
          <span aria-hidden className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-danger/10 text-danger">
            <TriangleAlert className="h-5 w-5" />
          </span>
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-semibold text-ink-1">Something went wrong</h1>
            <p className="text-sm text-ink-2">
              This page hit an unexpected error. Reloading usually fixes it; your saved work is not affected.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" className={buttonClasses()} onClick={() => window.location.reload()}>
              <RefreshCw aria-hidden className="h-4 w-4" />
              Reload page
            </button>
            <a href="/app/dashboard" className={buttonClasses({ variant: 'secondary' })}>
              Go to dashboard
            </a>
          </div>
          <p className="text-xs text-ink-3">Details: {this.state.error.message}</p>
        </div>
      </main>
    );
  }
}
