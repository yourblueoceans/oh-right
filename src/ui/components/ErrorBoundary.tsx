import { Component, type ReactNode } from 'react';

/** If the app crashes, show what happened instead of a blank page, so a screenshot tells us why. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };

  static getDerivedStateFromError(e: unknown) {
    return { error: describe(e) };
  }

  componentDidMount() {
    window.addEventListener('error', this.onError);
    window.addEventListener('unhandledrejection', this.onRejection);
  }

  componentWillUnmount() {
    window.removeEventListener('error', this.onError);
    window.removeEventListener('unhandledrejection', this.onRejection);
  }

  onError = (ev: ErrorEvent) => console.error('window error', ev.error ?? ev.message);
  onRejection = (ev: PromiseRejectionEvent) => console.error('unhandled rejection', ev.reason);

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="page center" data-testid="crash">
        <h1>Something went wrong</h1>
        <p>Please reload the page. If this keeps happening, send a screenshot of this screen.</p>
        <p className="mono small muted">{this.state.error}</p>
        <p className="mono small muted">{navigator.userAgent}</p>
        <button className="btn btn-primary" onClick={() => location.reload()}>
          Reload
        </button>
      </main>
    );
  }
}

function describe(e: unknown): string {
  const err = e as { name?: string; message?: string; code?: string };
  return [err?.code ?? err?.name, err?.message ?? String(e)].filter(Boolean).join(': ').slice(0, 300);
}
