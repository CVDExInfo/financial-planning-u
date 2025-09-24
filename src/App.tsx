import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';

import { Navigation } from '@/components/Navigation';
import { ProjectContextBar } from '@/components/ProjectContextBar';
import { RoleProvider } from '@/components/RoleProvider';

// PMO Routes
import { EstimatorWizard } from '@/features/pmo/prefactura/EstimatorWizard';

// SDMT Routes  
import { CostCatalog } from '@/features/sdmt/cost/Catalog/CostCatalog';
import { ForecastGrid } from '@/features/sdmt/cost/Forecast/ForecastGrid';
import { Reconciliation } from '@/features/sdmt/cost/Recon/Reconciliation';
import { CashFlowAnalysis } from '@/features/sdmt/cost/Cashflow/CashFlowAnalysis';
import { ScenarioManager } from '@/features/sdmt/cost/Scenarios/ScenarioManager';
import { ChangeManager } from '@/features/sdmt/cost/Changes/ChangeManager';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  const [currentModule, setCurrentModule] = useState<'PMO' | 'SDMT'>('PMO');

  return (
    <QueryClientProvider client={queryClient}>
      <RoleProvider>
        <BrowserRouter>
          <div className="min-h-screen bg-background">
            <Navigation 
              currentModule={currentModule} 
              onModuleChange={setCurrentModule} 
            />
            
            <Routes>
              {/* Root redirect */}
              <Route path="/" element={<Navigate to="/pmo/prefactura/estimator" replace />} />
              
              {/* PMO Routes */}
              <Route 
                path="/pmo/prefactura/estimator" 
                element={
                  <div>
                    <EstimatorWizard />
                  </div>
                } 
              />
              
              {/* SDMT Routes - All include ProjectContextBar */}
              <Route 
                path="/sdmt/cost/catalog" 
                element={
                  <div>
                    <ProjectContextBar />
                    <CostCatalog />
                  </div>
                } 
              />
              <Route 
                path="/sdmt/cost/forecast" 
                element={
                  <div>
                    <ProjectContextBar />
                    <ForecastGrid />
                  </div>
                } 
              />
              <Route 
                path="/sdmt/cost/recon" 
                element={
                  <div>
                    <ProjectContextBar />
                    <Reconciliation />
                  </div>
                } 
              />
              <Route 
                path="/sdmt/cost/cashflow" 
                element={
                  <div>
                    <ProjectContextBar />
                    <CashFlowAnalysis />
                  </div>
                } 
              />
              <Route 
                path="/sdmt/cost/scenarios" 
                element={
                  <div>
                    <ProjectContextBar />
                    <ScenarioManager />
                  </div>
                } 
              />
              <Route 
                path="/sdmt/cost/changes" 
                element={
                  <div>
                    <ProjectContextBar />
                    <ChangeManager />
                  </div>
                } 
              />
            </Routes>
            
            <Toaster position="top-right" />
          </div>
        </BrowserRouter>
      </RoleProvider>
    </QueryClientProvider>
  );
}

export default App;