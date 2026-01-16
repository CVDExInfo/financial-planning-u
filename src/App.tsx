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
import { PersonaProvider } from "@/contexts/PersonaContext";
import LoginPage from "@/components/LoginPage";
import NoAccess from "@/components/NoAccess";

// PMO Features
import PMOEstimatorWizard from "@/features/pmo/prefactura/Estimator/PMOEstimatorWizard";
import PMOProjectDetailsPage from "@/features/pmo/projects/PMOProjectDetailsPage";
import PMOBaselinesQueuePage from "@/features/pmo/baselines/PMOBaselinesQueuePage";

// SDMT Features - We'll create these placeholders for now
import SDMTCatalog from "@/features/sdmt/cost/Catalog/SDMTCatalog";
// Finanzas module (R1) - Gestion presupuesto
import RubrosCatalog from "@/modules/finanzas/RubrosCatalog";
import AllocationRulesPreview from "@/modules/finanzas/AllocationRulesPreview";
import FinanzasHome from "./modules/finanzas/FinanzasHome";
import ProjectsManager from "@/modules/finanzas/ProjectsManager";
import AdjustmentsManager from "@/modules/finanzas/AdjustmentsManager";
import ProvidersManager from "@/modules/finanzas/ProvidersManager";
import CashflowDashboard from "@/modules/finanzas/CashflowDashboard";
import ScenariosDashboard from "@/modules/finanzas/ScenariosDashboard";
import HubDesempeno from "@/modules/finanzas/HubDesempeno";
import PayrollPage from "@/modules/finanzas/payroll/PayrollPage";
import SDMTForecast from "@/features/sdmt/cost/Forecast/SDMTForecast";
import SDMTReconciliation from "@/features/sdmt/cost/Reconciliation/SDMTReconciliation";
import SDMTCashflow from "@/features/sdmt/cost/Cashflow/SDMTCashflow";
import SDMTScenarios from "@/features/sdmt/cost/Scenarios/SDMTScenarios";
import SDMTChanges from "@/features/sdmt/cost/Changes/SDMTChanges";

// Home page
import HomePage from "@/features/HomePage";
import UserProfile from "@/components/UserProfile";
import { QueryClientProvider } from "@tanstack/react-query";

import { queryClient } from "./lib/queryClient";
import { useIdleLogout } from "./hooks/useIdleLogout";

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
  const { isAuthenticated, isLoading, routeConfigMissing, currentRole, availableRoles } = useAuth();
  useIdleLogout();
  const finanzasEnabled =
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

  // SECURITY: Users without any assigned roles cannot access the application
  if (!availableRoles || availableRoles.length === 0) {
    return (
      <>
        <NoAccess />
        <Toaster position="top-right" />
      </>
    );
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

      <PersonaProvider>
        <ProjectProvider>
          {showProjectContextBar && <ProjectContextBar />}
          <main>
            <AccessControl>
            <Routes>
              {/* Finanzas root (app served under /finanzas) */}
              <Route
                path="/"
                element={finanzasEnabled ? <FinanzasHome /> : <HomePage />}
              />

              {/* User Profile */}
              <Route path="/profile" element={<UserProfile />} />

              {/* PMO Routes */}
              <Route
                path="/pmo/prefactura/estimator"
                element={<PMOEstimatorWizard />}
              />
              <Route
                path="/pmo/baselines"
                element={<PMOBaselinesQueuePage />}
              />
              <Route
                path="/pmo/projects/:projectId"
                element={<PMOProjectDetailsPage />}
              />

              {/* SDMT Routes */}
              <Route
                path="/finanzas/sdmt/cost/catalog"
                element={<Navigate to="/sdmt/cost/catalog" replace />}
              />
              <Route
                path="/finanzas/sdmt/cost/reconciliation"
                element={<Navigate to="/sdmt/cost/reconciliation" replace />}
              />
              <Route path="/sdmt/cost/catalog" element={<SDMTCatalog />} />
              <Route path="/projects/:projectId/cost-structure" element={<SDMTCatalog />} />
              <Route path="/sdmt/cost/forecast" element={<SDMTForecast />} />
              <Route
                path="/sdmt/cost/reconciliation"
                element={<SDMTReconciliation />}
              />
              <Route path="/sdmt/cost/cashflow" element={<SDMTCashflow />} />
              <Route path="/sdmt/cost/scenarios" element={<SDMTScenarios />} />
              <Route path="/sdmt/cost/changes" element={<SDMTChanges />} />

              {/* Finanzas R1 Routes (Spanish-first; redirect when disabled) */}
              <Route
                path="/projects"
                element={
                  finanzasEnabled ? <ProjectsManager /> : <Navigate to="/" replace />
                }
              />
              <Route
                path="/catalog/rubros"
                element={
                  finanzasEnabled ? <RubrosCatalog /> : <Navigate to="/" replace />
                }
              />
              <Route
                path="/rules"
                element={
                  finanzasEnabled ? (
                    <AllocationRulesPreview />
                  ) : (
                    <Navigate to="/" replace />
                  )
                }
              />
              <Route
                path="/adjustments"
                element={
                  finanzasEnabled ? (
                    <AdjustmentsManager />
                  ) : (
                    <Navigate to="/" replace />
                  )
                }
              />
              <Route
                path="/payroll/actuals"
                element={
                  finanzasEnabled ? (
                    <PayrollPage />
                  ) : (
                    <Navigate to="/" replace />
                  )
                }
              />
              <Route
                path="/cashflow"
                element={
                  finanzasEnabled ? (
                    <CashflowDashboard />
                  ) : (
                    <Navigate to="/" replace />
                  )
                }
              />
              <Route
                path="/scenarios"
                element={
                  finanzasEnabled ? (
                    <ScenariosDashboard />
                  ) : (
                    <Navigate to="/" replace />
                  )
                }
              />
              <Route
                path="/providers"
                element={
                  finanzasEnabled ? <ProvidersManager /> : <Navigate to="/" replace />
                }
              />
              <Route
                path="/hub"
                element={
                  finanzasEnabled ? <HubDesempeno /> : <Navigate to="/" replace />
                }
              />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            </AccessControl>
          </main>
        </ProjectProvider>
      </PersonaProvider>

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
