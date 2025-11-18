import { useState, useEffect } from "react";
import LoadingState from "./LoadingState";
import ErrorState from "./ErrorState";
import EmptyState from "./EmptyState";

interface DataContainerProps<T> {
  data?: T | T[] | null;
  isLoading?: boolean;
  error?: Error | string | null;
  onRetry?: () => void;
  loadingType?: "table" | "chart" | "card" | "grid" | "form";
  loadingRows?: number;
  emptyTitle?: string;
  emptyMessage?: string;
  emptyAction?: {
    label: string;
    onClick: () => void;
  };
  children: (data: T | T[]) => React.ReactNode;
  className?: string;
}

/**
 * A container component that handles loading, error, and empty states for data
 */
export default function DataContainer<T>({
  data,
  isLoading = false,
  error = null,
  onRetry,
  loadingType = "card",
  loadingRows = 3,
  emptyTitle,
  emptyMessage,
  emptyAction,
  children,
  className
}: DataContainerProps<T>) {
  const [showDelayedLoading, setShowDelayedLoading] = useState(false);

  // Show loading state after a brief delay to avoid flashing
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isLoading) {
      timer = setTimeout(() => setShowDelayedLoading(true), 150);
    } else {
      setShowDelayedLoading(false);
    }
    return () => clearTimeout(timer);
  }, [isLoading]);

  if (error) {
    const errorMessage = typeof error === 'string' ? error : error.message;
    return (
      <ErrorState
        message={errorMessage}
        onRetry={onRetry}
        className={className}
      />
    );
  }

  if (isLoading && showDelayedLoading) {
    return (
      <LoadingState
        type={loadingType}
        rows={loadingRows}
        className={className}
      />
    );
  }

  // Check if data is empty
  const isEmpty = !data || (Array.isArray(data) && data.length === 0);
  
  if (isEmpty && !isLoading) {
    return (
      <EmptyState
        title={emptyTitle}
        message={emptyMessage}
        action={emptyAction}
        className={className}
      />
    );
  }

  if (data) {
    return <>{children(data)}</>;
  }

  return null;
}