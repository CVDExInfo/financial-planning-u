import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig, PluginOption } from "vite";

import sparkPlugin from "@github/spark/spark-vite-plugin";
import createIconImportProxy from "@github/spark/vitePhosphorIconProxyPlugin";
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

export default defineConfig(() => ({
  base: isPmo ? "/" : "/finanzas/",
  define: {
    // Pass build target to frontend so it can set correct basename
    "import.meta.env.VITE_APP_BASENAME": JSON.stringify(
      isPmo ? "/" : "/finanzas"
    ),
    // Enable Finanzas-only mode when building for Finanzas
    "import.meta.env.VITE_FINZ_ENABLED": JSON.stringify(
      !isPmo ? "true" : "false"
    ),
  },
  plugins: [
    react(),
    tailwindcss(),
    // DO NOT REMOVE
    createIconImportProxy() as PluginOption,
    sparkPlugin() as PluginOption,
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
    outDir: isPmo ? "dist-pmo" : "dist-finanzas",
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
  },
}));
