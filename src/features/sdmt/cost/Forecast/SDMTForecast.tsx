import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Share2,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  FileSpreadsheet,
  Info,
  Calculator,
  ChevronDown,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { ChartInsightsPanel } from "@/components/ChartInsightsPanel";
import LineChartComponent from "@/components/charts/LineChart";
import { StackedColumnsChart } from "@/components/charts/StackedColumnsChart";
import ModuleBadge from "@/components/ModuleBadge";
import LoadingSpinner from "@/components/LoadingSpinner";
import type { ForecastCell, LineItem } from "@/types/domain";
import { useAuth } from "@/hooks/useAuth";
import { ALL_PROJECTS_ID, useProject } from "@/contexts/ProjectContext";
import { handleFinanzasApiError } from "@/features/sdmt/cost/utils/errorHandling";
import { useNavigate, useLocation } from "react-router-dom";
import { excelExporter, downloadExcelFile } from "@/lib/excel-export";
import {
  PDFExporter,
  formatReportCurrency,
  formatReportPercentage,
  getChangeType,
} from "@/lib/pdf-export";
import { computeTotals, computeVariance } from "@/lib/forecast/analytics";
import { normalizeForecastCells, normalizeRubroId } from "@/features/sdmt/cost/utils/dataAdapters";
import { getCanonicalRubroId, getTaxonomyById } from "@/lib/rubros/canonical-taxonomy";
import { useProjectLineItems } from "@/hooks/useProjectLineItems";
import {
  bulkUploadPayrollActuals,
  type PayrollActualInput,
  getProjectRubros,
  getBaselineById,
  type BaselineDetail,
  acceptBaseline,
  getAllocations,
} from "@/api/finanzas";
import { getForecastPayload, getProjectInvoices } from "./forecastService";
import { normalizeInvoiceMonth } from "./useSDMTForecastData";
import { computeForecastFromAllocations, type Allocation } from "./computeForecastFromAllocations";
import finanzasClient from "@/api/finanzasClient";
import { ES_TEXTS } from "@/lib/i18n/es";
import { BaselineStatusPanel } from "@/components/baseline/BaselineStatusPanel";
import { BudgetSimulatorCard } from "./BudgetSimulatorCard";
import { MonthlyBudgetCard } from "./MonthlyBudgetCard";
import { PortfolioSummaryView } from "./PortfolioSummaryView";
import { ForecastSummaryBar } from "./components/ForecastSummaryBar";
import { ForecastChartsPanel } from "./components/ForecastChartsPanel";
import { ForecastRubrosTable } from "./components/ForecastRubrosTable";
import { TopVarianceProjectsTable } from "./components/TopVarianceProjectsTable";
import { TopVarianceRubrosTable } from "./components/TopVarianceRubrosTable";
import { MonthlySnapshotGrid } from "./components/MonthlySnapshotGrid";
import { ForecastActionsMenu } from "./components/ForecastActionsMenu";
import { DataHealthPanel } from "@/components/finanzas/DataHealthPanel";
import type {
  BudgetSimulationState,
  SimulatedMetrics,
} from "./budgetSimulation";
import { applyBudgetSimulation, applyBudgetToTrends } from "./budgetSimulation";
import { isBudgetNotFoundError, resolveAnnualBudgetState } from "./budgetState";
import { FEATURE_FLAGS } from "@/config/featureFlags";
import { ForecastRubrosAdapter } from "./components/ForecastRubrosAdapter";
import {
  allocateBudgetMonthly,
  aggregateMonthlyTotals,
  allocateBudgetWithMonthlyInputs,
  calculateRunwayMetrics,
  type MonthlyAllocation,
  type MonthlyBudgetInput,
  type RunwayMetrics,
} from "./budgetAllocation";
import {
  buildCategoryTotals,
  buildCategoryRubros,
  buildPortfolioTotals,
} from "./categoryGrouping";
import { buildProjectTotals, buildProjectRubros } from "./projectGrouping";

import { getBaselineDuration, clampMonthIndex } from "./monthHelpers";

// ---- Exported helpers for month support and testing ----
// Re-exported from monthHelpers.ts for backward compatibility
export { getBaselineDuration, clampMonthIndex };
// ---------------------------------------------------------

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

// TODOS MODE – DATA NOTES
// ========================
// Portfolio Forecast Loading:
//   - Function: loadPortfolioForecast(months, requestKey) (line ~570)
//   - Uses Promise.all to fetch forecast data for all projects in parallel (excluding ALL_PROJECTS_ID)
//   - For each project: getForecastPayload, getProjectInvoices, getProjectRubros
//   - Falls back to baseline line items if server forecast is empty and baseline is accepted
//   - Aggregates all project data into portfolioLineItems and forecastData states
//   - Handles stale request detection via requestKey to prevent race conditions
//   - TODO: Replace per-project fan-out with aggregate portfolio endpoints when available
//
// All-In Budget Monthly GET/PUT:
//   - GET function: finanzasClient.getAllInBudgetMonthly(year) in src/api/finanzasClient.ts (line ~661)
//   - PUT function: finanzasClient.putAllInBudgetMonthly(year, currency, months) in src/api/finanzasClient.ts (line ~693)
//   - Load function: loadMonthlyBudget(year) (line ~942)
//   - Save function: handleSaveMonthlyBudget() (line ~1007)
//   - State: monthlyBudgets (12 month entries), useMonthlyBudget (boolean flag)
//   - Metadata: monthlyBudgetLastUpdated, monthlyBudgetUpdatedBy
//   - 404 handling: Treated as "no budget set" - initializes empty 12-month array, sets useMonthlyBudget=false
//   - Only active in TODOS/ALL_PROJECTS mode (isPortfolioView)
//
// Known Issues / Warnings:
//   - Monthly budget 404 returns warning: "Monthly budget not found for {year}" - this is expected/non-blocking
//   - Portfolio loading may show "Waiting for projects to load..." if only ALL_PROJECTS placeholder exists
//   - No explicit pagination handling for project list (assumes all projects fit in single response)

type ForecastRow = ForecastCell & {
  projectId?: string;
  projectName?: string;
  rubroId?: string;
  description?: string;
  category?: string;
};
type ProjectLineItem = LineItem & { projectId?: string; projectName?: string };
type LineItemLike = Record<string, unknown>;

// Constants
const MINIMUM_PROJECTS_FOR_PORTFOLIO = 2; // ALL_PROJECTS + at least one real project
const PORTFOLIO_PROJECTS_WAIT_MS = Number(import.meta.env.VITE_FINZ_PORTFOLIO_WAIT_MS || 500); // Wait time for projects to populate (race condition mitigation)

// Feature flags for new forecast layout
const NEW_FORECAST_LAYOUT_ENABLED = import.meta.env.VITE_FINZ_NEW_FORECAST_LAYOUT === 'true';
const SHOW_KEY_TRENDS = import.meta.env.VITE_FINZ_SHOW_KEYTRENDS === 'true';

// Backward compatibility: HIDE_KEY_TRENDS is deprecated, use SHOW_KEY_TRENDS instead

// Feature flag to hide executive key-trends (projects & rubros) cards
const HIDE_KEY_TRENDS = import.meta.env.VITE_FINZ_HIDE_KEY_TRENDS === 'true';

// Feature flag to hide Real Annual Budget KPIs in TODOS/Portfolio view
const HIDE_REAL_ANNUAL_KPIS = import.meta.env.VITE_FINZ_HIDE_REAL_ANNUAL_KPIS === 'true';

// Feature flag to hide Resumen de Portafolio in TODOS mode
const HIDE_PROJECT_SUMMARY = import.meta.env.VITE_FINZ_HIDE_PROJECT_SUMMARY === 'true';

// Feature flag to show Portfolio KPI tiles in new layout (default false for minimal view)
const SHOW_PORTFOLIO_KPIS = import.meta.env.VITE_FINZ_SHOW_PORTFOLIO_KPIS === 'true';

// Debug logging for feature flags (development only)
if (import.meta.env.DEV) {
  console.log('[SDMTForecast] Feature Flags:', {
    NEW_FORECAST_LAYOUT_ENABLED,
    SHOW_KEY_TRENDS,
    HIDE_KEY_TRENDS,
    HIDE_REAL_ANNUAL_KPIS,
    HIDE_PROJECT_SUMMARY,
    SHOW_PORTFOLIO_KPIS,
  });
}

// Feature flags for portfolio summary view customization
// (Flags for ONLY_SHOW_MONTHLY_BREAKDOWN_TRANSPOSED, HIDE_EXPANDABLE_PROJECT_LIST,
// and HIDE_RUNWAY_METRICS are declared and used inside PortfolioSummaryView.tsx)

