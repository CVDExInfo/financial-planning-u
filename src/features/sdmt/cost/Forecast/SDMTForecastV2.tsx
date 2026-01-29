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

import { useState, useEffect, useMemo, useRef } from 'react';
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
import { normalizeForecastCells } from '@/features/sdmt/cost/utils/dataAdapters';
import { getForecastPayload, getProjectInvoices } from './forecastService';
import finanzasClient from '@/api/finanzasClient';
import { getAllocations } from '@/api/finanzas';
import { getProjectRubros } from '@/api/finanzas';
import { isBudgetNotFoundError, resolveAnnualBudgetState } from './budgetState';
import { transformLineItemsToForecast } from './transformLineItemsToForecast';
import { computeForecastFromAllocations, type Allocation } from './computeForecastFromAllocations';
import { buildCanonicalMatrix, deriveKpisFromMatrix, type CanonicalMatrixRow } from '../utils/canonicalMatrix';
import { ExcelExporter } from '@/lib/excel-export';
import { PDFExporter } from '@/lib/pdf-export';

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
  const [canonicalMatrix, setCanonicalMatrix] = useState<CanonicalMatrixRow[]>([]);
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
  
  // Baseline detail state
  const [baselineDetail, setBaselineDetail] = useState<BaselineDetail | null>(null);
  
  /**
   * Load baseline detail from API
   */
  useEffect(() => {
    const loadBaselineDetail = async () => {
      if (!currentProject?.baselineId) {
        setBaselineDetail(null);
        return;
      }
      
      try {
        // Import getBaselineById from finanzas API
        const { getBaselineById } = await import('@/api/finanzas');
        const detail = await getBaselineById(currentProject.baselineId);
        setBaselineDetail(detail);
      } catch (err) {
        console.error('[SDMTForecastV2] Error loading baseline detail:', err);
        // Fallback to default duration if baseline fetch fails
        setBaselineDetail({
          baseline_id: currentProject.baselineId,
          payload: { duration_months: 60 },
        } as BaselineDetail);
      }
    };
    
    loadBaselineDetail();
  }, [currentProject?.baselineId]);
  
  const monthsToShow = useMemo(() => {
    return baselineDetail ? getBaselineDuration(baselineDetail) : 60;
  }, [baselineDetail]);
  
  const canEditBudget = useMemo(() => {
    // Only allow editing in portfolio view
    return isPortfolioView && !!user;
  }, [isPortfolioView, user]);
  
  // ==================== REFS & HELPERS ====================
  
  // Request tracking ref to prevent race conditions
  const latestRequestKeyRef = useRef<string>("");
  
  // Helper function to resolve baseline status
  const resolveBaselineStatus = (project: { baselineStatus?: string; baseline_status?: string } | null): string => {
    if (!project) return '';
    return project.baselineStatus || project.baseline_status || '';
  };
  
  // ==================== COMPUTED KPIs ====================
  
  /**
   * Compute summary KPIs from canonical matrix
   */
  const summaryKpis = useMemo(() => {
    if (!canonicalMatrix || canonicalMatrix.length === 0) {
      return null;
    }
    
    return deriveKpisFromMatrix(canonicalMatrix, monthsToShow);
  }, [canonicalMatrix, monthsToShow]);
  
  /**
   * Compute monthly trends for charts from canonical matrix
   */
  const monthlyTrends = useMemo(() => {
    if (!canonicalMatrix || canonicalMatrix.length === 0) {
      return [];
    }
    
    const trends = [];
    for (let month = 1; month <= Math.min(12, monthsToShow); month++) {
      let value = 0;
      canonicalMatrix.forEach((row) => {
        value += (row as any)[`month_${month}_forecast`] || 0;
      });
      trends.push({ month, value });
    }
    return trends;
  }, [canonicalMatrix, monthsToShow]);
  
  /**
   * Compute variance series for charts from canonical matrix
   */
  const varianceSeries = useMemo(() => {
    if (!canonicalMatrix || canonicalMatrix.length === 0) {
      return [];
    }
    
    const series = [];
    for (let month = 1; month <= Math.min(12, monthsToShow); month++) {
      let planned = 0;
      let forecast = 0;
      canonicalMatrix.forEach((row) => {
        planned += (row as any)[`month_${month}_planned`] || 0;
        forecast += (row as any)[`month_${month}_forecast`] || 0;
      });
      series.push({ month, value: forecast - planned });
    }
    return series;
  }, [canonicalMatrix, monthsToShow]);
  
  // ==================== DATA LOADING FUNCTIONS ====================
  
  /**
   * Load forecast data for a single project
   */
  const loadSingleProjectForecast = async (
    projectId: string,
    months: number,
    requestKey: string
  ) => {
    const payload = await getForecastPayload(projectId, months);
    
    // Check if request is still valid
    if (latestRequestKeyRef.current !== requestKey) {
      return;
    }
    
    const debugMode = import.meta.env.DEV;
    let normalized = normalizeForecastCells(payload.data, {
      baselineId: currentProject?.baselineId,
      debugMode,
    });
    
    const baselineStatus = resolveBaselineStatus(currentProject as any);
    const hasAcceptedBaseline = baselineStatus === 'accepted';
    
    // Fallback: If server forecast is empty and we have line items, use them
    if (
      (!normalized || normalized.length === 0) &&
      safeLineItems &&
      safeLineItems.length > 0 &&
      hasAcceptedBaseline
    ) {
      if (import.meta.env.DEV) {
        console.debug(
          `[SDMTForecastV2] Using baseline fallback for ${projectId}, baseline ${currentProject?.baselineId}: ${safeLineItems.length} line items`
        );
      }
      normalized = transformLineItemsToForecast(safeLineItems, months, projectId);
    }
    
    // Get matched invoices and sync with actuals
    const invoices = await getProjectInvoices(projectId);
    
    // Check again after async operation
    if (latestRequestKeyRef.current !== requestKey) {
      return;
    }
    
    const matchedInvoices = invoices.filter((inv) => inv.status === 'Matched');
    
    const updatedData: ForecastRow[] = normalized.map((cell) => {
      const matchedInvoice = matchedInvoices.find(
        (inv) =>
          inv.line_item_id === cell.line_item_id && inv.month === cell.month
      );
      
      return matchedInvoice
        ? {
            ...cell,
            actual: matchedInvoice.amount || 0,
            variance: cell.forecast - cell.planned,
          }
        : cell;
    });
    
    setForecastData(updatedData);
  };
  
  /**
   * Load forecast data for portfolio view (all projects)
   */
  const loadPortfolioForecast = async (months: number, requestKey: string) => {
    const candidateProjects = projects.filter(
      (project) => project.id && project.id !== ALL_PROJECTS_ID
    );
    
    if (candidateProjects.length === 0) {
      if (import.meta.env.DEV) {
        console.debug('[SDMTForecastV2] No candidate projects for portfolio view');
      }
      setForecastData([]);
      return;
    }
    
    const portfolioResults = await Promise.all(
      candidateProjects.map(async (project) => {
        try {
          const [payload, invoices, projectLineItems, allocations] = await Promise.all([
            getForecastPayload(project.id, months),
            getProjectInvoices(project.id),
            getProjectRubros(project.id).catch(() => [] as LineItem[]),
            getAllocations(project.id, project.baselineId).catch(() => [] as Allocation[]),
          ]);
          
          // Check if request is still valid
          if (latestRequestKeyRef.current !== requestKey) {
            return null;
          }
          
          const debugMode = import.meta.env.DEV;
          let normalized = normalizeForecastCells(payload.data, {
            baselineId: project.baselineId,
            debugMode,
          });
          
          const baselineStatus = resolveBaselineStatus(project as any);
          const hasAcceptedBaseline = baselineStatus === 'accepted';
          
          // Fallback hierarchy: allocations -> lineItems
          if (
            (!normalized || normalized.length === 0) &&
            allocations &&
            allocations.length > 0 &&
            hasAcceptedBaseline
          ) {
            normalized = computeForecastFromAllocations(allocations, projectLineItems, months, project.id);
          } else if (
            (!normalized || normalized.length === 0) &&
            projectLineItems &&
            projectLineItems.length > 0 &&
            hasAcceptedBaseline
          ) {
            normalized = transformLineItemsToForecast(projectLineItems, months, project.id);
          }
          
          // Sync with invoices
          const matchedInvoices = invoices.filter((inv) => inv.status === 'Matched');
          const projectData: ForecastRow[] = normalized.map((cell) => {
            const matchedInvoice = matchedInvoices.find(
              (inv) =>
                inv.line_item_id === cell.line_item_id && inv.month === cell.month
            );
            
            return {
              ...cell,
              projectId: project.id,
              projectName: project.name || project.id,
              actual: matchedInvoice ? matchedInvoice.amount || 0 : cell.actual || 0,
            };
          });
          
          return projectData;
        } catch (error) {
          console.error(`[SDMTForecastV2] Error loading project ${project.id}:`, error);
          return [];
        }
      })
    );
    
    // Check if request is still valid after all promises
    if (latestRequestKeyRef.current !== requestKey) {
      return;
    }
    
    const allData = portfolioResults.flat().filter((row): row is ForecastRow => row !== null);
    setForecastData(allData);
  };
  
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
      
      // Generate unique request key to prevent race conditions
      const requestKey = `${selectedProjectId}-${Date.now()}`;
      latestRequestKeyRef.current = requestKey;
      
      try {
        setLoading(true);
        setError(null);
        
        if (isPortfolioView) {
          // Portfolio view: load all projects
          await loadPortfolioForecast(monthsToShow, requestKey);
        } else {
          // Single project view
          await loadSingleProjectForecast(selectedProjectId, monthsToShow, requestKey);
        }
        
      } catch (err) {
        console.error('[SDMTForecastV2] Error loading forecast data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load forecast data');
        toast.error('Error al cargar datos de pronóstico');
      } finally {
        setLoading(false);
      }
    };
    
    loadForecastData();
  }, [selectedProjectId, monthsToShow, isPortfolioView, projects]);
  
  /**
   * Rebuild canonical matrix whenever forecast data changes
   */
  useEffect(() => {
    if (!forecastData || forecastData.length === 0) {
      setCanonicalMatrix([]);
      return;
    }
    
    try {
      // Build canonical matrix from current forecast data
      // Group forecast data by project
      const forecastsByProject: Record<string, ForecastCell[]> = {};
      forecastData.forEach(row => {
        const projectId = row.projectId || selectedProjectId || 'unknown';
        if (!forecastsByProject[projectId]) {
          forecastsByProject[projectId] = [];
        }
        
        // Convert row to ForecastCell format
        const cells: ForecastCell[] = [];
        for (let month = 1; month <= monthsToShow; month++) {
          const plannedKey = `month_${month}_planned`;
          const forecastKey = `month_${month}_forecast`;
          const actualKey = `month_${month}_actual`;
          
          if ((row as any)[plannedKey] !== undefined || (row as any)[forecastKey] !== undefined) {
            cells.push({
              line_item_id: row.line_item_id,
              month,
              planned: (row as any)[plannedKey] || 0,
              forecast: (row as any)[forecastKey] || 0,
              actual: (row as any)[actualKey] || 0,
              variance: ((row as any)[forecastKey] || 0) - ((row as any)[plannedKey] || 0),
              last_updated: row.last_updated || new Date().toISOString(),
              updated_by: row.updated_by || 'system',
            });
          }
        }
        
        forecastsByProject[projectId].push(...cells);
      });
      
      // Build forecastPayloads array
      const forecastPayloads = Object.entries(forecastsByProject).map(([projectId, data]) => ({
        projectId,
        data,
      }));
      
      // Get unique project IDs and build projects array
      const projectIds = Array.from(new Set(forecastData.map(row => row.projectId || selectedProjectId).filter(Boolean)));
      const projectsList = projectIds.map(id => {
        const project = projects.find(p => p.id === id);
        return {
          id: id as string,
          name: project?.name || (forecastData.find(row => row.projectId === id)?.projectName) || id as string,
        };
      });
      
      // Build canonical matrix
      const result = buildCanonicalMatrix({
        projects: projectsList,
        forecastPayloads,
        monthsToShow,
      });
      
      setCanonicalMatrix(result.matrixRows);
    } catch (err) {
      console.error('[SDMTForecastV2] Error building canonical matrix:', err);
    }
  }, [forecastData, monthsToShow, selectedProjectId, projects]);
  
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
  
  /**
   * Load monthly budgets when year or portfolio view changes
   */
  useEffect(() => {
    const loadMonthlyBudget = async () => {
      if (!isPortfolioView) return; // Monthly budgets only in portfolio view
      
      try {
        const monthlyBudget = await finanzasClient.getAllInBudgetMonthly(budgetYear);
        if (!monthlyBudget) {
          setMonthlyBudgets(Array(12).fill(0));
          setUseMonthlyBudget(false);
          return;
        }
        
        if (monthlyBudget && monthlyBudget.months) {
          // Convert from API format to internal format
          const budgets = monthlyBudget.months
            .map((m) => {
              const monthMatch = m.month.match(/^\d{4}-(\d{2})$/);
              const monthNum = monthMatch ? parseInt(monthMatch[1], 10) : 0;
              return {
                month: monthNum,
                budget: m.amount,
              };
            })
            .filter((b) => b.month >= 1 && b.month <= 12);
          
          // Create array with 12 months, filling in budgets
          const monthlyBudgetArray = Array(12).fill(0);
          budgets.forEach((b) => {
            if (b.month >= 1 && b.month <= 12) {
              monthlyBudgetArray[b.month - 1] = b.budget;
            }
          });
          
          setMonthlyBudgets(monthlyBudgetArray);
          
          // Enable monthly budget if we have data
          if (budgets.length > 0) {
            setUseMonthlyBudget(true);
          }
        } else {
          setMonthlyBudgets(Array(12).fill(0));
        }
      } catch (error: any) {
        // If 404, no budgets are set for this year - that's okay, no toast needed
        if (isBudgetNotFoundError(error)) {
          if (import.meta.env.DEV) {
            console.warn(`[SDMTForecastV2] Monthly budget not found for ${budgetYear} (404 - No hay presupuesto)`);
          }
          setMonthlyBudgets(Array(12).fill(0));
          setUseMonthlyBudget(false);
          // No toast for 404 - this is expected when no budget is set
        } else {
          console.error('[SDMTForecastV2] Error loading monthly budget:', error);
          // Only toast for actual errors, not 404
          toast.error('Error al cargar presupuesto mensual');
        }
      }
    };
    
    loadMonthlyBudget();
  }, [budgetYear, isPortfolioView]);
  
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
    // Monthly budgets will be loaded by the useEffect
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
      
      // Convert monthly budgets to API format
      const months = monthlyBudgets.map((budget, index) => ({
        month: `${budgetYear}-${String(index + 1).padStart(2, '0')}`,
        amount: budget,
      }));
      
      await finanzasClient.putAllInBudgetMonthly(budgetYear, 'USD', months);
      
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
  const handleExportExcel = async () => {
    try {
      if (!canonicalMatrix || canonicalMatrix.length === 0) {
        toast.warning('No hay datos para exportar');
        return;
      }
      
      toast.info('Generando archivo Excel...');
      
      const exporter = new ExcelExporter();
      
      // Convert canonical matrix rows to ForecastCell format for export
      const exportCells: ForecastCell[] = [];
      canonicalMatrix.forEach(row => {
        for (let month = 1; month <= monthsToShow; month++) {
          exportCells.push({
            line_item_id: row.lineItemId,
            month,
            planned: (row as any)[`month_${month}_planned`] || 0,
            forecast: (row as any)[`month_${month}_forecast`] || 0,
            actual: (row as any)[`month_${month}_actual`] || 0,
            variance: ((row as any)[`month_${month}_forecast`] || 0) - ((row as any)[`month_${month}_planned`] || 0),
            last_updated: row.lastUpdated || new Date().toISOString(),
            updated_by: row.updatedBy || 'system',
          });
        }
      });
      
      const buffer = await exporter.exportForecastGrid(exportCells, safeLineItems);
      
      // Download the file
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `forecast-${isPortfolioView ? 'portfolio' : selectedProjectId}-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Archivo Excel generado correctamente');
    } catch (err) {
      console.error('[SDMTForecastV2] Error exporting to Excel:', err);
      toast.error('Error al exportar a Excel');
    }
  };
  
  /**
   * Handle export to PDF
   */
  const handleExportPDF = async () => {
    try {
      if (!summaryKpis || !canonicalMatrix || canonicalMatrix.length === 0) {
        toast.warning('No hay datos para exportar');
        return;
      }
      
      toast.info('Generando PDF...');
      
      const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-MX', {
          style: 'currency',
          currency: 'MXN',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(value);
      };
      
      const reportData = {
        title: 'Pronóstico SDMT - Vista Ejecutiva',
        subtitle: isPortfolioView ? 'Vista Portafolio' : currentProject?.name || selectedProjectId,
        generated: new Date().toISOString(),
        metrics: [
          {
            label: 'Presupuesto',
            value: formatCurrency(summaryKpis.presupuesto),
            color: '#3b82f6',
          },
          {
            label: 'Pronóstico',
            value: formatCurrency(summaryKpis.pronostico),
            color: '#8b5cf6',
          },
          {
            label: 'Real',
            value: formatCurrency(summaryKpis.real),
            color: '#10b981',
          },
          {
            label: 'Consumo',
            value: `${summaryKpis.consumo.toFixed(1)}%`,
            color: '#f59e0b',
          },
          {
            label: 'Varianza',
            value: formatCurrency(summaryKpis.varianza),
            changeType: summaryKpis.varianza >= 0 ? 'positive' : 'negative',
            color: summaryKpis.varianza >= 0 ? '#10b981' : '#ef4444',
          },
        ],
        summary: [
          `Total de líneas de costos: ${canonicalMatrix.length}`,
          `Período: ${monthsToShow} meses`,
          `Generado: ${new Date().toLocaleDateString('es-MX')}`,
        ],
      };
      
      const htmlContent = PDFExporter.generateHTMLReport(reportData);
      
      // Open in new window for printing/PDF save
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 500);
      }
      
      toast.success('PDF abierto para imprimir/guardar');
    } catch (err) {
      console.error('[SDMTForecastV2] Error exporting to PDF:', err);
      toast.error('Error al exportar a PDF');
    }
  };
  
  /**
   * Handle save forecast data with optimistic UI and rollback
   */
  const handleSaveForecast = async () => {
    if (!user) {
      toast.error('Debe iniciar sesión para guardar');
      return;
    }
    
    if (!forecastData || forecastData.length === 0) {
      toast.warning('No hay datos para guardar');
      return;
    }
    
    if (!selectedProjectId || selectedProjectId === ALL_PROJECTS_ID) {
      toast.error('Seleccione un proyecto específico para guardar');
      return;
    }
    
    // Save current state for potential rollback
    const previousData = [...forecastData];
    
    try {
      setSavingBudget(true);
      
      // Optimistic UI update - show saving state
      toast.info('Guardando pronóstico...');
      
      // Normalize forecast data for server
      const normalizedData = forecastData.map(row => {
        return normalizeForecastRowForServer(row as any);
      });
      
      // Call bulk upsert API using finanzasClient
      await finanzasClient.bulkUpsertForecast(selectedProjectId, normalizedData);
      
      toast.success('Pronóstico guardado correctamente');
      
    } catch (err) {
      console.error('[SDMTForecastV2] Error saving forecast:', err);
      
      // Rollback to previous data
      setForecastData(previousData);
      
      toast.error('Error al guardar pronóstico. Los cambios se han revertido.');
    } finally {
      setSavingBudget(false);
    }
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
      <div className="col-span-12 mb-6 flex flex-wrap items-center justify-between gap-4 px-6">
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
      <div className="col-span-12 space-y-6 px-6">
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

export default SDMTForecastV2;
