import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { Toaster } from "sonner";

// Components
import Navigation from "@/components/Navigation";
import ProjectContextBar from "@/components/ProjectContextBar";
import AccessControl from "@/components/AccessControl";
import { AuthProvider } from "@/components/AuthProvider";
import { useAuth } from "@/hooks/useAuth";
import { ProjectProvider } from "@/contexts/ProjectContext";
import Login from "@/components/Login";

// PMO Features
import PMOEstimatorWizard from "@/features/pmo/prefactura/Estimator/PMOEstimatorWizard";

// SDMT Features - We'll create these placeholders for now
import SDMTCatalog from "@/features/sdmt/cost/Catalog/SDMTCatalog";
// Finanzas module (R1) - Gestion presupuesto
import RubrosCatalog from "@/modules/finanzas/RubrosCatalog";
import AllocationRulesPreview from "@/modules/finanzas/AllocationRulesPreview";
import FinanzasHome from "./modules/finanzas/FinanzasHome";
import ProjectsManager from "@/modules/finanzas/ProjectsManager";
import AdjustmentsManager from "@/modules/finanzas/AdjustmentsManager";
import ProvidersManager from "@/modules/finanzas/ProvidersManager";
import SDMTForecast from "@/features/sdmt/cost/Forecast/SDMTForecast";
import SDMTReconciliation from "@/features/sdmt/cost/Reconciliation/SDMTReconciliation";
import SDMTCashflow from "@/features/sdmt/cost/Cashflow/SDMTCashflow";
import SDMTScenarios from "@/features/sdmt/cost/Scenarios/SDMTScenarios";
import SDMTChanges from "@/features/sdmt/cost/Changes/SDMTChanges";

// Home page
import HomePage from "@/features/HomePage";
import UserProfile from "@/components/UserProfile";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 2 * 60 * 1000,
    },
  },
});

// Hook to determine current module
// NOTE: Module context detection reserved for future enhancements
// function useCurrentModule() {
//   const location = useLocation();
//   const { currentRole } = useAuth();
//   if (location.pathname.startsWith("/pmo/")) return "PMO";
//   if (location.pathname.startsWith("/sdmt/")) return currentRole === "PMO" ? "PMO" : "SDMT";
//   return undefined;
// }

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const finzEnabled =
    import.meta.env.VITE_FINZ_ENABLED !== "false" ||
    (typeof window !== "undefined" &&
      window.location.pathname.startsWith("/finanzas"));
  // Determine current module (reserved for future contextual UI; currently unused)
  // const currentModule = useCurrentModule();
  const location = useLocation();
  const showProjectContextBar = location.pathname.startsWith("/sdmt/");

  // ✅ CRITICAL: Prevent React from intercepting OAuth callback route
  // The callback.html is a static file that must execute independently to:
  // 1. Parse tokens from URL hash (Cognito implicit flow)
  // 2. Store tokens in localStorage
  // 3. Redirect back to the SPA
  // 
  // If React renders here, it will:
  // - Check isAuthenticated (false, since tokens not yet stored)
  // - Redirect to login page before callback.html can execute
  // - Create infinite login loop
  //
  // Solution: Return null to prevent React rendering on callback routes
  // This allows the browser to load the static callback.html file from /public
  if (location.pathname.includes("/auth/callback")) {
    console.log("[App] Callback route detected - deferring to static callback.html");
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center mx-auto mb-4">
            <span className="text-primary-foreground font-bold text-sm">I</span>
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <ProjectProvider>
        {showProjectContextBar && <ProjectContextBar />}
        <main>
          <AccessControl>
            <Routes>
              {/* Finanzas root (app served under /finanzas) */}
              {finzEnabled ? (
                <Route path="/" element={<FinanzasHome />} />
              ) : (
                <Route path="/" element={<HomePage />} />
              )}

              {/* User Profile */}
              <Route path="/profile" element={<UserProfile />} />

              {/* PMO Routes */}
              <Route
                path="/pmo/prefactura/estimator"
                element={<PMOEstimatorWizard />}
              />

              {/* SDMT Routes */}
              <Route path="/sdmt/cost/catalog" element={<SDMTCatalog />} />
              <Route path="/sdmt/cost/forecast" element={<SDMTForecast />} />
              <Route
                path="/sdmt/cost/reconciliation"
                element={<SDMTReconciliation />}
              />
              <Route path="/sdmt/cost/cashflow" element={<SDMTCashflow />} />
              <Route path="/sdmt/cost/scenarios" element={<SDMTScenarios />} />
              <Route path="/sdmt/cost/changes" element={<SDMTChanges />} />

              {/* Finanzas R1 Routes (feature-flagged) */}
              {finzEnabled && (
                <>
                  {/* Finanzas routes (relative to basename /finanzas) */}
                  <Route path="/projects" element={<ProjectsManager />} />
                  <Route path="/catalog/rubros" element={<RubrosCatalog />} />
                  <Route path="/rules" element={<AllocationRulesPreview />} />
                  <Route path="/adjustments" element={<AdjustmentsManager />} />
                  <Route path="/providers" element={<ProvidersManager />} />
                </>
              )}

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AccessControl>
          </main>
        </ProjectProvider>

      <Toaster position="top-right" />
    </div>
  );
}

function App() {
  // Use VITE_PUBLIC_BASE as primary source, fallback to /finanzas
  const basename =
    import.meta.env.VITE_PUBLIC_BASE ||
    import.meta.env.VITE_APP_BASENAME ||
    "/finanzas";

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={basename.replace(/\/$/, "")}>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
