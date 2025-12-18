import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Share2, TrendingUp, TrendingDown, ExternalLink, FileSpreadsheet, Info } from 'lucide-react';
import { toast } from 'sonner';
import { ChartInsightsPanel } from '@/components/ChartInsightsPanel';
import LineChartComponent from '@/components/charts/LineChart';
import { StackedColumnsChart } from '@/components/charts/StackedColumnsChart';
import ModuleBadge from '@/components/ModuleBadge';
import LoadingSpinner from '@/components/LoadingSpinner';
import type { ForecastCell, LineItem } from '@/types/domain';
import { useAuth } from '@/hooks/useAuth';
import { ALL_PROJECTS_ID, useProject } from '@/contexts/ProjectContext';
import { handleFinanzasApiError } from '@/features/sdmt/cost/utils/errorHandling';
import { useNavigate, useLocation } from 'react-router-dom';
import { excelExporter, downloadExcelFile } from '@/lib/excel-export';
import { PDFExporter, formatReportCurrency, formatReportPercentage, getChangeType } from '@/lib/pdf-export';
import { normalizeForecastCells } from '@/features/sdmt/cost/utils/dataAdapters';
import { useProjectLineItems } from '@/hooks/useProjectLineItems';
import { bulkUploadPayrollActuals, type PayrollActualInput, getProjectRubros } from '@/api/finanzas';
import { getForecastPayload, getProjectInvoices } from './forecastService';
import finanzasClient from '@/api/finanzasClient';
import { ES_TEXTS } from '@/lib/i18n/es';
import { BaselineStatusPanel } from '@/components/baseline/BaselineStatusPanel';
import { BudgetSimulatorCard } from './BudgetSimulatorCard';
import { PortfolioSummaryView } from './PortfolioSummaryView';
import type { BudgetSimulationState, SimulatedMetrics } from './budgetSimulation';
import { applyBudgetSimulation, applyBudgetToTrends } from './budgetSimulation';
import { ForecastPageHeader } from './components/ForecastPageHeader';
import { ForecastActionBarSticky } from './components/ForecastActionBarSticky';
import { KpiGrid } from './components/KpiGrid';
import { BudgetAndSimulatorPanel, type AllocationStrategy } from './components/BudgetAndSimulatorPanel';
import { ForecastAnalytics } from './components/ForecastAnalytics';
import { calculateMonthlyBudgets, calculateBudgetConsumption } from './budgetAllocation';

// TODO: Backend Integration for Change Request Impact on Forecast
// When a change request is approved in SDMTChanges, the backend should:
// 1. Parse the change's start_month_index, duration_months, and allocation_mode
// 2. Create or update forecast entries for each affected_line_items (or new_line_item_request)
// 3. Distribute the impact_amount across months according to allocation_mode:
//    - "one_time": Add full amount to start_month_index only
//    - "spread_evenly": Divide amount equally across duration_months starting from start_month_index
// 4. Return forecast cells with metadata linking them to the change request ID
// 5. This component will then display change indicators (e.g., "Change #123" chip) on affected cells
// Expected API response enhancement: ForecastCell should include optional field:
//   - change_request_id?: string (to link forecast cells to their source change)

type ForecastRow = ForecastCell & { projectId?: string; projectName?: string };
type ProjectLineItem = LineItem & { projectId?: string; projectName?: string };

