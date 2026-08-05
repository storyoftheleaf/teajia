import React from 'react';
import { recoverAndReload } from '../../lib/recoverFromChunkError';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Application error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen bg-tea-bg text-tea-text items-center justify-center p-6">
          <div className="bg-tea-surface border border-tea-border p-8 rounded-xl max-w-md w-full shadow-2xl text-center">
            <h2 className="text-xl font-serif text-tea-text mb-2">Something went wrong</h2>
            <p className="text-tea-text-sec text-sm mb-6">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
            <button
              onClick={() => { void recoverAndReload(); }}
              className="cta-solid px-6 py-3 rounded-xl text-sm font-medium transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
