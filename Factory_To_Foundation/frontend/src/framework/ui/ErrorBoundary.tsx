import { Component, type ErrorInfo, type ReactNode } from "react";

type ErrorBoundaryProps = {
  children: ReactNode;
  /** Shown above the error detail — e.g. "Manufacturing", "Analytics". */
  label?: string;
};

type ErrorBoundaryState = {
  error: Error | null;
};

/**
 * Real, honest failure handling — this app had zero React error
 * boundaries anywhere before this (confirmed by grep), meaning any
 * uncaught render-time error (a real GLTF fetch/parse failure on a
 * flaky real mobile network, a WebGL context failure, anything) silently
 * blanks the entire page with no visible error at all — React's default
 * behavior with no boundary present. This doesn't try to guess or paper
 * over the real cause; it surfaces the real error message and a reload
 * action, so a crash reported from a real device is diagnosable instead
 * of just "the page went white."
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error(`[ErrorBoundary${this.props.label ? ` — ${this.props.label}` : ""}]`, error, info.componentStack);
  }

  render() {
    const { error } = this.state;

    if (!error) {
      return this.props.children;
    }

    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-sm font-semibold" style={{ color: "var(--ff-status-critical)" }}>
          {this.props.label ? `${this.props.label} hit a real error` : "This page hit a real error"}
        </p>

        <p className="max-w-md text-xs" style={{ color: "var(--ff-text-muted)" }}>
          {error.message || String(error)}
        </p>

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-2 rounded-[0.25rem] px-4 py-2 text-sm font-medium text-white"
          style={{ background: "var(--ff-accent)" }}
        >
          Reload
        </button>
      </div>
    );
  }
}