export function SDMTForecast() {
  const [forecastData, setForecastData] = useState<ForecastRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [forecastError, setForecastError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null);
  const [editingCell, setEditingCell] = useState<{ line_item_id: string; month: number; type: 'forecast' | 'actual' } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [dataSource, setDataSource] = useState<'api' | 'mock'>('api');
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [portfolioLineItems, setPortfolioLineItems] = useState<ProjectLineItem[]>([]);
  const [dirtyActuals, setDirtyActuals] = useState<Record<string, ForecastRow>>({});
  const [savingActuals, setSavingActuals] = useState(false);
  const [dirtyForecasts, setDirtyForecasts] = useState<Record<string, ForecastRow>>({});
  const [savingForecasts, setSavingForecasts] = useState(false);
  const [budgetSimulation, setBudgetSimulation] = useState<BudgetSimulationState>({
    enabled: false,
    budgetTotal: '',
    factor: 1.0,
    estimatedOverride: '',
  });
  // Annual Budget state
  const [budgetYear, setBudgetYear] = useState<number>(new Date().getFullYear());
  const [budgetAmount, setBudgetAmount] = useState<string>('');
  const [budgetCurrency, setBudgetCurrency] = useState<string>('USD');
  const [budgetLastUpdated, setBudgetLastUpdated] = useState<string | null>(null);
  const [loadingBudget, setLoadingBudget] = useState(false);
  const [savingBudget, setSavingBudget] = useState(false);
  // Budget Allocation Strategy
  const [allocationStrategy, setAllocationStrategy] = useState<AllocationStrategy>('equal');
  // Budget Overview state for KPIs
  const [budgetOverview, setBudgetOverview] = useState<{
    year: number;
    budgetAllIn: { amount: number; currency: string } | null;
    totals: {
      planned: number;
      forecast: number;
      actual: number;
      varianceBudgetVsForecast: number;
      varianceBudgetVsActual: number;
      percentBudgetConsumedActual: number | null;
      percentBudgetConsumedForecast: number | null;
    };
  } | null>(null);
  const { user, login } = useAuth();
  const { selectedProjectId, selectedPeriod, currentProject, projectChangeCount, projects } = useProject();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    lineItems,
    isLoading: isLineItemsLoading,
    error: lineItemsError,
  } = useProjectLineItems();
  const safeLineItems = useMemo(
    () => (Array.isArray(lineItems) ? lineItems : []),
    [lineItems]
  );
  const isPortfolioView = selectedProjectId === ALL_PROJECTS_ID;
  const lineItemsForGrid = isPortfolioView ? portfolioLineItems : safeLineItems;

  // Helper function to compute calendar month from monthIndex and project start date
  const getCalendarMonth = (monthIndex: number): string => {
    if (!currentProject?.start_date) {
      // Fallback: display just the month name without year for consistency
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return monthNames[monthIndex - 1] || `M${monthIndex}`;
    }
    
    const startDate = new Date(currentProject.start_date);
    startDate.setUTCMonth(startDate.getUTCMonth() + (monthIndex - 1));
    const year = startDate.getUTCFullYear();
    const month = startDate.getUTCMonth() + 1;
    
    // Return month name for display (e.g., "May 2025")
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[month - 1]} ${year}`;
  };

  // Load data when project or period changes
  useEffect(() => {
    if (selectedProjectId) {
      console.log('🔄 Forecast: Loading data for project:', selectedProjectId, 'change count:', projectChangeCount, 'baseline:', currentProject?.baselineId);
      // Reset state before loading new data
      setForecastData([]);
      setPortfolioLineItems([]);
      loadForecastData();
    }
  }, [selectedProjectId, selectedPeriod, projectChangeCount, currentProject?.baselineId]);

  // Reload data when returning from reconciliation with refresh parameter
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const refreshParam = urlParams.get('_refresh');
    if (refreshParam && selectedProjectId) {
      if (import.meta.env.DEV) {
        console.log('🔄 Forecast: Refreshing after reconciliation');
      }
      loadForecastData();
    }
  }, [location.search]);

  useEffect(() => {
    if (!lineItemsError) return;

    const message = handleFinanzasApiError(lineItemsError, {
      onAuthError: login,
      fallback: 'No se pudieron cargar los rubros para forecast.',
    });
    setForecastError((prev) => prev || message);
  }, [lineItemsError, login]);

  const loadForecastData = async () => {
    if (!selectedProjectId) {
      console.log('❌ No project selected, skipping forecast load');
      return;
    }

    try {
      setLoading(true);
      setForecastError(null);
      setDirtyActuals({});
      setDirtyForecasts({});
      const months = parseInt(selectedPeriod);
      if (import.meta.env.DEV) {
        console.debug('[Forecast] Loading data', { projectId: selectedProjectId, months });
      }

      if (isPortfolioView) {
        await loadPortfolioForecast(months);
      } else {
        await loadSingleProjectForecast(selectedProjectId, months);
      }
    } catch (error) {
      console.error('❌ Failed to load forecast data for project:', selectedProjectId, error);
      const message = handleFinanzasApiError(error, {
        onAuthError: login,
        fallback: 'No se pudo cargar el forecast.',
      });
      setForecastError(message);
      setForecastData([]); // Clear data on error
    } finally {
      setLoading(false);
    }
  };

  const loadSingleProjectForecast = async (projectId: string, months: number) => {
    const payload = await getForecastPayload(projectId, months);
    const normalized = normalizeForecastCells(payload.data);
    setDataSource(payload.source);
    setGeneratedAt(payload.generatedAt);
    setPortfolioLineItems([]);

    // Get matched invoices and sync with actuals
    const invoices = await getProjectInvoices(projectId);
    const matchedInvoices = invoices.filter(inv => inv.status === 'Matched');

    const updatedData: ForecastRow[] = normalized.map(cell => {
      const matchedInvoice = matchedInvoices.find(inv =>
        inv.line_item_id === cell.line_item_id && inv.month === cell.month
      );

      const withActuals = matchedInvoice
        ? {
            ...cell,
            actual: matchedInvoice.amount || 0,
            variance: cell.forecast - cell.planned // Keep forecast-based variance
          }
        : cell;

      return {
        ...withActuals,
        projectId,
        projectName: currentProject?.name,
      };
    });

    if (import.meta.env.DEV) {
      console.debug('[Forecast] data pipeline', {
        projectId,
        rawCells: Array.isArray(payload.data) ? payload.data.length : 0,
        normalizedCells: normalized.length,
        invoices: invoices.length,
        matchedInvoices: matchedInvoices.length,
        lineItems: safeLineItems.length,
        generatedAt: payload.generatedAt,
      });
    }

    setForecastData(updatedData);

    if (import.meta.env.DEV) {
      console.debug('[Forecast] Data loaded', {
        projectId,
        source: payload.source,
        records: updatedData.length,
      });
    }
  };

  const loadPortfolioForecast = async (months: number) => {
    const candidateProjects = projects.filter(project => project.id && project.id !== ALL_PROJECTS_ID);

    if (candidateProjects.length === 0) {
      setForecastError('No hay proyectos disponibles para consolidar.');
      setForecastData([]);
      return;
    }

    const portfolioResults = await Promise.all(
      candidateProjects.map(async project => {
        const [payload, invoices, projectLineItems] = await Promise.all([
          getForecastPayload(project.id, months),
          getProjectInvoices(project.id),
          getProjectRubros(project.id).catch(() => [] as LineItem[]),
        ]);

        const normalized = normalizeForecastCells(payload.data);
        const matchedInvoices = invoices.filter(inv => inv.status === 'Matched');

        const projectData: ForecastRow[] = normalized.map(cell => {
          const matchedInvoice = matchedInvoices.find(inv =>
            inv.line_item_id === cell.line_item_id && inv.month === cell.month
          );

          const withActuals = matchedInvoice
            ? { ...cell, actual: matchedInvoice.amount || 0, variance: cell.forecast - cell.planned }
            : cell;

          return {
            ...withActuals,
            projectId: project.id,
            projectName: project.name,
          };
        });

        return {
          project,
          data: projectData,
          lineItems: projectLineItems.map(item => ({ ...item, projectId: project.id, projectName: project.name })),
          generatedAt: payload.generatedAt,
        };
      })
    );

    const aggregatedData = portfolioResults.flatMap(result => result.data);
    const aggregatedLineItems = portfolioResults.flatMap(result => result.lineItems);
    const firstGeneratedAt = portfolioResults.find(result => result.generatedAt)?.generatedAt;

    setDataSource('api');
    setGeneratedAt(firstGeneratedAt || new Date().toISOString());
    setPortfolioLineItems(aggregatedLineItems);
    setForecastData(aggregatedData);

    if (import.meta.env.DEV) {
      console.debug('[Forecast] Portfolio data loaded', {
        projects: candidateProjects.length,
        records: aggregatedData.length,
        lineItems: aggregatedLineItems.length,
      });
    }
  };

  const handleCellEdit = (line_item_id: string, month: number, type: 'forecast' | 'actual') => {
    const cell = forecastData.find(c => c.line_item_id === line_item_id && c.month === month);
    setEditingCell({ line_item_id, month, type });
    const currentValue = type === 'forecast' ? cell?.forecast : cell?.actual;
    setEditValue(currentValue?.toString() || '0');
  };

  const handleCellSave = () => {
    if (editingCell) {
      let pendingChange: ForecastRow | null = null;
      const updatedData = forecastData.map(cell => {
        if (cell.line_item_id === editingCell.line_item_id && cell.month === editingCell.month) {
          const newValue = parseFloat(editValue) || 0;
          const updates = editingCell.type === 'forecast'
            ? { forecast: newValue, variance: newValue - cell.planned }
            : { actual: newValue };

          const nextCell: ForecastRow = {
            ...cell,
            ...updates,
            last_updated: new Date().toISOString(),
            updated_by: user?.login || 'current-user'
          };
          
          // Track the pending change
          if (editingCell.type === 'actual') {
            pendingChange = nextCell;
          } else if (editingCell.type === 'forecast') {
            pendingChange = nextCell;
          }
          
          return nextCell;
        }
        return cell;
      });
      setForecastData(updatedData);
      
      if (pendingChange) {
        const changeKey = `${pendingChange.projectId || selectedProjectId}-${pendingChange.line_item_id}-${pendingChange.month}`;
        if (editingCell.type === 'actual') {
          setDirtyActuals(prev => ({ ...prev, [changeKey]: pendingChange as ForecastRow }));
        } else if (editingCell.type === 'forecast') {
          setDirtyForecasts(prev => ({ ...prev, [changeKey]: pendingChange as ForecastRow }));
        }
      }
      
      setEditingCell(null);
      toast.success(`${editingCell.type === 'forecast' ? 'Pronóstico' : 'Real'} actualizado correctamente`);
    }
  };

  const handlePersistActuals = async () => {
    const entries = Object.values(dirtyActuals);
    if (entries.length === 0) {
      toast.info('No hay cambios de valores reales para guardar');
      return;
    }

    setSavingActuals(true);
    try {
      const currentYear = new Date().getFullYear();
      const payload: PayrollActualInput[] = entries
        .map(cell => {
          const projectId = cell.projectId || selectedProjectId;
          const matchedLineItem = lineItemsForGrid.find(item =>
            item.id === cell.line_item_id && (!item.projectId || item.projectId === projectId)
          );
          const monthKey = `${currentYear}-${String(cell.month).padStart(2, '0')}`;

          if (!projectId) return null;

          return {
            projectId,
            month: monthKey,
            rubroId: cell.line_item_id,
            amount: Number(cell.actual) || 0,
            currency: matchedLineItem?.currency || 'USD',
            resourceCount: matchedLineItem?.qty ? Number(matchedLineItem.qty) : undefined,
            notes: cell.notes,
            uploadedBy: user?.email || user?.login,
            source: 'sdmt-forecast',
          } satisfies PayrollActualInput;
        })
        .filter((row): row is PayrollActualInput => Boolean(row));

      if (payload.length === 0) {
        toast.error('No pudimos construir los datos para guardar en nómina.');
        return;
      }

      await bulkUploadPayrollActuals(payload);
      toast.success('Valores reales enviados a Nómina (DynamoDB)');
      setDirtyActuals({});
    } catch (error) {
      console.error('❌ Error al guardar valores reales', error);
      const message = handleFinanzasApiError(error, {
        onAuthError: login,
        fallback: 'No pudimos guardar los valores reales.',
      });
      setForecastError(prev => prev || message);
    } finally {
      setSavingActuals(false);
    }
  };

  const handlePersistForecasts = async () => {
    const entries: ForecastRow[] = Object.values(dirtyForecasts);
    if (entries.length === 0) {
      toast.info('No hay cambios de pronóstico para guardar');
      return;
    }

    // Prevent duplicate submissions
    if (savingForecasts) {
      return;
    }

    setSavingForecasts(true);
    try {
      // Group by project for API calls
      const byProject = new Map<string, ForecastRow[]>();
      entries.forEach(cell => {
        const projectId = cell.projectId || selectedProjectId;
        if (!projectId) return;
        
        if (!byProject.has(projectId)) {
          byProject.set(projectId, []);
        }
        byProject.get(projectId)!.push(cell);
      });

      // Send updates per project using bulkUpsertForecast with monthIndex format
      // The API expects: {items: [{rubroId, month: number (1-12), forecast}]}
      // We send monthIndex as a number, and the backend will compute the calendar month
      for (const [projectId, projectCells] of byProject.entries()) {
        const items = projectCells.map(cell => {
          // Validate month is in valid range (1-12)
          const monthIndex = Math.max(1, Math.min(12, cell.month));
          return {
            rubroId: cell.line_item_id,
            month: monthIndex, // Send as numeric monthIndex (1-12)
            forecast: Number(cell.forecast) || 0,
          };
        });

        await finanzasClient.bulkUpsertForecast(projectId, items);
      }

      toast.success('Pronósticos ajustados guardados exitosamente');
      setDirtyForecasts({});
      
      // Reload forecast data to show persisted values
      await loadForecastData();
    } catch (error) {
      console.error('❌ Error al guardar pronósticos', error);
      const message = handleFinanzasApiError(error, {
        onAuthError: login,
        fallback: 'No pudimos guardar los pronósticos ajustados.',
      });
      setForecastError(prev => prev || message);
    } finally {
      setSavingForecasts(false);
    }
  };

  // Load Annual Budget
  const loadAnnualBudget = async (year: number) => {
    setLoadingBudget(true);
    try {
      const budget = await finanzasClient.getAllInBudget(year);
      if (budget && budget.amount !== null) {
        setBudgetAmount(budget.amount.toString());
        setBudgetCurrency(budget.currency || 'USD');
        setBudgetLastUpdated(budget.updated_at || null);
      } else {
        setBudgetAmount('');
        setBudgetCurrency('USD');
        setBudgetLastUpdated(null);
      }
    } catch (error: any) {
      // If 404, it means no budget is set for this year - that's okay
      if (error?.status === 404 || error?.statusCode === 404) {
        setBudgetAmount('');
        setBudgetCurrency('USD');
        setBudgetLastUpdated(null);
      } else {
        console.error('Error loading annual budget:', error);
        const message = handleFinanzasApiError(error, {
          onAuthError: login,
          fallback: 'No pudimos cargar el presupuesto anual.',
        });
        toast.error(message);
      }
    } finally {
      setLoadingBudget(false);
    }
  };

  // Load Budget Overview for KPIs (only in portfolio view)
  const loadBudgetOverview = async (year: number) => {
    if (!isPortfolioView) return;
    
    try {
      const overview = await finanzasClient.getAllInBudgetOverview(year);
      setBudgetOverview(overview);
      console.log('[SDMTForecast] Budget overview loaded:', overview);
    } catch (error: any) {
      // Don't show error to user, just log it - this is optional enhancement
      console.error('Error loading budget overview:', error);
      setBudgetOverview(null);
    }
  };

  // Save Annual Budget
  const handleSaveAnnualBudget = async () => {
    const amount = parseFloat(budgetAmount);
    if (isNaN(amount) || amount < 0) {
      toast.error('Por favor ingrese un monto válido');
      return;
    }

    setSavingBudget(true);
    try {
      const result = await finanzasClient.putAllInBudget(budgetYear, amount, budgetCurrency);
      setBudgetLastUpdated(result.updated_at);
      toast.success('Presupuesto anual guardado exitosamente');
      
      // Reload budget overview to update KPIs
      await loadBudgetOverview(budgetYear);
    } catch (error) {
      console.error('Error saving annual budget:', error);
      const message = handleFinanzasApiError(error, {
        onAuthError: login,
        fallback: 'No pudimos guardar el presupuesto anual.',
      });
      toast.error(message);
    } finally {
      setSavingBudget(false);
    }
  };

  // Load budget when year changes
  useEffect(() => {
    loadAnnualBudget(budgetYear);
    // Also load overview if in portfolio view
    if (isPortfolioView) {
      loadBudgetOverview(budgetYear);
    }
  }, [budgetYear, isPortfolioView]);

  // Check if user can edit forecast (SDMT only) or actuals (SDMT role)
  const canEditForecast = user?.current_role === 'SDMT';
  const canEditActual = user?.current_role === 'SDMT';
  const canEditBudget = user?.current_role === 'SDMT';

  // Function to navigate to reconciliation with filters
  const navigateToReconciliation = (line_item_id: string, month?: number) => {
    const params = new URLSearchParams();
    params.set('line_item', line_item_id);
    if (month) params.set('month', month.toString());
    
    // Add returnUrl so user can navigate back to Forecast
    const currentPath = location.pathname + location.search;
    params.set('returnUrl', currentPath);
    
    navigate(`/sdmt/cost/reconciliation?${params.toString()}`);
  };

  // Group forecast data by line item and month for display
  const forecastGrid = useMemo(() => {
    const grid = lineItemsForGrid.map(lineItem => {
      const itemForecasts = forecastData.filter(f =>
        f.line_item_id === lineItem.id && (!lineItem.projectId || f.projectId === lineItem.projectId)
      );
      const months = Array.from({ length: 12 }, (_, i) => i + 1);

      const monthlyData = months.map(month => {
        const cell = itemForecasts.find(f => f.month === month);
        return cell || {
          line_item_id: lineItem.id,
          month,
          planned: 0,
          forecast: 0,
          actual: 0,
          variance: 0,
          last_updated: '',
          updated_by: '',
          projectId: lineItem.projectId,
          projectName: lineItem.projectName,
        };
      });

      // Check if the line item has any non-zero values to show
      const hasNonZeroValues = monthlyData.some(cell => 
        (cell.planned || 0) > 0 || (cell.forecast || 0) > 0 || (cell.actual || 0) > 0
      );

      return { 
        lineItem, 
        monthlyData,
        hasNonZeroValues
      };
    }).filter(item => item.hasNonZeroValues); // Only show items with data

    if (import.meta.env.DEV && grid.length > 0) {
      console.debug('[Forecast] Grid recalculated', { projectId: selectedProjectId, rows: grid.length });
    }

    return grid;
  }, [lineItemsForGrid, forecastData, selectedProjectId]);

  const totalFTE = useMemo(() => {
    return lineItemsForGrid.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
  }, [lineItemsForGrid]);

  // Calculate totals and metrics - using useMemo to ensure it updates when data changes
  const baseMetrics = useMemo(() => {
    const totalPlanned = forecastData.reduce((sum, cell) => sum + (cell.planned || 0), 0);
    const totalForecast = forecastData.reduce((sum, cell) => sum + (cell.forecast || 0), 0);
    const totalActual = forecastData.reduce((sum, cell) => sum + (cell.actual || 0), 0);
    
    // SDMT ALIGNMENT FIX: Calculate variances at aggregate level, not sum of cell variances
    // Variación de Pronóstico = difference between total forecast and total planned
    const totalVariance = totalForecast - totalPlanned;
    const variancePercentage = totalPlanned > 0 ? (totalVariance / totalPlanned) * 100 : 0;
    
    // Variación Real = difference between actual and planned (not actual vs forecast)
    // This represents how much actual costs deviate from the original plan/baseline.
    // Previously calculated as (actual - forecast), but business requirement per screenshots
    // shows this should be (actual - planned) to measure variance from baseline budget.
    const actualVariance = totalActual - totalPlanned;
    const actualVariancePercentage = totalPlanned > 0 ? (actualVariance / totalPlanned) * 100 : 0;

    if (import.meta.env.DEV && forecastData.length > 0) {
      console.debug('[Forecast] Metrics recalculated', {
        projectId: selectedProjectId,
        totalPlanned,
        totalForecast,
        totalActual,
        totalVariance,
        actualVariance,
      });
    }

    return {
      totalVariance,
      totalPlanned,
      totalForecast,
      totalActual,
      variancePercentage,
      actualVariance,
      actualVariancePercentage
    };
  }, [forecastData, selectedProjectId]);

  // Apply budget simulation overlay to base metrics
  const metrics = useMemo(() => {
    // Only apply simulation in portfolio view when enabled
    if (isPortfolioView && budgetSimulation.enabled) {
      return applyBudgetSimulation(baseMetrics, budgetSimulation);
    }
    // For non-portfolio view or disabled simulation, return base metrics with zero budget fields
    return {
      ...baseMetrics,
      budgetTotal: 0,
      budgetUtilization: 0,
      budgetVarianceProjected: 0,
      budgetVariancePlanned: 0,
      pctUsedActual: 0,
    } as SimulatedMetrics;
  }, [baseMetrics, budgetSimulation, isPortfolioView]);

  const {
    totalVariance,
    totalPlanned,
    totalForecast,
    totalActual,
    variancePercentage,
    actualVariance,
    actualVariancePercentage,
    budgetTotal,
    budgetUtilization,
    budgetVarianceProjected,
    pctUsedActual,
  } = metrics;
  const dirtyActualCount = useMemo(() => Object.keys(dirtyActuals).length, [dirtyActuals]);
  const dirtyForecastCount = useMemo(() => Object.keys(dirtyForecasts).length, [dirtyForecasts]);

  const isLoadingState = loading || isLineItemsLoading;
  const hasGridData = forecastGrid.length > 0;
  const isEmptyState = !isLoadingState && !forecastError && forecastData.length === 0;

  // Chart data - recalculate when forecastData changes
  const monthlyTrends = useMemo(() => {
    const baseTrends = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const monthData = forecastData.filter(cell => cell.month === month);
      return {
        month,
        Planned: monthData.reduce((sum, cell) => sum + (cell.planned || 0), 0),
        Forecast: monthData.reduce((sum, cell) => sum + (cell.forecast || 0), 0),
        Actual: monthData.reduce((sum, cell) => sum + (cell.actual || 0), 0)
      };
    });

    if (import.meta.env.DEV && forecastData.length > 0) {
      console.debug('[Forecast] Chart trends recalculated', { projectId: selectedProjectId });
    }
    
    // Apply budget line when simulation is enabled in portfolio view
    if (isPortfolioView && budgetSimulation.enabled && budgetTotal > 0) {
      return applyBudgetToTrends(baseTrends, budgetTotal);
    }
    
    return baseTrends;
  }, [forecastData, selectedProjectId, isPortfolioView, budgetSimulation.enabled, budgetTotal]);

  // Calculate monthly budget allocation based on strategy
  const budgetAllocation = useMemo(() => {
    const budgetValue = parseFloat(budgetAmount);
    if (!budgetValue || budgetValue <= 0) {
      return null;
    }

    const monthlyPlanned = monthlyTrends.map(t => t.Planned);
    const monthlyForecast = monthlyTrends.map(t => t.Forecast);
    
    return calculateMonthlyBudgets(budgetValue, allocationStrategy, monthlyPlanned, monthlyForecast);
  }, [budgetAmount, allocationStrategy, monthlyTrends]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Format currency for grid display (full amounts, not abbreviated)
  const formatGridCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getVarianceColor = (variance: number) => {
    if (variance > 0) return 'text-red-600 bg-red-50';
    if (variance < 0) return 'text-green-600 bg-green-50';
    return 'text-muted-foreground bg-muted';
  };

  const getVarianceIcon = (variance: number) => {
    if (variance > 0) return <TrendingUp size={14} className="text-red-600" />;
    if (variance < 0) return <TrendingDown size={14} className="text-green-600" />;
    return null;
  };

  // Export functions
  const handleExcelExport = async () => {
    if (exporting) return;
    
    try {
      setExporting('excel');
      const exporter = excelExporter;
      const buffer = await exporter.exportForecastGrid(forecastData, lineItemsForGrid);
      const filename = `forecast-data-${new Date().toISOString().split('T')[0]}.xlsx`;
      downloadExcelFile(buffer, filename);
      toast.success('Reporte Excel exportado exitosamente');
    } catch (error) {
      toast.error('Error al exportar reporte Excel');
      console.error(error);
    } finally {
      setExporting(null);
    }
  };

  const handlePDFExport = async () => {
    if (exporting) return;
    
    try {
      setExporting('pdf');
      const reportData = {
        title: 'Análisis de Pronóstico de Costos',
        subtitle: 'Resumen Ejecutivo y Reporte de Variaciones',
        generated: new Date().toLocaleDateString(),
        metrics: [
          {
            label: 'Presupuesto Planeado Total',
            value: formatReportCurrency(totalPlanned),
            color: '#64748b'
          },
          {
            label: 'Pronóstico Actual',
            value: formatReportCurrency(totalForecast),
            change: formatReportPercentage(((totalForecast - totalPlanned) / totalPlanned) * 100),
            changeType: getChangeType(totalForecast - totalPlanned),
            color: '#2BB673'
          },
          {
            label: 'Gastos Reales',
            value: formatReportCurrency(totalActual),
            change: formatReportPercentage(((totalActual - totalPlanned) / totalPlanned) * 100),
            changeType: getChangeType(totalActual - totalPlanned),
            color: '#14B8A6'
          },
          {
            label: 'Variación de Presupuesto',
            value: formatReportCurrency(Math.abs(totalVariance)),
            change: formatReportPercentage(Math.abs(variancePercentage)),
            changeType: getChangeType(-Math.abs(totalVariance)),
            color: totalVariance > 0 ? '#ef4444' : '#22c55e'
          }
        ],
        summary: [
          `Variación total del presupuesto del proyecto: ${formatReportCurrency(totalVariance)} (${variancePercentage.toFixed(1)}%)`,
          `${forecastData.filter(f => f.variance > 0).length} rubros mostrando sobrecostos`,
          `${forecastData.filter(f => f.variance < 0).length} rubros bajo presupuesto`,
          `Precisión actual del pronóstico: ${(100 - Math.abs(variancePercentage)).toFixed(1)}%`
        ],
        recommendations: [
          totalVariance > 50000 ? 'Se requiere revisión inmediata del presupuesto por sobrecostos significativos' : 'Variación de presupuesto dentro del rango aceptable',
          'Enfocar en rubros con mayor impacto de variación para optimización de costos',
          'Considerar actualizar modelos de pronóstico basados en tendencias de desempeño real',
          'Implementar seguimiento mejorado para categorías de costo de alto riesgo'
        ]
      };

      await PDFExporter.exportToPDF(reportData);
      toast.success('Reporte profesional de pronóstico generado');
    } catch (error) {
      toast.error('Error al generar resumen PDF');
      console.error(error);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="max-w-full mx-auto p-6 space-y-6">
      {/* Sticky Page Header */}
      <ForecastPageHeader
        projectName={currentProject?.name}
        projectChangeCount={projectChangeCount}
        startDate={currentProject?.start_date}
        isPortfolioView={isPortfolioView}
        dataSource={dataSource}
        lastUpdated={generatedAt}
      />

      {/* Baseline Status Panel */}
      <BaselineStatusPanel />

      {/* Sticky Action Bar */}
      <ForecastActionBarSticky
        dirtyActualCount={dirtyActualCount}
        dirtyForecastCount={dirtyForecastCount}
        savingActuals={savingActuals}
        savingForecasts={savingForecasts}
        canEditForecast={canEditForecast}
        exporting={exporting}
        onSaveActuals={handlePersistActuals}
        onSaveForecasts={handlePersistForecasts}
        onExportExcel={handleExcelExport}
        onExportPDF={handlePDFExport}
      />

      {/* Unified KPI Grid */}
      <KpiGrid
        totalPlanned={totalPlanned}
        totalForecast={totalForecast}
        totalActual={totalActual}
        totalFTE={totalFTE}
        totalVariance={totalVariance}
        variancePercentage={variancePercentage}
        actualVariance={actualVariance}
        actualVariancePercentage={actualVariancePercentage}
        formatCurrency={formatCurrency}
      />

      {/* Budget Simulation KPIs - Only show when simulation is enabled */}
      {isPortfolioView && budgetSimulation.enabled && budgetTotal > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3">
          <Card className="border-primary/30">
            <CardContent className="p-3">
              <div className="text-2xl font-bold text-primary">{formatCurrency(budgetTotal)}</div>
              <div className="flex items-center gap-1">
                <p className="text-sm text-muted-foreground">Presupuesto Total</p>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs max-w-xs">Presupuesto anual simulado distribuido proporcionalmente por mes</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-xs text-muted-foreground">Simulación activa</p>
            </CardContent>
          </Card>
          <Card className="border-primary/30">
            <CardContent className="p-3">
              <div className={`text-2xl font-bold ${budgetVarianceProjected >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(Math.abs(budgetVarianceProjected))}
              </div>
              <div className="flex items-center gap-1">
                {getVarianceIcon(-budgetVarianceProjected)}
                <p className="text-sm text-muted-foreground">Variación vs Presupuesto</p>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs max-w-xs">Diferencia entre presupuesto y pronóstico (Budget - Forecast)</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-xs text-muted-foreground">
                {budgetVarianceProjected >= 0 ? 'Bajo presupuesto' : 'Sobre presupuesto'}
              </p>
            </CardContent>
          </Card>
          <Card className="border-primary/30">
            <CardContent className="p-3">
              <div className={`text-2xl font-bold ${budgetUtilization > 100 ? 'text-red-600' : budgetUtilization > 90 ? 'text-yellow-600' : 'text-green-600'}`}>
                {budgetUtilization.toFixed(1)}%
              </div>
              <div className="flex items-center gap-1">
                <p className="text-sm text-muted-foreground">Utilización de Presupuesto</p>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs max-w-xs">Porcentaje del presupuesto utilizado según pronóstico (Forecast / Budget × 100)</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-xs text-muted-foreground">Pronóstico / Presupuesto</p>
            </CardContent>
          </Card>
          <Card className="border-primary/30">
            <CardContent className="p-3">
              <div className={`text-2xl font-bold ${pctUsedActual > 100 ? 'text-red-600' : pctUsedActual > 90 ? 'text-yellow-600' : 'text-blue-600'}`}>
                {pctUsedActual.toFixed(1)}%
              </div>
              <div className="flex items-center gap-1">
                <p className="text-sm text-muted-foreground">Real vs Presupuesto</p>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs max-w-xs">Porcentaje del presupuesto consumido por gastos reales (Actual / Budget × 100)</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-xs text-muted-foreground">Gastos reales / Presupuesto</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Real Annual Budget KPIs - Show when budget is set and portfolio view (not simulation) */}
      {isPortfolioView && !budgetSimulation.enabled && budgetOverview?.budgetAllIn && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3">
          <Card className="border-blue-500/30">
            <CardContent className="p-3">
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency(budgetOverview.budgetAllIn.amount)}
              </div>
              <p className="text-sm text-muted-foreground">Presupuesto Anual All-In</p>
              <p className="text-xs text-muted-foreground">
                {budgetOverview.budgetAllIn.currency} · {budgetOverview.year}
              </p>
            </CardContent>
          </Card>
          <Card className="border-blue-500/30">
            <CardContent className="p-3">
              <div className={`text-2xl font-bold ${
                budgetOverview.totals.varianceBudgetVsForecast >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {formatCurrency(Math.abs(budgetOverview.totals.varianceBudgetVsForecast))}
              </div>
              <div className="flex items-center gap-1">
                {getVarianceIcon(-budgetOverview.totals.varianceBudgetVsForecast)}
                <p className="text-sm text-muted-foreground">Over/Under Budget</p>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs max-w-xs">Diferencia entre presupuesto anual y pronóstico total (Budget - Forecast)</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-xs text-muted-foreground">
                {budgetOverview.totals.varianceBudgetVsForecast >= 0 ? 'Bajo presupuesto' : 'Sobre presupuesto'}
              </p>
            </CardContent>
          </Card>
          <Card className="border-blue-500/30">
            <CardContent className="p-3">
              <div className={`text-2xl font-bold ${
                (budgetOverview.totals.percentBudgetConsumedForecast || 0) > 100 
                  ? 'text-red-600' 
                  : (budgetOverview.totals.percentBudgetConsumedForecast || 0) > 90 
                    ? 'text-yellow-600' 
                    : 'text-green-600'
              }`}>
                {budgetOverview.totals.percentBudgetConsumedForecast?.toFixed(1) || '0.0'}%
              </div>
              <p className="text-sm text-muted-foreground">% Consumo Pronóstico</p>
              <p className="text-xs text-muted-foreground">Forecast / Budget</p>
            </CardContent>
          </Card>
          <Card className="border-blue-500/30">
            <CardContent className="p-3">
              <div className={`text-2xl font-bold ${
                (budgetOverview.totals.percentBudgetConsumedActual || 0) > 100 
                  ? 'text-red-600' 
                  : (budgetOverview.totals.percentBudgetConsumedActual || 0) > 90 
                    ? 'text-yellow-600' 
                    : 'text-green-600'
              }`}>
                {budgetOverview.totals.percentBudgetConsumedActual?.toFixed(1) || '0.0'}%
              </div>
              <p className="text-sm text-muted-foreground">% Consumo Real</p>
              <p className="text-xs text-muted-foreground">Actual / Budget</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Budget & Simulator Panel */}
      <BudgetAndSimulatorPanel
        budgetYear={budgetYear}
        budgetAmount={budgetAmount}
        budgetCurrency={budgetCurrency}
        budgetLastUpdated={budgetLastUpdated}
        loadingBudget={loadingBudget}
        savingBudget={savingBudget}
        canEditBudget={canEditBudget}
        onBudgetYearChange={setBudgetYear}
        onBudgetAmountChange={setBudgetAmount}
        onBudgetCurrencyChange={setBudgetCurrency}
        onSaveBudget={handleSaveAnnualBudget}
        allocationStrategy={allocationStrategy}
        onAllocationStrategyChange={setAllocationStrategy}
        monthlyBudgetAverage={budgetAllocation?.average}
        maxPressureMonth={budgetAllocation?.maxPressureMonth}
        formatCurrency={formatCurrency}
        isPortfolioView={isPortfolioView}
        simulationState={budgetSimulation}
        onSimulationChange={setBudgetSimulation}
      />

      {/* Portfolio Summary View - Only show in portfolio mode */}
      {isPortfolioView && !loading && forecastData.length > 0 && (
        <PortfolioSummaryView
          forecastData={forecastData}
          lineItems={portfolioLineItems}
          formatCurrency={formatCurrency}
          onViewProject={(projectId) => {
            // TODO: Navigate to single project view with selected project
            console.log('View project:', projectId);
          }}
        />
      )}

      {/* Forecast Grid */}
      <Card>
        <CardHeader>
          <CardTitle>Cuadrícula de Pronóstico 12 Meses</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingState ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-center space-y-3">
                <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center mx-auto mb-2 animate-pulse">
                  <span className="text-primary font-bold text-sm">📊</span>
                </div>
                <div className="text-muted-foreground">
                  Cargando datos de pronóstico{currentProject ? ` para ${currentProject.name}` : ''}...
                </div>
                <div className="text-xs text-muted-foreground">
                  Project: {selectedProjectId} | Change #{projectChangeCount}
                </div>
              </div>
            </div>
          ) : forecastError ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-center space-y-3">
                <div className="w-8 h-8 bg-destructive/10 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <span className="text-destructive font-bold text-sm">⚠️</span>
                </div>
                <div className="text-destructive">{forecastError}</div>
                <div className="text-xs text-muted-foreground">Project ID: {selectedProjectId}</div>
              </div>
            </div>
          ) : isEmptyState ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-center space-y-3">
                <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center mx-auto mb-2">
                  <span className="text-muted-foreground font-bold text-sm">🗂️</span>
                </div>
                <div className="text-muted-foreground">
                  No hay datos de pronóstico disponibles aún para {currentProject?.name || 'este proyecto'}.
                </div>
                <div className="text-xs text-muted-foreground">
                  Project ID: {selectedProjectId} | Última generación: {generatedAt ? new Date(generatedAt).toLocaleString() : 'sin registro'}
                </div>
              </div>
            </div>
          ) : !hasGridData ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-center space-y-3">
                <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center mx-auto mb-2">
                  <span className="text-muted-foreground font-bold text-sm">📋</span>
                </div>
                <div className="text-muted-foreground">
                  No hay datos de pronóstico disponibles para {currentProject?.name || 'este proyecto'}
                </div>
                <div className="text-xs text-muted-foreground">
                  Project ID: {selectedProjectId}
                </div>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background min-w-[300px]">Rubro</TableHead>
                    {Array.from({ length: 12 }, (_, i) => (
                      <TableHead key={i + 1} className="text-center min-w-[140px]">
                        <div className="font-semibold">M{i + 1}</div>
                        {!isPortfolioView && currentProject?.start_date && (
                          <div className="text-xs font-normal text-muted-foreground mt-1">
                            {getCalendarMonth(i + 1)}
                          </div>
                        )}
                        <div className="text-xs font-normal text-muted-foreground mt-1">
                          P / F / A
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {forecastGrid.map(({ lineItem, monthlyData }) => (
                    <TableRow key={lineItem.id}>
                      <TableCell className="sticky left-0 bg-background">
                        <div className="space-y-1">
                          <div className="font-medium flex items-center gap-2">
                            {lineItem.description}
                            {lineItem.projectName && (
                              <Badge variant="outline" className="text-[10px]">
                                {lineItem.projectName}
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">{lineItem.category}</div>
                        </div>
                      </TableCell>
                      {monthlyData.map(cell => (
                        <TableCell key={cell.month} className="p-2">
                          <div className="space-y-2 text-xs">
                            {/* Planned (Read-only) - only show if > 0 */}
                            {cell.planned > 0 && (
                              <div className="text-muted-foreground bg-muted/20 px-2 py-1 rounded">
                                P: {formatGridCurrency(cell.planned)}
                              </div>
                            )}
                            
                            {/* Forecast (Editable by PMO/SDMT) - only show if > 0 or planned > 0 */}
                            {(cell.forecast > 0 || cell.planned > 0) && (
                              <div>
                                {editingCell?.line_item_id === cell.line_item_id && 
                                 editingCell?.month === cell.month && 
                                 editingCell?.type === 'forecast' ? (
                                  <Input
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={handleCellSave}
                                    onKeyDown={(e) => e.key === 'Enter' && handleCellSave()}
                                    className="h-7 text-xs"
                                    id={`forecast-input-${cell.line_item_id}-${cell.month}`}
                                    name={`forecast-${cell.line_item_id}-${cell.month}`}
                                    aria-label={`Forecast value for ${cell.line_item_id} month ${cell.month}`}
                                    disabled={savingForecasts}
                                    autoFocus
                                  />
                                ) : (
                                  <div
                                    className={`px-2 py-1 rounded transition-colors ${
                                      canEditForecast && !savingForecasts
                                        ? 'cursor-pointer hover:bg-primary/10 bg-primary/5 text-primary font-medium'
                                        : 'cursor-default bg-muted/10 text-muted-foreground'
                                    }`}
                                    onClick={() => canEditForecast && !savingForecasts && handleCellEdit(cell.line_item_id, cell.month, 'forecast')}
                                    title={
                                      savingForecasts 
                                        ? 'Guardando pronósticos...' 
                                        : canEditForecast 
                                          ? 'Click to edit forecast' 
                                          : 'No permission to edit forecast'
                                    }
                                  >
                                    F: {formatGridCurrency(cell.forecast)}
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {/* Actual (Editable by SDMT only) - only show if > 0 or there's forecast/planned */}
                            {(cell.actual > 0 || cell.forecast > 0 || cell.planned > 0) && (
                              <div>
                                {editingCell?.line_item_id === cell.line_item_id && 
                                 editingCell?.month === cell.month && 
                                 editingCell?.type === 'actual' ? (
                                  <Input
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={handleCellSave}
                                    onKeyDown={(e) => e.key === 'Enter' && handleCellSave()}
                                    className="h-7 text-xs"
                                    id={`actual-input-${cell.line_item_id}-${cell.month}`}
                                    name={`actual-${cell.line_item_id}-${cell.month}`}
                                    aria-label={`Actual value for ${cell.line_item_id} month ${cell.month}`}
                                    autoFocus
                                  />
                                ) : (
                                  <div className="flex items-center gap-1">
                                    <div
                                      className={`px-2 py-1 rounded flex-1 transition-colors ${
                                        canEditActual 
                                          ? 'cursor-pointer hover:bg-blue-50 bg-blue-50/50 text-blue-700 font-medium'
                                          : 'cursor-default bg-muted/10 text-muted-foreground'
                                      }`}
                                      onClick={() => canEditActual && handleCellEdit(cell.line_item_id, cell.month, 'actual')}
                                      title={canEditActual ? 'Click to edit actual' : 'No permission to edit actuals'}
                                    >
                                      A: {formatGridCurrency(cell.actual)}
                                    </div>
                                    {/* Always show reconciliation icon for organic actuals entry */}
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-5 w-5 p-0 hover:bg-blue-100"
                                      onClick={() => navigateToReconciliation(cell.line_item_id, cell.month)}
                                      title={cell.actual > 0 ? 'View/Edit Factura' : 'Add Factura / Enter Actuals'}
                                    >
                                      <ExternalLink size={12} />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {/* Variance Indicator */}
                            {cell.variance !== 0 && (
                              <div className={`px-2 py-1 rounded text-xs font-medium text-center ${getVarianceColor(cell.variance)}`}>
                                {cell.variance > 0 ? '+' : ''}{formatGridCurrency(cell.variance)}
                              </div>
                            )}
                            
                            {/* TODO: Show change request indicator when backend provides change_request_id
                            {cell.change_request_id && (
                              <Badge variant="outline" className="text-[10px] mt-1">
                                Change #{cell.change_request_id.slice(0, 8)}
                              </Badge>
                            )}
                            */}
                          </div>
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Charts and Analytics */}
      {!loading && (
        <ForecastAnalytics
          monthlyTrends={monthlyTrends}
          insights={[
            {
              title: "Forecast Accuracy",
              value: `${(100 - Math.abs(variancePercentage)).toFixed(1)}%`,
              type: variancePercentage < 5 ? 'positive' : variancePercentage > 15 ? 'negative' : 'neutral'
            },
            {
              title: "Largest Variance",
              value: formatCurrency(Math.max(...forecastData.map(c => Math.abs(c.variance || 0)), 0)),
              type: 'neutral'
            },
            {
              title: "Forecast vs Planned",
              value: totalForecast > totalPlanned ? 'Over Budget' : totalForecast < totalPlanned ? 'Under Budget' : 'On Target',
              type: totalForecast > totalPlanned ? 'negative' : totalForecast < totalPlanned ? 'positive' : 'neutral'
            },
            // Add budget insights when simulation is enabled
            ...(isPortfolioView && budgetSimulation.enabled && budgetTotal > 0
              ? [{
                  title: "Budget Utilization",
                  value: `${budgetUtilization.toFixed(1)}%`,
                  type: (budgetUtilization > 100 ? 'negative' : budgetUtilization > 90 ? 'neutral' : 'positive') as 'positive' | 'negative' | 'neutral'
                }]
              : [])
          ]}
          variancePercentage={variancePercentage}
          isPortfolioView={isPortfolioView}
          budgetSimulationEnabled={budgetSimulation.enabled}
          budgetTotal={budgetTotal}
          onExport={handleExcelExport}
        />
      )}
    </div>
  );
}

export default SDMTForecast;