/**
 * SDMTForecastV2.tsx
 * 
 * Main orchestrator component for the SDMT Forecast Dashboard V2.
 * Composes five key positions in a modular, DashboardLayout-based structure:
 * 
 * Position #1: ExecutiveSummaryCard - KPI tiles for high-level metrics
 * Position #2: PayrollMonthlyBudget - Monthly budget management (collapsed by default)
 * Position #3: ForecastMonthlyGrid - Monthly forecast data grid (expanded by default)
 * Position #4: MatrizExecutiveBar - Executive summary bar with actions (collapsed)
 * Position #5: ChartsPanelV2 - Trend and variance charts (collapsed)
 * 
 * Features:
 * - Portfolio and single-project view modes
 * - Session-persisted UI state (collapsed panels, budget year)
 * - Real-time data loading from API
 * - Monthly budget management with year selector
 * - Responsive design with DashboardLayout wrapper
 */

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Save, Download, FileSpreadsheet, Eye, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { DashboardLayout } from '@/components/ui/design-system/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { ALL_PROJECTS_ID, useProject } from '@/contexts/ProjectContext';
import { useProjectLineItems } from '@/hooks/useProjectLineItems';
import { computeTotals, computeVariance } from '@/lib/forecast/analytics';
import { normalizeForecastRowForServer } from './utils/normalizeForServer';
import { getBaselineDuration } from './monthHelpers';
import { ExecutiveSummaryCard } from './components/ExecutiveSummaryCard';
import { PayrollMonthlyBudget } from './components/PayrollMonthlyBudget';
import { ForecastMonthlyGrid } from './components/ForecastMonthlyGrid';
import { MatrizExecutiveBar } from './components/MatrizExecutiveBar';
import { ChartsPanelV2 } from './components/ChartsPanelV2';
import LoadingSpinner from '@/components/LoadingSpinner';
import type { ForecastCell, LineItem } from '@/types/domain';
import type { BaselineDetail } from '@/api/finanzas';

// Types
type ForecastRow = ForecastCell & {
  projectId?: string;
  projectName?: string;
  rubroId?: string;
  description?: string;
  category?: string;
};

type ProjectLineItem = LineItem & { 
  projectId?: string; 
  projectName?: string;
};

/**
 * Main SDMTForecastV2 component
 */
