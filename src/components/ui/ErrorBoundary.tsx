import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Catches render-time errors anywhere in the component tree below it and shows
 * a friendly fallback instead of a blank white screen. Without this, one
 * component throwing during render takes down the entire app.
 *
 * Error boundaries MUST be class components — React has no Hook equivalent.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // In a production corporate app this is where you'd send the error to a
    // monitoring service (Sentry, Datadog, etc.). For now we log it.
    console.error("Uncaught render error:", error, info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100">
            <svg
              className="h-6 w-6 text-rose-600"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
          </div>
          <h1 className="mb-2 text-lg font-semibold text-slate-800">
            Something went wrong
          </h1>
          <p className="mb-6 text-sm text-slate-500">
            An unexpected error occurred while displaying this page. You can try
            again, or reload the app.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={this.handleReset}
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Try again
            </button>
            <button
              onClick={this.handleReload}
              className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
            >
              Reload app
            </button>
          </div>

          {import.meta.env.DEV && this.state.error && (
            <pre className="mt-6 max-h-40 overflow-auto rounded-lg bg-slate-900 p-3 text-left text-xs text-rose-300">
              {this.state.error.message}
            </pre>
          )}
        </div>
      </div>
    );
  }
}
