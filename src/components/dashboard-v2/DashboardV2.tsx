/**
 * DashboardV2 - Main Component
 * 
 * Modern, modular dashboard with virtualized grid and single-call data loading.
 * Feature-flagged for safe rollout.
 */

import { useState } from 'react';
import { useDashboardData } from '@/hooks/useDashboardData';
import { TopBar } from './TopBar';
import { ExecutiveSummary } from './ExecutiveSummary';
import { MonthlyBudgetPanel } from './MonthlyBudgetPanel';
import { ForecastGridWrapper } from './ForecastGridWrapper';
import { ForecastChartsPanel } from './ForecastChartsPanel';

export interface DashboardV2Props {
  /** Initial view mode */
  initialViewMode?: 'portfolio' | 'project';
  /** Initial project ID (for project mode) */
  initialProjectId?: string;
  /** Initial period in months */
  initialMonths?: number;
  /** Initial year */
  initialYear?: number;
}

/**
 * DashboardV2 Component
 * 
 * Main orchestration component for the modernized forecast dashboard.
 * Composed of modular sub-components with clear responsibilities.
 * 
 * @example
 * ```tsx
 * <DashboardV2 
 *   initialViewMode="portfolio" 
 *   initialMonths={12} 
 *   initialYear={2024} 
 * />
 * ```
 */
export function DashboardV2({
  initialViewMode = 'portfolio',
  initialProjectId,
  initialMonths = 12,
  initialYear = new Date().getFullYear(),
}: DashboardV2Props) {
  // UI State
  const [viewMode, setViewMode] = useState<'portfolio' | 'project'>(initialViewMode);
  const [projectId, setProjectId] = useState<string | undefined>(initialProjectId);
  const [months, setMonths] = useState<number>(initialMonths);
  const [year, setYear] = useState<number>(initialYear);
  const [isBudgetPanelExpanded, setIsBudgetPanelExpanded] = useState(false);
  
  // Data Fetching via react-query
  const {
    data: dashboardData,
    isLoading,
    error,
    refetch,
  } = useDashboardData({
    viewMode,
    projectId,
    months,
    year,
    enabled: true,
  });
  
  // Derived state
  const hasData = !!dashboardData && !isLoading && !error;
  
  // Feature flags
  const isEditEnabled = import.meta.env.VITE_DASHBOARD_V2_EDIT === 'true';
  const isReadOnly = import.meta.env.VITE_DASHBOARD_V2_READONLY === 'true';
  const canEdit = isEditEnabled && !isReadOnly;
  
  // Layout structure matching DashboardV2 spec
  return (
    <div className="dashboard-v2 flex flex-col h-screen bg-gray-50">
      {/* Position #0: Top Bar */}
      <TopBar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        projectId={projectId}
        onProjectIdChange={setProjectId}
        months={months}
        onMonthsChange={setMonths}
        year={year}
        onYearChange={setYear}
        onRefresh={refetch}
        canEdit={canEdit}
      />
      
      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-600">Loading dashboard data...</div>
          </div>
        )}
        
        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="text-red-800 font-semibold">Error loading dashboard</div>
            <div className="text-red-600 text-sm mt-1">{error.message}</div>
            <button
              onClick={() => refetch()}
              className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        )}
        
        {/* Dashboard Content */}
        {hasData && (
          <>
            {/* Position #1: Executive Summary KPI Strip */}
            <ExecutiveSummary
              summary={dashboardData.summary}
              metadata={dashboardData.metadata}
            />
            
            {/* Position #2: Monthly Budget Panel (Collapsible) */}
            <MonthlyBudgetPanel
              year={year}
              isExpanded={isBudgetPanelExpanded}
              onToggleExpanded={() => setIsBudgetPanelExpanded(!isBudgetPanelExpanded)}
              canEdit={canEdit}
            />
            
            {/* Position #3: Forecast Grid (Virtualized) */}
            <ForecastGridWrapper
              data={dashboardData}
              months={months}
              year={year}
              canEdit={canEdit}
            />
            
            {/* Position #5: Charts Panel */}
            <ForecastChartsPanel
              data={dashboardData}
              months={months}
            />
          </>
        )}
      </div>
    </div>
  );
}

export default DashboardV2;
