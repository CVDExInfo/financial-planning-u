import { AuthError, ServerError, ValidationError } from "@/lib/errors";
import { toast } from "sonner";

export function handleFinanzasApiError(
  error: unknown,
  options: { onAuthError?: () => void; fallback?: string } = {},
): string {
  const fallback = options.fallback || "Ocurrió un error inesperado.";

  if (error instanceof AuthError) {
    const message = error.code === "FORBIDDEN"
      ? "No tienes permiso para ejecutar esta acción."
      : "Tu sesión ha expirado. Inicia sesión nuevamente.";
    toast.error(message);
    if (options.onAuthError) {
      options.onAuthError();
    }
    return message;
  }

  if (error instanceof ValidationError) {
    const message = error.message || fallback;
    toast.error(message);
    return message;
  }

  if (error instanceof ServerError) {
    const message = error.message || "Error interno de Finanzas.";
    toast.error(message);
    return message;
  }

  if (error instanceof Error) {
    toast.error(error.message || fallback);
    return error.message || fallback;
  }

  toast.error(fallback);
  return fallback;
}
