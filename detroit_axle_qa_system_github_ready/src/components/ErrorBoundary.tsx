import { Component, type ErrorInfo, type ReactNode } from 'react';

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  errorMessage: string;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'An unexpected error occurred.',
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            background: '#07111f',
            color: '#e5eefb',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '640px',
              borderRadius: '24px',
              padding: '28px',
              background: 'rgba(15,23,42,0.9)',
              border: '1px solid rgba(248,113,113,0.24)',
              boxShadow: '0 20px 50px rgba(2,6,23,0.45)',
            }}
          >
            <div
              style={{
                fontSize: '12px',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                fontWeight: 800,
                color: '#fca5a5',
                marginBottom: '12px',
              }}
            >
              Application Error
            </div>
            <h1 style={{ marginTop: 0, marginBottom: '10px', color: '#f8fafc' }}>
              Something went wrong
            </h1>
            <p style={{ margin: 0, color: '#cbd5e1', lineHeight: 1.6 }}>
              {this.state.errorMessage || 'An unexpected error occurred while rendering the app.'}
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
