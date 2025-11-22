import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";

import { resolve } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, "..");
const projectRoot = process.env.PROJECT_ROOT || __dirname;

// Dual-SPA build configuration selector
// BUILD_TARGET env var selects which SPA to build:
//   - BUILD_TARGET=pmo     → PMO Portal (dist-pmo/, base: /)
//   - BUILD_TARGET=finanzas → Finanzas SDT Portal (dist-finanzas/, base: /finanzas/)
//   - default              → Finanzas (for backward compatibility)
const buildTarget = process.env.BUILD_TARGET || "finanzas";
const isPmo = buildTarget === "pmo";

console.log(
  `[Vite] Configuring for ${
    isPmo ? "PMO" : "FINANZAS"
  } (BUILD_TARGET=${buildTarget})`
);

export default defineConfig(() => {
  const outDir = isPmo ? "dist-pmo" : "dist-finanzas";
  const publicBase =
    process.env.VITE_PUBLIC_BASE || (isPmo ? "/" : "/finanzas/");
  
  // Normalize API base URL from environment
  const rawApiBase = process.env.VITE_API_BASE_URL || "";
  const apiBaseUrl = typeof rawApiBase === "string"
    ? rawApiBase.trim().replace(/\/+$/, "")
    : "";

  // Fail fast during build instead of shipping a broken bundle
  if (!isPmo && !apiBaseUrl) {
    console.error("");
    console.error("╔════════════════════════════════════════════════════════════════╗");
    console.error("║  ❌ CRITICAL BUILD ERROR: VITE_API_BASE_URL not set           ║");
    console.error("╚════════════════════════════════════════════════════════════════╝");
    console.error("");
    console.error("The Finanzas frontend REQUIRES VITE_API_BASE_URL to function.");
    console.error("Without this configuration:");
    console.error("  ❌ API calls will fail with 'Failed to fetch' errors");
    console.error("  ❌ Application will not load any data");
    console.error("  ❌ Users will see empty grids and visualizations");
    console.error("");
    console.error("🔧 To fix this:");
    console.error("");
    console.error("  1. For local development:");
    console.error("     Set VITE_API_BASE_URL in your .env.local file");
    console.error("     See .env.example for the correct value");
    console.error("     npm run build:finanzas");
    console.error("");
    console.error("  2. For CI/CD:");
    console.error("     Set DEV_API_URL in GitHub repository variables");
    console.error("");
    console.error("  3. For production:");
    console.error("     Set VITE_API_BASE_URL via environment variables");
    console.error("");
    console.error("📖 For more details, see:");
    console.error("   - README.md (section: Required Configuration)");
    console.error("   - .env.example");
    console.error("   - API_CONNECTIVITY_VALIDATION.md");
    console.error("");
    throw new Error("VITE_API_BASE_URL is not set for Finanzas build.");
  }

  // Log successful configuration
  if (!isPmo) {
    console.log(`[Vite][Finanzas] ✅ VITE_API_BASE_URL: ${apiBaseUrl}`);
  }

  return {
    base: publicBase,
    define: {
      // Primary source for basename (used in App.tsx)
      "import.meta.env.VITE_PUBLIC_BASE": JSON.stringify(
        publicBase.replace(/\/$/, "")
      ),
      // Legacy support for VITE_APP_BASENAME
      "import.meta.env.VITE_APP_BASENAME": JSON.stringify(
        publicBase.replace(/\/$/, "")
      ),
      // Enable Finanzas-only mode when building for Finanzas
      "import.meta.env.VITE_FINZ_ENABLED": JSON.stringify(
        !isPmo ? "true" : "false"
      ),
      // Explicitly inject API base URL from process.env
      "import.meta.env.VITE_API_BASE_URL": JSON.stringify(apiBaseUrl),
    },
    plugins: [
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        "@": resolve(projectRoot, "src"),
      },
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-router-dom",
        "@radix-ui/react-dialog",
        "@radix-ui/react-select",
        "@radix-ui/react-tabs",
        "lucide-react",
        "recharts",
      ],
    },
    build: {
      outDir: outDir,
      commonjsOptions: {
        include: [/node_modules/],
        transformMixedEsModules: true,
      },
    },
  };
});
