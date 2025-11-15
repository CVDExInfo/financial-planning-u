/**
 * ErrorBoundary Component for Finanzas Module
 * 
 * Catches runtime errors in the component tree and displays a fallback UI.
 * Integrates with the logger utility for error tracking and correlation IDs.
 * 
 * Usage:
 *   <ErrorBoundary>
 *     <YourComponent />
 *   </ErrorBoundary>
 */

import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { logger, generateCorrelationId } from '@/utils/logger';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional fallback component */
  fallback?: (error: Error, errorInfo: ErrorInfo, correlationId: string) => ReactNode;
  /** Optional callback when error occurs */
  onError?: (error: Error, errorInfo: ErrorInfo, correlationId: string) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  correlationId: string | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      correlationId: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const correlationId = generateCorrelationId();
    
    // Log the error with correlation ID
    logger.error(
      'Uncaught error in component tree',
      error,
      correlationId
    );
    
    // Log component stack
    logger.error('Component stack:', errorInfo.componentStack);
    
    // Update state with error info
    this.setState({
      errorInfo,
      correlationId,
    });
    
    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo, correlationId);
    }
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      correlationId: null,
    });
  };

  handleGoHome = (): void => {
    window.location.href = '/';
  };

  render(): ReactNode {
    if (this.state.hasError) {
      const { error, errorInfo, correlationId } = this.state;
      
      // Use custom fallback if provided
      if (this.props.fallback && error && errorInfo && correlationId) {
        return this.props.fallback(error, errorInfo, correlationId);
      }
      
      // Default fallback UI
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                  <AlertTriangle className="h-6 w-6 text-destructive" />
                </div>
                <div>
                  <CardTitle>Something went wrong</CardTitle>
                  <CardDescription>
                    An unexpected error occurred. Our team has been notified.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Error details for development */}
              {import.meta.env.DEV && error && (
                <div className="rounded-lg bg-muted p-4 space-y-2">
                  <p className="text-sm font-medium">Error Details (Development Only):</p>
                  <pre className="text-xs overflow-auto max-h-40 p-2 bg-background rounded border">
                    {error.toString()}
                  </pre>
                  {errorInfo && (
                    <pre className="text-xs overflow-auto max-h-40 p-2 bg-background rounded border">
                      {errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              )}
              
              {/* Correlation ID */}
              {correlationId && (
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-xs text-muted-foreground">
                    Error ID: <code className="font-mono">{correlationId}</code>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Please reference this ID when contacting support.
                  </p>
                </div>
              )}
              
              {/* Action buttons */}
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={this.handleReset}
                  variant="default"
                  className="flex-1"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Try Again
                </Button>
                <Button
                  onClick={this.handleGoHome}
                  variant="outline"
                  className="flex-1"
                >
                  <Home className="mr-2 h-4 w-4" />
                  Go to Home
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
