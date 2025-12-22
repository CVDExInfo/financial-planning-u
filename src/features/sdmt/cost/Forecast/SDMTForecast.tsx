import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Share2, TrendingUp, TrendingDown, ExternalLink, FileSpreadsheet, Info, Calculator, ChevronDown } from 'lucide-react';
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
import { MonthlyBudgetCard } from './MonthlyBudgetCard';
import { PortfolioSummaryView } from './PortfolioSummaryView';
import type { BudgetSimulationState, SimulatedMetrics } from './budgetSimulation';
import { applyBudgetSimulation, applyBudgetToTrends } from './budgetSimulation';
import { 
  allocateBudgetMonthly, 
  aggregateMonthlyTotals, 
  allocateBudgetWithMonthlyInputs,
  calculateRunwayMetrics,
  type MonthlyAllocation,
  type MonthlyBudgetInput,
  type RunwayMetrics,
} from './budgetAllocation';

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

// Constants
const MINIMUM_PROJECTS_FOR_PORTFOLIO = 2; // ALL_PROJECTS + at least one real project

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
  // Monthly Budget state (new - per user request)
  const [monthlyBudgets, setMonthlyBudgets] = useState<MonthlyBudgetInput[]>([]);
  const [useMonthlyBudget, setUseMonthlyBudget] = useState(false);
  const [loadingMonthlyBudget, setLoadingMonthlyBudget] = useState(false);
  const [savingMonthlyBudget, setSavingMonthlyBudget] = useState(false);
  const [monthlyBudgetLastUpdated, setMonthlyBudgetLastUpdated] = useState<string | null>(null);
  const [monthlyBudgetUpdatedBy, setMonthlyBudgetUpdatedBy] = useState<string | null>(null);
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

  // Helper function to get current month index (1-12) based on today's date and project start
  const getCurrentMonthIndex = (): number => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1; // 1-12
    
    // For portfolio view or when no project start date, use calendar month (1-12)
    if (!currentProject?.start_date || isPortfolioView) {
      return currentMonth;
    }
    
    // Calculate month index relative to project start date
    const startDate = new Date(currentProject.start_date);
    const startYear = startDate.getFullYear();
    const startMonth = startDate.getMonth() + 1; // 1-12
    
    // Calculate months elapsed since project start
    const monthsElapsed = (currentYear - startYear) * 12 + (currentMonth - startMonth) + 1;
    
    // Clamp to 1-12 range (project month index)
    return Math.max(1, Math.min(12, monthsElapsed));
  };

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
      
      // Handle CURRENT_MONTH period - always load 12 months but filter to current month later
      const isCurrentMonthMode = selectedPeriod === 'CURRENT_MONTH';
      const months = isCurrentMonthMode ? 12 : parseInt(selectedPeriod);
      
      if (import.meta.env.DEV) {
        console.debug('[Forecast] Loading data', { 
          projectId: selectedProjectId, 
          months,
          isCurrentMonthMode,
          selectedPeriod 
        });
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

    // Guard: Don't error out if projects haven't loaded yet
    // Only show error after we're sure the list is definitively empty
    if (candidateProjects.length === 0) {
      // Check if we're still in initial load state (only ALL_PROJECTS exists)
      if (projects.length < MINIMUM_PROJECTS_FOR_PORTFOLIO) {
        // Projects might still be loading; don't set error yet
        if (import.meta.env.DEV) {
          console.debug('[Forecast] Portfolio: Waiting for projects to load...');
        }
        setForecastData([]);
        return;
      }
      // If we have projects but they're all filtered out, that's a real empty state
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
      
      // Reload budget and budget overview to update KPIs
      await loadAnnualBudget(budgetYear);
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

  // Load Monthly Budget
  const loadMonthlyBudget = async (year: number) => {
    if (!isPortfolioView) return; // Monthly budgets only in portfolio view
    
    setLoadingMonthlyBudget(true);
    try {
      const monthlyBudget = await finanzasClient.getAllInBudgetMonthly(year);
      if (monthlyBudget && monthlyBudget.months) {
        // Convert from API format (month: "YYYY-MM", amount) to internal format (month: 1-12, budget)
        const budgets: MonthlyBudgetInput[] = monthlyBudget.months.map(m => {
          const monthMatch = m.month.match(/^\d{4}-(\d{2})$/);
          const monthNum = monthMatch ? parseInt(monthMatch[1], 10) : 0;
          return {
            month: monthNum,
            budget: m.amount,
          };
        }).filter(b => b.month >= 1 && b.month <= 12);
        
        setMonthlyBudgets(budgets);
        setMonthlyBudgetLastUpdated(monthlyBudget.updated_at || null);
        setMonthlyBudgetUpdatedBy(monthlyBudget.updated_by || null);
        
        // If we have saved monthly budgets, enable the monthly budget mode
        if (budgets.length > 0) {
          setUseMonthlyBudget(true);
        }
      } else {
        setMonthlyBudgets([]);
        setMonthlyBudgetLastUpdated(null);
        setMonthlyBudgetUpdatedBy(null);
      }
    } catch (error: any) {
      // If 404, it means no monthly budgets are set for this year - that's okay
      if (error?.status === 404 || error?.statusCode === 404) {
        setMonthlyBudgets([]);
        setMonthlyBudgetLastUpdated(null);
        setMonthlyBudgetUpdatedBy(null);
      } else {
        console.error('Error loading monthly budget:', error);
        
        // Show user-friendly error for network failures
        if (error instanceof TypeError && error.message.includes('fetch')) {
          toast.error('Error de red al cargar presupuesto mensual. Verifique la conexión e intente nuevamente.');
        }
        // Don't show toast for other errors (optional feature, may not be configured)
      }
    } finally {
      setLoadingMonthlyBudget(false);
    }
  };

  // Save Monthly Budget
  const handleSaveMonthlyBudget = async () => {
    if (monthlyBudgets.length === 0) {
      toast.error('Ingrese al menos un presupuesto mensual');
      return;
    }

    setSavingMonthlyBudget(true);
    try {
      // Convert from internal format (month: 1-12, budget) to API format (month: "YYYY-MM", amount)
      const months = monthlyBudgets.map(mb => ({
        month: `${budgetYear}-${String(mb.month).padStart(2, '0')}`,
        amount: mb.budget,
      }));

      const result = await finanzasClient.putAllInBudgetMonthly(budgetYear, budgetCurrency, months);
      setMonthlyBudgetLastUpdated(result.updated_at);
      setMonthlyBudgetUpdatedBy(result.updated_by);
      toast.success('Presupuesto mensual guardado exitosamente');
      
      // Reload monthly budget and budget overview to update KPIs and grid
      await loadMonthlyBudget(budgetYear);
      await loadBudgetOverview(budgetYear);
    } catch (error) {
      console.error('Error saving monthly budget:', error);
      
      // Provide detailed error message for network failures
      let message: string;
      if (error instanceof TypeError && error.message.includes('fetch')) {
        message = 'Error de red al guardar presupuesto mensual. Verifique la conexión, configuración de CORS, y la URL base de la API en las variables de entorno.';
      } else {
        message = handleFinanzasApiError(error, {
          onAuthError: login,
          fallback: 'No pudimos guardar el presupuesto mensual.',
        });
      }
      toast.error(message);
    } finally {
      setSavingMonthlyBudget(false);
    }
  };

  // Reset monthly budget to auto-distribution
  const handleResetMonthlyBudget = () => {
    setMonthlyBudgets([]);
    setUseMonthlyBudget(false);
    toast.info('Presupuesto mensual restablecido a distribución automática');
  };

  // Load budget when year changes
  useEffect(() => {
    loadAnnualBudget(budgetYear);
    // Also load overview and monthly budget if in portfolio view
    if (isPortfolioView) {
      loadBudgetOverview(budgetYear);
      loadMonthlyBudget(budgetYear);
    }
  }, [budgetYear, isPortfolioView]);

  // Check if user can edit forecast, actuals, and budget
  // Per docs/ui-api-action-map.md: Forecast adjustment is PMO only
  // Per docs/finanzas-roles-and-permissions.md: Budget management is PMO/ADMIN
  const canEditForecast = ['PMO', 'SDMT'].includes(user?.current_role || '');
  const canEditActual = user?.current_role === 'SDMT';
  const canEditBudget = ['PMO', 'SDMT'].includes(user?.current_role || '');

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

  // Filter forecast data to current month when CURRENT_MONTH period is selected
  const filteredForecastData = useMemo(() => {
    if (selectedPeriod !== 'CURRENT_MONTH') {
      return forecastData;
    }
    
    const currentMonthIndex = getCurrentMonthIndex();
    const filtered = forecastData.filter(cell => cell.month === currentMonthIndex);
    
    if (import.meta.env.DEV) {
      console.debug('[Forecast] Current month filtering', {
        currentMonthIndex,
        totalCells: forecastData.length,
        filteredCells: filtered.length,
      });
    }
    
    return filtered;
  }, [forecastData, selectedPeriod]);

  // Group forecast data by line item and month for display
  const forecastGrid = useMemo(() => {
    const isCurrentMonthMode = selectedPeriod === 'CURRENT_MONTH';
    const currentMonthIndex = isCurrentMonthMode ? getCurrentMonthIndex() : 0;
    
    const grid = lineItemsForGrid.map(lineItem => {
      const itemForecasts = filteredForecastData.filter(f =>
        f.line_item_id === lineItem.id && (!lineItem.projectId || f.projectId === lineItem.projectId)
      );
      
      // In current month mode, only show the current month; otherwise show all 12 months
      const months = isCurrentMonthMode 
        ? [currentMonthIndex] 
        : Array.from({ length: 12 }, (_, i) => i + 1);

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
  }, [lineItemsForGrid, filteredForecastData, selectedProjectId, selectedPeriod]);

  const totalFTE = useMemo(() => {
    return lineItemsForGrid.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
  }, [lineItemsForGrid]);

  // Calculate totals and metrics - using useMemo to ensure it updates when data changes
  const baseMetrics = useMemo(() => {
    const totalPlanned = filteredForecastData.reduce((sum, cell) => sum + (cell.planned || 0), 0);
    const totalForecast = filteredForecastData.reduce((sum, cell) => sum + (cell.forecast || 0), 0);
    const totalActual = filteredForecastData.reduce((sum, cell) => sum + (cell.actual || 0), 0);
    
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

    if (import.meta.env.DEV && filteredForecastData.length > 0) {
      console.debug('[Forecast] Metrics recalculated', {
        projectId: selectedProjectId,
        selectedPeriod,
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
  }, [filteredForecastData, selectedProjectId, selectedPeriod]);

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
  
  // Special case: TODOS mode with only the ALL_PROJECTS placeholder (no real projects)
  const isTodosEmptyState = isPortfolioView && !isLoadingState && !forecastError && projects.length < MINIMUM_PROJECTS_FOR_PORTFOLIO;

  // Calculate monthly budget allocations when annual budget is set
  // Must be computed BEFORE monthlyTrends since trends may reference it
  const monthlyBudgetAllocations = useMemo<MonthlyAllocation[]>(() => {
    // Only calculate if we have annual budget and are in portfolio view
    const annualBudget = parseFloat(budgetAmount);
    
    if (!isPortfolioView || !annualBudget || annualBudget <= 0) {
      // Return empty allocations (zero budget per month)
      return Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        budgetAllocated: 0,
        planned: 0,
        forecast: 0,
        actual: 0,
      }));
    }

    // Aggregate monthly totals from forecast data
    const monthlyTotals = aggregateMonthlyTotals(forecastData);
    
    // NEW: If monthly budgets are provided, use those with auto-fill
    if (useMonthlyBudget && monthlyBudgets.length > 0) {
      return allocateBudgetWithMonthlyInputs(annualBudget, monthlyBudgets, monthlyTotals);
    }
    
    // Otherwise, allocate annual budget proportionally across months
    return allocateBudgetMonthly(annualBudget, monthlyTotals);
  }, [budgetAmount, isPortfolioView, forecastData, useMonthlyBudget, monthlyBudgets]);

  // Calculate runway metrics for month-by-month tracking
  const runwayMetrics = useMemo<RunwayMetrics[]>(() => {
    const annualBudget = parseFloat(budgetAmount);
    if (!annualBudget || annualBudget <= 0 || monthlyBudgetAllocations.length === 0) {
      return [];
    }
    return calculateRunwayMetrics(annualBudget, monthlyBudgetAllocations);
  }, [budgetAmount, monthlyBudgetAllocations]);

  // Check if we have a valid budget for variance analysis
  const hasBudgetForVariance = useMemo(() => {
    const annualBudget = parseFloat(budgetAmount);
    return annualBudget > 0;
  }, [budgetAmount]);

  // Chart data - recalculate when forecastData changes
  const monthlyTrends = useMemo(() => {
    const isCurrentMonthMode = selectedPeriod === 'CURRENT_MONTH';
    const currentMonthIndex = isCurrentMonthMode ? getCurrentMonthIndex() : 0;
    
    // In current month mode, show only current month; otherwise show all 12
    const monthsToShow = isCurrentMonthMode ? [currentMonthIndex] : Array.from({ length: 12 }, (_, i) => i + 1);
    
    const baseTrends = monthsToShow.map((month) => {
      const monthData = forecastData.filter(cell => cell.month === month);
      return {
        month,
        Planned: monthData.reduce((sum, cell) => sum + (cell.planned || 0), 0),
        Forecast: monthData.reduce((sum, cell) => sum + (cell.forecast || 0), 0),
        Actual: monthData.reduce((sum, cell) => sum + (cell.actual || 0), 0)
      };
    });

    if (import.meta.env.DEV && forecastData.length > 0) {
      console.debug('[Forecast] Chart trends recalculated', { 
        projectId: selectedProjectId,
        isCurrentMonthMode,
        currentMonthIndex,
        monthsShown: monthsToShow.length
      });
    }
    
    // Apply budget line when simulation is enabled OR when annual budget is set
    if (isPortfolioView && budgetSimulation.enabled && budgetTotal > 0) {
      // Use simulation budget (even distribution)
      return applyBudgetToTrends(baseTrends, budgetTotal);
    }
    
    // When annual budget is set (not simulation), use allocated budget per month
    const annualBudget = parseFloat(budgetAmount);
    if (isPortfolioView && annualBudget > 0) {
      // Use the monthly allocations we computed (filter to current month if needed)
      return baseTrends.map((trend) => {
        const allocation = monthlyBudgetAllocations.find(a => a.month === trend.month);
        return {
          ...trend,
          Budget: allocation?.budgetAllocated || 0,
        };
      });
    }
    
    return baseTrends;
  }, [forecastData, selectedProjectId, selectedPeriod, isPortfolioView, budgetSimulation.enabled, budgetTotal, budgetAmount, monthlyBudgetAllocations]);

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
    <div className="max-w-full mx-auto p-6 space-y-3">
      {/* Compact Header Row with Title, Subtitle, and Actions */}
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{ES_TEXTS.forecast.title}</h1>
              <ModuleBadge />
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {ES_TEXTS.forecast.description}
            </p>
            {currentProject && (
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className="text-xs">
                  {currentProject.name}
                </Badge>
                {!isPortfolioView && currentProject?.start_date && (
                  <span className="text-xs text-muted-foreground">
                    📅 Inicio: {new Date(currentProject.start_date).toLocaleDateString('es-ES', { 
                      month: 'short', 
                      year: 'numeric' 
                    })}
                  </span>
                )}
                <Badge variant={dataSource === 'mock' ? 'outline' : 'secondary'} className="text-xs">
                  {dataSource === 'mock' ? 'Datos de prueba' : 'Datos de API'}
                </Badge>
              </div>
            )}
          </div>
          
          {/* Primary Actions - Right Side */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={handlePersistForecasts}
              disabled={savingForecasts || dirtyForecastCount === 0 || !canEditForecast}
              className="gap-2 h-9"
              size="sm"
            >
              {savingForecasts ? <LoadingSpinner size="sm" /> : null}
              Guardar Pronóstico
              {dirtyForecastCount > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {dirtyForecastCount}
                </Badge>
              )}
            </Button>
            <Button
              onClick={handlePersistActuals}
              disabled={savingActuals || dirtyActualCount === 0}
              className="gap-2 h-9"
              variant="outline"
              size="sm"
            >
              {savingActuals ? <LoadingSpinner size="sm" /> : null}
              Guardar
              {dirtyActualCount > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {dirtyActualCount}
                </Badge>
              )}
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2 h-9" size="sm">
                  <Share2 size={16} />
                  Exportar
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Compartir Datos de Pronóstico</DialogTitle>
                  <DialogDescription>
                    Exportar y compartir datos de pronóstico en múltiples formatos para interesados y reportes.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Button 
                      variant="outline" 
                      className="h-20 flex flex-col gap-2"
                      onClick={handleExcelExport}
                      disabled={exporting !== null}
                    >
                      {exporting === 'excel' ? (
                        <LoadingSpinner size="sm" />
                      ) : (
                        <FileSpreadsheet size={24} />
                      )}
                      <span>Reporte Excel</span>
                      <span className="text-xs text-muted-foreground">
                        {exporting === 'excel' ? 'Generando...' : 'Pronóstico detallado con fórmulas'}
                      </span>
                    </Button>
                    <Button 
                      variant="outline" 
                      className="h-20 flex flex-col gap-2"
                      onClick={handlePDFExport}
                      disabled={exporting !== null}
                    >
                      {exporting === 'pdf' ? (
                        <LoadingSpinner size="sm" />
                      ) : (
                        <Share2 size={24} />
                      )}
                      <span>Resumen PDF</span>
                      <span className="text-xs text-muted-foreground">
                        {exporting === 'pdf' ? 'Generando...' : 'Formato de resumen ejecutivo'}
                      </span>
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Baseline Status Panel */}
      <BaselineStatusPanel />

      {/* KPI Summary - Standardized & Compact */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
        <Card className="h-full">
          <CardContent className="p-3">
            <div className="text-xl font-bold">{formatCurrency(totalPlanned)}</div>
            <div className="flex items-center gap-1 mt-1">
              <p className="text-xs text-muted-foreground">Total Planeado</p>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs max-w-xs">Suma de costos planificados importados desde Planview baseline</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </CardContent>
        </Card>
        <Card className="h-full">
          <CardContent className="p-3">
            <div className="text-xl font-bold">{formatCurrency(totalForecast)}</div>
            <div className="flex items-center gap-1 mt-1">
              <p className="text-xs text-muted-foreground">Pronóstico Total</p>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs max-w-xs">Pronóstico ajustado por SDMT basado en tendencias y factores de riesgo</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </CardContent>
        </Card>
        <Card className="h-full">
          <CardContent className="p-3">
            <div className="text-xl font-bold text-blue-600">{formatCurrency(totalActual)}</div>
            <div className="flex items-center gap-1 mt-1">
              <p className="text-xs text-muted-foreground">Total Real</p>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs max-w-xs">Gastos reales registrados en el sistema desde facturas conciliadas</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </CardContent>
        </Card>
        <Card className="h-full">
          <CardContent className="p-3">
            <div className="text-xl font-bold">{totalFTE.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Total FTE</p>
          </CardContent>
        </Card>
        <Card className="h-full">
          <CardContent className="p-3">
            <div className={`text-xl font-bold ${totalVariance >= 0 ? 'text-red-600' : 'text-green-600'}`}>
              {formatCurrency(Math.abs(totalVariance))}
            </div>
            <div className="flex items-center gap-1 mt-1">
              {getVarianceIcon(totalVariance)}
              <p className="text-xs text-muted-foreground">Variación Pronóstico</p>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs max-w-xs">Diferencia entre pronóstico y planificado (Forecast - Planned)</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="text-xs text-muted-foreground">{Math.abs(variancePercentage).toFixed(1)}%</p>
          </CardContent>
        </Card>
        <Card className="h-full">
          <CardContent className="p-3">
            <div className={`text-xl font-bold ${actualVariance >= 0 ? 'text-red-600' : 'text-green-600'}`}>
              {formatCurrency(Math.abs(actualVariance))}
            </div>
            <div className="flex items-center gap-1 mt-1">
              {getVarianceIcon(actualVariance)}
              <p className="text-xs text-muted-foreground">Variación Real</p>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs max-w-xs">Diferencia entre gastos reales y planificado (Actual - Planned)</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="text-xs text-muted-foreground">{Math.abs(actualVariancePercentage).toFixed(1)}%</p>
          </CardContent>
        </Card>
      </div>

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
      {isPortfolioView && !budgetSimulation.enabled && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3">
          <Card className="border-blue-500/30">
            <CardContent className="p-3">
              <div className="text-2xl font-bold text-blue-600">
                {budgetOverview?.budgetAllIn ? formatCurrency(budgetOverview.budgetAllIn.amount) : '—'}
              </div>
              <p className="text-sm text-muted-foreground">Presupuesto Anual All-In</p>
              <p className="text-xs text-muted-foreground">
                {budgetOverview?.budgetAllIn ? `${budgetOverview.budgetAllIn.currency} · ${budgetOverview.year}` : 'No configurado'}
              </p>
            </CardContent>
          </Card>
          <Card className="border-blue-500/30">
            <CardContent className="p-3">
              {budgetOverview?.budgetAllIn ? (
                <>
                  <div className={`text-2xl font-bold ${
                    budgetOverview.totals.varianceBudgetVsForecast >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {formatCurrency(Math.abs(budgetOverview.totals.varianceBudgetVsForecast))}
                  </div>
                  <div className="flex items-center gap-1">
                    {getVarianceIcon(-budgetOverview.totals.varianceBudgetVsForecast)}
                    <p className="text-sm text-muted-foreground">{ES_TEXTS.forecast.overUnderBudget}</p>
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
                </>
              ) : (
                <>
                  <div className="text-2xl font-bold text-muted-foreground">—</div>
                  <p className="text-sm text-muted-foreground">{ES_TEXTS.forecast.overUnderBudget}</p>
                  <p className="text-xs text-muted-foreground">No hay presupuesto</p>
                </>
              )}
            </CardContent>
          </Card>
          <Card className="border-blue-500/30">
            <CardContent className="p-3">
              <div className={`text-2xl font-bold ${
                budgetOverview?.totals.percentBudgetConsumedForecast !== null && budgetOverview?.totals.percentBudgetConsumedForecast !== undefined
                  ? (budgetOverview.totals.percentBudgetConsumedForecast > 100 
                      ? 'text-red-600' 
                      : budgetOverview.totals.percentBudgetConsumedForecast > 90 
                        ? 'text-yellow-600' 
                        : 'text-green-600')
                  : 'text-muted-foreground'
              }`}>
                {budgetOverview?.totals.percentBudgetConsumedForecast !== null && budgetOverview?.totals.percentBudgetConsumedForecast !== undefined
                  ? `${budgetOverview.totals.percentBudgetConsumedForecast.toFixed(1)}%`
                  : '—'}
              </div>
              <div className="flex items-center gap-1">
                <p className="text-sm text-muted-foreground">% Consumo Pronóstico</p>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs max-w-xs">Porcentaje del presupuesto consumido según pronóstico (Forecast / Budget × 100)</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-xs text-muted-foreground">Forecast / Budget</p>
            </CardContent>
          </Card>
          <Card className="border-blue-500/30">
            <CardContent className="p-3">
              <div className={`text-2xl font-bold ${
                budgetOverview?.totals.percentBudgetConsumedActual !== null && budgetOverview?.totals.percentBudgetConsumedActual !== undefined
                  ? (budgetOverview.totals.percentBudgetConsumedActual > 100 
                      ? 'text-red-600' 
                      : budgetOverview.totals.percentBudgetConsumedActual > 90 
                        ? 'text-yellow-600' 
                        : 'text-green-600')
                  : 'text-muted-foreground'
              }`}>
                {budgetOverview?.totals.percentBudgetConsumedActual !== null && budgetOverview?.totals.percentBudgetConsumedActual !== undefined
                  ? `${budgetOverview.totals.percentBudgetConsumedActual.toFixed(1)}%`
                  : '—'}
              </div>
              <div className="flex items-center gap-1">
                <p className="text-sm text-muted-foreground">% Consumo Real</p>
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
              <p className="text-xs text-muted-foreground">Actual / Budget</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Budget & Simulation Panel - Collapsible */}
      <Collapsible>
        <Card className="border-2 border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Presupuesto & Simulación</CardTitle>
              </div>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  aria-label="Expandir/Colapsar panel de presupuesto"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </CollapsibleTrigger>
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0">
              {/* Annual Budget Editor */}
              <div className="space-y-3">
                <div className="text-sm font-medium">Presupuesto Anual All-In</div>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="flex-shrink-0 w-20">
                    <label htmlFor="budget-year" className="text-xs text-muted-foreground block mb-1">Año</label>
                    <Input
                      id="budget-year"
                      type="number"
                      value={budgetYear}
                      onChange={(e) => setBudgetYear(parseInt(e.target.value))}
                      min={2020}
                      max={2100}
                      disabled={loadingBudget || savingBudget || !canEditBudget}
                      className="h-8 text-sm"
                      aria-label="Año del presupuesto"
                    />
                  </div>
                  <div className="flex-grow min-w-[140px] max-w-[200px]">
                    <label htmlFor="budget-amount" className="text-xs text-muted-foreground block mb-1">Monto</label>
                    <Input
                      id="budget-amount"
                      type="number"
                      value={budgetAmount}
                      onChange={(e) => setBudgetAmount(e.target.value)}
                      placeholder="0"
                      disabled={loadingBudget || savingBudget || !canEditBudget}
                      className="h-8 text-sm"
                      aria-label="Monto del presupuesto"
                    />
                  </div>
                  <div className="flex-shrink-0 w-20">
                    <label htmlFor="budget-currency" className="text-xs text-muted-foreground block mb-1">Moneda</label>
                    <select
                      id="budget-currency"
                      value={budgetCurrency}
                      onChange={(e) => setBudgetCurrency(e.target.value)}
                      disabled={loadingBudget || savingBudget || !canEditBudget}
                      className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Moneda del presupuesto"
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="MXN">MXN</option>
                    </select>
                  </div>
                  <Button
                    onClick={handleSaveAnnualBudget}
                    disabled={savingBudget || loadingBudget || !canEditBudget || !budgetAmount}
                    className="gap-2 h-8"
                    size="sm"
                  >
                    {savingBudget ? <LoadingSpinner size="sm" /> : null}
                    {savingBudget ? 'Guardando...' : 'Guardar Presupuesto'}
                  </Button>
                </div>
                {budgetLastUpdated && (
                  <div className="text-xs text-muted-foreground mt-2">
                    📅 Última actualización: {new Date(budgetLastUpdated).toLocaleString('es-MX')}
                  </div>
                )}
                {!canEditBudget && (
                  <div className="text-xs text-amber-600 mt-2">
                    ⚠️ Solo usuarios PMO/SDMT pueden editar el presupuesto anual
                  </div>
                )}
                {!isPortfolioView && budgetAmount && (
                  <div className="text-xs text-muted-foreground mt-2">
                    ℹ️ Presupuesto All-In aplica a todos los proyectos; seleccione "TODOS" para ver consumo total.
                  </div>
                )}
              </div>
              
              {/* Monthly Budget Input - Only in Portfolio View when annual budget is set */}
              {isPortfolioView && budgetAmount && parseFloat(budgetAmount) > 0 && (
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-medium">Modo: Presupuesto Mensual</div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="use-monthly-budget" className="text-sm text-muted-foreground">
                        Habilitar entrada mensual
                      </Label>
                      <input
                        type="checkbox"
                        id="use-monthly-budget"
                        checked={useMonthlyBudget}
                        onChange={(e) => setUseMonthlyBudget(e.target.checked)}
                        disabled={!canEditBudget}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </div>
                  </div>
                  {useMonthlyBudget && (
                    <MonthlyBudgetCard
                      monthlyBudgets={monthlyBudgets}
                      annualBudgetReference={parseFloat(budgetAmount)}
                      onMonthlyBudgetsChange={setMonthlyBudgets}
                      onSave={handleSaveMonthlyBudget}
                      onReset={handleResetMonthlyBudget}
                      disabled={!canEditBudget || loadingMonthlyBudget}
                      saving={savingMonthlyBudget}
                      lastUpdated={monthlyBudgetLastUpdated}
                      updatedBy={monthlyBudgetUpdatedBy}
                    />
                  )}
                  {!useMonthlyBudget && (
                    <div className="text-xs text-muted-foreground p-3 bg-muted/50 rounded">
                      💡 Presupuesto se distribuye automáticamente por mes basado en costos planificados.
                      Habilite "entrada mensual" arriba para ingresar presupuestos específicos por mes.
                    </div>
                  )}
                </div>
              )}
              
              {/* Budget Simulator - Only in Portfolio View */}
              {isPortfolioView && (
                <>
                  <div className="border-t pt-4">
                    <div className="text-sm font-medium mb-3">Simulador de Presupuesto (solo vista)</div>
                    <BudgetSimulatorCard
                      simulationState={budgetSimulation}
                      onSimulationChange={setBudgetSimulation}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Portfolio Summary View - Only show in portfolio mode */}
      {isPortfolioView && !loading && forecastData.length > 0 && (
        <PortfolioSummaryView
          forecastData={forecastData}
          lineItems={portfolioLineItems}
          formatCurrency={formatCurrency}
          monthlyBudgetAllocations={monthlyBudgetAllocations}
          runwayMetrics={runwayMetrics}
          selectedPeriod={selectedPeriod}
          getCurrentMonthIndex={getCurrentMonthIndex}
          onViewProject={(projectId) => {
            // TODO: Navigate to single project view with selected project
            console.log('View project:', projectId);
          }}
        />
      )}

      {/* Forecast Grid */}
      <Card>
        <CardHeader>
          <CardTitle>
            {selectedPeriod === 'CURRENT_MONTH' 
              ? `Cuadrícula de Pronóstico - Mes Actual (M${getCurrentMonthIndex()})`
              : 'Cuadrícula de Pronóstico 12 Meses'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedPeriod === 'CURRENT_MONTH' && !isLoadingState && (
            <div className="mb-3 p-2 bg-blue-50 rounded text-sm text-blue-900">
              📅 Mostrando solo el mes en curso (M{getCurrentMonthIndex()}) - {getCalendarMonth(getCurrentMonthIndex())}
            </div>
          )}
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
          ) : isTodosEmptyState ? (
            <div className="flex items-center justify-center h-48">
              <div className="text-center space-y-4 max-w-md">
                <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <span className="text-amber-600 font-bold text-xl">⚠️</span>
                </div>
                <div className="text-lg font-semibold text-foreground">
                  No se encontraron proyectos para 'TODOS'
                </div>
                <div className="text-sm text-muted-foreground">
                  Verifica permisos y filtros. Si deberías ver proyectos, intenta recargar.
                </div>
                <div className="text-xs text-muted-foreground">
                  Proyectos cargados: {projects.length} (incluyendo ALL_PROJECTS)
                </div>
                <Button 
                  onClick={loadForecastData}
                  variant="outline"
                  size="sm"
                  className="mt-4"
                >
                  Reintentar
                </Button>
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
                    {(() => {
                      const isCurrentMonthMode = selectedPeriod === 'CURRENT_MONTH';
                      const currentMonthIndex = isCurrentMonthMode ? getCurrentMonthIndex() : 0;
                      const monthsToShow = isCurrentMonthMode ? [currentMonthIndex] : Array.from({ length: 12 }, (_, i) => i + 1);
                      
                      return monthsToShow.map((monthNum) => (
                        <TableHead key={monthNum} className="text-center min-w-[140px]">
                          <div className="font-semibold">M{monthNum}</div>
                          {!isPortfolioView && currentProject?.start_date && (
                            <div className="text-xs font-normal text-muted-foreground mt-1">
                              {getCalendarMonth(monthNum)}
                            </div>
                          )}
                          <div className="text-xs font-normal text-muted-foreground mt-1">
                            P / F / A
                          </div>
                        </TableHead>
                      ));
                    })()}
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
      {!loading && forecastData.length > 0 && (() => {
        const charts = [
          <LineChartComponent
            key={`forecast-trends-${selectedProjectId}`}
            data={monthlyTrends}
            lines={[
              { dataKey: 'Planned', name: ES_TEXTS.forecast.plan.replace(' (P)', ''), color: 'oklch(0.45 0.12 200)', strokeDasharray: '5 5' },
              { dataKey: 'Forecast', name: ES_TEXTS.forecast.forecast.replace(' (F)', ''), color: 'oklch(0.61 0.15 160)', strokeWidth: 3 },
              { dataKey: 'Actual', name: ES_TEXTS.forecast.actual.replace(' (A)', ''), color: 'oklch(0.72 0.15 65)' },
              // Add Budget line when simulation is enabled OR when annual budget is set
              ...(isPortfolioView && (
                (budgetSimulation.enabled && budgetTotal > 0) || hasBudgetForVariance
              )
                ? [{ dataKey: 'Budget', name: ES_TEXTS.forecast.budgetLineLabel, color: 'oklch(0.5 0.2 350)', strokeDasharray: '8 4', strokeWidth: 2 }]
                : [])
            ]}
            title={ES_TEXTS.forecast.monthlyForecastTrends}
          />
        ];

        // ALWAYS add variance analysis chart (required by specs)
        // Show placeholder if no budget, variance vs budget if budget exists
        if (hasBudgetForVariance) {
          // Show variance vs allocated budget
          charts.push(
            <StackedColumnsChart
              key={`variance-analysis-${selectedProjectId}`}
              data={monthlyBudgetAllocations.map(allocation => {
                const forecastVariance = allocation.forecast - allocation.budgetAllocated;
                const actualVariance = allocation.actual - allocation.budgetAllocated;
                return {
                  month: allocation.month,
                  'Forecast Over Budget': Math.max(0, forecastVariance),
                  'Forecast Under Budget': Math.abs(Math.min(0, forecastVariance)),
                  'Actual Over Budget': Math.max(0, actualVariance),
                  'Actual Under Budget': Math.abs(Math.min(0, actualVariance)),
                };
              })}
              stacks={[
                { dataKey: 'Forecast Over Budget', name: ES_TEXTS.forecast.forecastOverBudget, color: 'oklch(0.65 0.2 30)' },
                { dataKey: 'Forecast Under Budget', name: ES_TEXTS.forecast.forecastUnderBudget, color: 'oklch(0.55 0.15 140)' },
                { dataKey: 'Actual Over Budget', name: ES_TEXTS.forecast.actualOverBudget, color: 'oklch(0.70 0.25 25)' },
                { dataKey: 'Actual Under Budget', name: ES_TEXTS.forecast.actualUnderBudget, color: 'oklch(0.60 0.18 150)' },
              ]}
              title={ES_TEXTS.forecast.varianceAnalysisVsBudget}
            />
          );
        } else {
          // Show placeholder card prompting to set budget
          charts.push(
            <Card key="variance-placeholder" className="border-2 border-dashed border-muted">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{ES_TEXTS.forecast.varianceAnalysis}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center h-[300px] text-center">
                <div className="w-16 h-16 bg-muted/50 rounded-lg flex items-center justify-center mb-4">
                  <Calculator className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground mb-2">
                  Análisis de Variación No Disponible
                </p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  Define el Presupuesto Anual All-In arriba para ver la variación mensual vs presupuesto asignado.
                </p>
              </CardContent>
            </Card>
          );
        }

        return (
          <ChartInsightsPanel
            title="Forecast Analytics & Trends"
            charts={charts}
            insights={[
              {
                title: ES_TEXTS.forecast.forecastAccuracy,
                value: `${(100 - Math.abs(variancePercentage)).toFixed(1)}%`,
                type: variancePercentage < 5 ? 'positive' : variancePercentage > 15 ? 'negative' : 'neutral'
              },
              {
                title: ES_TEXTS.forecast.largestVariance,
                value: formatCurrency(Math.max(...forecastData.map(c => Math.abs(c.variance || 0)))),
                type: 'neutral'
              },
              {
                title: ES_TEXTS.forecast.forecastVsPlanned,
                value: totalForecast > totalPlanned ? ES_TEXTS.forecast.overBudget : totalForecast < totalPlanned ? ES_TEXTS.forecast.underBudget : ES_TEXTS.forecast.onTarget,
                type: totalForecast > totalPlanned ? 'negative' : totalForecast < totalPlanned ? 'positive' : 'neutral'
              },
              // Add budget insights when simulation is enabled
              ...(isPortfolioView && budgetSimulation.enabled && budgetTotal > 0
                ? [{
                    title: ES_TEXTS.forecast.budgetUtilization,
                    value: `${budgetUtilization.toFixed(1)}%`,
                    type: budgetUtilization > 100 ? 'negative' : budgetUtilization > 90 ? 'neutral' : 'positive'
                  }]
                : [])
            ]}
            onExport={handleExcelExport}
          />
        );
      })()}
    </div>
  );
}

export default SDMTForecast;