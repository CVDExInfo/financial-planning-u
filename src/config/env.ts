/**
 * Centralized access to Vite environment variables used by Finanzas UI.
 * Ensures we only touch import.meta.env in a single place and normalize values.
 */

const rawApiBase = (import.meta as any)?.env?.VITE_API_BASE_URL ?? "";
const normalizedApiBase = typeof rawApiBase === "string"
  ? rawApiBase.trim().replace(/\/+$/, "")
  : "";

export const API_BASE = normalizedApiBase;
export const HAS_API_BASE = API_BASE.length > 0;

// Log API_BASE at runtime for debugging
console.log(`[env.ts] API_BASE configured: "${API_BASE}" (has value: ${HAS_API_BASE})`);

if (!HAS_API_BASE) {
  console.error(
    "VITE_API_BASE_URL is not set. Finanzas API client is disabled until the build injects it."
  );
}
