import { useState, useCallback, useRef } from 'react';

export interface AsyncState<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  isSuccess: boolean;
  isError: boolean;
}

export interface UseAsyncOperationOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
  showSuccessToast?: boolean;
  showErrorToast?: boolean;
  successMessage?: string;
  errorMessage?: string;
}

/**
 * Custom hook for managing async operations with loading, error, and success states
 */
export function useAsyncOperation<T = any>(
  options: UseAsyncOperationOptions = {}
) {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    isLoading: false,
    error: null,
    isSuccess: false,
    isError: false,
  });

  const abortController = useRef<AbortController | null>(null);

  const execute = useCallback(async (asyncFn: () => Promise<T>) => {
    // Cancel any existing operation
    if (abortController.current) {
      abortController.current.abort();
    }
    
    abortController.current = new AbortController();
    
    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
      isSuccess: false,
      isError: false,
    }));

    try {
      const result = await asyncFn();
      
      // Check if operation was aborted
      if (abortController.current?.signal.aborted) {
        return;
      }

      setState({
        data: result,
        isLoading: false,
        error: null,
        isSuccess: true,
        isError: false,
      });

      if (options.onSuccess) {
        options.onSuccess(result);
      }

      return result;
    } catch (error) {
      // Check if operation was aborted
      if (abortController.current?.signal.aborted) {
        return;
      }

      const err = error instanceof Error ? error : new Error(String(error));
      
      setState({
        data: null,
        isLoading: false,
        error: err,
        isSuccess: false,
        isError: true,
      });

      if (options.onError) {
        options.onError(err);
      }

      throw err;
    }
  }, [options]);

  const reset = useCallback(() => {
    if (abortController.current) {
      abortController.current.abort();
    }
    setState({
      data: null,
      isLoading: false,
      error: null,
      isSuccess: false,
      isError: false,
    });
  }, []);

  const retry = useCallback(async (lastAsyncFn?: () => Promise<T>) => {
    if (lastAsyncFn) {
      return execute(lastAsyncFn);
    }
  }, [execute]);

  return {
    ...state,
    execute,
    reset,
    retry,
  };
}