export function SDMTForecast() {
  const [forecastData, setForecastData] = useState<ForecastRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoadingForecast, setIsLoadingForecast] = useState(true);
  const [forecastError, setForecastError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null);
  const [editingCell, setEditingCell] = useState<{
    line_item_id: string;
    month: number;
    type: "forecast" | "actual";
  } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [dataSource, setDataSource] = useState<"api" | "mock">("api");
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [portfolioLineItems, setPortfolioLineItems] = useState<
    ProjectLineItem[]
  >([]);
  const [dirtyActuals, setDirtyActuals] = useState<Record<string, ForecastRow>>(
    {}
  );
  const [savingActuals, setSavingActuals] = useState(false);
  const [dirtyForecasts, setDirtyForecasts] = useState<
    Record<string, ForecastRow>
  >({});
  const [savingForecasts, setSavingForecasts] = useState(false);

  // Baseline detail for FTE calculation
  const [baselineDetail, setBaselineDetail] =
    useState<BaselineDetail | null>(null);

  // Materialization state tracking
  const [materializationPending, setMaterializationPending] = useState(false);
  const [materializationFailed, setMaterializationFailed] = useState(false);
  const [materializationTimeout, setMaterializationTimeout] = useState<number | null>(null);

  // Sorting state for forecast grid
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // State for controlling rubros grid collapsible (TODOS view)
  const [isRubrosGridOpen, setIsRubrosGridOpen] = useState(() => {
    const stored = sessionStorage.getItem('forecastRubrosGridOpen');
    return stored === 'true'; // Default to false if not set
  });
  
  // Persistent state for Portfolio Summary collapsible
  const [isPortfolioSummaryOpen, setIsPortfolioSummaryOpen] = useState(() => {
    const stored = sessionStorage.getItem('forecastPortfolioSummaryOpen');
    return stored === 'true'; // Default to false
  });
  
  // Persistent state for Budget Simulator collapsible
  const [isBudgetSimulatorOpen, setIsBudgetSimulatorOpen] = useState(() => {
    const stored = sessionStorage.getItem('forecastBudgetSimulatorOpen');
    return stored === 'true'; // Default to false
  });
  
  // Persistent state for Charts Panel collapsible
  const [isChartsPanelOpen, setIsChartsPanelOpen] = useState(() => {
    const stored = sessionStorage.getItem('forecastChartsPanelOpen');
    return stored === 'true'; // Default to false
  });
  
  // Persistent state for Monitoring Table collapsible
  const [isMonitoringTableOpen, setIsMonitoringTableOpen] = useState(() => {
    const stored = sessionStorage.getItem('forecastMonitoringTableOpen');
    return stored === 'true'; // Default to true for monitoring
  });
  
  // Persistent state for Single Project Budget Panel collapsible
  const [isSingleProjectBudgetOpen, setIsSingleProjectBudgetOpen] = useState(() => {
    const stored = sessionStorage.getItem('forecastSingleProjectBudgetOpen');
    return stored === 'true'; // Default to false
  });

  // Handlers to persist collapsible states
  const handleRubrosGridOpenChange = (open: boolean) => {
    setIsRubrosGridOpen(open);
    sessionStorage.setItem('forecastRubrosGridOpen', String(open));
  };
  
  const handlePortfolioSummaryOpenChange = (open: boolean) => {
    setIsPortfolioSummaryOpen(open);
    sessionStorage.setItem('forecastPortfolioSummaryOpen', String(open));
  };
  
  const handleBudgetSimulatorOpenChange = (open: boolean) => {
    setIsBudgetSimulatorOpen(open);
    sessionStorage.setItem('forecastBudgetSimulatorOpen', String(open));
  };
  
  const handleChartsPanelOpenChange = (open: boolean) => {
    setIsChartsPanelOpen(open);
    sessionStorage.setItem('forecastChartsPanelOpen', String(open));
  };
  
  const handleMonitoringTableOpenChange = (open: boolean) => {
    setIsMonitoringTableOpen(open);
    sessionStorage.setItem('forecastMonitoringTableOpen', String(open));
  };
  
  const handleSingleProjectBudgetOpenChange = (open: boolean) => {
    setIsSingleProjectBudgetOpen(open);
    sessionStorage.setItem('forecastSingleProjectBudgetOpen', String(open));
  };

  // Breakdown view mode for TODOS/portfolio view (Proyectos vs Rubros)
  // The ForecastRubrosTable component has its own internal viewMode that switches between
  // 'category' and 'project' views. This state tracks the user's preference at the page level.
  const [breakdownMode, setBreakdownMode] = useState<'project' | 'rubros'>(() => {
    const stored = sessionStorage.getItem('forecastBreakdownMode');
    return stored === 'rubros' ? 'rubros' : 'project';
  });
  
  // Handler for breakdown mode changes
  const handleBreakdownModeChange = (newMode: 'project' | 'rubros') => {
    setBreakdownMode(newMode);
    sessionStorage.setItem('forecastBreakdownMode', newMode);
    // Note: The ForecastRubrosTable component manages its own viewMode internally
    // and persists it in sessionStorage. This handler updates the page-level state
    // which could be used to control other aspects of the view in the future.
  };

  // Stale response guard: Track latest request to prevent race conditions
  const latestRequestKeyRef = useRef<string>("");
  const abortControllerRef = useRef<AbortController | null>(null);

  // Ref for scrolling to rubros section when category is clicked
  const rubrosSectionRef = useRef<HTMLDivElement>(null);

  const [budgetSimulation, setBudgetSimulation] =
    useState<BudgetSimulationState>({
      enabled: false,
      budgetTotal: "",
      factor: 1.0,
      estimatedOverride: "",
    });
  // Annual Budget state
  const [budgetYear, setBudgetYear] = useState<number>(
    new Date().getFullYear()
  );
  const [budgetAmount, setBudgetAmount] = useState<string>("");
  const [budgetCurrency, setBudgetCurrency] = useState<string>("USD");
  const [budgetLastUpdated, setBudgetLastUpdated] = useState<string | null>(
    null
  );
  const [budgetMissingYear, setBudgetMissingYear] = useState<number | null>(
    null
  );
  const [loadingBudget, setLoadingBudget] = useState(false);
  const [savingBudget, setSavingBudget] = useState(false);
  // Monthly Budget state (new - per user request)
  const [monthlyBudgets, setMonthlyBudgets] = useState<MonthlyBudgetInput[]>(
    []
  );
  const [useMonthlyBudget, setUseMonthlyBudget] = useState(false);
  const [loadingMonthlyBudget, setLoadingMonthlyBudget] = useState(false);
  const [savingMonthlyBudget, setSavingMonthlyBudget] = useState(false);
  const [monthlyBudgetLastUpdated, setMonthlyBudgetLastUpdated] = useState<
    string | null
  >(null);
  const [monthlyBudgetUpdatedBy, setMonthlyBudgetUpdatedBy] = useState<
    string | null
  >(null);
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
  const {
    selectedProjectId,
    setSelectedProjectId,
    selectedPeriod,
    currentProject,
    projectChangeCount,
    projects,
  } = useProject();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    lineItems,
    taxonomyByRubroId,
    isLoading: isLineItemsLoading,
    error: lineItemsError,
  } = useProjectLineItems({
    useFallback: true,
    baselineId: currentProject?.baselineId,
    withTaxonomy: true,
  });
  const safeLineItems = useMemo(
    () => (Array.isArray(lineItems) ? lineItems : []),
    [lineItems]
  );
  const isPortfolioView = selectedProjectId === ALL_PROJECTS_ID;
  const forecastMode: "single" | "all-projects" = isPortfolioView
    ? "all-projects"
    : "single";
  const lineItemsForGrid = isPortfolioView ? portfolioLineItems : safeLineItems;
  const projectStartDate = (currentProject as { start_date?: string } | null)
    ?.start_date;

  // Helper function to get current month index (1-12) based on today's date and project start
  const getCurrentMonthIndex = (): number => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1; // 1-12

    // For portfolio view or when no project start date, use calendar month (1-12)
    if (!projectStartDate || isPortfolioView) {
      return currentMonth;
    }

    // Calculate month index relative to project start date
    const startDate = new Date(projectStartDate);
    const startYear = startDate.getFullYear();
    const startMonth = startDate.getMonth() + 1; // 1-12

    // Calculate months elapsed since project start
    const monthsElapsed =
      (currentYear - startYear) * 12 + (currentMonth - startMonth) + 1;

    // Clamp according to baseline duration (fallback to 60)
    return clampMonthIndex(monthsElapsed, baselineDetail);
  };

  // Helper function to compute calendar month from monthIndex and project start date
  const getCalendarMonth = (monthIndex: number): string => {
    if (!projectStartDate) {
      // Fallback: display just the month name without year for consistency
      const monthNames = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      return monthNames[monthIndex - 1] || `M${monthIndex}`;
    }

    const startDate = new Date(projectStartDate);
    startDate.setUTCMonth(startDate.getUTCMonth() + (monthIndex - 1));
    const year = startDate.getUTCFullYear();
    const month = startDate.getUTCMonth() + 1;

    // Return month name for display (e.g., "May 2025")
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    return `${monthNames[month - 1]} ${year}`;
  };

  useEffect(() => {
    if (!lineItemsError) return;

    const message = handleFinanzasApiError(lineItemsError, {
      onAuthError: login,
      fallback: "No se pudieron cargar los rubros para forecast.",
    });
    setForecastError((prev) => prev || message);
  }, [lineItemsError, login]);

  // Load baseline details for FTE calculation and track materialization status
  useEffect(() => {
    if (currentProject?.baselineId && !isPortfolioView) {
      getBaselineById(currentProject.baselineId)
        .then((data) => {
          if (import.meta.env.DEV) {
            console.log(
              "[SDMTForecast] Baseline details loaded for FTE calculation",
              { baselineId: currentProject.baselineId, data }
            );
          }
          setBaselineDetail(data);
          
          // Track materialization status from metadata
          const meta = data?.metadata ?? {};
          const isPending = !!meta?.materialization_queued_at || meta?.materialization_status === 'pending';
          const isFailed = meta?.materialization_status === 'failed' || !!meta?.materialization_failed;
          const materializedAt = meta?.materializedAt ?? data?.materializedAt ?? meta?.materialized_at;
          
          if (import.meta.env.DEV) {
            console.log("[SDMTForecast] Baseline materialization status:", {
              isPending,
              isFailed,
              materializedAt,
              materialization_status: meta?.materialization_status,
              materialization_queued_at: meta?.materialization_queued_at,
            });
          }
          
          setMaterializationPending(isPending && !materializedAt);
          setMaterializationFailed(isFailed);
          
          // Compute timeout if queued for more than 15 minutes
          if (isPending && meta?.materialization_queued_at && !materializedAt) {
            const queuedTs = new Date(meta.materialization_queued_at).getTime();
            const elapsedMin = (Date.now() - queuedTs) / (1000 * 60);
            setMaterializationTimeout(elapsedMin > 15 ? Math.round(elapsedMin) : null);
          } else {
            setMaterializationTimeout(null);
          }
        })
        .catch((err) => {
          console.error("Failed to load baseline details:", err);
          setBaselineDetail(null);
          setMaterializationFailed(true);
          setMaterializationPending(false);
          setMaterializationTimeout(null);
        });
    } else {
      setBaselineDetail(null);
      setMaterializationPending(false);
      setMaterializationFailed(false);
      setMaterializationTimeout(null);
    }
  }, [currentProject?.baselineId, isPortfolioView]);

  const transformLineItemsToForecast = (
    lineItems: LineItemLike[],
    months: number,
    projectId: string
  ): ForecastRow[] => {
    if (!lineItems || lineItems.length === 0) return [];

    const forecastCells: ForecastRow[] = [];

    const resolveNumber = (value: unknown, fallback = 0): number => {
      if (value === null || value === undefined) return fallback;
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : fallback;
    };

    const resolveDuration = (
      item: LineItemLike
    ): { value: number; fromData: boolean } => {
      const baseline = item.baseline as LineItemLike | undefined;
      const candidates = [
        item.duration,
        item.duracion,
        baseline?.duration,
        baseline?.duracion,
        item.baseline_duration,
        item.baseline_duracion,
      ];
      for (const candidate of candidates) {
        const parsed = resolveNumber(candidate, NaN);
        if (Number.isFinite(parsed) && parsed > 0) {
          return { value: Math.trunc(parsed), fromData: true };
        }
      }
      return { value: 1, fromData: false };
    };

    const resolveString = (value: unknown): string | undefined => {
      if (typeof value === "string" && value.trim().length > 0) {
        return value;
      }
      return undefined;
    };

    lineItems.forEach((item) => {
      const lineItemId =
        resolveString(item.id) ||
        resolveString(item.rubroId) ||
        resolveString(item.rubro_id) ||
        resolveString(item.linea_codigo) ||
        resolveString(item.linea_id) ||
        "";

      if (!lineItemId) {
        return;
      }

      const rubroKey =
        resolveString(item.rubroId) ||
        resolveString(item.rubro_id) ||
        resolveString(item.linea_codigo) ||
        lineItemId;

      const duration = resolveDuration(item);
      const startMonthRaw = resolveNumber(item.start_month, NaN);
      const endMonthRaw = resolveNumber(item.end_month, NaN);
      const hasExplicitRange =
        Number.isFinite(startMonthRaw) || Number.isFinite(endMonthRaw);
      const startMonth = hasExplicitRange
        ? Math.max(
            1,
            Math.min(
              months,
              Number.isFinite(startMonthRaw) ? Math.trunc(startMonthRaw) : 1
            )
          )
        : 1;
      const endMonth = hasExplicitRange
        ? Math.max(
            startMonth,
            Math.min(
              months,
              Number.isFinite(endMonthRaw) ? Math.trunc(endMonthRaw) : months
            )
          )
        : duration.fromData
        ? Math.min(months, duration.value)
        : months;

      const resolveFirstNumber = (values: unknown[]): number | null => {
        for (const value of values) {
          if (value === null || value === undefined) continue;
          if (typeof value === "string" && value.trim().length === 0) continue;
          const numeric = Number(value);
          if (Number.isFinite(numeric)) return numeric;
        }
        return null;
      };

      const baseTotal = resolveFirstNumber([
        item.total_cost,
        item.totalCost,
        item.total,
        item.monto_total,
        item.amount,
        item.monto,
      ]);

      const unitCost = resolveNumber(
        item.unitCost ?? item.costo_unitario ?? item.unit_cost,
        0
      );
      const qty =
        resolveNumber(item.qty ?? item.cantidad ?? item.quantity, 1) || 1;
      const computedTotal = baseTotal ?? unitCost * qty;
      const activeMonthCount = Math.max(1, endMonth - startMonth + 1);
      const defaultMonthlyAmount = computedTotal / activeMonthCount;
      const monthlyValues = Array.isArray(item.monthly) ? item.monthly : null;

      for (let month = startMonth; month <= endMonth; month += 1) {
        const monthIndex = month - 1;
        const monthlyOverride = monthlyValues
          ? resolveNumber(monthlyValues[monthIndex], NaN)
          : NaN;
        const amount = Number.isFinite(monthlyOverride)
          ? monthlyOverride
          : defaultMonthlyAmount;

        // Try to resolve category and description from canonical taxonomy
        const taxonomy = getTaxonomyById(lineItemId) || getTaxonomyById(rubroKey);
        
        const description = 
          resolveString(item.description) ||
          resolveString(item.descripcion) ||
          (taxonomy ? taxonomy.linea_gasto || taxonomy.descripcion : '') ||
          lineItemId;
        
        const category = 
          resolveString(item.category) || 
          resolveString(item.categoria) || 
          (taxonomy ? taxonomy.categoria : '');

        forecastCells.push({
          line_item_id: lineItemId,
          rubroId: rubroKey,
          projectId,
          description,
          category,
          month,
          planned: amount,
          forecast: amount,
          actual: 0,
          variance: 0,
          last_updated: new Date().toISOString(),
          updated_by: user?.email || user?.login || "system",
        });
      }
    });

    return forecastCells;
  };

  const resolveBaselineStatus = (
    project?: { baselineStatus?: string; baseline_status?: string } | null
  ): string | null => {
    return project?.baselineStatus ?? project?.baseline_status ?? null;
  };

  /**
   * Load forecast data for a single project
   */
  const loadSingleProjectForecast = async (
    projectId: string,
    months: number,
    requestKey: string
  ) => {
    const payload = await getForecastPayload(projectId, months);

    // Check if request is still valid before continuing
    if (latestRequestKeyRef.current !== requestKey) {
      return; // Stale, abort processing
    }

    // Pass baseline ID and enable debug mode in development for better diagnostics
    const debugMode = import.meta.env.DEV;
    let normalized = normalizeForecastCells(payload.data, {
      baselineId: currentProject?.baselineId,
      debugMode,
    });
    let usedFallback = false;
    const baselineStatus = resolveBaselineStatus(
      currentProject as {
        baselineStatus?: string;
        baseline_status?: string;
      } | null
    );
    const hasAcceptedBaseline = baselineStatus === "accepted";

    // Fallback: If server forecast is empty and we have line items, use them
    if (
      (!normalized || normalized.length === 0) &&
      safeLineItems &&
      safeLineItems.length > 0 &&
      hasAcceptedBaseline
    ) {
      if (import.meta.env.DEV) {
        console.debug(
          `[SDMTForecast] Using baseline fallback for ${projectId}, baseline ${currentProject?.baselineId}: ${safeLineItems.length} line items`
        );
      }
      normalized = transformLineItemsToForecast(
        safeLineItems,
        months,
        projectId
      );
      usedFallback = true;
    } else if (normalized && normalized.length > 0 && import.meta.env.DEV) {
      console.debug(
        `[SDMTForecast] Using server forecast rows for ${projectId}, baseline ${currentProject?.baselineId}`
      );
    }

    setDataSource(usedFallback ? "mock" : payload.source); // Mark as 'mock' to indicate fallback
    setGeneratedAt(payload.generatedAt);
    setPortfolioLineItems([]);

    // Get matched invoices and sync with actuals
    const invoices = await getProjectInvoices(projectId);

    // Check again after async operation
    if (latestRequestKeyRef.current !== requestKey) {
      return;
    }

    const matchedInvoices = invoices.filter((inv) => inv.status === "Matched");

    const updatedData: ForecastRow[] = normalized.map((cell) => {
      const matchedInvoice = matchedInvoices.find(
        (inv) =>
          inv.line_item_id === cell.line_item_id && inv.month === cell.month
      );

      const withActuals = matchedInvoice
        ? {
            ...cell,
            actual: matchedInvoice.amount || 0,
            variance: cell.forecast - cell.planned, // Keep forecast-based variance
          }
        : cell;

      return {
        ...withActuals,
        projectId,
        projectName: currentProject?.name,
      };
    });

    if (import.meta.env.DEV) {
      console.debug("[Forecast] data pipeline", {
        projectId,
        rawCells: Array.isArray(payload.data) ? payload.data.length : 0,
        normalizedCells: normalized.length,
        invoices: invoices.length,
        matchedInvoices: matchedInvoices.length,
        lineItems: safeLineItems.length,
        usedFallback,
        generatedAt: payload.generatedAt,
      });
      
      // DEV telemetry: Track unmatched invoices to help debug actuals
      const unmatchedInvoices = matchedInvoices.filter(inv => {
        return !normalized.some(cell => 
          cell.line_item_id === inv.line_item_id && cell.month === inv.month
        );
      });
      
      // Calculate total actual from matched invoices
      const totalActualFromInvoices = updatedData.reduce((sum, cell) => sum + (cell.actual || 0), 0);
      
      if (unmatchedInvoices.length > 0) {
        console.debug(
          `[Forecast] unmatchedInvoices=${unmatchedInvoices.length}/${matchedInvoices.length}`,
          {
            sample: unmatchedInvoices.slice(0, 3).map(inv => ({
              line_item_id: inv.line_item_id,
              month: inv.month,
              amount: inv.amount,
              rubroId: inv.rubroId || inv.rubro_id,
            })),
            forecastKeys: normalized.slice(0, 5).map(cell => ({
              line_item_id: cell.line_item_id,
              month: cell.month,
              rubroId: cell.rubroId,
            })),
          }
        );
      }
      
      // Log summary of actuals
      console.debug(
        `[Forecast] Actuals summary for ${projectId}:`,
        {
          totalInvoices: invoices.length,
          matchedInvoices: matchedInvoices.length,
          totalActualAmount: totalActualFromInvoices,
          cellsWithActuals: updatedData.filter(c => (c.actual || 0) > 0).length,
        }
      );
    }

    // Final check before setting state
    if (latestRequestKeyRef.current !== requestKey) {
      return;
    }

    setForecastData(updatedData);

    if (import.meta.env.DEV) {
      console.debug("[Forecast] Data loaded", {
        projectId,
        source: usedFallback ? "lineItems-fallback" : payload.source,
        records: updatedData.length,
      });
    }
  };

  const loadPortfolioForecast = async (months: number, requestKey: string) => {
    if (import.meta.env.DEV) {
      console.log(
        `[loadPortfolioForecast] projects loaded: ${projects.length}, ids: ${JSON.stringify(projects.map(p => p.id))}`
      );
    }
    
    let candidateProjects = projects.filter(
      (project) => project.id && project.id !== ALL_PROJECTS_ID
    );
    // TODO(SDMT): Replace per-project fan-out with aggregate portfolio endpoints when available.

    // Guard: Don't error out if projects haven't loaded yet
    // Only show error after we're sure the list is definitively empty
    if (candidateProjects.length === 0) {
      // Check if we're still in initial load state (only ALL_PROJECTS exists)
      if (projects.length < MINIMUM_PROJECTS_FOR_PORTFOLIO) {
        // Projects might still be loading; don't set error yet
        if (import.meta.env.DEV) {
          console.debug(
            "[Forecast] Portfolio: Waiting for projects to load..."
          );
        }
        // Short wait to avoid spurious empty projects on initial load / race conditions
        await new Promise((res) => setTimeout(res, PORTFOLIO_PROJECTS_WAIT_MS));
        candidateProjects = projects.filter((p) => p.id && p.id !== ALL_PROJECTS_ID);
        if (candidateProjects.length === 0) {
          if (import.meta.env.DEV) {
            console.debug("[Forecast] Portfolio: still no candidate projects after waiting");
          }
          setForecastData([]);
          return;
        }
        // If we now have candidates after waiting, proceed with them below
      } else {
        // If we have projects but they're all filtered out, that's a real empty state
        setForecastError("No hay proyectos disponibles para consolidar.");
        setForecastData([]);
        return;
      }
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

          // Check if request is still valid after async operations
          if (latestRequestKeyRef.current !== requestKey) {
            // Return empty result to be filtered out, don't throw
            return null;
          }

          const debugMode = import.meta.env.DEV;
          let normalized = normalizeForecastCells(payload.data, {
            baselineId: project.baselineId,
            debugMode,
          });
          const baselineStatus = resolveBaselineStatus(
            project as {
              baselineStatus?: string;
              baseline_status?: string;
            } | null
          );
          const hasAcceptedBaseline = baselineStatus === "accepted";
          let usedFallback = false;

          // Log allocations fetched for portfolio project
          if (import.meta.env.DEV) {
            console.debug(
              `[loadPortfolioForecast] project ${project.id}: forecast=${payload.data?.length || 0} allocations=${allocations?.length || 0} rubros=${projectLineItems.length}`
            );
          }

          // Fallback hierarchy (matching single-project view in useSDMTForecastData):
          // 1. Try allocations if forecast is empty and allocations exist
          // 2. Else try lineItems if available
          if (
            (!normalized || normalized.length === 0) &&
            hasAcceptedBaseline
          ) {
            // Try allocations first if available (preferred fallback)
            if (allocations && allocations.length > 0) {
              if (import.meta.env.DEV) {
                console.debug(
                  `[SDMTForecast] Using allocations fallback for ${project.id}, baseline ${project.baselineId}: ${allocations.length} allocations`
                );
              }
              // Convert allocations to forecast cells format
              // Allocations have: month, planned, forecast, actual, rubroId/rubro_id
              normalized = allocations.map((alloc: any) => ({
                line_item_id: alloc.rubroId || alloc.rubro_id || alloc.line_item_id,
                month: alloc.month,
                planned: alloc.planned || 0,
                forecast: alloc.forecast || alloc.planned || 0,
                actual: alloc.actual || 0,
                variance: (alloc.forecast || alloc.planned || 0) - (alloc.planned || 0),
                last_updated: alloc.last_updated || new Date().toISOString(),
                updated_by: alloc.updated_by || 'system',
              }));
              usedFallback = true;
            } else if (projectLineItems.length > 0) {
              // Fall back to baseline rubros if no allocations
              if (import.meta.env.DEV) {
                console.debug(
                  `[SDMTForecast] Using baseline fallback for ${project.id}, baseline ${project.baselineId}: ${projectLineItems.length} line items`
                );
              }
              normalized = transformLineItemsToForecast(
                projectLineItems,
                months,
                project.id
              );
              usedFallback = true;
            }
          } else if (normalized.length > 0 && import.meta.env.DEV) {
            console.debug(
              `[SDMTForecast] Using server forecast rows for ${project.id}, baseline ${project.baselineId}`
            );
          }
          const matchedInvoices = invoices.filter(
            (inv) => inv.status === "Matched"
          );

          const projectData: ForecastRow[] = normalized.map((cell) => {
            const matchedInvoice = matchedInvoices.find((inv) => {
              const invoiceMonth = normalizeInvoiceMonth(inv.month);
              return (
                inv.line_item_id === cell.line_item_id &&
                invoiceMonth === cell.month
              );
            });

            const withActuals = matchedInvoice
              ? {
                  ...cell,
                  actual: matchedInvoice.amount || 0,
                  variance: cell.forecast - cell.planned,
                }
              : cell;

            return {
              ...withActuals,
              projectId: project.id,
              projectName: project.name,
            };
          });

          if (import.meta.env.DEV) {
            console.log(
              `[loadPortfolioForecast] project ${project.id} forecastRows=${projectData.length} invoices=${invoices.length}`
            );
            
            // DEV telemetry: Track unmatched invoices to help debug actuals
            const unmatchedInvoices = matchedInvoices.filter(inv => {
              const invoiceMonth = normalizeInvoiceMonth(inv.month);
              return !normalized.some(cell => 
                cell.line_item_id === inv.line_item_id && cell.month === invoiceMonth
              );
            });
            
            if (unmatchedInvoices.length > 0) {
              console.debug(
                `[loadPortfolioForecast] project ${project.id} unmatchedInvoices=${unmatchedInvoices.length}/${matchedInvoices.length}`,
                {
                  sample: unmatchedInvoices.slice(0, 3).map(inv => ({
                    line_item_id: inv.line_item_id,
                    month: inv.month,
                    amount: inv.amount,
                    rubroId: inv.rubroId || inv.rubro_id,
                  })),
                  forecastKeys: normalized.slice(0, 5).map(cell => ({
                    line_item_id: cell.line_item_id,
                    month: cell.month,
                    rubroId: cell.rubroId,
                  })),
                }
              );
            }
          }

          return {
            project,
            data: projectData,
            lineItems: projectLineItems.map((item) => ({
              ...item,
              projectId: project.id,
              projectName: project.name,
            })),
            generatedAt: payload.generatedAt,
            usedFallback,
          };
        } catch (error) {
          // Log error but don't crash entire portfolio load
          console.warn(
            `[Forecast] Failed to load data for project ${project.id} (${project.name}):`,
            error
          );
          // Return null to be filtered out later
          return null;
        }
      })
    );

    // Filter out null results from aborted requests
    const validResults = portfolioResults.filter((result) => result !== null);

    // Final check before setting state
    if (latestRequestKeyRef.current !== requestKey) {
      return;
    }

    const aggregatedData = validResults.flatMap((result) => result.data);
    
    // Build canonical map to deduplicate line items by canonical ID
    const canonicalMap = new Map<string, LineItem>();
    const allLineItemsFlattened = validResults.flatMap((result) => result.lineItems);
    
    for (const li of allLineItemsFlattened) {
      const normalizedId = normalizeRubroId(li.id);
      const canonical = getCanonicalRubroId(normalizedId) || normalizedId;
      const taxonomy = getTaxonomyById(normalizedId);
      
      const existing = canonicalMap.get(canonical);
      
      if (!existing) {
        // Use taxonomy description if available, otherwise use line item description
        const desc = taxonomy?.linea_gasto || taxonomy?.descripcion || li.description || '';
        const category = taxonomy?.categoria || li.category || '';
        
        canonicalMap.set(canonical, { 
          ...li, 
          id: canonical,
          description: desc,
          category: category,
        });
      } else {
        // Merge metadata: prefer taxonomy description or longest description
        const taxonomyDesc = taxonomy?.linea_gasto || taxonomy?.descripcion;
        const currentDesc = existing.description || '';
        const newDesc = taxonomyDesc || li.description || '';
        
        // Prefer taxonomy description, then longest description
        if (taxonomyDesc) {
          existing.description = taxonomyDesc;
        } else if (newDesc.length > currentDesc.length) {
          existing.description = newDesc;
        }
        
        // Prefer taxonomy category
        const taxonomyCategory = taxonomy?.categoria;
        if (taxonomyCategory) {
          existing.category = taxonomyCategory;
        } else {
          existing.category = existing.category || li.category;
        }
      }
    }
    
    const portfolioLineItemsArray = Array.from(canonicalMap.values());
    
    const firstGeneratedAt = validResults.find(
      (result) => result.generatedAt
    )?.generatedAt;

    setDataSource("api");
    setGeneratedAt(firstGeneratedAt || new Date().toISOString());
    setPortfolioLineItems(portfolioLineItemsArray);
    setForecastData(aggregatedData);

    if (import.meta.env.DEV) {
      console.debug("[Forecast] Portfolio data loaded", {
        projects: candidateProjects.length,
        records: aggregatedData.length,
        lineItems: portfolioLineItemsArray.length,
        uniqueCanonicalIds: canonicalMap.size,
      });
    }
  };

  const loadForecastData = useCallback(async () => {
    // If we're in portfolio (TODOS) view, we MUST load portfolio-wide forecast even when there is
    // no selectedProjectId. Only skip forecast load when not in portfolio view and no project selected.
    if (!isPortfolioView && !selectedProjectId) {
      console.log("❌ No project selected and not portfolio view, skipping forecast load");
      return;
    }

    // Create a new abort controller for this request
    abortControllerRef.current = new AbortController();

    // Generate unique request key to identify this specific request
    const requestKey = `${selectedProjectId}__${
      currentProject?.baselineId || ""
    }__${Date.now()}`;
    latestRequestKeyRef.current = requestKey;

    try {
      setLoading(true);
      setIsLoadingForecast(true);
      setForecastError(null);
      setDirtyActuals({});
      setDirtyForecasts({});

      // Handle CURRENT_MONTH period - always load 12 months but filter to current month later
      const isCurrentMonthMode = selectedPeriod === "CURRENT_MONTH";
      const months = isCurrentMonthMode ? 12 : parseInt(selectedPeriod);

      if (import.meta.env.DEV) {
        console.debug("[Forecast] Loading data", {
          projectId: selectedProjectId,
          months,
          isCurrentMonthMode,
          selectedPeriod,
          requestKey,
        });
      }

      if (isPortfolioView) {
        await loadPortfolioForecast(months, requestKey);
      } else {
        await loadSingleProjectForecast(selectedProjectId, months, requestKey);
      }

      // Verify this is still the latest request before applying results
      if (latestRequestKeyRef.current !== requestKey) {
        if (import.meta.env.DEV) {
          console.debug("[Forecast] Discarding stale response", {
            requestKey,
            latest: latestRequestKeyRef.current,
          });
        }
        return; // Stale response, ignore it
      }
    } catch (error) {
      // Ignore aborted requests
      if (error instanceof Error && error.name === "AbortError") {
        if (import.meta.env.DEV) {
          console.debug("[Forecast] Request aborted", { requestKey });
        }
        return;
      }

      console.error(
        "❌ Failed to load forecast data for project:",
        selectedProjectId,
        error
      );
      const message = handleFinanzasApiError(error, {
        onAuthError: login,
        fallback: "No se pudo cargar el forecast.",
      });

      // Only set error if this is still the latest request
      if (latestRequestKeyRef.current === requestKey) {
        setForecastError(message);
        setForecastData([]); // Clear data on error
      }
    } finally {
      // Only clear loading if this is still the latest request
      if (latestRequestKeyRef.current === requestKey) {
        setLoading(false);
        setIsLoadingForecast(false);
      }
    }
  }, [isPortfolioView, selectedProjectId, currentProject?.baselineId, selectedPeriod, login]);


  // Consolidated data loading effect: handles initial load, route changes, and event-driven refreshes
  // This ensures forecast loads on:
  // 1. Initial mount / when dependencies change (project, period, baseline)
  // 2. Route change (location.key)
  // 3. Document visibility change (hidden → visible)
  // 4. Window focus
  // 5. Manual refresh via URL parameter (_refresh)
  useEffect(() => {
    // Helper to trigger load and guard against overlapping calls
    const triggerLoad = () => {
      // Allow portfolio mode OR a single selected project to start the load
      if (isPortfolioView || selectedProjectId) {
        if (import.meta.env.DEV) {
          console.log(
            "🔄 Forecast: Loading data for project:",
            selectedProjectId,
            "isPortfolioView:",
            isPortfolioView,
            "change count:",
            projectChangeCount,
            "baseline:",
            currentProject?.baselineId
          );
        }

        // Abort any previous request
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }

        // Reset state before loading new data
        setForecastData([]);
        setPortfolioLineItems([]);
        loadForecastData();
      }
    };

    // Run once on mount / whenever route (location.key) or main deps change
    triggerLoad();

    // Check for URL refresh parameter
    const urlParams = new URLSearchParams(location.search);
    const refreshParam = urlParams.get("_refresh");
    if (refreshParam && (selectedProjectId || isPortfolioView)) {
      if (import.meta.env.DEV) {
        console.log("🔄 Forecast: Refreshing after reconciliation (URL param)");
      }
      // Already triggered above, but this logs the reason
    }

    // Guard to prevent repeated visibility-based refreshes
    let didRefreshOnVisibility = false;

    // Visibility change: when tab becomes visible again, reload once
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && (selectedProjectId || isPortfolioView) && !didRefreshOnVisibility) {
        didRefreshOnVisibility = true;
        if (import.meta.env.DEV) {
          console.log("🔄 Forecast: Refreshing on visibility change");
        }
        triggerLoad();
      } else if (document.visibilityState === 'hidden') {
        // Reset the flag when tab becomes hidden so next visibility will trigger refresh
        didRefreshOnVisibility = false;
      }
    };
    window.addEventListener('visibilitychange', onVisibility);

    // Cleanup: remove event listeners and abort outstanding request when component unmounts
    return () => {
      window.removeEventListener('visibilitychange', onVisibility);
      // Abort any outstanding request when component unmounts
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [
    loadForecastData,
    location.key,
    location.search,
    selectedProjectId,
    selectedPeriod,
    projectChangeCount,
    currentProject?.baselineId,
    isPortfolioView,
    projects.length,
  ]);

  // Clear stale filters and state when switching between TODOS and single project
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('🧹 [Forecast] View mode changed - clearing stale state', {
        isPortfolioView,
        selectedProjectId,
      });
    }
    
    // Reset dirty states to prevent accidental saves of stale data
    setDirtyActuals({});
    setDirtyForecasts({});
    
    // Reset editing state
    setEditingCell(null);
    setEditValue('');
    
    // Reset budget simulation when switching views
    if (budgetSimulation.enabled) {
      setBudgetSimulation({
        enabled: false,
        budgetTotal: '',
        factor: 1.0,
        estimatedOverride: '',
      });
    }
  }, [isPortfolioView, selectedProjectId]);

  const handleCellEdit = (
    line_item_id: string,
    month: number,
    type: "forecast" | "actual"
  ) => {
    const cell = forecastData.find(
      (c) => c.line_item_id === line_item_id && c.month === month
    );
    setEditingCell({ line_item_id, month, type });
    const currentValue = type === "forecast" ? cell?.forecast : cell?.actual;
    setEditValue(currentValue?.toString() || "0");
  };

  const handleCellSave = () => {
    if (editingCell) {
      let pendingChange: ForecastRow | null = null;
      const updatedData = forecastData.map((cell) => {
        if (
          cell.line_item_id === editingCell.line_item_id &&
          cell.month === editingCell.month
        ) {
          const newValue = parseFloat(editValue) || 0;
          const updates =
            editingCell.type === "forecast"
              ? { forecast: newValue, variance: newValue - cell.planned }
              : { actual: newValue };

          const nextCell: ForecastRow = {
            ...cell,
            ...updates,
            last_updated: new Date().toISOString(),
            updated_by: user?.login || "current-user",
          };

          // Track the pending change
          if (editingCell.type === "actual") {
            pendingChange = nextCell;
          } else if (editingCell.type === "forecast") {
            pendingChange = nextCell;
          }

          return nextCell;
        }
        return cell;
      });
      setForecastData(updatedData);

      if (pendingChange) {
        const changeKey = `${pendingChange.projectId || selectedProjectId}-${
          pendingChange.line_item_id
        }-${pendingChange.month}`;
        if (editingCell.type === "actual") {
          setDirtyActuals((prev) => ({
            ...prev,
            [changeKey]: pendingChange as ForecastRow,
          }));
        } else if (editingCell.type === "forecast") {
          setDirtyForecasts((prev) => ({
            ...prev,
            [changeKey]: pendingChange as ForecastRow,
          }));
        }
      }

      setEditingCell(null);
      toast.success(
        `${
          editingCell.type === "forecast" ? "Pronóstico" : "Real"
        } actualizado correctamente`
      );
    }
  };

  const handlePersistActuals = async () => {
    const entries = Object.values(dirtyActuals);
    if (entries.length === 0) {
      toast.info("No hay cambios de valores reales para guardar");
      return;
    }

    setSavingActuals(true);
    try {
      const currentYear = new Date().getFullYear();
      const payload: PayrollActualInput[] = entries
        .map((cell) => {
          const projectId = cell.projectId || selectedProjectId;
          const matchedLineItem = lineItemsForGrid.find((item) => {
            const lineItemProjectId = (item as { projectId?: string })
              .projectId;
            return (
              item.id === cell.line_item_id &&
              (!lineItemProjectId || lineItemProjectId === projectId)
            );
          });
          const monthKey = `${currentYear}-${String(cell.month).padStart(
            2,
            "0"
          )}`;

          if (!projectId) return null;
          const currency = (matchedLineItem?.currency ||
            "USD") as PayrollActualInput["currency"];

          return {
            projectId,
            month: monthKey,
            rubroId: cell.line_item_id,
            amount: Number(cell.actual) || 0,
            currency,
            resourceCount: matchedLineItem?.qty
              ? Number(matchedLineItem.qty)
              : undefined,
            notes: cell.notes,
            uploadedBy: user?.email || user?.login,
            source: "sdmt-forecast",
          } as PayrollActualInput;
        })
        .filter((row): row is PayrollActualInput => Boolean(row));

      if (payload.length === 0) {
        toast.error("No pudimos construir los datos para guardar en nómina.");
        return;
      }

      await bulkUploadPayrollActuals(payload);
      toast.success("Valores reales enviados a Nómina (DynamoDB)");
      setDirtyActuals({});
    } catch (error) {
      console.error("❌ Error al guardar valores reales", error);
      const message = handleFinanzasApiError(error, {
        onAuthError: login,
        fallback: "No pudimos guardar los valores reales.",
      });
      setForecastError((prev) => prev || message);
    } finally {
      setSavingActuals(false);
    }
  };

  const handlePersistForecasts = async () => {
    const entries: ForecastRow[] = Object.values(dirtyForecasts);
    if (entries.length === 0) {
      toast.info("No hay cambios de pronóstico para guardar");
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
      entries.forEach((cell) => {
        const projectId = cell.projectId || selectedProjectId;
        if (!projectId) return;

        if (!byProject.has(projectId)) {
          byProject.set(projectId, []);
        }
        byProject.get(projectId)!.push(cell);
      });

      // Send updates per project using bulkUpsertForecast with monthIndex format
      // The API expects: {items: [{rubroId, month: number, forecast}]}
      // We send monthIndex as a number, and the backend will compute the calendar month
      for (const [projectId, projectCells] of byProject.entries()) {
        const items = projectCells.map((cell) => {
          // Validate month is in valid range (up to baseline duration, fallback 60)
          const maxMonths = getBaselineDuration(baselineDetail);
          const monthIndex = Math.max(1, Math.min(maxMonths, cell.month));
          return {
            rubroId: cell.line_item_id,
            month: monthIndex,
            forecast: Number(cell.forecast) || 0,
          };
        });

        await finanzasClient.bulkUpsertForecast(projectId, items);
      }

      toast.success("Pronósticos ajustados guardados exitosamente");
      setDirtyForecasts({});

      // Reload forecast data to show persisted values
      await loadForecastData();
    } catch (error) {
      console.error("❌ Error al guardar pronósticos", error);
      const message = handleFinanzasApiError(error, {
        onAuthError: login,
        fallback: "No pudimos guardar los pronósticos ajustados.",
      });
      setForecastError((prev) => prev || message);
    } finally {
      setSavingForecasts(false);
    }
  };

  // Load Annual Budget
  const loadAnnualBudget = async (year: number) => {
    setLoadingBudget(true);
    try {
      const budget = await finanzasClient.getAllInBudget(year);
      const resolution = resolveAnnualBudgetState({ budget, year });
      setBudgetAmount(resolution.state.amount);
      setBudgetCurrency(resolution.state.currency);
      setBudgetLastUpdated(resolution.state.lastUpdated);
      setBudgetMissingYear(resolution.state.missingYear);
    } catch (error: any) {
      const resolution = resolveAnnualBudgetState({ error, year });
      setBudgetAmount(resolution.state.amount);
      setBudgetCurrency(resolution.state.currency);
      setBudgetLastUpdated(resolution.state.lastUpdated);
      setBudgetMissingYear(resolution.state.missingYear);

      // If 404, it means no budget is set for this year - that's okay
      if (resolution.status === "missing") {
        console.warn(
          `[SDMTForecast] ⚠️ No annual budget configured for ${year}`
        );
        return;
      }

      console.error("Error loading annual budget:", error);
      const message = handleFinanzasApiError(error, {
        onAuthError: login,
        fallback: "No pudimos cargar el presupuesto anual.",
      });
      toast.error(message);
    } finally {
      setLoadingBudget(false);
    }
  };

  // Load Budget Overview for KPIs (only in portfolio view)
  const loadBudgetOverview = async (year: number) => {
    if (!isPortfolioView) return;

    try {
      const overview = await finanzasClient.getAllInBudgetOverview(year);
      if (!overview) {
        if (import.meta.env.DEV) {
          console.debug(`[SDMTForecast] Budget overview missing for ${year}`);
        }
        setBudgetOverview(null);
        return;
      }
      setBudgetOverview(overview);
      console.log("[SDMTForecast] Budget overview loaded:", overview);
    } catch (error: any) {
      if (isBudgetNotFoundError(error)) {
        console.warn(`[SDMTForecast] ⚠️ Budget overview not found for ${year}`);
        setBudgetOverview(null);
        return;
      }
      // Don't show error to user, just log it - this is optional enhancement
      console.error("Error loading budget overview:", error);
      setBudgetOverview(null);
    }
  };

  // Save Annual Budget
  const handleSaveAnnualBudget = async () => {
    const amount = parseFloat(budgetAmount);
    if (isNaN(amount) || amount < 0) {
      toast.error("Por favor ingrese un monto válido");
      return;
    }

    setSavingBudget(true);
    try {
      const result = await finanzasClient.putAllInBudget(
        budgetYear,
        amount,
        budgetCurrency
      );
      setBudgetLastUpdated(result.updated_at);
      toast.success("Presupuesto anual guardado exitosamente");

      // Reload budget and budget overview to update KPIs
      await loadAnnualBudget(budgetYear);
      await loadBudgetOverview(budgetYear);
    } catch (error) {
      console.error("Error saving annual budget:", error);
      const message = handleFinanzasApiError(error, {
        onAuthError: login,
        fallback: "No pudimos guardar el presupuesto anual.",
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
      if (!monthlyBudget) {
        setMonthlyBudgets([]);
        setMonthlyBudgetLastUpdated(null);
        setMonthlyBudgetUpdatedBy(null);
        setUseMonthlyBudget(false);
        return;
      }
      if (monthlyBudget && monthlyBudget.months) {
        // Convert from API format (month: "YYYY-MM", amount) to internal format (month: 1-12, budget)
        const budgets: MonthlyBudgetInput[] = monthlyBudget.months
          .map((m) => {
            const monthMatch = m.month.match(/^\d{4}-(\d{2})$/);
            const monthNum = monthMatch ? parseInt(monthMatch[1], 10) : 0;
            return {
              month: monthNum,
              budget: m.amount,
            };
          })
          .filter((b) => b.month >= 1 && b.month <= 60); // Support up to 60 months

        setMonthlyBudgets(budgets);
        setMonthlyBudgetLastUpdated(monthlyBudget.updated_at || null);
        setMonthlyBudgetUpdatedBy(monthlyBudget.updated_by || null);

        // If we have saved monthly budgets, enable the monthly budget mode
        if (budgets.length > 0) {
          setUseMonthlyBudget(true);
        }

        // DEV: Log monthly budgets loaded to help debug budget display issues
        if (import.meta.env.DEV) {
          console.debug('[SDMTForecast] monthlyBudgets loaded', {
            year,
            count: budgets.length,
            monthlyBudgets: budgets,
            useMonthlyBudget: budgets.length > 0,
            totalBudget: budgets.reduce((sum, b) => sum + b.budget, 0),
          });
        }
      } else {
        setMonthlyBudgets([]);
        setMonthlyBudgetLastUpdated(null);
        setMonthlyBudgetUpdatedBy(null);
      }
    } catch (error: any) {
      // If 404, it means no monthly budgets are set for this year - that's okay
      if (isBudgetNotFoundError(error)) {
        console.warn(`[SDMTForecast] ⚠️ Monthly budget not found for ${year}`);
        setMonthlyBudgets(
          Array.from({ length: 12 }, (_, index) => ({
            month: index + 1,
            budget: 0,
          }))
        );
        setMonthlyBudgetLastUpdated(null);
        setMonthlyBudgetUpdatedBy(null);
        setUseMonthlyBudget(false);

        // DEV: Log zeroed monthly budgets to help debug budget display issues
        if (import.meta.env.DEV) {
          console.debug('[SDMTForecast] monthlyBudgets initialized to zero (not found)', {
            year,
            useMonthlyBudget: false,
          });
        }
      } else {
        console.error("Error loading monthly budget:", error);

        // Show user-friendly error for network failures
        if (error instanceof TypeError && error.message.includes("fetch")) {
          toast.error(
            "Error de red al cargar presupuesto mensual. Verifique la conexión e intente nuevamente."
          );
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
      toast.error("Ingrese al menos un presupuesto mensual");
      return;
    }

    setSavingMonthlyBudget(true);
    try {
      // Convert from internal format (month: 1-12, budget) to API format (month: "YYYY-MM", amount)
      const months = monthlyBudgets.map((mb) => ({
        month: `${budgetYear}-${String(mb.month).padStart(2, "0")}`,
        amount: mb.budget,
      }));

      const result = await finanzasClient.putAllInBudgetMonthly(
        budgetYear,
        budgetCurrency,
        months
      );
      setMonthlyBudgetLastUpdated(result.updated_at);
      setMonthlyBudgetUpdatedBy(result.updated_by);
      toast.success("Presupuesto mensual guardado exitosamente");

      // Reload monthly budget and budget overview to update KPIs and grid
      await loadMonthlyBudget(budgetYear);
      await loadBudgetOverview(budgetYear);
    } catch (error) {
      console.error("Error saving monthly budget:", error);

      // Provide detailed error message for network failures
      let message: string;
      if (error instanceof TypeError && error.message.includes("fetch")) {
        message =
          "Error de red al guardar presupuesto mensual. Verifique la conexión, configuración de CORS, y la URL base de la API en las variables de entorno.";
      } else {
        message = handleFinanzasApiError(error, {
          onAuthError: login,
          fallback: "No pudimos guardar el presupuesto mensual.",
        });
      }
      toast.error(message);
    } finally {
      setSavingMonthlyBudget(false);
    }
  };

  // Retry materialization - reload baseline and forecast data with polling
  const handleRetryMaterialization = useCallback(async () => {
    if (!selectedProjectId || !currentProject?.baselineId) {
      console.warn("[SDMTForecast] Cannot retry materialization: no baseline ID");
      return;
    }

    if (import.meta.env.DEV) {
      console.log("[SDMTForecast] Retrying materialization for baseline:", currentProject.baselineId);
    }

    setMaterializationPending(true);
    setMaterializationFailed(false);
    setMaterializationTimeout(null);

    try {
      // Call acceptBaseline to re-enqueue materialization
      await acceptBaseline(selectedProjectId, {
        baseline_id: currentProject.baselineId,
        accepted_by: user?.email || user?.login,
      });

      if (import.meta.env.DEV) {
        console.log("[SDMTForecast] acceptBaseline called successfully, polling for materialization...");
      }

      // Poll baseline until materialized (max 10 attempts, 2 seconds apart)
      const poll = async () => {
        for (let i = 0; i < 10; i++) {
          await new Promise(r => setTimeout(r, 2000));
          
          const latest = await getBaselineById(currentProject.baselineId!);
          const meta = latest?.metadata ?? {};
          const materializedAt = meta?.materializedAt ?? latest?.materializedAt ?? meta?.materialized_at;
          
          if (import.meta.env.DEV) {
            console.log(`[SDMTForecast] Poll attempt ${i + 1}/10:`, {
              materializedAt,
              materialization_status: meta?.materialization_status,
            });
          }
          
          if (materializedAt) {
            // Materialization complete!
            setBaselineDetail(latest);
            setMaterializationPending(false);
            setMaterializationFailed(false);
            setMaterializationTimeout(null);
            
            // Reload forecast data to show materialized rubros/allocations
            await loadForecastData();
            
            if (import.meta.env.DEV) {
              console.log("[SDMTForecast] Materialization complete, forecast reloaded");
            }
            return;
          }
        }
        
        // Timeout - still pending after 10 polls
        if (import.meta.env.DEV) {
          console.warn("[SDMTForecast] Materialization polling timed out after 20 seconds");
        }
        setMaterializationPending(true);
        setMaterializationTimeout(1); // Indicate timeout occurred
      };
      
      await poll();
    } catch (err) {
      console.error("[SDMTForecast] Failed to retry materialization:", err);
      setMaterializationFailed(true);
      setMaterializationPending(false);
      setMaterializationTimeout(null);
    }
  }, [selectedProjectId, currentProject?.baselineId, user?.email, user?.login, loadForecastData]);

  // Reset monthly budget to auto-distribution
  const handleResetMonthlyBudget = () => {
    setMonthlyBudgets([]);
    setUseMonthlyBudget(false);
    toast.info("Presupuesto mensual restablecido a distribución automática");
  };

  // Save budget from rubros table inline editing
  const handleSaveBudgetFromTable = async (
    budgets: Array<{ month: number; budget: number }>
  ) => {
    if (budgets.length === 0) {
      throw new Error("No budget data provided");
    }

    // Convert from internal format (month: 1-12, budget) to API format (month: "YYYY-MM", amount)
    const months = budgets.map((mb) => ({
      month: `${budgetYear}-${String(mb.month).padStart(2, "0")}`,
      amount: mb.budget,
    }));

    const result = await finanzasClient.putAllInBudgetMonthly(
      budgetYear,
      budgetCurrency,
      months
    );

    // Update state
    setMonthlyBudgets(budgets);
    setUseMonthlyBudget(true);
    setMonthlyBudgetLastUpdated(result.updated_at);
    setMonthlyBudgetUpdatedBy(result.updated_by);

    // Reload budget overview to update KPIs
    await loadBudgetOverview(budgetYear);
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
  const canEditForecast =
    !isPortfolioView && ["PMO", "SDMT"].includes(user?.current_role || "");
  const canEditActual = !isPortfolioView && user?.current_role === "SDMT";
  const canEditBudget = ["PMO", "SDMT"].includes(user?.current_role || "");

  // Navigate to reconciliation, preserving project context
  const navigateToReconciliation = (line_item_id: string, month?: number) => {
    const params = new URLSearchParams();
    // Preserve project ID
    if (selectedProjectId && selectedProjectId !== ALL_PROJECTS_ID) {
      params.set("projectId", selectedProjectId);
    }
    params.set("line_item", line_item_id);
    if (month) params.set("month", month.toString());

    // Add returnUrl so user can navigate back to Forecast
    const currentPath = location.pathname + location.search;
    params.set("returnUrl", currentPath);

    navigate(`/sdmt/cost/reconciliation?${params.toString()}`);
  };

  // Navigate to single project view
  const navigateToProject = useCallback(
    (projectId: string) => {
      if (projectId && projectId !== ALL_PROJECTS_ID) {
        // Use ProjectContext to select the project, which will trigger navigation
        setSelectedProjectId(projectId);
      }
    },
    [setSelectedProjectId]
  );

  // Handle category click - expand rubros accordion
  const handleCategoryClick = useCallback(
    (category: string) => {
      // Guard: only run in portfolio/TODOS view
      if (!isPortfolioView) return;

      // Ensure rubros/details section is visible
      setIsRubrosGridOpen(true);

      // Small delay to allow collapsible to open before scrolling
      setTimeout(() => {
        // Smooth scroll to rubros grid
        if (rubrosSectionRef.current) {
          rubrosSectionRef.current.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });

          // After scrolling, move focus to support keyboard users
          rubrosSectionRef.current.focus();
        }
      }, 100);

      // Keep or slightly refine the toast message
      toast.info(`Ver categoría: ${category}`, {
        description:
          'Desplazando a la cuadrícula de pronóstico. Usa el encabezado "Desglose Mensual vs Presupuesto" para revisar los detalles por rubro.',
      });
    },
    [isPortfolioView]
  );

  // Filter forecast data to current month when CURRENT_MONTH period is selected
  const filteredForecastData = useMemo(() => {
    if (selectedPeriod !== "CURRENT_MONTH") {
      return forecastData;
    }

    const currentMonthIndex = getCurrentMonthIndex();
    const filtered = forecastData.filter(
      (cell) => cell.month === currentMonthIndex
    );

    if (import.meta.env.DEV) {
      console.debug("[Forecast] Current month filtering", {
        currentMonthIndex,
        totalCells: forecastData.length,
        filteredCells: filtered.length,
      });
    }

    return filtered;
  }, [forecastData, selectedPeriod]);

  // Group forecast data by line item and month for display
  const forecastGrid = useMemo(() => {
    const isCurrentMonthMode = selectedPeriod === "CURRENT_MONTH";
    const currentMonthIndex = isCurrentMonthMode ? getCurrentMonthIndex() : 0;

    const grid = lineItemsForGrid
      .map((lineItem) => {
        const lineItemData = lineItem as LineItem & {
          projectId?: string;
          projectName?: string;
        };
        const itemForecasts = filteredForecastData.filter((f) => {
          const forecastProjectId = (f as any).projectId || (f as any).project_id;
          return (
            f.line_item_id === lineItem.id &&
            (!lineItemData.projectId || forecastProjectId === lineItemData.projectId)
          );
        });

        // In current month mode, only show the current month; otherwise show all 12 months
        const months = isCurrentMonthMode
          ? [currentMonthIndex]
          : Array.from({ length: 12 }, (_, i) => i + 1);

        const monthlyData = months.map((month) => {
          const cell = itemForecasts.find((f) => f.month === month);
          return (
            cell || {
              line_item_id: lineItem.id,
              month,
              planned: 0,
              forecast: 0,
              actual: 0,
              variance: 0,
              last_updated: "",
              updated_by: "",
              projectId: lineItemData.projectId,
              projectName: lineItemData.projectName,
            }
          );
        });

        // Check if the line item has any non-zero values to show
        const hasNonZeroValues = monthlyData.some(
          (cell) =>
            (cell.planned || 0) > 0 ||
            (cell.forecast || 0) > 0 ||
            (cell.actual || 0) > 0
        );

        return {
          lineItem,
          monthlyData,
          hasNonZeroValues,
        };
      })
      .filter((item) => item.hasNonZeroValues); // Only show items with data

    // Apply sorting: sort by category, then by description
    const sorted = [...grid].sort((a, b) => {
      const categoryA = a.lineItem.category || "Sin categoría";
      const categoryB = b.lineItem.category || "Sin categoría";
      const descriptionA = a.lineItem.description || "";
      const descriptionB = b.lineItem.description || "";

      // Primary sort by category
      const categoryCompare =
        sortDirection === "asc"
          ? categoryA.localeCompare(categoryB, "es")
          : categoryB.localeCompare(categoryA, "es");

      if (categoryCompare !== 0) return categoryCompare;

      // Secondary sort by description
      return sortDirection === "asc"
        ? descriptionA.localeCompare(descriptionB, "es")
        : descriptionB.localeCompare(descriptionA, "es");
    });

    if (import.meta.env.DEV && sorted.length > 0) {
      console.debug("[Forecast] Grid recalculated", {
        projectId: selectedProjectId,
        rows: sorted.length,
        sortDirection,
      });
    }

    return sorted;
  }, [
    lineItemsForGrid,
    filteredForecastData,
    selectedProjectId,
    selectedPeriod,
    sortDirection,
  ]);

  // Group forecast grid by category with sub-totals
  const forecastGridWithSubtotals = useMemo(() => {
    type GridRow = {
      type: "item" | "subtotal";
      lineItem?: ProjectLineItem;
      category?: string;
      monthlyData: ForecastRow[];
    };

    // Group items by category (items are already sorted within categories due to forecastGrid sort)
    const itemsByCategory = new Map<string, typeof forecastGrid>();
    forecastGrid.forEach((item) => {
      const category = item.lineItem.category || "Sin categoría";
      if (!itemsByCategory.has(category)) {
        itemsByCategory.set(category, []);
      }
      itemsByCategory.get(category)!.push(item);
    });

    // Sort categories by name to maintain consistent order
    const sortedCategories = Array.from(itemsByCategory.keys()).sort((a, b) =>
      sortDirection === "asc"
        ? a.localeCompare(b, "es")
        : b.localeCompare(a, "es")
    );

    // Build rows with sub-totals
    const rows: GridRow[] = [];
    const isCurrentMonthMode = selectedPeriod === "CURRENT_MONTH";
    const currentMonthIndex = isCurrentMonthMode ? getCurrentMonthIndex() : 0;
    const months = isCurrentMonthMode
      ? [currentMonthIndex]
      : Array.from({ length: 12 }, (_, i) => i + 1);

    sortedCategories.forEach((category) => {
      const categoryItems = itemsByCategory.get(category)!;

      // Add category items (already sorted by description within category)
      categoryItems.forEach((item) => {
        rows.push({
          type: "item",
          lineItem: item.lineItem,
          monthlyData: item.monthlyData,
        });
      });

      // Calculate and add sub-total row
      const subtotalSource = categoryItems.flatMap((item) => item.monthlyData);
      const subtotalTotals = computeTotals(subtotalSource, months);
      const subtotalMonthlyData = months.map((month) => {
        const totals = subtotalTotals.byMonth[month] || {
          planned: 0,
          forecast: 0,
          actual: 0,
          varianceForecast: 0,
          varianceActual: 0,
        };

        return {
          line_item_id: `subtotal-${category}-${month}`,
          month,
          planned: totals.planned,
          forecast: totals.forecast,
          actual: totals.actual,
          variance: totals.varianceForecast,
          last_updated: "",
          updated_by: "",
        } as ForecastRow;
      });

      rows.push({
        type: "subtotal",
        category,
        monthlyData: subtotalMonthlyData,
      });
    });

    return rows;
  }, [forecastGrid, selectedPeriod, sortDirection]);

  const totalFTE = useMemo(() => {
    // Helper: sum numeric FTE-like values safely
    const sumFtesFromArray = (arr: any[] = []) =>
      arr.reduce((sum: number, item: any) => {
        // Accept different possible field names and qty fallback
        const raw = item?.fte_count ?? item?.fte ?? item?.qty ?? 0;
        const val = Number(raw);
        return sum + (Number.isFinite(val) ? val : 0);
      }, 0);

    // 1) Prefer baseline labor_estimates if present
    if (baselineDetail) {
      const laborEstimates =
        Array.isArray(baselineDetail.labor_estimates) &&
        baselineDetail.labor_estimates.length > 0
          ? baselineDetail.labor_estimates
          : Array.isArray(baselineDetail.payload?.labor_estimates) &&
            baselineDetail.payload.labor_estimates.length > 0
          ? baselineDetail.payload.labor_estimates
          : null;

      if (laborEstimates) {
        const fteSum = sumFtesFromArray(laborEstimates);
        return Math.round(fteSum * 100) / 100;
      }
    }

    // 2) Fallback to line items qty
    const lineItemFte = Array.isArray(lineItemsForGrid)
      ? sumFtesFromArray(lineItemsForGrid)
      : 0;
    return Math.round(lineItemFte * 100) / 100;
  }, [baselineDetail, lineItemsForGrid]);

  const monthsForTotals = useMemo(() => {
    if (selectedPeriod === "CURRENT_MONTH") {
      return [getCurrentMonthIndex()];
    }

    // Allow up to baseline.duration_months (fallback 60)
    const baselineDuration = getBaselineDuration(baselineDetail);
    const maxMonths = Math.max(1, baselineDuration);

    const count = Number.parseInt(selectedPeriod, 10);
    if (Number.isFinite(count) && count > 0 && count <= maxMonths) {
      return Array.from({ length: count }, (_, i) => i + 1);
    }

    // Default to last 12 months or up to baseline if smaller
    return Array.from({ length: Math.min(12, maxMonths) }, (_, i) => i + 1);
  }, [selectedPeriod, projectStartDate, isPortfolioView, baselineDetail]);

  // Calculate totals and metrics - using useMemo to ensure it updates when data changes
  const totals = useMemo(
    () => computeTotals(filteredForecastData, monthsForTotals),
    [filteredForecastData, monthsForTotals]
  );

  const baseMetrics = useMemo(() => {
    const { overall } = totals;
    const totalVariance = overall.varianceForecast;
    const actualVariance = overall.varianceActual;

    if (import.meta.env.DEV && filteredForecastData.length > 0) {
      console.debug("[Forecast] Metrics recalculated", {
        projectId: selectedProjectId,
        forecastMode,
        selectedPeriod,
        totalPlanned: overall.planned,
        totalForecast: overall.forecast,
        totalActual: overall.actual,
        totalVariance,
        actualVariance,
      });
    }

    return {
      totalVariance,
      totalPlanned: overall.planned,
      totalForecast: overall.forecast,
      totalActual: overall.actual,
      variancePercentage: overall.varianceForecastPercent,
      actualVariance,
      actualVariancePercentage: overall.varianceActualPercent,
    };
  }, [
    filteredForecastData,
    forecastMode,
    selectedPeriod,
    totals,
    selectedProjectId,
  ]);

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
  const dirtyActualCount = useMemo(
    () => Object.keys(dirtyActuals).length,
    [dirtyActuals]
  );
  const dirtyForecastCount = useMemo(
    () => Object.keys(dirtyForecasts).length,
    [dirtyForecasts]
  );

  const isLoadingState = loading || isLineItemsLoading;

  // Enhanced hasGridData: Check if we have Planned (P), Forecast (F), or Actual (A) data
  // This ensures new projects with only P or F (but no A) will display data instead of "No hay datos"
  const hasGridData = useMemo(() => {
    if (forecastGrid.length === 0) return false;

    // Check totals: if any of P, F, or A is > 0, we have data to display
    const hasP = totals.overall.planned > 0;
    const hasF = totals.overall.forecast > 0;
    const hasA = totals.overall.actual > 0;

    return hasP || hasF || hasA;
  }, [forecastGrid.length, totals]);

  const isEmptyState =
    !isLoadingState && !forecastError && forecastData.length === 0;

  // Special case: TODOS mode with only the ALL_PROJECTS placeholder (no real projects)
  const isTodosEmptyState =
    isPortfolioView &&
    !isLoadingState &&
    !forecastError &&
    projects.length < MINIMUM_PROJECTS_FOR_PORTFOLIO;

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
      return allocateBudgetWithMonthlyInputs(
        annualBudget,
        monthlyBudgets,
        monthlyTotals
      );
    }

    // Otherwise, allocate annual budget proportionally across months
    return allocateBudgetMonthly(annualBudget, monthlyTotals);
  }, [
    budgetAmount,
    isPortfolioView,
    forecastData,
    useMonthlyBudget,
    monthlyBudgets,
  ]);

  // Compute KPI values for the summary bar (TODOS mode only)
  const summaryBarKpis = useMemo(() => {
    if (!isPortfolioView) {
      return null; // Don't compute KPIs for single-project view
    }

    // Calculate monthly budget sum and budgetAllIn for parity checking
    const monthlyBudgetSum = monthlyBudgets.reduce(
      (acc, m) => acc + (m.budget || 0),
      0
    );
    const budgetAllIn = budgetOverview?.budgetAllIn?.amount || 0;

    // Determine totalBudget per spec: useMonthlyBudget ? sum(monthlyBudgets) : budgetAllIn
    const totalBudget = useMonthlyBudget ? monthlyBudgetSum : budgetAllIn;

    // Extract totals from existing computations
    const totalForecastValue = totals.overall.forecast;
    const totalActualValue = totals.overall.actual;

    // Compute variance vs budget (Forecast - Budget)
    const varianceBudget =
      totalBudget > 0 ? totalForecastValue - totalBudget : 0;
    const varianceBudgetPercent =
      totalBudget > 0 ? (varianceBudget / totalBudget) * 100 : 0;

    // Compute % consumed (Actual / Budget)
    const consumedPercent =
      totalBudget > 0 ? (totalActualValue / totalBudget) * 100 : 0;

    return {
      totalBudget,
      totalForecast: totalForecastValue,
      totalActual: totalActualValue,
      varianceBudget,
      varianceBudgetPercent,
      consumedPercent,
      useMonthlyBudget,
      lastUpdated: monthlyBudgetLastUpdated,
      updatedBy: monthlyBudgetUpdatedBy,
      // Pass data for parity checking
      monthlyBudgetSum,
      budgetAllIn,
    };
  }, [
    isPortfolioView,
    useMonthlyBudget,
    monthlyBudgets,
    totals,
    monthlyBudgetLastUpdated,
    monthlyBudgetUpdatedBy,
    budgetOverview,
  ]);

  // Calculate runway metrics for month-by-month tracking
  const runwayMetrics = useMemo<RunwayMetrics[]>(() => {
    const annualBudget = parseFloat(budgetAmount);
    if (
      !annualBudget ||
      annualBudget <= 0 ||
      monthlyBudgetAllocations.length === 0
    ) {
      return [];
    }
    return calculateRunwayMetrics(annualBudget, monthlyBudgetAllocations);
  }, [budgetAmount, monthlyBudgetAllocations]);

  // Build category totals for TODOS mode (charts and rubros table)
  const categoryTotals = useMemo(() => {
    if (forecastData.length === 0) {
      return new Map();
    }
    // In single-project mode, filter to selected project
    const dataToGroup = isPortfolioView 
      ? forecastData 
      : forecastData.filter(cell => ((cell as any).projectId || (cell as any).project_id) === selectedProjectId);
    return buildCategoryTotals(dataToGroup);
  }, [isPortfolioView, forecastData, selectedProjectId]);

  // Build category rubros for TODOS mode (rubros table)
  const categoryRubros = useMemo(() => {
    if (forecastData.length === 0) {
      return new Map();
    }
    // In single-project mode, filter to selected project
    const dataToGroup = isPortfolioView 
      ? forecastData 
      : forecastData.filter(cell => ((cell as any).projectId || (cell as any).project_id) === selectedProjectId);
    const lineItemsToUse = isPortfolioView ? portfolioLineItems : safeLineItems;
    return buildCategoryRubros(dataToGroup, lineItemsToUse);
  }, [isPortfolioView, forecastData, portfolioLineItems, safeLineItems, selectedProjectId]);

  // Build project totals for TODOS mode (project view)
  const projectTotals = useMemo(() => {
    if (forecastData.length === 0) {
      return new Map();
    }
    // In single-project mode, filter to selected project
    const dataToGroup = isPortfolioView 
      ? forecastData 
      : forecastData.filter(cell => ((cell as any).projectId || (cell as any).project_id) === selectedProjectId);
    return buildProjectTotals(dataToGroup);
  }, [isPortfolioView, forecastData, selectedProjectId]);

  // Build project rubros for TODOS mode (project view)
  const projectRubros = useMemo(() => {
    if (forecastData.length === 0) {
      return new Map();
    }
    // In single-project mode, filter to selected project
    const dataToGroup = isPortfolioView 
      ? forecastData 
      : forecastData.filter(cell => ((cell as any).projectId || (cell as any).project_id) === selectedProjectId);
    const lineItemsToUse = isPortfolioView ? portfolioLineItems : safeLineItems;
    return buildProjectRubros(dataToGroup, lineItemsToUse, taxonomyByRubroId);
  }, [isPortfolioView, forecastData, portfolioLineItems, safeLineItems, taxonomyByRubroId, selectedProjectId]);

  // Build portfolio totals for TODOS mode (charts and rubros table)
  const portfolioTotalsForCharts = useMemo(() => {
    if (forecastData.length === 0) {
      return {
        byMonth: {},
        overall: {
          forecast: 0,
          actual: 0,
          planned: 0,
          varianceForecast: 0,
          varianceActual: 0,
          percentConsumption: 0,
        },
      };
    }
    // In single-project mode, filter to selected project
    const dataToGroup = isPortfolioView 
      ? forecastData 
      : forecastData.filter(cell => ((cell as any).projectId || (cell as any).project_id) === selectedProjectId);
    return buildPortfolioTotals(dataToGroup);
  }, [isPortfolioView, forecastData, selectedProjectId]);

  // Compute projects per month (M/M) for chart bar series
  const projectsPerMonth = useMemo(() => {
    if (!isPortfolioView || forecastData.length === 0) {
      return Array.from({ length: 12 }, (_, i) => ({ month: i + 1, count: 0 }));
    }

    // Count unique projects per month
    const monthlyProjects = new Map<number, Set<string>>();
    
    forecastData.forEach((cell) => {
      const month = cell.month;
      const projectId = cell.projectId;
      
      if (!month || !projectId || month < 1 || month > 12) return;
      
      if (!monthlyProjects.has(month)) {
        monthlyProjects.set(month, new Set());
      }
      monthlyProjects.get(month)!.add(projectId);
    });

    return Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const count = monthlyProjects.get(month)?.size || 0;
      return { month, count };
    });
  }, [isPortfolioView, forecastData]);

  // Check if we have a valid budget for variance analysis
  const hasBudgetForVariance = useMemo(() => {
    const annualBudget = parseFloat(budgetAmount);
    return annualBudget > 0;
  }, [budgetAmount]);

  // Build project summaries for top variance table in TODOS mode
  const projectSummaries = useMemo(() => {
    if (
      !isPortfolioView ||
      forecastData.length === 0 ||
      !hasBudgetForVariance
    ) {
      return [];
    }

    // Get total annual budget
    const annualBudget = parseFloat(budgetAmount);

    // Group forecast data by project
    const projectMap = new Map<
      string,
      {
        id: string;
        name: string;
        code?: string;
        plannedTotal: number;
        forecastTotal: number;
        actualTotal: number;
      }
    >();

    forecastData.forEach((cell) => {
      const projectId = cell.projectId;
      const projectName = cell.projectName || "Unknown Project";

      if (!projectId) return;

      if (!projectMap.has(projectId)) {
        // Find project details from projects list
        const project = projects.find((p) => p.id === projectId);
        projectMap.set(projectId, {
          id: projectId,
          name: projectName,
          code: project?.code,
          plannedTotal: 0,
          forecastTotal: 0,
          actualTotal: 0,
        });
      }

      const projectData = projectMap.get(projectId)!;
      projectData.plannedTotal += cell.planned || 0;
      projectData.forecastTotal += cell.forecast || 0;
      projectData.actualTotal += cell.actual || 0;
    });

    // Calculate total planned across all projects for budget allocation
    const totalPlanned = Array.from(projectMap.values()).reduce(
      (sum, proj) => sum + proj.plannedTotal,
      0
    );

    // Add budgetTotal for each project (proportional allocation)
    return Array.from(projectMap.values()).map((project) => ({
      ...project,
      budgetTotal:
        totalPlanned > 0
          ? annualBudget * (project.plannedTotal / totalPlanned)
          : 0,
    }));
  }, [
    isPortfolioView,
    forecastData,
    hasBudgetForVariance,
    budgetAmount,
    projects,
  ]);

  const varianceSeries = useMemo(() => {
    if (!hasBudgetForVariance) return [];
    return computeVariance({
      plan: monthlyBudgetAllocations.map((allocation) => allocation.planned),
      forecast: monthlyBudgetAllocations.map(
        (allocation) => allocation.forecast
      ),
      actual: monthlyBudgetAllocations.map((allocation) => allocation.actual),
      budget: monthlyBudgetAllocations.map(
        (allocation) => allocation.budgetAllocated
      ),
    });
  }, [hasBudgetForVariance, monthlyBudgetAllocations]);

  const monthsForCharts = useMemo(() => {
    if (selectedPeriod === "CURRENT_MONTH") {
      return [getCurrentMonthIndex()];
    }
    const baselineDuration = getBaselineDuration(baselineDetail);
    const maxMonths = Math.max(1, baselineDuration);
    return Array.from({ length: Math.min(12, maxMonths) }, (_, i) => i + 1);
  }, [selectedPeriod, projectStartDate, isPortfolioView, baselineDetail]);

  // Chart data - recalculate when forecastData changes
  const monthlyTrends = useMemo(() => {
    const trendTotals = computeTotals(forecastData, monthsForCharts);
    const baseTrends = monthsForCharts.map((month) => {
      const totals = trendTotals.byMonth[month] || {
        planned: 0,
        forecast: 0,
        actual: 0,
      };
      return {
        month,
        Planned: totals.planned,
        Forecast: totals.forecast,
        Actual: totals.actual,
      };
    });

    if (import.meta.env.DEV && forecastData.length > 0) {
      console.debug("[Forecast] Chart trends recalculated", {
        projectId: selectedProjectId,
        forecastMode,
        monthsShown: monthsForCharts.length,
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
        const allocation = monthlyBudgetAllocations.find(
          (a) => a.month === trend.month
        );
        return {
          ...trend,
          Budget: allocation?.budgetAllocated || 0,
        };
      });
    }

    return baseTrends;
  }, [
    forecastData,
    monthsForCharts,
    selectedProjectId,
    forecastMode,
    isPortfolioView,
    budgetSimulation.enabled,
    budgetTotal,
    budgetAmount,
    monthlyBudgetAllocations,
  ]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Format currency for grid display (full amounts, not abbreviated)
  const formatGridCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getVarianceColor = (variance: number) => {
    if (variance > 0) return "text-red-600 bg-red-50";
    if (variance < 0) return "text-green-600 bg-green-50";
    return "text-muted-foreground bg-muted";
  };

  const getVarianceIcon = (variance: number) => {
    if (variance > 0) return <TrendingUp size={14} className="text-red-600" />;
    if (variance < 0)
      return <TrendingDown size={14} className="text-green-600" />;
    return null;
  };

  // Export functions
  const handleExcelExport = async () => {
    if (exporting) return;

    try {
      setExporting("excel");
      const exporter = excelExporter;
      const buffer = await exporter.exportForecastGrid(
        forecastData,
        lineItemsForGrid
      );
      const filename = `forecast-data-${
        new Date().toISOString().split("T")[0]
      }.xlsx`;
      downloadExcelFile(buffer, filename);
      toast.success("Reporte Excel exportado exitosamente");
    } catch (error) {
      toast.error("Error al exportar reporte Excel");
      console.error(error);
    } finally {
      setExporting(null);
    }
  };

  const handlePDFExport = async () => {
    if (exporting) return;

    try {
      setExporting("pdf");
      const reportData = {
        title: "Análisis de Pronóstico de Costos",
        subtitle: "Resumen Ejecutivo y Reporte de Variaciones",
        generated: new Date().toLocaleDateString(),
        metrics: [
          {
            label: "Presupuesto Planeado Total",
            value: formatReportCurrency(totalPlanned),
            color: "#64748b",
          },
          {
            label: "Pronóstico Actual",
            value: formatReportCurrency(totalForecast),
            change: formatReportPercentage(
              ((totalForecast - totalPlanned) / totalPlanned) * 100
            ),
            changeType: getChangeType(totalForecast - totalPlanned),
            color: "#2BB673",
          },
          {
            label: "Gastos Reales",
            value: formatReportCurrency(totalActual),
            change: formatReportPercentage(
              ((totalActual - totalPlanned) / totalPlanned) * 100
            ),
            changeType: getChangeType(totalActual - totalPlanned),
            color: "#14B8A6",
          },
          {
            label: "Variación de Presupuesto",
            value: formatReportCurrency(Math.abs(totalVariance)),
            change: formatReportPercentage(Math.abs(variancePercentage)),
            changeType: getChangeType(-Math.abs(totalVariance)),
            color: totalVariance > 0 ? "#ef4444" : "#22c55e",
          },
        ],
        summary: [
          `Variación total del presupuesto del proyecto: ${formatReportCurrency(
            totalVariance
          )} (${variancePercentage.toFixed(1)}%)`,
          `${
            forecastData.filter((f) => f.variance > 0).length
          } rubros mostrando sobrecostos`,
          `${
            forecastData.filter((f) => f.variance < 0).length
          } rubros bajo presupuesto`,
          `Precisión actual del pronóstico: ${(
            100 - Math.abs(variancePercentage)
          ).toFixed(1)}%`,
        ],
        recommendations: [
          totalVariance > 50000
            ? "Se requiere revisión inmediata del presupuesto por sobrecostos significativos"
            : "Variación de presupuesto dentro del rango aceptable",
          "Enfocar en rubros con mayor impacto de variación para optimización de costos",
          "Considerar actualizar modelos de pronóstico basados en tendencias de desempeño real",
          "Implementar seguimiento mejorado para categorías de costo de alto riesgo",
        ],
      };

      await PDFExporter.exportToPDF(reportData);
      toast.success("Reporte profesional de pronóstico generado");
    } catch (error) {
      toast.error("Error al generar resumen PDF");
      console.error(error);
    } finally {
      setExporting(null);
    }
  };

  // Toggle sort direction for forecast grid
  const toggleSortDirection = () => {
    setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
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
                {!isPortfolioView && projectStartDate && (
                  <span className="text-xs text-muted-foreground">
                    📅 Inicio:{" "}
                    {new Date(projectStartDate).toLocaleDateString("es-ES", {
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                )}
                <Badge
                  variant={dataSource === "mock" ? "outline" : "secondary"}
                  className="text-xs"
                >
                  {dataSource === "mock" ? "Datos de prueba" : "Datos de API"}
                </Badge>
                {!isPortfolioView && selectedProjectId && (
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs"
                    onClick={() =>
                      navigate(
                        `/sdmt/cost/catalog?projectId=${selectedProjectId}`
                      )
                    }
                  >
                    Ver Rubros →
                  </Button>
                )}
              </div>
            )}
            {/* Debug flag banner (dev only) */}
            {import.meta.env.DEV && (
              <div className="text-xs text-muted-foreground mt-1">
                Debug Flags:
                <span className="ml-2 font-mono bg-muted/10 px-2 py-1 rounded">
                  NEW_FORECAST_LAYOUT={String(NEW_FORECAST_LAYOUT_ENABLED)}
                </span>
              </div>
            )}
          </div>

          {/* Primary Actions - Right Side */}
          <ForecastActionsMenu
            onSaveForecast={handlePersistForecasts}
            savingForecast={savingForecasts}
            dirtyForecastCount={dirtyForecastCount}
            canEditForecast={canEditForecast}
            onSaveActuals={handlePersistActuals}
            savingActuals={savingActuals}
            dirtyActualCount={dirtyActualCount}
            onExcelExport={handleExcelExport}
            onPDFExport={handlePDFExport}
            exporting={exporting}
          />
        </div>
      </div>

      {/* Baseline Status Panel - Hidden in TODOS/Portfolio View */}
      {!isPortfolioView && <BaselineStatusPanel />}

      {/* Data Health Debug Panel (Dev Only) */}
      <DataHealthPanel />

      {/* Position #1: Resumen Ejecutivo - Cartera Completa (ForecastSummaryBar) - Always visible at top */}
      {isPortfolioView && summaryBarKpis && (
        <ForecastSummaryBar
          totalBudget={summaryBarKpis.totalBudget}
          totalForecast={summaryBarKpis.totalForecast}
          totalActual={summaryBarKpis.totalActual}
          consumedPercent={summaryBarKpis.consumedPercent}
          varianceBudget={summaryBarKpis.varianceBudget}
          varianceBudgetPercent={summaryBarKpis.varianceBudgetPercent}
          useMonthlyBudget={summaryBarKpis.useMonthlyBudget}
          lastUpdated={summaryBarKpis.lastUpdated}
          updatedBy={summaryBarKpis.updatedBy}
          monthlyBudgetSum={summaryBarKpis.monthlyBudgetSum}
          budgetAllIn={summaryBarKpis.budgetAllIn}
        />
      )}



      {/* KPI Summary - Standardized & Compact - Single Project Mode Only */}
      {!isPortfolioView && (
        <>
          {isLoadingForecast ? (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-center min-h-[120px]">
                  <div className="text-center">
                    <LoadingSpinner size="lg" />
                    <p className="text-muted-foreground mt-4">
                      Cargando pronóstico...
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
              <Card className="h-full">
                <CardContent className="p-3">
                  <div className="text-xl font-bold">
                    {formatCurrency(totalPlanned)}
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <p className="text-xs text-muted-foreground">
                      Total Planeado
                    </p>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs max-w-xs">
                            Suma de costos planificados importados desde
                            Planview baseline
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </CardContent>
              </Card>
              <Card className="h-full">
                <CardContent className="p-3">
                  <div className="text-xl font-bold">
                    {formatCurrency(totalForecast)}
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <p className="text-xs text-muted-foreground">
                      Pronóstico Total
                    </p>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs max-w-xs">
                            Pronóstico ajustado por SDMT basado en tendencias y
                            factores de riesgo
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </CardContent>
              </Card>
              <Card className="h-full">
                <CardContent className="p-3">
                  <div className="text-xl font-bold text-blue-600">
                    {formatCurrency(totalActual)}
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <p className="text-xs text-muted-foreground">Total Real</p>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs max-w-xs">
                            {totalActual === 0 
                              ? "Sin gastos reales. Los valores reales provienen de facturas conciliadas en el módulo de Reconciliación."
                              : "Gastos reales registrados en el sistema desde facturas conciliadas"}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </CardContent>
              </Card>
              <Card className="h-full">
                <CardContent className="p-3">
                  <div className="text-xl font-bold">
                    {totalFTE.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Total FTE
                  </p>
                </CardContent>
              </Card>
              <Card className="h-full">
                <CardContent className="p-3">
                  <div
                    className={`text-xl font-bold ${
                      totalVariance >= 0 ? "text-red-600" : "text-green-600"
                    }`}
                  >
                    {formatCurrency(Math.abs(totalVariance))}
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    {getVarianceIcon(totalVariance)}
                    <p className="text-xs text-muted-foreground">
                      Variación Pronóstico
                    </p>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs max-w-xs">
                            Diferencia entre pronóstico y planificado (Forecast
                            - Planned)
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {Math.abs(variancePercentage).toFixed(1)}%
                  </p>
                </CardContent>
              </Card>
              <Card className="h-full">
                <CardContent className="p-3">
                  <div
                    className={`text-xl font-bold ${
                      actualVariance >= 0 ? "text-red-600" : "text-green-600"
                    }`}
                  >
                    {formatCurrency(Math.abs(actualVariance))}
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    {getVarianceIcon(actualVariance)}
                    <p className="text-xs text-muted-foreground">
                      Variación Real
                    </p>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs max-w-xs">
                            Diferencia entre gastos reales y planificado (Actual
                            - Planned)
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {Math.abs(actualVariancePercentage).toFixed(1)}%
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      {/* Budget Simulation KPIs - Only show when simulation is enabled */}
      {isPortfolioView && budgetSimulation.enabled && budgetTotal > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3">
          <Card className="border-primary/30">
            <CardContent className="p-3">
              <div className="text-2xl font-bold text-primary">
                {formatCurrency(budgetTotal)}
              </div>
              <div className="flex items-center gap-1">
                <p className="text-sm text-muted-foreground">
                  Presupuesto Total
                </p>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs max-w-xs">
                        Presupuesto anual simulado distribuido proporcionalmente
                        por mes
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-xs text-muted-foreground">Simulación activa</p>
            </CardContent>
          </Card>
          <Card className="border-primary/30">
            <CardContent className="p-3">
              <div
                className={`text-2xl font-bold ${
                  budgetVarianceProjected >= 0
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                {formatCurrency(Math.abs(budgetVarianceProjected))}
              </div>
              <div className="flex items-center gap-1">
                {getVarianceIcon(-budgetVarianceProjected)}
                <p className="text-sm text-muted-foreground">
                  Variación vs Presupuesto
                </p>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs max-w-xs">
                        Diferencia entre presupuesto y pronóstico (Budget -
                        Forecast)
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-xs text-muted-foreground">
                {budgetVarianceProjected >= 0
                  ? "Bajo presupuesto"
                  : "Sobre presupuesto"}
              </p>
            </CardContent>
          </Card>
          <Card className="border-primary/30">
            <CardContent className="p-3">
              <div
                className={`text-2xl font-bold ${
                  budgetUtilization > 100
                    ? "text-red-600"
                    : budgetUtilization > 90
                    ? "text-yellow-600"
                    : "text-green-600"
                }`}
              >
                {budgetUtilization.toFixed(1)}%
              </div>
              <div className="flex items-center gap-1">
                <p className="text-sm text-muted-foreground">
                  Utilización de Presupuesto
                </p>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs max-w-xs">
                        Porcentaje del presupuesto utilizado según pronóstico
                        (Forecast / Budget × 100)
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-xs text-muted-foreground">
                Pronóstico / Presupuesto
              </p>
            </CardContent>
          </Card>
          <Card className="border-primary/30">
            <CardContent className="p-3">
              <div
                className={`text-2xl font-bold ${
                  pctUsedActual > 100
                    ? "text-red-600"
                    : pctUsedActual > 90
                    ? "text-yellow-600"
                    : "text-blue-600"
                }`}
              >
                {pctUsedActual.toFixed(1)}%
              </div>
              <div className="flex items-center gap-1">
                <p className="text-sm text-muted-foreground">
                  Real vs Presupuesto
                </p>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs max-w-xs">
                        Porcentaje del presupuesto consumido por gastos reales
                        (Actual / Budget × 100)
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-xs text-muted-foreground">
                Gastos reales / Presupuesto
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Real Annual Budget KPIs - Show when budget is set and portfolio view (not simulation) */}
      {/* Hide when NEW_FORECAST_LAYOUT is enabled - KPIs are shown in ForecastSummaryBar instead */}
      {/* Gate behind SHOW_PORTFOLIO_KPIS flag (default false) or existing HIDE_REAL_ANNUAL_KPIS */}
      {SHOW_PORTFOLIO_KPIS && !NEW_FORECAST_LAYOUT_ENABLED && !HIDE_REAL_ANNUAL_KPIS && isPortfolioView && !budgetSimulation.enabled && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3">
          <Card className="border-blue-500/30">
            <CardContent className="p-3">
              <div className="text-2xl font-bold text-blue-600">
                {budgetOverview?.budgetAllIn
                  ? formatCurrency(budgetOverview.budgetAllIn.amount)
                  : "—"}
              </div>
              <p className="text-sm text-muted-foreground">
                Presupuesto Anual All-In
              </p>
              <p className="text-xs text-muted-foreground">
                {budgetOverview?.budgetAllIn
                  ? `${budgetOverview.budgetAllIn.currency} · ${budgetOverview.year}`
                  : "No configurado"}
              </p>
            </CardContent>
          </Card>
          <Card className="border-blue-500/30">
            <CardContent className="p-3">
              {budgetOverview?.budgetAllIn ? (
                <>
                  <div
                    className={`text-2xl font-bold ${
                      budgetOverview.totals.varianceBudgetVsForecast >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {formatCurrency(
                      Math.abs(budgetOverview.totals.varianceBudgetVsForecast)
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {getVarianceIcon(
                      -budgetOverview.totals.varianceBudgetVsForecast
                    )}
                    <p className="text-sm text-muted-foreground">
                      {ES_TEXTS.forecast.overUnderBudget}
                    </p>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs max-w-xs">
                            Diferencia entre presupuesto anual y pronóstico
                            total (Budget - Forecast)
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {budgetOverview.totals.varianceBudgetVsForecast >= 0
                      ? "Bajo presupuesto"
                      : "Sobre presupuesto"}
                  </p>
                </>
              ) : (
                <>
                  <div className="text-2xl font-bold text-muted-foreground">
                    —
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {ES_TEXTS.forecast.overUnderBudget}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    No hay presupuesto
                  </p>
                </>
              )}
            </CardContent>
          </Card>
          <Card className="border-blue-500/30">
            <CardContent className="p-3">
              <div
                className={`text-2xl font-bold ${
                  budgetOverview?.totals.percentBudgetConsumedForecast !==
                    null &&
                  budgetOverview?.totals.percentBudgetConsumedForecast !==
                    undefined
                    ? budgetOverview.totals.percentBudgetConsumedForecast > 100
                      ? "text-red-600"
                      : budgetOverview.totals.percentBudgetConsumedForecast > 90
                      ? "text-yellow-600"
                      : "text-green-600"
                    : "text-muted-foreground"
                }`}
              >
                {budgetOverview?.totals.percentBudgetConsumedForecast !==
                  null &&
                budgetOverview?.totals.percentBudgetConsumedForecast !==
                  undefined
                  ? `${budgetOverview.totals.percentBudgetConsumedForecast.toFixed(
                      1
                    )}%`
                  : "—"}
              </div>
              <div className="flex items-center gap-1">
                <p className="text-sm text-muted-foreground">
                  % Consumo Pronóstico
                </p>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs max-w-xs">
                        Porcentaje del presupuesto consumido según pronóstico
                        (Forecast / Budget × 100)
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-xs text-muted-foreground">Forecast / Budget</p>
            </CardContent>
          </Card>
          <Card className="border-blue-500/30">
            <CardContent className="p-3">
              <div
                className={`text-2xl font-bold ${
                  budgetOverview?.totals.percentBudgetConsumedActual !== null &&
                  budgetOverview?.totals.percentBudgetConsumedActual !==
                    undefined
                    ? budgetOverview.totals.percentBudgetConsumedActual > 100
                      ? "text-red-600"
                      : budgetOverview.totals.percentBudgetConsumedActual > 90
                      ? "text-yellow-600"
                      : "text-green-600"
                    : "text-muted-foreground"
                }`}
              >
                {budgetOverview?.totals.percentBudgetConsumedActual !== null &&
                budgetOverview?.totals.percentBudgetConsumedActual !== undefined
                  ? `${budgetOverview.totals.percentBudgetConsumedActual.toFixed(
                      1
                    )}%`
                  : "—"}
              </div>
              <div className="flex items-center gap-1">
                <p className="text-sm text-muted-foreground">% Consumo Real</p>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs max-w-xs">
                        Porcentaje del presupuesto consumido por gastos reales
                        (Actual / Budget × 100)
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-xs text-muted-foreground">Actual / Budget</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========== TODOS / PORTFOLIO VIEW LAYOUT ========== */}
      {isPortfolioView && (
        <>
          {/* Position #2: Cuadrícula de Pronóstico (12 Meses) - Canonical 12m grid */}
          {/* NOTE: This is the canonical 12-month grid when NEW_FORECAST_LAYOUT is enabled. */}
          {/* This MUST always render in portfolio view (even when forecastData is empty) */}
          {/* The ForecastRubrosTable component handles empty state internally */}
          {/* Must NOT be collapsed by default on entry (defaultOpen=true). */}
          {/* Single instance on entire page - no duplicates. */}
          {NEW_FORECAST_LAYOUT_ENABLED && !loading && (
            <Collapsible
              open={isRubrosGridOpen}
              onOpenChange={handleRubrosGridOpenChange}
              defaultOpen={false}
            >
              <Card ref={rubrosSectionRef} tabIndex={-1} className="space-y-2">
                <CardHeader className="pb-2 pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">
                        Cuadrícula de Pronóstico
                      </CardTitle>
                      <Badge variant="secondary" className="ml-2">M1-M12</Badge>
                    </div>
                    
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        aria-label="Expandir/Colapsar Cuadrícula de Pronóstico"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <ForecastRubrosTable
                      categoryTotals={categoryTotals}
                      categoryRubros={categoryRubros}
                      projectTotals={projectTotals}
                      projectRubros={projectRubros}
                      portfolioTotals={portfolioTotalsForCharts}
                      monthlyBudgets={monthlyBudgets}
                      onSaveBudget={handleSaveBudgetFromTable}
                      formatCurrency={formatCurrency}
                      canEditBudget={canEditBudget}
                      defaultFilter="labor"
                    />
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}

          {/* Position #3: Matriz del Mes — Vista Ejecutiva - MonthlySnapshotGrid */}
          {/* Visual: filters & buttons must be compact and balanced (see #3 in expected layout). */}
          {/* Only show when NEW_FORECAST_LAYOUT is enabled */}
          {NEW_FORECAST_LAYOUT_ENABLED && (isLoadingForecast ? (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-center min-h-[200px]">
                  <div className="text-center">
                    <LoadingSpinner size="lg" />
                    <p className="text-muted-foreground mt-4">
                      Cargando pronóstico...
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (forecastData.length > 0 || portfolioLineItems.length > 0) ? (
            <MonthlySnapshotGrid
              forecastData={forecastData}
              lineItems={portfolioLineItems}
              monthlyBudgets={monthlyBudgets}
              useMonthlyBudget={useMonthlyBudget}
              formatCurrency={formatCurrency}
              getCurrentMonthIndex={getCurrentMonthIndex}
              onScrollToDetail={(params) => {
                // Scroll to the 12-month grid section
                if (rubrosSectionRef.current) {
                  setIsRubrosGridOpen(true);
                  setTimeout(() => {
                    rubrosSectionRef.current?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    });
                  }, 100);
                }
              }}
              onNavigateToReconciliation={(lineItemId, projectId) => {
                const params = new URLSearchParams();
                if (projectId) {
                  params.set("projectId", projectId);
                }
                params.set("line_item", lineItemId);
                const currentPath = location.pathname + location.search;
                params.set("returnUrl", currentPath);
                navigate(
                  `/finanzas/sdmt/cost/reconciliation?${params.toString()}`
                );
              }}
              onNavigateToCostCatalog={(projectId) => {
                navigate(`/sdmt/cost/catalog?projectId=${projectId}`);
              }}
            />
          ) : null)}

          {/* Position #4: Resumen de Portafolio - PortfolioSummaryView */}
          {/* Only show when NEW_FORECAST_LAYOUT is enabled, HIDE_PROJECT_SUMMARY flag is false, and budget simulation is NOT active */}
          {NEW_FORECAST_LAYOUT_ENABLED && !HIDE_PROJECT_SUMMARY && !loading && !budgetSimulation.enabled && (
            <Collapsible
              open={isPortfolioSummaryOpen}
              onOpenChange={handlePortfolioSummaryOpenChange}
              defaultOpen={false}
            >
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      Resumen de Portafolio
                    </CardTitle>
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        aria-label="Expandir/Colapsar resumen de Portafolio"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <PortfolioSummaryView
                      forecastData={forecastData}
                      lineItems={portfolioLineItems}
                      formatCurrency={formatCurrency}
                      monthlyBudgetAllocations={monthlyBudgetAllocations}
                      runwayMetrics={runwayMetrics}
                      selectedPeriod={selectedPeriod}
                      getCurrentMonthIndex={getCurrentMonthIndex}
                      allProjects={projects
                        .filter((p) => p.id !== ALL_PROJECTS_ID)
                        .map((p) => ({ id: p.id, name: p.name }))}
                      onViewProject={(projectId) => {
                        console.log("View project:", projectId);
                      }}
                    />
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}

          {/* Duplicate ForecastRubrosTable removed - keeping only the first instance at line ~2551 */}

          {/* Position #5: Simulador de Presupuesto - Collapsible (defaultOpen={false}) */}
          {/* Only show when NEW_FORECAST_LAYOUT is enabled */}
          {NEW_FORECAST_LAYOUT_ENABLED && (
          <Collapsible
            open={isBudgetSimulatorOpen}
            onOpenChange={handleBudgetSimulatorOpenChange}
            defaultOpen={false}
          >
            <Card className="border-2 border-primary/20">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calculator className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">
                      Simulador de Presupuesto
                    </CardTitle>
                  </div>
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      aria-label="Expandir/Colapsar simulador de presupuesto"
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
                    <div className="text-sm font-medium">
                      Presupuesto Anual All-In
                    </div>
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="flex-shrink-0 w-20">
                        <label
                          htmlFor="budget-year"
                          className="text-xs text-muted-foreground block mb-1"
                        >
                          Año
                        </label>
                        <Input
                          id="budget-year"
                          type="number"
                          value={budgetYear}
                          onChange={(e) =>
                            setBudgetYear(parseInt(e.target.value))
                          }
                          min={2020}
                          max={2100}
                          disabled={
                            loadingBudget || savingBudget || !canEditBudget
                          }
                          className="h-8 text-sm"
                          aria-label="Año del presupuesto"
                        />
                      </div>
                      <div className="flex-grow min-w-[140px] max-w-[200px]">
                        <label
                          htmlFor="budget-amount"
                          className="text-xs text-muted-foreground block mb-1"
                        >
                          Monto
                        </label>
                        <Input
                          id="budget-amount"
                          type="number"
                          value={budgetAmount}
                          onChange={(e) => setBudgetAmount(e.target.value)}
                          placeholder="0"
                          disabled={
                            loadingBudget || savingBudget || !canEditBudget
                          }
                          className="h-8 text-sm"
                          aria-label="Monto del presupuesto"
                        />
                      </div>
                      <div className="flex-shrink-0 w-20">
                        <label
                          htmlFor="budget-currency"
                          className="text-xs text-muted-foreground block mb-1"
                        >
                          Moneda
                        </label>
                        <select
                          id="budget-currency"
                          value={budgetCurrency}
                          onChange={(e) => setBudgetCurrency(e.target.value)}
                          disabled={
                            loadingBudget || savingBudget || !canEditBudget
                          }
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
                        disabled={
                          savingBudget ||
                          loadingBudget ||
                          !canEditBudget ||
                          !budgetAmount
                        }
                        className="gap-2 h-8 min-w-[160px]"
                        size="sm"
                      >
                        {savingBudget ? <LoadingSpinner size="sm" /> : null}
                        {savingBudget ? "Guardando..." : "Guardar Presupuesto"}
                      </Button>
                    </div>
                    {budgetLastUpdated && (
                      <div className="text-xs text-muted-foreground mt-2">
                        📅 Última actualización:{" "}
                        {new Date(budgetLastUpdated).toLocaleString("es-MX")}
                      </div>
                    )}
                    {!canEditBudget && (
                      <div className="text-xs text-amber-600 mt-2">
                        ⚠️ Solo usuarios PMO/SDMT pueden editar el presupuesto
                        anual
                      </div>
                    )}
                  </div>

                  {/* Monthly Budget Input - Only when annual budget is set */}
                  {budgetAmount && parseFloat(budgetAmount) > 0 && (
                    <div className="border-t pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-sm font-medium">
                          Modo: Presupuesto Mensual
                        </div>
                        <div className="flex items-center gap-2">
                          <Label
                            htmlFor="use-monthly-budget"
                            className="text-sm text-muted-foreground"
                          >
                            Habilitar entrada mensual
                          </Label>
                          <input
                            type="checkbox"
                            id="use-monthly-budget"
                            checked={useMonthlyBudget}
                            onChange={(e) =>
                              setUseMonthlyBudget(e.target.checked)
                            }
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
                          💡 Presupuesto se distribuye automáticamente por mes
                          basado en costos planificados. Habilite "entrada
                          mensual" arriba para ingresar presupuestos específicos
                          por mes.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Budget Simulator */}
                  <div className="border-t pt-4">
                    <div className="text-sm font-medium mb-3">
                      Simulador de Presupuesto (solo vista)
                    </div>
                    <BudgetSimulatorCard
                      simulationState={budgetSimulation}
                      onSimulationChange={setBudgetSimulation}
                    />
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
          )}

          {/* Position #6: Gráficos de Tendencias - ForecastChartsPanel (Collapsible) */}
          {/* Only show when NEW_FORECAST_LAYOUT is enabled */}
          {NEW_FORECAST_LAYOUT_ENABLED && !loading && forecastData.length > 0 && (
            <ForecastChartsPanel
              portfolioTotals={portfolioTotalsForCharts}
              categoryTotals={categoryTotals}
              monthlyBudgets={monthlyBudgets}
              useMonthlyBudget={useMonthlyBudget}
              formatCurrency={formatCurrency}
              projectsPerMonth={projectsPerMonth}
              isOpen={isChartsPanelOpen}
              onOpenChange={handleChartsPanelOpenChange}
            />
          )}
        </>
      )}

      {/* ========== SINGLE PROJECT VIEW LAYOUT ========== */}
      {/* Budget & Simulation Panel - Collapsible - Single Project Mode Only */}
      {!isPortfolioView && (
        <Collapsible
          open={isSingleProjectBudgetOpen}
          onOpenChange={handleSingleProjectBudgetOpenChange}
          defaultOpen={false}
        >
          <Card className="border-2 border-primary/20">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">
                    Presupuesto & Simulación
                  </CardTitle>
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
                  <div className="text-sm font-medium">
                    Presupuesto Anual All-In
                  </div>
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="flex-shrink-0 w-20">
                      <label
                        htmlFor="budget-year"
                        className="text-xs text-muted-foreground block mb-1"
                      >
                        Año
                      </label>
                      <Input
                        id="budget-year"
                        type="number"
                        value={budgetYear}
                        onChange={(e) =>
                          setBudgetYear(parseInt(e.target.value))
                        }
                        min={2020}
                        max={2100}
                        disabled={
                          loadingBudget || savingBudget || !canEditBudget
                        }
                        className="h-8 text-sm"
                        aria-label="Año del presupuesto"
                      />
                    </div>
                    <div className="flex-grow min-w-[140px] max-w-[200px]">
                      <label
                        htmlFor="budget-amount"
                        className="text-xs text-muted-foreground block mb-1"
                      >
                        Monto
                      </label>
                      <Input
                        id="budget-amount"
                        type="number"
                        value={budgetAmount}
                        onChange={(e) => setBudgetAmount(e.target.value)}
                        placeholder="0"
                        disabled={
                          loadingBudget || savingBudget || !canEditBudget
                        }
                        className="h-8 text-sm"
                        aria-label="Monto del presupuesto"
                      />
                    </div>
                    <div className="flex-shrink-0 w-20">
                      <label
                        htmlFor="budget-currency"
                        className="text-xs text-muted-foreground block mb-1"
                      >
                        Moneda
                      </label>
                      <select
                        id="budget-currency"
                        value={budgetCurrency}
                        onChange={(e) => setBudgetCurrency(e.target.value)}
                        disabled={
                          loadingBudget || savingBudget || !canEditBudget
                        }
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
                      disabled={
                        savingBudget ||
                        loadingBudget ||
                        !canEditBudget ||
                        !budgetAmount
                      }
                      className="gap-2 h-8 min-w-[160px]"
                      size="sm"
                    >
                      {savingBudget ? <LoadingSpinner size="sm" /> : null}
                      {savingBudget ? "Guardando..." : "Guardar Presupuesto"}
                    </Button>
                  </div>
                  {budgetLastUpdated && (
                    <div className="text-xs text-muted-foreground mt-2">
                      📅 Última actualización:{" "}
                      {new Date(budgetLastUpdated).toLocaleString("es-MX")}
                    </div>
                  )}
                  {!canEditBudget && (
                    <div className="text-xs text-amber-600 mt-2">
                      ⚠️ Solo usuarios PMO/SDMT pueden editar el presupuesto
                      anual
                    </div>
                  )}
                  {!isPortfolioView && budgetAmount && (
                    <div className="text-xs text-muted-foreground mt-2">
                      ℹ️ Presupuesto All-In aplica a todos los proyectos;
                      seleccione "TODOS" para ver consumo total.
                    </div>
                  )}
                </div>

                {/* Monthly Budget Input - Only in Portfolio View when annual budget is set */}
                {isPortfolioView &&
                  budgetAmount &&
                  parseFloat(budgetAmount) > 0 && (
                    <div className="border-t pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-sm font-medium">
                          Modo: Presupuesto Mensual
                        </div>
                        <div className="flex items-center gap-2">
                          <Label
                            htmlFor="use-monthly-budget"
                            className="text-sm text-muted-foreground"
                          >
                            Habilitar entrada mensual
                          </Label>
                          <input
                            type="checkbox"
                            id="use-monthly-budget"
                            checked={useMonthlyBudget}
                            onChange={(e) =>
                              setUseMonthlyBudget(e.target.checked)
                            }
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
                          💡 Presupuesto se distribuye automáticamente por mes
                          basado en costos planificados. Habilite "entrada
                          mensual" arriba para ingresar presupuestos específicos
                          por mes.
                        </div>
                      )}
                    </div>
                  )}

                {/* Budget Simulator - Only in Portfolio View */}
                {isPortfolioView && (
                  <>
                    <div className="border-t pt-4">
                      <div className="text-sm font-medium mb-3">
                        Simulador de Presupuesto (solo vista)
                      </div>
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
      )}

      {/* Forecast Grid / Position #7: Monitoreo mensual de proyectos vs. presupuesto */}
      {/* This is the legacy grid for old layout, and Position #7 for NEW_FORECAST_LAYOUT */}
      {/* Shows in portfolio view with breakdown modes (Proyectos | Rubros por proyecto) */}
      {isPortfolioView ? (
        /* TODOS mode - wrapped in collapsible "Monitoreo mensual de proyectos vs. presupuesto" */
        <Collapsible
          open={isMonitoringTableOpen}
          onOpenChange={handleMonitoringTableOpenChange}
          defaultOpen={true}
        >
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">
                    Monitoreo mensual de proyectos vs. presupuesto
                  </CardTitle>
                  <Badge variant="secondary" className="ml-2">M1-M12</Badge>
                </div>
                
                <div className="flex items-center gap-3">
                  <Label htmlFor="breakdown-mode-select" className="text-sm">Vista</Label>
                  <Select
                    value={breakdownMode}
                    onValueChange={(v) => handleBreakdownModeChange(v as 'project' | 'rubros')}
                  >
                    <SelectTrigger
                      id="breakdown-mode-select"
                      className="h-8 w-[200px]"
                      aria-label="Seleccionar vista: Proyectos o Rubros por proyecto"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="project">Proyectos</SelectItem>
                      <SelectItem value="rubros">Rubros por proyecto</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      aria-label="Expandir/Colapsar desglose mensual"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </CollapsibleTrigger>
                </div>
              </div>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="pt-0">
                {selectedPeriod === "CURRENT_MONTH" && !isLoadingState && (
                  <div className="mb-3 p-2 bg-blue-50 rounded text-sm text-blue-900">
                    📅 Mostrando solo el mes en curso (M{getCurrentMonthIndex()}
                    ) - {getCalendarMonth(getCurrentMonthIndex())}
                  </div>
                )}
                {budgetMissingYear && (
                  <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    No hay presupuesto configurado para {budgetMissingYear}.
                    Puedes “Materializar Ahora” o continuar con pronóstico
                    manual.
                  </div>
                )}
                {isLoadingState ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="text-center space-y-3">
                      <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center mx-auto mb-2 animate-pulse">
                        <span className="text-primary font-bold text-sm">
                          📊
                        </span>
                      </div>
                      <div className="text-muted-foreground">
                        Cargando datos de pronóstico
                        {currentProject ? ` para ${currentProject.name}` : ""}
                        ...
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Project: {selectedProjectId} | Change #
                        {projectChangeCount}
                      </div>
                    </div>
                  </div>
                ) : isTodosEmptyState ? (
                  <div className="flex items-center justify-center h-48">
                    <div className="text-center space-y-4 max-w-md">
                      <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                        <span className="text-amber-600 font-bold text-xl">
                          ⚠️
                        </span>
                      </div>
                      <div className="text-lg font-semibold text-foreground">
                        No se encontraron proyectos para 'TODOS'
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Verifica permisos y filtros. Si deberías ver proyectos,
                        intenta recargar.
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Proyectos cargados: {projects.length} (incluyendo
                        ALL_PROJECTS)
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
                        <span className="text-destructive font-bold text-sm">
                          ⚠️
                        </span>
                      </div>
                      <div className="text-destructive">{forecastError}</div>
                      <div className="text-xs text-muted-foreground">
                        Project ID: {selectedProjectId}
                      </div>
                    </div>
                  </div>
                ) : isEmptyState ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="text-center space-y-3">
                      <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center mx-auto mb-2">
                        <span className="text-muted-foreground font-bold text-sm">
                          🗂️
                        </span>
                      </div>
                      <div className="text-muted-foreground">
                        No hay datos de pronóstico disponibles aún para{" "}
                        {currentProject?.name || "este proyecto"}.
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Project ID: {selectedProjectId} | Última generación:{" "}
                        {generatedAt
                          ? new Date(generatedAt).toLocaleString()
                          : "sin registro"}
                      </div>
                    </div>
                  </div>
                ) : !hasGridData ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="text-center space-y-3">
                      <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center mx-auto mb-2">
                        <span className="text-muted-foreground font-bold text-sm">
                          📋
                        </span>
                      </div>
                      <div className="text-muted-foreground">
                        No hay datos de pronóstico disponibles para{" "}
                        {currentProject?.name || "este proyecto"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Project ID: {selectedProjectId}
                      </div>
                    </div>
                  </div>
                ) : FEATURE_FLAGS.ENABLE_RUBROS_ADAPTER ? (
                  <ForecastRubrosAdapter
                    categoryTotals={categoryTotals}
                    categoryRubros={categoryRubros}
                    projectTotals={projectTotals}
                    projectRubros={projectRubros}
                    portfolioTotals={portfolioTotalsForCharts}
                    monthlyBudgets={monthlyBudgets}
                    baselineDetail={baselineDetail}
                    selectedPeriod={selectedPeriod}
                    externalViewMode={breakdownMode === 'project' ? 'project' : 'category'}
                    onViewModeChange={(v) => handleBreakdownModeChange(v === 'project' ? 'project' : 'rubros')}
                    onSaveMonthlyBudget={handleSaveMonthlyBudget}
                    formatCurrency={formatCurrency}
                    canEditBudget={canEditBudget}
                    materializationPending={materializationPending}
                    materializationFailed={materializationFailed}
                    materializationTimeout={materializationTimeout}
                    onRetryMaterialization={handleRetryMaterialization}
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead
                            className="sticky left-0 bg-background min-w-[300px] cursor-pointer hover:bg-muted/50 select-none"
                            onClick={toggleSortDirection}
                            title="Click para ordenar"
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) =>
                              e.key === "Enter" && toggleSortDirection()
                            }
                            aria-label={`Ordenar por rubro - actualmente ${
                              sortDirection === "asc"
                                ? "ascendente"
                                : "descendente"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span>Rubro</span>
                              <span
                                className="text-muted-foreground"
                                aria-hidden="true"
                              >
                                {sortDirection === "asc" ? "▲" : "▼"}
                              </span>
                            </div>
                          </TableHead>
                          {(() => {
                            const isCurrentMonthMode =
                              selectedPeriod === "CURRENT_MONTH";
                            const currentMonthIndex = isCurrentMonthMode
                              ? getCurrentMonthIndex()
                              : 0;
                            // Dynamic month range based on selectedPeriod
                            const periodCount = isCurrentMonthMode
                              ? 1
                              : parseInt(selectedPeriod) || 12;
                            const baselineDuration =
                              getBaselineDuration(baselineDetail);
                            const maxMonths = Math.max(1, baselineDuration);
                            const monthCount = Math.min(periodCount, maxMonths);
                            const monthsToShow = isCurrentMonthMode
                              ? [currentMonthIndex]
                              : Array.from(
                                  { length: monthCount },
                                  (_, i) => i + 1
                                );

                            return monthsToShow.map((monthNum) => (
                              <TableHead
                                key={monthNum}
                                className="text-center min-w-[140px]"
                              >
                                <div className="font-semibold">M{monthNum}</div>
                                {!isPortfolioView && projectStartDate && (
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
                        {forecastGridWithSubtotals.map((row, rowIndex) => {
                          if (row.type === "subtotal") {
                            // Render sub-total row
                            return (
                              <TableRow
                                key={`subtotal-${row.category}-${rowIndex}`}
                                className="bg-muted/30 font-semibold"
                              >
                                <TableCell className="sticky left-0 bg-muted/30">
                                  <div className="font-bold text-sm">
                                    Subtotal - {row.category}
                                  </div>
                                </TableCell>
                                {row.monthlyData.map((cell) => (
                                  <TableCell key={cell.month} className="p-2">
                                    <div className="space-y-2 text-xs font-semibold">
                                      {/* Sub-total Planned */}
                                      {cell.planned > 0 && (
                                        <div className="text-muted-foreground bg-muted/40 px-2 py-1 rounded">
                                          P: {formatGridCurrency(cell.planned)}
                                        </div>
                                      )}

                                      {/* Sub-total Forecast */}
                                      {(cell.forecast > 0 ||
                                        cell.planned > 0) && (
                                        <div className="px-2 py-1 rounded bg-primary/10 text-primary">
                                          F: {formatGridCurrency(cell.forecast)}
                                        </div>
                                      )}

                                      {/* Sub-total Actual */}
                                      {(cell.actual > 0 ||
                                        cell.forecast > 0 ||
                                        cell.planned > 0) && (
                                        <div className="px-2 py-1 rounded bg-blue-50/80 text-blue-700">
                                          A: {formatGridCurrency(cell.actual)}
                                        </div>
                                      )}

                                      {/* Sub-total Variance */}
                                      {cell.variance !== 0 && (
                                        <div
                                          className={`px-2 py-1 rounded text-xs font-bold text-center ${getVarianceColor(
                                            cell.variance
                                          )}`}
                                        >
                                          {cell.variance > 0 ? "+" : ""}
                                          {formatGridCurrency(cell.variance)}
                                        </div>
                                      )}
                                    </div>
                                  </TableCell>
                                ))}
                              </TableRow>
                            );
                          }

                          // Render regular item row
                          const { lineItem, monthlyData } = row;
                          if (!lineItem) {
                            // Safety check: skip if lineItem is undefined (should not happen for item rows)
                            return null;
                          }
                          return (
                            <TableRow key={lineItem.id}>
                              <TableCell className="sticky left-0 bg-background">
                                <div className="space-y-1">
                                  <div className="font-medium flex items-center gap-2">
                                    {lineItem.description}
                                    {lineItem.projectName && (
                                      <Badge
                                        variant="outline"
                                        className="text-[10px]"
                                      >
                                        {lineItem.projectName}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {lineItem.category}
                                  </div>
                                </div>
                              </TableCell>
                              {monthlyData.map((cell) => (
                                <TableCell key={cell.month} className="p-2">
                                  <div className="space-y-2 text-xs">
                                    {/* Planned (Read-only) - only show if > 0 */}
                                    {cell.planned > 0 && (
                                      <div className="text-muted-foreground bg-muted/20 px-2 py-1 rounded">
                                        P: {formatGridCurrency(cell.planned)}
                                      </div>
                                    )}

                                    {/* Forecast (Editable by PMO/SDMT) - only show if > 0 or planned > 0 */}
                                    {(cell.forecast > 0 ||
                                      cell.planned > 0) && (
                                      <div>
                                        {editingCell?.line_item_id ===
                                          cell.line_item_id &&
                                        editingCell?.month === cell.month &&
                                        editingCell?.type === "forecast" ? (
                                          <Input
                                            value={editValue}
                                            onChange={(e) =>
                                              setEditValue(e.target.value)
                                            }
                                            onBlur={handleCellSave}
                                            onKeyDown={(e) =>
                                              e.key === "Enter" &&
                                              handleCellSave()
                                            }
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
                                              canEditForecast &&
                                              !savingForecasts
                                                ? "cursor-pointer hover:bg-primary/10 bg-primary/5 text-primary font-medium"
                                                : "cursor-default bg-muted/10 text-muted-foreground"
                                            }`}
                                            onClick={() =>
                                              canEditForecast &&
                                              !savingForecasts &&
                                              handleCellEdit(
                                                cell.line_item_id,
                                                cell.month,
                                                "forecast"
                                              )
                                            }
                                            title={
                                              savingForecasts
                                                ? "Guardando pronósticos..."
                                                : canEditForecast
                                                ? "Click to edit forecast"
                                                : "No permission to edit forecast"
                                            }
                                          >
                                            F:{" "}
                                            {formatGridCurrency(cell.forecast)}
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {/* Actual (Editable by SDMT only) - only show if > 0 or there's forecast/planned */}
                                    {(cell.actual > 0 ||
                                      cell.forecast > 0 ||
                                      cell.planned > 0) && (
                                      <div>
                                        {editingCell?.line_item_id ===
                                          cell.line_item_id &&
                                        editingCell?.month === cell.month &&
                                        editingCell?.type === "actual" ? (
                                          <Input
                                            value={editValue}
                                            onChange={(e) =>
                                              setEditValue(e.target.value)
                                            }
                                            onBlur={handleCellSave}
                                            onKeyDown={(e) =>
                                              e.key === "Enter" &&
                                              handleCellSave()
                                            }
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
                                                  ? "cursor-pointer hover:bg-blue-50 bg-blue-50/50 text-blue-700 font-medium"
                                                  : "cursor-default bg-muted/10 text-muted-foreground"
                                              }`}
                                              onClick={() =>
                                                canEditActual &&
                                                handleCellEdit(
                                                  cell.line_item_id,
                                                  cell.month,
                                                  "actual"
                                                )
                                              }
                                              title={
                                                canEditActual
                                                  ? "Click to edit actual"
                                                  : "No permission to edit actuals"
                                              }
                                            >
                                              A:{" "}
                                              {formatGridCurrency(cell.actual)}
                                            </div>
                                            {/* Always show reconciliation icon for organic actuals entry */}
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              className="h-5 w-5 p-0 hover:bg-blue-100"
                                              onClick={() =>
                                                navigateToReconciliation(
                                                  cell.line_item_id,
                                                  cell.month
                                                )
                                              }
                                              title={
                                                cell.actual > 0
                                                  ? "View/Edit Factura"
                                                  : "Add Factura / Enter Actuals"
                                              }
                                            >
                                              <ExternalLink size={12} />
                                            </Button>
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {/* Variance Indicator */}
                                    {cell.variance !== 0 && (
                                      <div
                                        className={`px-2 py-1 rounded text-xs font-medium text-center ${getVarianceColor(
                                          cell.variance
                                        )}`}
                                      >
                                        {cell.variance > 0 ? "+" : ""}
                                        {formatGridCurrency(cell.variance)}
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
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      ) : (
        /* Single project mode - regular Card wrapper */
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedPeriod === "CURRENT_MONTH"
                ? `Cuadrícula de Pronóstico - Mes Actual (M${getCurrentMonthIndex()})`
                : "Cuadrícula de Pronóstico"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedPeriod === "CURRENT_MONTH" && !isLoadingState && (
              <div className="mb-3 p-2 bg-blue-50 rounded text-sm text-blue-900">
                📅 Mostrando solo el mes en curso (M{getCurrentMonthIndex()}) -{" "}
                {getCalendarMonth(getCurrentMonthIndex())}
              </div>
            )}
            {budgetMissingYear && (
              <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                No hay presupuesto configurado para {budgetMissingYear}. Puedes
                "Materializar Ahora" o continuar con pronóstico manual.
              </div>
            )}
            {isLoadingState ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-center space-y-3">
                  <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center mx-auto mb-2 animate-pulse">
                    <span className="text-primary font-bold text-sm">📊</span>
                  </div>
                  <div className="text-muted-foreground">
                    Cargando datos de pronóstico
                    {currentProject ? ` para ${currentProject.name}` : ""}...
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
                    Verifica permisos y filtros. Si deberías ver proyectos,
                    intenta recargar.
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Proyectos cargados: {projects.length} (incluyendo
                    ALL_PROJECTS)
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
                    <span className="text-destructive font-bold text-sm">
                      ⚠️
                    </span>
                  </div>
                  <div className="text-destructive">{forecastError}</div>
                  <div className="text-xs text-muted-foreground">
                    Project ID: {selectedProjectId}
                  </div>
                </div>
              </div>
            ) : isEmptyState ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-center space-y-3">
                  <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center mx-auto mb-2">
                    <span className="text-muted-foreground font-bold text-sm">
                      🗂️
                    </span>
                  </div>
                  <div className="text-muted-foreground">
                    No hay datos de pronóstico disponibles aún para{" "}
                    {currentProject?.name || "este proyecto"}.
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Project ID: {selectedProjectId} | Última generación:{" "}
                    {generatedAt
                      ? new Date(generatedAt).toLocaleString()
                      : "sin registro"}
                  </div>
                </div>
              </div>
            ) : !hasGridData ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-center space-y-3">
                  <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center mx-auto mb-2">
                    <span className="text-muted-foreground font-bold text-sm">
                      📋
                    </span>
                  </div>
                  <div className="text-muted-foreground">
                    No hay datos de pronóstico disponibles para{" "}
                    {currentProject?.name || "este proyecto"}
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
                      <TableHead
                        className="sticky left-0 bg-background min-w-[300px] cursor-pointer hover:bg-muted/50 select-none"
                        onClick={toggleSortDirection}
                        title="Click para ordenar"
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) =>
                          e.key === "Enter" && toggleSortDirection()
                        }
                        aria-label={`Ordenar por rubro - actualmente ${
                          sortDirection === "asc" ? "ascendente" : "descendente"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span>Rubro</span>
                          <span
                            className="text-muted-foreground"
                            aria-hidden="true"
                          >
                            {sortDirection === "asc" ? "▲" : "▼"}
                          </span>
                        </div>
                      </TableHead>
                      {(() => {
                        const isCurrentMonthMode =
                          selectedPeriod === "CURRENT_MONTH";
                        const currentMonthIndex = isCurrentMonthMode
                          ? getCurrentMonthIndex()
                          : 0;
                        // Dynamic month range based on selectedPeriod
                        const periodCount = isCurrentMonthMode
                          ? 1
                          : parseInt(selectedPeriod) || 12;
                        const baselineDuration =
                          getBaselineDuration(baselineDetail);
                        const maxMonths = Math.max(1, baselineDuration);
                        const monthCount = Math.min(periodCount, maxMonths);
                        const monthsToShow = isCurrentMonthMode
                          ? [currentMonthIndex]
                          : Array.from({ length: monthCount }, (_, i) => i + 1);

                        return monthsToShow.map((monthNum) => (
                          <TableHead
                            key={monthNum}
                            className="text-center min-w-[140px]"
                          >
                            <div className="font-semibold">M{monthNum}</div>
                            {!isPortfolioView && projectStartDate && (
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
                    {forecastGridWithSubtotals.map((row, rowIndex) => {
                      if (row.type === "subtotal") {
                        // Render sub-total row
                        return (
                          <TableRow
                            key={`subtotal-${row.category}-${rowIndex}`}
                            className="bg-muted/30 font-semibold"
                          >
                            <TableCell className="sticky left-0 bg-muted/30">
                              <div className="font-bold text-sm">
                                Subtotal - {row.category}
                              </div>
                            </TableCell>
                            {row.monthlyData.map((cell) => (
                              <TableCell key={cell.month} className="p-2">
                                <div className="space-y-2 text-xs font-semibold">
                                  {/* Sub-total Planned */}
                                  {cell.planned > 0 && (
                                    <div className="text-muted-foreground bg-muted/40 px-2 py-1 rounded">
                                      P: {formatGridCurrency(cell.planned)}
                                    </div>
                                  )}

                                  {/* Sub-total Forecast */}
                                  {(cell.forecast > 0 || cell.planned > 0) && (
                                    <div className="px-2 py-1 rounded bg-primary/10 text-primary">
                                      F: {formatGridCurrency(cell.forecast)}
                                    </div>
                                  )}

                                  {/* Sub-total Actual */}
                                  {(cell.actual > 0 ||
                                    cell.forecast > 0 ||
                                    cell.planned > 0) && (
                                    <div className="px-2 py-1 rounded bg-blue-50/80 text-blue-700">
                                      A: {formatGridCurrency(cell.actual)}
                                    </div>
                                  )}

                                  {/* Sub-total Variance */}
                                  {cell.variance !== 0 && (
                                    <div
                                      className={`px-2 py-1 rounded text-xs font-bold text-center ${getVarianceColor(
                                        cell.variance
                                      )}`}
                                    >
                                      {cell.variance > 0 ? "+" : ""}
                                      {formatGridCurrency(cell.variance)}
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            ))}
                          </TableRow>
                        );
                      }

                      // Render regular item row
                      const { lineItem, monthlyData } = row;
                      if (!lineItem) {
                        // Safety check: skip if lineItem is undefined (should not happen for item rows)
                        return null;
                      }
                      return (
                        <TableRow key={lineItem.id}>
                          <TableCell className="sticky left-0 bg-background">
                            <div className="space-y-1">
                              <div className="font-medium flex items-center gap-2">
                                {lineItem.description}
                                {lineItem.projectName && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px]"
                                  >
                                    {lineItem.projectName}
                                  </Badge>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {lineItem.category}
                              </div>
                            </div>
                          </TableCell>
                          {monthlyData.map((cell) => (
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
                                    {editingCell?.line_item_id ===
                                      cell.line_item_id &&
                                    editingCell?.month === cell.month &&
                                    editingCell?.type === "forecast" ? (
                                      <Input
                                        value={editValue}
                                        onChange={(e) =>
                                          setEditValue(e.target.value)
                                        }
                                        onBlur={handleCellSave}
                                        onKeyDown={(e) =>
                                          e.key === "Enter" && handleCellSave()
                                        }
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
                                            ? "cursor-pointer hover:bg-primary/10 bg-primary/5 text-primary font-medium"
                                            : "cursor-default bg-muted/10 text-muted-foreground"
                                        }`}
                                        onClick={() =>
                                          canEditForecast &&
                                          !savingForecasts &&
                                          handleCellEdit(
                                            cell.line_item_id,
                                            cell.month,
                                            "forecast"
                                          )
                                        }
                                        title={
                                          savingForecasts
                                            ? "Guardando pronósticos..."
                                            : canEditForecast
                                            ? "Click to edit forecast"
                                            : "No permission to edit forecast"
                                        }
                                      >
                                        F: {formatGridCurrency(cell.forecast)}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Actual (Editable by SDMT only) - only show if > 0 or there's forecast/planned */}
                                {(cell.actual > 0 ||
                                  cell.forecast > 0 ||
                                  cell.planned > 0) && (
                                  <div>
                                    {editingCell?.line_item_id ===
                                      cell.line_item_id &&
                                    editingCell?.month === cell.month &&
                                    editingCell?.type === "actual" ? (
                                      <Input
                                        value={editValue}
                                        onChange={(e) =>
                                          setEditValue(e.target.value)
                                        }
                                        onBlur={handleCellSave}
                                        onKeyDown={(e) =>
                                          e.key === "Enter" && handleCellSave()
                                        }
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
                                              ? "cursor-pointer hover:bg-blue-50 bg-blue-50/50 text-blue-700 font-medium"
                                              : "cursor-default bg-muted/10 text-muted-foreground"
                                          }`}
                                          onClick={() =>
                                            canEditActual &&
                                            handleCellEdit(
                                              cell.line_item_id,
                                              cell.month,
                                              "actual"
                                            )
                                          }
                                          title={
                                            canEditActual
                                              ? "Click to edit actual"
                                              : "No permission to edit actuals"
                                          }
                                        >
                                          A: {formatGridCurrency(cell.actual)}
                                        </div>
                                        {/* Always show reconciliation icon for organic actuals entry */}
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-5 w-5 p-0 hover:bg-blue-100"
                                          onClick={() =>
                                            navigateToReconciliation(
                                              cell.line_item_id,
                                              cell.month
                                            )
                                          }
                                          title={
                                            cell.actual > 0
                                              ? "View/Edit Factura"
                                              : "Add Factura / Enter Actuals"
                                          }
                                        >
                                          <ExternalLink size={12} />
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Variance Indicator */}
                                {cell.variance !== 0 && (
                                  <div
                                    className={`px-2 py-1 rounded text-xs font-medium text-center ${getVarianceColor(
                                      cell.variance
                                    )}`}
                                  >
                                    {cell.variance > 0 ? "+" : ""}
                                    {formatGridCurrency(cell.variance)}
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
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Charts and Analytics - Single Project Mode Only */}
      {!isPortfolioView &&
        !loading &&
        forecastData.length > 0 &&
        (() => {
          const charts = [
            <LineChartComponent
              key={`forecast-trends-${selectedProjectId}`}
              data={monthlyTrends}
              lines={[
                {
                  dataKey: "Planned",
                  name: ES_TEXTS.forecast.plan.replace(" (P)", ""),
                  color: "oklch(0.45 0.12 200)",
                  strokeDasharray: "5 5",
                },
                {
                  dataKey: "Forecast",
                  name: ES_TEXTS.forecast.forecast.replace(" (F)", ""),
                  color: "oklch(0.61 0.15 160)",
                  strokeWidth: 3,
                },
                {
                  dataKey: "Actual",
                  name: ES_TEXTS.forecast.actual.replace(" (A)", ""),
                  color: "oklch(0.72 0.15 65)",
                },
                // Add Budget line when simulation is enabled OR when annual budget is set
                ...(isPortfolioView &&
                ((budgetSimulation.enabled && budgetTotal > 0) ||
                  hasBudgetForVariance)
                  ? [
                      {
                        dataKey: "Budget",
                        name: ES_TEXTS.forecast.budgetLineLabel,
                        color: "oklch(0.5 0.2 350)",
                        strokeDasharray: "8 4",
                        strokeWidth: 2,
                      },
                    ]
                  : []),
              ]}
              title={ES_TEXTS.forecast.monthlyForecastTrends}
            />,
          ];

          // ALWAYS add variance analysis chart (required by specs)
          // Show placeholder if no budget, variance vs budget if budget exists
          if (hasBudgetForVariance) {
            // Show variance vs allocated budget
            charts.push(
              <StackedColumnsChart
                key={`variance-analysis-${selectedProjectId}`}
                data={varianceSeries.map((point) => {
                  const forecastVariance = point.forecastVarianceBudget ?? 0;
                  const actualVariance = point.actualVarianceBudget ?? 0;
                  return {
                    month: point.month,
                    "Forecast Over Budget": Math.max(0, forecastVariance),
                    "Forecast Under Budget": Math.abs(
                      Math.min(0, forecastVariance)
                    ),
                    "Actual Over Budget": Math.max(0, actualVariance),
                    "Actual Under Budget": Math.abs(
                      Math.min(0, actualVariance)
                    ),
                  };
                })}
                stacks={[
                  {
                    dataKey: "Forecast Over Budget",
                    name: ES_TEXTS.forecast.forecastOverBudget,
                    color: "oklch(0.65 0.2 30)",
                  },
                  {
                    dataKey: "Forecast Under Budget",
                    name: ES_TEXTS.forecast.forecastUnderBudget,
                    color: "oklch(0.55 0.15 140)",
                  },
                  {
                    dataKey: "Actual Over Budget",
                    name: ES_TEXTS.forecast.actualOverBudget,
                    color: "oklch(0.70 0.25 25)",
                  },
                  {
                    dataKey: "Actual Under Budget",
                    name: ES_TEXTS.forecast.actualUnderBudget,
                    color: "oklch(0.60 0.18 150)",
                  },
                ]}
                title={ES_TEXTS.forecast.varianceAnalysisVsBudget}
              />
            );
          } else {
            // Show placeholder card prompting to set budget
            charts.push(
              <Card
                key="variance-placeholder"
                className="border-2 border-dashed border-muted"
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    {ES_TEXTS.forecast.varianceAnalysis}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center h-[300px] text-center">
                  <div className="w-16 h-16 bg-muted/50 rounded-lg flex items-center justify-center mb-4">
                    <Calculator className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground mb-2">
                    Análisis de Variación No Disponible
                  </p>
                  <p className="text-xs text-muted-foreground max-w-xs">
                    Define el Presupuesto Anual All-In arriba para ver la
                    variación mensual vs presupuesto asignado.
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
                  type:
                    variancePercentage < 5
                      ? "positive"
                      : variancePercentage > 15
                      ? "negative"
                      : "neutral",
                },
                {
                  title: ES_TEXTS.forecast.largestVariance,
                  value: formatCurrency(
                    Math.max(
                      ...forecastData.map((c) => Math.abs(c.variance || 0))
                    )
                  ),
                  type: "neutral",
                },
                {
                  title: ES_TEXTS.forecast.forecastVsPlanned,
                  value:
                    totalForecast > totalPlanned
                      ? ES_TEXTS.forecast.overBudget
                      : totalForecast < totalPlanned
                      ? ES_TEXTS.forecast.underBudget
                      : ES_TEXTS.forecast.onTarget,
                  type:
                    totalForecast > totalPlanned
                      ? "negative"
                      : totalForecast < totalPlanned
                      ? "positive"
                      : "neutral",
                },
                // Add budget insights when simulation is enabled
                ...(isPortfolioView &&
                budgetSimulation.enabled &&
                budgetTotal > 0
                  ? [
                      {
                        title: ES_TEXTS.forecast.budgetUtilization,
                        value: `${budgetUtilization.toFixed(1)}%`,
                        type: (budgetUtilization > 100
                          ? "negative"
                          : budgetUtilization > 90
                          ? "neutral"
                          : "positive") as "positive" | "negative" | "neutral",
                      },
                    ]
                  : []),
              ]}
              onExport={handleExcelExport}
            />
          );
        })()}
    </div>
  );
}

export default SDMTForecast;
