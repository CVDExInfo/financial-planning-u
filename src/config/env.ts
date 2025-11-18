/**
 * Centralized access to Vite environment variables used by Finanzas UI.
 * Ensures we only touch import.meta.env in a single place and normalize values.
 * 
 * VITE_API_BASE_URL is REQUIRED for the Finanzas frontend to function.
 * If this value is missing:
 * - Build will fail (enforced in vite.config.ts)
 * - Runtime will throw clear errors when API calls are attempted
 * 
 * Setup instructions:
 * - Local dev: Set in .env.development or .env.local
 * - CI/CD: Set via VITE_API_BASE_URL environment variable
 * - See README.md for complete setup instructions
 */

const rawApiBase = (import.meta as any)?.env?.VITE_API_BASE_URL ?? "";
const normalizedApiBase = typeof rawApiBase === "string"
  ? rawApiBase.trim().replace(/\/+$/, "")
  : "";

export const API_BASE = normalizedApiBase;
export const HAS_API_BASE = API_BASE.length > 0;

// Log API_BASE at runtime for debugging
if (import.meta.env.DEV) {
  console.log(`[env.ts] API_BASE configured: "${API_BASE}" (has value: ${HAS_API_BASE})`);
}

if (!HAS_API_BASE) {
  const errorMessage = `
╔═══════════════════════════════════════════════════════════════════╗
║ ❌ CONFIGURATION ERROR: VITE_API_BASE_URL is not set            ║
╚═══════════════════════════════════════════════════════════════════╝

The Finanzas frontend requires VITE_API_BASE_URL to be configured.

📋 Setup Instructions:

  For Local Development:
  ----------------------
  1. Copy .env.example to .env.local
  2. Set VITE_API_BASE_URL to the API endpoint:
     
     VITE_API_BASE_URL=https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev

  For Production/Staging:
  ----------------------
  Set VITE_API_BASE_URL in your CI/CD environment variables.
  
  Example (GitHub Actions):
    env:
      VITE_API_BASE_URL: \${{ vars.DEV_API_URL }}

📖 See README.md for complete documentation.

⚠️  API calls will fail until this is configured.
  `.trim();
  
  console.error(errorMessage);
  
  // In production builds, also show user-friendly UI error
  if (import.meta.env.PROD) {
    // Store error for display in UI components
    (window as any).__FINANZAS_CONFIG_ERROR__ = errorMessage;
  }
}
