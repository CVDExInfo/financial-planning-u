/**
 * useProviders Hook
 * 
 * Fetches and manages the list of registered providers/vendors from the Finanzas API.
 * Used in reconciliation and other modules where vendor selection is needed.
 */

import { useQuery } from "@tanstack/react-query";
import finanzasClient, { type Provider } from "@/api/finanzasClient";
import { useAuth } from "@/hooks/useAuth";

export interface ProvidersOptions {
  tipo?: string;
  estado?: string;
  enabled?: boolean;
}

export function useProviders(options: ProvidersOptions = {}) {
  const { login } = useAuth();

  const query = useQuery({
    queryKey: ["providers", options.tipo, options.estado],
    queryFn: async () => {
      try {
        const providers = await finanzasClient.getProviders({
          tipo: options.tipo,
          estado: options.estado || "active",
          limit: 100,
        });
        return providers;
      } catch (error) {
        // Handle auth errors by triggering re-authentication
        if (error instanceof Error && /401|403|expired/i.test(error.message)) {
          login?.();
        }
        throw error;
      }
    },
    enabled: options.enabled !== false,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
  });

  return {
    providers: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
