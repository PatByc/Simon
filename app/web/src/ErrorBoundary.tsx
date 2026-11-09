import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Simon UI error", { error, componentStack: info.componentStack });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="fatal-error" role="alert">
        <p className="eyebrow">Simon encountered a UI error</p>
        <h1>The application could not continue.</h1>
        <p>Your Pi session and saved conversations remain on the local backend.</p>
        <button type="button" onClick={() => window.location.reload()}>Reload Simon</button>
      </main>
    );
  }
}
