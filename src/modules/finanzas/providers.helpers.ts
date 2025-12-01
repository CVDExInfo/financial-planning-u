import { handleFinanzasApiError } from "@/features/sdmt/cost/utils/errorHandling";
import type { Provider } from "@/api/finanzasClient";

export async function loadProvidersWithHandler(
  fetchProviders: () => Promise<Provider[]>,
  onAuthError?: () => void,
) {
  try {
    const providers = await fetchProviders();
    return { providers, error: null as string | null };
  } catch (error) {
    const message = handleFinanzasApiError(error, {
      onAuthError,
      fallback: "No se pudieron cargar los proveedores.",
    });
    return { providers: [] as Provider[], error: message };
  }
}
