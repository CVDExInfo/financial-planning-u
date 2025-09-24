import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';

// Components
import Navigation from '@/components/Navigation';
import ProjectContextBar from '@/components/ProjectContextBar';
import AccessControl from '@/components/AccessControl';


// PMO Features
import PMOEstimatorWizard from '@/features/pmo/prefactura/Estimator/PMOEstimatorWizard';

// SDMT Features - We'll create these placeholders for now
import SDMTCatalog from '@/features/sdmt/cost/Catalog/SDMTCatalog';
import SDMTForecast from '@/features/sdmt/cost/Forecast/SDMTForecast';
import SDMTReconciliation from '@/features/sdmt/cost/Reconciliation/SDMTReconciliation';
import SDMTCashflow from '@/features/sdmt/cost/Cashflow/SDMTCashflow';
import SDMTScenarios from '@/features/sdmt/cost/Scenarios/SDMTScenarios';
import SDMTChanges from '@/features/sdmt/cost/Changes/SDMTChanges';

// Home page
import HomePage from '@/features/HomePage';

// Hook to determine current module
function useCurrentModule() {
  const location = useLocation();
  
  if (location.pathname.startsWith('/pmo/')) {
    return 'PMO';
  } else if (location.pathname.startsWith('/sdmt/')) {
    return 'SDMT';
  }
  return undefined;
}

function AppContent() {
  const currentModule = useCurrentModule();
  const location = useLocation();
  const showProjectContextBar = location.pathname.startsWith('/sdmt/');

  return (
    <div className="min-h-screen bg-background">
      <Navigation currentModule={currentModule} />
      {showProjectContextBar && <ProjectContextBar />}
      
      <main>
        <AccessControl>
          <Routes>
            {/* Home */}
            <Route path="/" element={<HomePage />} />
            
            {/* PMO Routes */}
            <Route path="/pmo/prefactura/estimator" element={<PMOEstimatorWizard />} />
            
            {/* SDMT Routes */}
            <Route path="/sdmt/cost/catalog" element={<SDMTCatalog />} />
            <Route path="/sdmt/cost/forecast" element={<SDMTForecast />} />
            <Route path="/sdmt/cost/reconciliation" element={<SDMTReconciliation />} />
            <Route path="/sdmt/cost/cashflow" element={<SDMTCashflow />} />
            <Route path="/sdmt/cost/scenarios" element={<SDMTScenarios />} />
            <Route path="/sdmt/cost/changes" element={<SDMTChanges />} />
            
            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AccessControl>
      </main>
      
      <Toaster position="top-right" />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;