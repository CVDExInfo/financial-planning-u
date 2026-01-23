import { QueryClient } from "@tanstack/react-query";

/**
 * Global QueryClient configuration for the application.
 * 
 * IMPORTANT: No polling or automatic refetching enabled.
 * - refetchOnWindowFocus: false - Don't refetch when window gains focus
 * - refetchInterval: false - No periodic polling
 * - refetchOnReconnect: false - Don't refetch when network reconnects
 * 
 * Data is only fetched:
 * 1. On initial mount
 * 2. When explicitly invalidated by user actions
 * 3. When query key changes (e.g., project/period selection)
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchInterval: false,
      refetchOnReconnect: false,
      retry: 1,
      staleTime: 2 * 60 * 1000,
    },
  },
});

export default queryClient;
