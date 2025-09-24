import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background text-foreground">
        <div className="p-8">
          <h1 className="text-4xl font-bold mb-4">Financial Planning & Management</h1>
          <p className="text-muted-foreground mb-8">Ikusi Digital Platform</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 bg-card rounded-lg border">
              <h2 className="text-xl font-semibold mb-2">PMO Pre-Factura Estimator</h2>
              <p className="text-muted-foreground mb-4">Create baseline budget estimates for project planning</p>
              <a href="/pmo/prefactura/estimator" className="inline-block px-4 py-2 bg-primary text-primary-foreground rounded">
                Open Estimator
              </a>
            </div>
            
            <div className="p-6 bg-card rounded-lg border">
              <h2 className="text-xl font-semibold mb-2">SDMT Cost Management</h2>
              <p className="text-muted-foreground mb-4">Track costs, forecasts, and manage project finances</p>
              <a href="/sdmt/cost/catalog" className="inline-block px-4 py-2 bg-primary text-primary-foreground rounded">
                Open Cost Manager
              </a>
            </div>
          </div>
        </div>
        
        <Routes>
          <Route path="/" element={
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <h3 className="text-2xl font-bold mb-2">Welcome to Financial Planning</h3>
                <p className="text-muted-foreground">Select a module above to get started</p>
              </div>
            </div>
          } />
          
          <Route path="/pmo/prefactura/estimator" element={
            <div className="p-8">
              <h1 className="text-3xl font-bold mb-4">PMO Pre-Factura Estimator</h1>
              <p className="text-muted-foreground">Estimator wizard will be implemented here</p>
            </div>
          } />
          
          <Route path="/sdmt/cost/catalog" element={
            <div className="p-8">
              <h1 className="text-3xl font-bold mb-4">SDMT Cost Catalog</h1>
              <p className="text-muted-foreground">Cost catalog will be implemented here</p>
            </div>
          } />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;