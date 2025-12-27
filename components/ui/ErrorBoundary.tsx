
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ExclamationTriangleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    // In a real production app, you would log this to Sentry/LogRocket here.
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-screen w-screen bg-bg-primary text-white p-6">
            <div className="relative w-full max-w-lg p-8 bg-bg-secondary/70 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl text-center overflow-hidden">
                {/* Background Decor */}
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-red-500/5 to-transparent pointer-events-none"></div>
                
                <div className="relative z-10 flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-6 border border-red-500/20">
                        <ExclamationTriangleIcon className="w-8 h-8 text-red-400" />
                    </div>
                    
                    <h1 className="text-3xl font-bold text-white mb-3">Something went wrong</h1>
                    <p className="text-gray-400 mb-8 leading-relaxed">
                        Bubble encountered an unexpected issue. This can happen due to network interruptions or browser extension conflicts.
                    </p>

                    <div className="flex gap-4">
                        <button
                            onClick={this.handleReload}
                            className="flex items-center gap-2 px-6 py-3 bg-white text-black rounded-xl font-bold hover:bg-gray-200 transition-all shadow-lg hover:shadow-xl hover:scale-105"
                        >
                            <ArrowPathIcon className="w-5 h-5" />
                            <span>Reload Application</span>
                        </button>
                    </div>
                    
                    {this.state.error && (
                        <div className="mt-8 p-4 bg-black/30 rounded-lg border border-white/5 w-full text-left">
                            <p className="text-xs text-gray-500 font-mono break-all">
                                Error: {this.state.error.message}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
