import React, { Component, ErrorInfo, ReactNode } from 'react';
import { motion } from 'framer-motion';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '400px',
            padding: '2rem',
            textAlign: 'center'
          }}
        >
          <span 
            className="material-symbols-outlined" 
            style={{ fontSize: '4rem', color: '#ef4444', marginBottom: '1rem' }}
          >
            error
          </span>
          <h2 style={{ marginBottom: '1rem', fontSize: '1.5rem', fontWeight: 700 }}>
            Oops! Something went wrong
          </h2>
          <p style={{ marginBottom: '2rem', opacity: 0.7, maxWidth: '500px' }}>
            {this.state.error?.message || 'An unexpected error occurred. Please try again.'}
          </p>
          <motion.button
            className="btn btn-primary"
            onClick={this.handleReset}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            style={{
              padding: '0.75rem 2rem',
              borderRadius: '12px',
              background: '#06b6d4',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '1rem'
            }}
          >
            Try Again
          </motion.button>
          {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
            <details style={{ marginTop: '2rem', textAlign: 'left', maxWidth: '800px' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600, marginBottom: '1rem' }}>
                Error Details (Development Only)
              </summary>
              <pre style={{ 
                background: '#1a1a1a', 
                padding: '1rem', 
                borderRadius: '8px', 
                overflow: 'auto',
                fontSize: '0.875rem'
              }}>
                {this.state.error?.stack}
                {'\n\n'}
                {this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
        </motion.div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
