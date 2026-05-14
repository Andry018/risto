import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error?: Error; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-charcoal flex items-center justify-center p-8">
          <div className="bg-surface border border-surface-light rounded-[40px] p-10 max-w-md text-center">
            <h1 className="text-2xl font-black text-red-500 mb-4">Errore</h1>
            <p className="text-gray-400 mb-6">Si è verificato un errore imprevisto.</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-gold text-black font-black py-3 px-8 rounded-2xl hover:bg-gold-hover transition-all"
            >
              RICARICA
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
