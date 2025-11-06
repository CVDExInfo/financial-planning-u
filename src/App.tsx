import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';

// Components
import Navigation from '@/components/Navigation';
import ProjectContextBar from '@/components/ProjectContextBar';
import AccessControl from '@/components/AccessControl';
import { AuthProvider, useAuth } from '@/components/AuthProvider';
import { ProjectProvider } from '@/contexts/ProjectContext';
import LoginPage from '@/components/LoginPage';

// PMO Features
import PMOEstimatorWizard from '@/features/pmo/prefactura/Estimator/PMOEstimatorWizard';

// SDMT Features - We'll create these placeholders for now
import SDMTCatalog from '@/features/sdmt/cost/Catalog/SDMTCatalog';
// Finanzas module (R1) - Gestion presupuesto
import RubrosCatalog from '@/modules/finanzas/RubrosCatalog';
import SDMTForecast from '@/features/sdmt/cost/Forecast/SDMTForecast';
import SDMTReconciliation from '@/features/sdmt/cost/Reconciliation/SDMTReconciliation';
import SDMTCashflow from '@/features/sdmt/cost/Cashflow/SDMTCashflow';
import SDMTScenarios from '@/features/sdmt/cost/Scenarios/SDMTScenarios';
import SDMTChanges from '@/features/sdmt/cost/Changes/SDMTChanges';

// Home page
import HomePage from '@/features/HomePage';
import UserProfile from '@/components/UserProfile';

// Hook to determine current module
function useCurrentModule() {
  const location = useLocation();
  const { currentRole } = useAuth();
  
  if (location.pathname.startsWith('/pmo/')) {
    return 'PMO';
  } else if (location.pathname.startsWith('/sdmt/')) {
    // PMO users accessing SDMT routes are still working in their PMO capacity
    return currentRole === 'PMO' ? 'PMO' : 'SDMT';
  }
  return undefined;
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const currentModule = useCurrentModule();
  const location = useLocation();
  const showProjectContextBar = location.pathname.startsWith('/sdmt/');

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
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation currentModule={currentModule} />
      
      <ProjectProvider>
        {showProjectContextBar && <ProjectContextBar />}
        <main>
          <AccessControl>
            <Routes>
              {/* Home */}
              <Route path="/" element={<HomePage />} />
              
              {/* User Profile */}
              <Route path="/profile" element={<UserProfile />} />
              
              {/* PMO Routes */}
              <Route path="/pmo/prefactura/estimator" element={<PMOEstimatorWizard />} />
              
              {/* SDMT Routes */}
              <Route path="/sdmt/cost/catalog" element={<SDMTCatalog />} />
              <Route path="/sdmt/cost/forecast" element={<SDMTForecast />} />
              <Route path="/sdmt/cost/reconciliation" element={<SDMTReconciliation />} />
              <Route path="/sdmt/cost/cashflow" element={<SDMTCashflow />} />
              <Route path="/sdmt/cost/scenarios" element={<SDMTScenarios />} />
              <Route path="/sdmt/cost/changes" element={<SDMTChanges />} />
              
              {/* Finanzas R1 Routes (feature-flagged) */}
              {import.meta.env.VITE_FINZ_ENABLED === 'true' && (
                <Route path="/finanzas/catalog/rubros" element={<RubrosCatalog />} />
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
  return (
    <BrowserRouter basename="/finanzas">
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;