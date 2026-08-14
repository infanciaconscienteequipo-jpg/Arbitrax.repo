import React, { Component, ReactNode, ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message || 'Error inesperado de la aplicación.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ARBITRAX UI ERROR:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-binance-black text-white flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-binance-card border border-binance-border rounded-2xl p-6 space-y-4 text-center">
            <h1 className="text-lg font-extrabold text-binance-red">Ocurrió un error en esta pantalla</h1>
            <p className="text-sm text-binance-gray break-words">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-xl bg-binance-yellow text-binance-black font-extrabold text-xs cursor-pointer"
            >
              RECARGAR
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