export function SDMTForecastV2() {
  // ==================== STATE DECLARATIONS ====================
  
  // Core data state
  const [forecastData, setForecastData] = useState<ForecastRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Budget state
  const [budgetYear, setBudgetYear] = useState<number>(() => {
    const stored = sessionStorage.getItem('forecastV2BudgetYear');
    return stored ? parseInt(stored, 10) : new Date().getFullYear();
  });
  
  const [monthlyBudgets, setMonthlyBudgets] = useState<number[]>(() => {
    const stored = sessionStorage.getItem('forecastV2MonthlyBudgets');
    return stored ? JSON.parse(stored) : Array(12).fill(0);
  });
  
  const [useMonthlyBudget, setUseMonthlyBudget] = useState<boolean>(() => {
    const stored = sessionStorage.getItem('forecastV2UseMonthlyBudget');
    return stored === 'true';
  });
  
  // UI state (persisted to sessionStorage)
  const [isChartsPanelOpen, setIsChartsPanelOpen] = useState(() => {
    const stored = sessionStorage.getItem('forecastChartsPanelOpen');
    return stored === 'true'; // Default to false (collapsed)
  });
  
  const [isMatrizCollapsed, setIsMatrizCollapsed] = useState(() => {
    const stored = sessionStorage.getItem('forecastV2MatrizCollapsed');
    return stored !== 'false'; // Default to true (collapsed)
  });
  
  // Saving state
  const [savingBudget, setSavingBudget] = useState(false);
  
  // ==================== HOOKS ====================
  
  const { user } = useAuth();
  const {
    selectedProjectId,
    setSelectedProjectId,
    selectedPeriod,
    currentProject,
    projects,
  } = useProject();
  
  const {
    lineItems,
    isLoading: isLineItemsLoading,
    error: lineItemsError,
  } = useProjectLineItems({
    useFallback: true,
    baselineId: currentProject?.baselineId,
    withTaxonomy: true,
  });
  
  // ==================== COMPUTED VALUES ====================
  
  const isPortfolioView = selectedProjectId === ALL_PROJECTS_ID;
  
  const safeLineItems = useMemo(
    () => (Array.isArray(lineItems) ? lineItems : []),
    [lineItems]
  );
  
  const baselineDetail: BaselineDetail | null = useMemo(() => {
    if (!currentProject?.baselineId) return null;
    // In a real implementation, fetch this from API
    // For now, return mock data
    return {
      baseline_id: currentProject.baselineId,
      payload: { duration_months: 60 },
    } as BaselineDetail;
  }, [currentProject?.baselineId]);
  
  const monthsToShow = useMemo(() => {
    return baselineDetail ? getBaselineDuration(baselineDetail) : 60;
  }, [baselineDetail]);
  
  const canEditBudget = useMemo(() => {
    // Only allow editing in portfolio view
    return isPortfolioView && !!user;
  }, [isPortfolioView, user]);
  
  // ==================== COMPUTED KPIs ====================
  
  /**
   * Compute summary KPIs from forecast data
   */
  const summaryKpis = useMemo(() => {
    if (!forecastData || forecastData.length === 0) {
      return null;
    }
    
    // Aggregate forecast data across all months
    let presupuesto = 0;
    let pronostico = 0;
    let real = 0;
    
    forecastData.forEach((row) => {
      for (let month = 1; month <= 12; month++) {
        const planned = Number(row[`month_${month}_planned`] || 0);
        const forecast = Number(row[`month_${month}_forecast`] || 0);
        const actual = Number(row[`month_${month}_actual`] || 0);
        
        presupuesto += planned;
        pronostico += forecast;
        real += actual;
      }
    });
    
    const consumo = presupuesto > 0 ? (real / presupuesto) * 100 : 0;
    const varianza = pronostico - presupuesto;
    
    return {
      presupuesto,
      pronostico,
      real,
      consumo,
      varianza,
    };
  }, [forecastData]);
  
  /**
   * Compute monthly trends for charts
   */
  const monthlyTrends = useMemo(() => {
    if (!forecastData || forecastData.length === 0) {
      return [];
    }
    
    const trends = [];
    for (let month = 1; month <= 12; month++) {
      let value = 0;
      forecastData.forEach((row) => {
        value += Number(row[`month_${month}_forecast`] || 0);
      });
      trends.push({ month, value });
    }
    return trends;
  }, [forecastData]);
  
  /**
   * Compute variance series for charts
   */
  const varianceSeries = useMemo(() => {
    if (!forecastData || forecastData.length === 0) {
      return [];
    }
    
    const series = [];
    for (let month = 1; month <= 12; month++) {
      let planned = 0;
      let forecast = 0;
      forecastData.forEach((row) => {
        planned += Number(row[`month_${month}_planned`] || 0);
        forecast += Number(row[`month_${month}_forecast`] || 0);
      });
      series.push({ month, value: forecast - planned });
    }
    return series;
  }, [forecastData]);
  
  // ==================== EFFECT HOOKS ====================
  
  /**
   * Load forecast data when project changes
   */
  useEffect(() => {
    const loadForecastData = async () => {
      if (!selectedProjectId) {
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        setError(null);
        
        // TODO: Replace with actual API call
        // For now, generate mock data based on line items
        const mockData: ForecastRow[] = safeLineItems.map((item) => {
          const row: ForecastRow = {
            line_item_id: item.line_item_id,
            rubroId: item.line_item_id,
            description: item.description || '',
            category: item.category || '',
          };
          
          // Generate random forecast values for each month
          for (let month = 1; month <= monthsToShow; month++) {
            const baseValue = Math.random() * 100000;
            row[`month_${month}_planned`] = baseValue;
            row[`month_${month}_forecast`] = baseValue * (0.9 + Math.random() * 0.2);
            row[`month_${month}_actual`] = month <= new Date().getMonth() + 1 
              ? baseValue * (0.8 + Math.random() * 0.3) 
              : 0;
          }
          
          return row;
        });
        
        setForecastData(mockData);
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (err) {
        console.error('[SDMTForecastV2] Error loading forecast data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load forecast data');
        toast.error('Error al cargar datos de pronóstico');
      } finally {
        setLoading(false);
      }
    };
    
    loadForecastData();
  }, [selectedProjectId, safeLineItems, monthsToShow]);
  
  /**
   * Persist budget year to sessionStorage
   */
  useEffect(() => {
    sessionStorage.setItem('forecastV2BudgetYear', String(budgetYear));
  }, [budgetYear]);
  
  /**
   * Persist monthly budgets to sessionStorage
   */
  useEffect(() => {
    sessionStorage.setItem('forecastV2MonthlyBudgets', JSON.stringify(monthlyBudgets));
  }, [monthlyBudgets]);
  
  /**
   * Persist useMonthlyBudget to sessionStorage
   */
  useEffect(() => {
    sessionStorage.setItem('forecastV2UseMonthlyBudget', String(useMonthlyBudget));
  }, [useMonthlyBudget]);
  
  // ==================== EVENT HANDLERS ====================
  
  /**
   * Handle charts panel open/close
   */
  const handleChartsPanelOpenChange = (open: boolean) => {
    setIsChartsPanelOpen(open);
    sessionStorage.setItem('forecastChartsPanelOpen', String(open));
  };
  
  /**
   * Handle matriz collapsed state
   */
  const handleMatrizToggle = (isOpen: boolean) => {
    setIsMatrizCollapsed(!isOpen);
    sessionStorage.setItem('forecastV2MatrizCollapsed', String(!isOpen));
  };
  
  /**
   * Handle year change for monthly budget
   */
  const handleYearChange = async (year: number) => {
    setBudgetYear(year);
    
    // TODO: Load monthly budgets for new year from API
    // For now, reset to zeros
    setMonthlyBudgets(Array(12).fill(0));
    setUseMonthlyBudget(false);
    
    toast.info(`Año cambiado a ${year}`);
  };
  
  /**
   * Handle save monthly budget
   */
  const handleSaveMonthlyBudget = async () => {
    if (!canEditBudget) {
      toast.error('No tiene permisos para editar presupuestos');
      return;
    }
    
    try {
      setSavingBudget(true);
      
      // TODO: Save to API
      // await finanzasClient.putAllInBudgetMonthly(budgetYear, 'USD', monthlyBudgets);
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 800));
      
      toast.success(`Presupuesto mensual guardado para ${budgetYear}`);
      
    } catch (err) {
      console.error('[SDMTForecastV2] Error saving monthly budget:', err);
      toast.error('Error al guardar presupuesto mensual');
    } finally {
      setSavingBudget(false);
    }
  };
  
  /**
   * Handle export to Excel
   */
  const handleExportExcel = () => {
    toast.info('Exportar a Excel - Próximamente');
  };
  
  /**
   * Handle export to PDF
   */
  const handleExportPDF = () => {
    toast.info('Exportar a PDF - Próximamente');
  };
  
  /**
   * Handle save forecast data
   */
  const handleSaveForecast = () => {
    toast.info('Guardar pronóstico - Próximamente');
  };
  
  /**
   * Handle matriz action buttons
   */
  const handleMatrizAction = (action: string) => {
    console.log('[SDMTForecastV2] Matriz action:', action);
    toast.info(`Acción: ${action} - Próximamente`);
  };
  
  // ==================== RENDER ====================
  
  // Loading state
  if (loading || isLineItemsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }
  
  // Error state
  if (error || lineItemsError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-2">Error</h2>
          <p className="text-gray-600">{error || lineItemsError}</p>
        </div>
      </div>
    );
  }
  
  return (
    <DashboardLayout maxWidth="full" className="py-6">
      {/* Top Bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 px-6">
        {/* Left side - Project selector and view mode */}
        <div className="flex items-center gap-4">
          <Select
            value={selectedProjectId}
            onValueChange={setSelectedProjectId}
          >
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Seleccionar proyecto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_PROJECTS_ID}>
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  <span>Todos los Proyectos (Portafolio)</span>
                </div>
              </SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.project_id} value={project.project_id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Badge variant={isPortfolioView ? 'default' : 'secondary'}>
            {isPortfolioView ? 'Vista Portafolio' : 'Vista Proyecto'}
          </Badge>
        </div>
        
        {/* Right side - Period selector and actions */}
        <div className="flex items-center gap-3">
          <Select value={String(budgetYear)} onValueChange={(val) => handleYearChange(Number(val))}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2023, 2024, 2025, 2026].map((year) => (
                <SelectItem key={year} value={String(year)}>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>{year}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button
            onClick={handleSaveForecast}
            variant="default"
            size="sm"
            disabled={savingBudget}
          >
            <Save className="h-4 w-4 mr-2" />
            Guardar
          </Button>
          
          <Button
            onClick={handleExportExcel}
            variant="outline"
            size="sm"
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Excel
          </Button>
          
          <Button
            onClick={handleExportPDF}
            variant="outline"
            size="sm"
          >
            <Download className="h-4 w-4 mr-2" />
            PDF
          </Button>
        </div>
      </div>
      
      {/* Main Content - 5 Positions */}
      <div className="space-y-6 px-6">
        {/* Position #1: Executive Summary Card */}
        <ExecutiveSummaryCard summaryBarKpis={summaryKpis} />
        
        {/* Position #2: Payroll Monthly Budget (collapsed by default) */}
        {isPortfolioView && (
          <PayrollMonthlyBudget
            budgetYear={budgetYear}
            monthlyBudgets={monthlyBudgets}
            onChangeMonthlyBudgets={setMonthlyBudgets}
            onSave={handleSaveMonthlyBudget}
            useMonthlyBudget={useMonthlyBudget}
            setUseMonthlyBudget={setUseMonthlyBudget}
            canEditBudget={canEditBudget}
            onYearChange={handleYearChange}
          />
        )}
        
        {/* Position #3: Forecast Monthly Grid (expanded by default) */}
        <ForecastMonthlyGrid
          forecastData={forecastData}
          lineItems={safeLineItems}
          months={monthsToShow}
          maxMonths={60}
          showRangeIcon={false}
          defaultExpanded={true}
          monthlyBudgets={monthlyBudgets}
          useMonthlyBudget={useMonthlyBudget}
        />
        
        {/* Position #4: Matriz Executive Bar (collapsed to summary only) */}
        {summaryKpis && (
          <MatrizExecutiveBar
            totals={summaryKpis}
            isCollapsedDefault={isMatrizCollapsed}
            onToggle={handleMatrizToggle}
            onAction={handleMatrizAction}
          />
        )}
        
        {/* Position #5: Charts Panel V2 (collapsed) */}
        <ChartsPanelV2
          monthlyTrends={monthlyTrends}
          varianceSeries={varianceSeries}
          isOpen={isChartsPanelOpen}
          onOpenChange={handleChartsPanelOpenChange}
          isPortfolioView={isPortfolioView}
          monthlyBudgets={monthlyBudgets}
        />
      </div>
    </DashboardLayout>
  );
}
