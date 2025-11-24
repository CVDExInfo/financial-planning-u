import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Components
import Navigation from "@/components/Navigation";
import ProjectContextBar from "@/components/ProjectContextBar";
import AccessControl from "@/components/AccessControl";
import { AuthProvider } from "@/components/AuthProvider";
import { useAuth } from "@/hooks/useAuth";
import { ProjectProvider } from "@/contexts/ProjectContext";
import LoginPage from "@/components/LoginPage";

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

const BASENAME =
  import.meta.env.VITE_PUBLIC_BASE ||
  import.meta.env.VITE_APP_BASENAME ||
  "/finanzas";

const normalizeBase = (base: string) =>
  base === "/" ? "" : base.replace(/\/$/, "");

function resolveLoginPaths() {
  const normalizedBase = normalizeBase(BASENAME);
  const isFinanzasContext =
    normalizedBase.startsWith("/finanzas") ||
    (typeof window !== "undefined" &&
      window.location.pathname.startsWith("/finanzas"));

  const browserLoginPath = isFinanzasContext
    ? "/finanzas/login"
    : `${normalizedBase || ""}/login`;

  const appLoginPath = normalizedBase
    ? browserLoginPath.replace(normalizedBase, "") || "/login"
    : browserLoginPath;

  const browserHomePath = isFinanzasContext ? "/finanzas/" : "/";
  const appHomePath = normalizedBase
    ? browserHomePath.replace(normalizedBase, "") || "/"
    : browserHomePath;

  return {
    browserLoginPath,
    appLoginPath,
    browserHomePath,
    appHomePath,
  };
}

function AppContent() {
  const { isAuthenticated, isLoading, routeConfigMissing, currentRole } = useAuth();
  const finzEnabled =
    import.meta.env.VITE_FINZ_ENABLED !== "false" ||
    (typeof window !== "undefined" &&
      window.location.pathname.startsWith("/finanzas"));
  const location = useLocation();
  const showProjectContextBar = location.pathname.startsWith("/sdmt/");
  const { appLoginPath, browserLoginPath, appHomePath } = resolveLoginPaths();

  // Prevent React from intercepting the static callback page that writes tokens
  if (location.pathname.includes("/auth/callback")) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-primary font-semibold">Ikusi</span>
          </div>
          <p className="text-muted-foreground">Loading your session…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    const loginRoutes = Array.from(
      new Set([appLoginPath, browserLoginPath].filter(Boolean))
    );

    return (
      <>
        <Routes>
          {loginRoutes.map((path) => (
            <Route key={path} path={path} element={<LoginPage />} />
          ))}
          <Route path="*" element={<Navigate to={browserLoginPath} replace />} />
        </Routes>
        <Toaster position="top-right" />
      </>
    );
  }

  if ([appLoginPath, browserLoginPath].includes(location.pathname)) {
    return <Navigate to={appHomePath} replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {routeConfigMissing && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <Alert>
            <AlertTitle>Role configuration incomplete</AlertTitle>
            <AlertDescription>
              Your role
              {currentRole ? ` (${currentRole})` : ""} is not fully configured for
              navigation. Please contact the administrator.
            </AlertDescription>
          </Alert>
        </div>
      )}

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
  const basename = normalizeBase(BASENAME);

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
