import React from 'react';

/**
 * ErrorBoundary - Catches React rendering errors and displays a fallback UI
 * This helps diagnose "Objects are not valid as React child" errors
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Error info:', errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '20px',
          margin: '20px',
          background: '#ffebee',
          border: '1px solid #f44336',
          borderRadius: '8px',
          fontFamily: 'monospace',
        }}>
          <h2 style={{ color: '#c62828', marginTop: 0 }}>Something went wrong</h2>
          <details style={{ whiteSpace: 'pre-wrap' }}>
            <summary>Click for error details</summary>
            <p><strong>Error:</strong> {this.state.error?.toString?.()}</p>
            <p><strong>Stack:</strong></p>
            <pre>{this.state.error?.stack}</pre>
            <p><strong>Component Stack:</strong></p>
            <pre>{this.state.errorInfo?.componentStack}</pre>
          </details>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '15px',
              padding: '10px 20px',
              background: '#2196f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
