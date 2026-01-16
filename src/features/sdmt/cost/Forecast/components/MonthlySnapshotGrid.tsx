/**
 * MonthlySnapshotGrid Component
 * 
 * Executive "Matriz del Mes" for TODOS (portfolio) mode.
 * Provides a single-month command center showing Budget/Forecast/Actual with variances
 * for all projects and rubros at a glance.
 * 
 * Supports:
 * - Month selection (current, previous, M1-M60)
 * - Grouping by Project or Rubro
 * - Search by project code/name and rubro name
 * - Filter to show only rows with variance
 * - Expand/collapse groups
 * - Sort by absolute variance vs Budget
 * - Action buttons (view monthly detail, reconciliation, budget request)
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  ChevronDown, 
  ChevronRight, 
  Calendar, 
  FileSpreadsheet, 
  ExternalLink,
  Edit,
  Search,
  ChevronsUpDown,
  Layers,
  Eye,
} from 'lucide-react';
import { toast } from 'sonner';
import { useFinanzasUser } from '@/hooks/useFinanzasUser';
import { MonthlySnapshotSummary } from './MonthlySnapshotSummary';
import { cn } from '@/lib/utils';
import { isLabor } from '@/lib/rubros-category-utils';

// Types
export interface ForecastCell {
  line_item_id: string;
  rubroId?: string;
  projectId?: string;
  projectName?: string;
  description?: string;
  category?: string;
  month: number;
  planned: number;
  forecast: number;
  actual: number;
  variance: number;
  last_updated?: string;
  updated_by?: string;
}

export interface MonthlyBudgetInput {
  month: number;
  budget: number;
}

interface MonthlySnapshotGridProps {
  /** All forecast data (all months) */
  forecastData: ForecastCell[];
  
  /** All line items for projects */
  lineItems: Array<{
    id: string;
    description?: string;
    category?: string;
    projectId?: string;
    projectName?: string;
  }>;
  
  /** Monthly budget allocations (12 months) */
  monthlyBudgets: MonthlyBudgetInput[];
  
  /** Whether monthly budget is enabled */
  useMonthlyBudget: boolean;
  
  /** Currency formatter function */
  formatCurrency: (amount: number) => string;
  
  /** Current month index (1..baseline.duration_months, fallback 1..60) for default selection */
  getCurrentMonthIndex: () => number;
  
  /** Callback to scroll to monthly detail section */
  onScrollToDetail?: (params?: { projectId?: string; categoryId?: string }) => void;
  
  /** Callback to navigate to reconciliation */
  onNavigateToReconciliation?: (projectId: string) => void;
  
  /** Callback to navigate to cost catalog (Estructura de costos) */
  onNavigateToCostCatalog?: (projectId: string) => void;
}

type GroupingMode = 'project' | 'rubro';
type MonthOption = 'current' | 'previous' | number; // 'current', 'previous', or 1-60
type CostTypeFilter = 'all' | 'labor' | 'non-labor';

interface SnapshotRow {
  id: string;
  name: string;
  code?: string;
  budget: number;
  forecast: number;
  actual: number;
  varianceBudget: number;
  varianceBudgetPercent: number | null;
  varianceForecast: number;
  varianceForecastPercent: number | null;
  status: 'En Meta' | 'En Riesgo' | 'Sobre Presupuesto' | 'Sin Presupuesto' | 'Sin Datos';
  children?: SnapshotRow[];
  // For child rows
  parentId?: string;
  projectId?: string;
  rubroId?: string;
}

export function MonthlySnapshotGrid({
  forecastData,
  lineItems,
  monthlyBudgets,
  useMonthlyBudget,
  formatCurrency,
  getCurrentMonthIndex,
  onScrollToDetail,
  onNavigateToReconciliation,
  onNavigateToCostCatalog,
}: MonthlySnapshotGridProps) {
  // Get user context for budget request payloads and sessionStorage key
  const { userEmail } = useFinanzasUser();

  // State
  const [selectedMonth, setSelectedMonth] = useState<MonthOption>('current');
  const [groupingMode, setGroupingMode] = useState<GroupingMode>('project');
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyVariance, setShowOnlyVariance] = useState(false);
  const [costTypeFilter, setCostTypeFilter] = useState<CostTypeFilter>('all');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [budgetRequestModal, setBudgetRequestModal] = useState<{
    open: boolean;
    row?: SnapshotRow;
  }>({ open: false });
  const [budgetRequestNotes, setBudgetRequestNotes] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hasLoadedFromStorage, setHasLoadedFromStorage] = useState(false);

  // Helper to get/set collapsed state from sessionStorage
  const getStoredCollapsedState = useCallback(() => {
    try {
      // For portfolio view, use 'portfolio' as the context identifier
      const storageKey = `monthlyGridCollapsed:portfolio:${userEmail || 'user'}`;
      const stored = sessionStorage.getItem(storageKey);
      return stored === 'true';
    } catch (e) {
      // sessionStorage may not be available in some environments
      return false;
    }
  }, [userEmail]);

  const setStoredCollapsedState = useCallback((collapsed: boolean) => {
    try {
      // For portfolio view, use 'portfolio' as the context identifier
      const storageKey = `monthlyGridCollapsed:portfolio:${userEmail || 'user'}`;
      sessionStorage.setItem(storageKey, String(collapsed));
    } catch (e) {
      // sessionStorage may not be available
    }
  }, [userEmail]);

  // Load initial collapsed state from sessionStorage once
  useEffect(() => {
    if (!hasLoadedFromStorage) {
      const storedState = getStoredCollapsedState();
      setIsCollapsed(storedState);
      setHasLoadedFromStorage(true);
    }
  }, [hasLoadedFromStorage, getStoredCollapsedState]);

  // Persist collapsed state to sessionStorage whenever it changes
  useEffect(() => {
    if (hasLoadedFromStorage) {
      setStoredCollapsedState(isCollapsed);
    }
  }, [isCollapsed, hasLoadedFromStorage, setStoredCollapsedState]);

  // Toggle collapsed state
  const toggleCollapsed = useCallback(() => {
    setIsCollapsed(prev => !prev);
  }, []);

  // Compute actual month index from selection
  const actualMonthIndex = useMemo(() => {
    if (selectedMonth === 'current') return getCurrentMonthIndex();
    if (selectedMonth === 'previous') {
      const current = getCurrentMonthIndex();
      // Determine the maximum available month from forecastData (fallback to 60)
      const maxMonth =
        (Array.isArray(forecastData) && forecastData.length > 0)
          ? Math.max(...forecastData.map((d) => Number(d.month) || 0))
          : 60;
      return current > 1 ? current - 1 : Math.max(1, maxMonth);
    }
    return selectedMonth as number;
  }, [selectedMonth, getCurrentMonthIndex, forecastData]);

  // Get budget for selected month
  const monthBudget = useMemo(() => {
    if (!useMonthlyBudget || monthlyBudgets.length === 0) return null;
    const budgetEntry = monthlyBudgets.find(b => b.month === actualMonthIndex);
    return budgetEntry?.budget ?? 0;
  }, [useMonthlyBudget, monthlyBudgets, actualMonthIndex]);

  // Transform and group data
  const snapshotRows = useMemo(() => {
    // Filter forecast data to selected month
    const monthData = forecastData.filter(cell => cell.month === actualMonthIndex);

    if (groupingMode === 'project') {
      // Group by project, with rubros as children
      const projectMap = new Map<string, SnapshotRow>();

      monthData.forEach(cell => {
        const projectId = cell.projectId || 'unknown';
        const projectName = cell.projectName || 'Proyecto desconocido';
        const rubroId = cell.rubroId || cell.line_item_id;
        const rubroName = cell.description || 'Sin descripción';

        // Get or create project row
        if (!projectMap.has(projectId)) {
          projectMap.set(projectId, {
            id: projectId,
            name: projectName,
            code: projectId,
            budget: 0,
            forecast: 0,
            actual: 0,
            varianceBudget: 0,
            varianceBudgetPercent: null,
            varianceForecast: 0,
            varianceForecastPercent: null,
            status: 'Sin Datos',
            children: [],
          });
        }

        const projectRow = projectMap.get(projectId)!;
        
        // Accumulate totals
        projectRow.forecast += cell.forecast || 0;
        projectRow.actual += cell.actual || 0;

        // Add rubro as child
        const rubroRow: SnapshotRow = {
          id: `${projectId}-${rubroId}`,
          name: rubroName,
          code: rubroId,
          budget: 0, // Budget at rubro level TBD
          forecast: cell.forecast || 0,
          actual: cell.actual || 0,
          varianceBudget: 0,
          varianceBudgetPercent: null,
          varianceForecast: (cell.actual || 0) - (cell.forecast || 0),
          varianceForecastPercent: (cell.forecast || 0) > 0 
            ? (((cell.actual || 0) - (cell.forecast || 0)) / (cell.forecast || 0)) * 100 
            : null,
          status: 'Sin Presupuesto',
          parentId: projectId,
          projectId,
          rubroId,
        };

        projectRow.children!.push(rubroRow);
      });

      // Calculate project-level metrics
      projectMap.forEach((projectRow, projectId) => {
        // Allocate budget proportionally based on forecast if available
        if (monthBudget && monthBudget > 0) {
          const totalForecast = Array.from(projectMap.values()).reduce((sum, p) => sum + p.forecast, 0);
          if (totalForecast > 0) {
            projectRow.budget = (projectRow.forecast / totalForecast) * monthBudget;
          } else {
            // Equal distribution if no forecast
            projectRow.budget = monthBudget / projectMap.size;
          }
        }

        // Calculate variances
        projectRow.varianceBudget = projectRow.forecast - projectRow.budget;
        projectRow.varianceBudgetPercent = projectRow.budget > 0 
          ? (projectRow.varianceBudget / projectRow.budget) * 100 
          : null;
        projectRow.varianceForecast = projectRow.actual - projectRow.forecast;
        projectRow.varianceForecastPercent = projectRow.forecast > 0
          ? (projectRow.varianceForecast / projectRow.forecast) * 100
          : null;

        // Determine status
        projectRow.status = determineStatus(
          projectRow.budget,
          projectRow.forecast,
          projectRow.actual
        );
      });

      return Array.from(projectMap.values());
    } else {
      // Group by rubro, with projects as children
      const rubroMap = new Map<string, SnapshotRow>();

      monthData.forEach(cell => {
        const rubroId = cell.rubroId || cell.line_item_id;
        const rubroName = cell.description || cell.category || 'Sin categoría';
        const projectId = cell.projectId || 'unknown';
        const projectName = cell.projectName || 'Proyecto desconocido';

        // Get or create rubro row
        if (!rubroMap.has(rubroId)) {
          rubroMap.set(rubroId, {
            id: rubroId,
            name: rubroName,
            code: rubroId,
            budget: 0,
            forecast: 0,
            actual: 0,
            varianceBudget: 0,
            varianceBudgetPercent: null,
            varianceForecast: 0,
            varianceForecastPercent: null,
            status: 'Sin Datos',
            children: [],
          });
        }

        const rubroRow = rubroMap.get(rubroId)!;
        
        // Accumulate totals
        rubroRow.forecast += cell.forecast || 0;
        rubroRow.actual += cell.actual || 0;

        // Add project as child
        const projectRow: SnapshotRow = {
          id: `${rubroId}-${projectId}`,
          name: projectName,
          code: projectId,
          budget: 0,
          forecast: cell.forecast || 0,
          actual: cell.actual || 0,
          varianceBudget: 0,
          varianceBudgetPercent: null,
          varianceForecast: (cell.actual || 0) - (cell.forecast || 0),
          varianceForecastPercent: (cell.forecast || 0) > 0 
            ? (((cell.actual || 0) - (cell.forecast || 0)) / (cell.forecast || 0)) * 100 
            : null,
          status: 'Sin Presupuesto',
          parentId: rubroId,
          projectId,
          rubroId,
        };

        rubroRow.children!.push(projectRow);
      });

      // Calculate rubro-level metrics
      rubroMap.forEach((rubroRow) => {
        // Allocate budget proportionally
        if (monthBudget && monthBudget > 0) {
          const totalForecast = Array.from(rubroMap.values()).reduce((sum, r) => sum + r.forecast, 0);
          if (totalForecast > 0) {
            rubroRow.budget = (rubroRow.forecast / totalForecast) * monthBudget;
          } else {
            rubroRow.budget = monthBudget / rubroMap.size;
          }
        }

        // Calculate variances
        rubroRow.varianceBudget = rubroRow.forecast - rubroRow.budget;
        rubroRow.varianceBudgetPercent = rubroRow.budget > 0 
          ? (rubroRow.varianceBudget / rubroRow.budget) * 100 
          : null;
        rubroRow.varianceForecast = rubroRow.actual - rubroRow.forecast;
        rubroRow.varianceForecastPercent = rubroRow.forecast > 0
          ? (rubroRow.varianceForecast / rubroRow.forecast) * 100
          : null;

        // Determine status
        rubroRow.status = determineStatus(
          rubroRow.budget,
          rubroRow.forecast,
          rubroRow.actual
        );
      });

      return Array.from(rubroMap.values());
    }
  }, [forecastData, actualMonthIndex, groupingMode, monthBudget]);

  // Apply search, variance, and cost type filters
  const filteredRows = useMemo(() => {
    let rows = [...snapshotRows];

    // Cost type filter - filter based on category
    if (costTypeFilter !== 'all') {
      rows = rows.filter(row => {
        // For parent rows, filter based on children's categories
        if (row.children && row.children.length > 0) {
          const hasMatchingChildren = row.children.some(child => {
            const category = child.code ? 
              (lineItems.find(li => li.id === child.code || li.projectId === child.code)?.category) : 
              undefined;
            
            if (costTypeFilter === 'labor') {
              return isLabor(category);
            } else if (costTypeFilter === 'non-labor') {
              return !isLabor(category);
            }
            return true;
          });
          
          // If parent has matching children, filter the children array
          if (hasMatchingChildren) {
            row.children = row.children.filter(child => {
              const category = child.code ? 
                (lineItems.find(li => li.id === child.code || li.projectId === child.code)?.category) : 
                undefined;
              
              if (costTypeFilter === 'labor') {
                return isLabor(category);
              } else if (costTypeFilter === 'non-labor') {
                return !isLabor(category);
              }
              return true;
            });
          }
          
          return hasMatchingChildren;
        }
        
        // For leaf rows (no children), filter based on their category
        const category = row.code ? 
          (lineItems.find(li => li.id === row.code || li.projectId === row.code)?.category) : 
          undefined;
        
        if (costTypeFilter === 'labor') {
          return isLabor(category);
        } else if (costTypeFilter === 'non-labor') {
          return !isLabor(category);
        }
        return true;
      });
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      rows = rows.filter(row => {
        const matchesParent = 
          row.name.toLowerCase().includes(query) ||
          (row.code?.toLowerCase().includes(query) ?? false);
        
        const matchesChild = row.children?.some(child =>
          child.name.toLowerCase().includes(query) ||
          (child.code?.toLowerCase().includes(query) ?? false)
        ) ?? false;

        return matchesParent || matchesChild;
      });
    }

    // Variance filter
    if (showOnlyVariance) {
      rows = rows.filter(row => {
        const hasVariance = 
          Math.abs(row.varianceBudget) > 0 ||
          Math.abs(row.varianceForecast) > 0;
        
        const childHasVariance = row.children?.some(child =>
          Math.abs(child.varianceBudget) > 0 ||
          Math.abs(child.varianceForecast) > 0
        ) ?? false;

        return hasVariance || childHasVariance;
      });
    }

    return rows;
  }, [snapshotRows, searchQuery, showOnlyVariance, costTypeFilter, lineItems]);

  // Sort by absolute variance vs Budget (descending)
  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      const absA = Math.abs(a.varianceBudget);
      const absB = Math.abs(b.varianceBudget);
      return absB - absA;
    });
  }, [filteredRows]);

  // Auto-expand top 3 groups on mount or when sorted rows change significantly
  useEffect(() => {
    const top3Ids = sortedRows.slice(0, 3).map(row => row.id);
    setExpandedGroups(new Set(top3Ids));
  }, [groupingMode, actualMonthIndex, sortedRows]);

  // Helper: Determine status based on budget/forecast/actual
  function determineStatus(
    budget: number,
    forecast: number,
    actual: number
  ): SnapshotRow['status'] {
    if (!useMonthlyBudget || budget === 0) {
      if (forecast === 0 && actual === 0) return 'Sin Datos';
      return 'Sin Presupuesto';
    }

    const consumptionPercent = (actual / budget) * 100;
    const forecastOverBudget = forecast > budget;

    if (forecastOverBudget || consumptionPercent > 100) {
      return 'Sobre Presupuesto';
    }

    if (consumptionPercent > 90) {
      return 'En Riesgo';
    }

    return 'En Meta';
  }

  // Helper: Get status badge color
  function getStatusColor(status: SnapshotRow['status']): string {
    switch (status) {
      case 'En Meta':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'En Riesgo':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'Sobre Presupuesto':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'Sin Presupuesto':
        return 'bg-gray-100 text-gray-700 border-gray-300';
      case 'Sin Datos':
        return 'bg-muted text-muted-foreground border-muted';
      default:
        return 'bg-muted text-muted-foreground';
    }
  }

  // Helper: Format variance with color
  function formatVariance(value: number, percent: number | null): {
    text: string;
    percentText: string;
    color: string;
  } {
    const isPositive = value > 0;
    const color = isPositive ? 'text-red-600' : value < 0 ? 'text-green-600' : 'text-muted-foreground';
    const sign = isPositive ? '+' : '';
    const percentText = percent !== null ? `${sign}${percent.toFixed(1)}%` : '—';
    
    return {
      text: `${sign}${formatCurrency(value)}`,
      percentText,
      color,
    };
  }

  // Handlers
  const toggleGroup = useCallback((rowId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  }, []);

  const handleScrollToDetail = useCallback((params?: { projectId?: string }) => {
    if (onScrollToDetail) {
      onScrollToDetail(params);
    } else {
      toast.info('Función de navegación no disponible');
    }
  }, [onScrollToDetail]);

  const handleNavigateToReconciliation = useCallback((row: SnapshotRow) => {
    if (onNavigateToReconciliation) {
      const projectId = row.projectId || row.id;
      onNavigateToReconciliation(projectId);
    } else {
      toast.info('Navegación a conciliación no disponible');
    }
  }, [onNavigateToReconciliation]);

  const handleNavigateToCostCatalog = useCallback((row: SnapshotRow) => {
    if (onNavigateToCostCatalog) {
      const projectId = row.projectId || row.id;
      onNavigateToCostCatalog(projectId);
    } else {
      toast.info('Navegación a estructura de costos no disponible');
    }
  }, [onNavigateToCostCatalog]);

  const handleOpenBudgetRequest = useCallback((row: SnapshotRow) => {
    setBudgetRequestModal({ open: true, row });
    setBudgetRequestNotes('');
  }, []);

  const handleSubmitBudgetRequest = useCallback(() => {
    const { row } = budgetRequestModal;
    if (!row) return;

    // Get requestedBy from user context, fallback to 'current-user'
    const requestedBy = userEmail || 'current-user';

    // TODO: Implement backend integration for budget requests
    const payload = {
      requestedBy,
      timestamp: new Date().toISOString(),
      type: groupingMode === 'project' ? 'project' : 'rubro',
      id: row.id,
      name: row.name,
      month: actualMonthIndex,
      currentBudget: row.budget,
      currentForecast: row.forecast,
      currentActual: row.actual,
      varianceBudget: row.varianceBudget,
      notes: budgetRequestNotes,
    };

    console.log('📤 Budget adjustment request:', payload);
    toast.success(`Solicitud de ajuste enviada para ${row.name}`);
    
    setBudgetRequestModal({ open: false });
    setBudgetRequestNotes('');
  }, [budgetRequestModal, budgetRequestNotes, groupingMode, actualMonthIndex, userEmail]);

  // Month options for selector - support up to 60 months (5 years)
  const monthOptions = useMemo(() => {
    const options: Array<{ value: MonthOption; label: string }> = [
      { value: 'current', label: 'Mes actual' },
      { value: 'previous', label: 'Mes anterior' },
    ];
    
    // Add M1 through M60 (5 years) to support long-term projects
    // Can be extended dynamically based on baselineDetail.duration_months if needed
    const maxMonths = 60;
    for (let i = 1; i <= maxMonths; i++) {
      options.push({ value: i, label: `M${i}` });
    }
    
    return options;
  }, []);

  // Calculate summary totals for collapsed view
  const summaryTotals = useMemo(() => {
    const totalBudget = sortedRows.reduce((sum, row) => sum + row.budget, 0);
    const totalForecast = sortedRows.reduce((sum, row) => sum + row.forecast, 0);
    const totalActual = sortedRows.reduce((sum, row) => sum + row.actual, 0);
    
    return {
      totalBudget,
      totalForecast,
      totalActual,
    };
  }, [sortedRows]);

  // Calculate summary metrics for the selected month (used in expanded view summary strip)
  const summaryForMonth = useMemo(() => {
    const budget = summaryTotals.totalBudget;
    const forecast = summaryTotals.totalForecast;
    const actual = summaryTotals.totalActual;
    
    const consumoPct = budget > 0 ? (actual / budget) * 100 : 0;
    const varianceAbs = actual - budget;
    const variancePct = budget > 0 ? (varianceAbs / budget) * 100 : 0;
    
    return {
      budget,
      forecast,
      actual,
      consumoPct,
      varianceAbs,
      variancePct,
    };
  }, [summaryTotals]);

  // Handler for variance item click in summary
  const handleSummaryVarianceClick = useCallback((item: { 
    id: string; 
    projectId?: string; 
    rubroId?: string;
  }) => {
    // Find the row and navigate to reconciliation
    const row = sortedRows.find(r => r.id === item.id);
    if (row && onNavigateToReconciliation) {
      const projectId = row.projectId || row.id;
      onNavigateToReconciliation(projectId);
    }
  }, [sortedRows, onNavigateToReconciliation]);

  // Calculate Labor vs Non-Labor breakdown for mini visual
  const laborBreakdown = useMemo(() => {
    if (!filteredRows || filteredRows.length === 0) {
      return { laborBudget: 0, nonLaborBudget: 0, laborPct: 0, nonLaborPct: 0 };
    }

    let laborBudget = 0;
    let nonLaborBudget = 0;

    // Aggregate budget by cost type for all filtered rows
    filteredRows.forEach(row => {
      // Check if this row or its children are labor
      if (row.children && row.children.length > 0) {
        row.children.forEach(child => {
          const category = child.code ? 
            (lineItems.find(li => li.id === child.code || li.projectId === child.code)?.category) : 
            undefined;
          
          if (isLabor(category)) {
            laborBudget += child.budget || 0;
          } else {
            nonLaborBudget += child.budget || 0;
          }
        });
      } else {
        // For leaf rows without children
        const category = row.code ? 
          (lineItems.find(li => li.id === row.code || li.projectId === row.code)?.category) : 
          undefined;
        
        if (isLabor(category)) {
          laborBudget += row.budget || 0;
        } else {
          nonLaborBudget += row.budget || 0;
        }
      }
    });

    const total = laborBudget + nonLaborBudget;
    const laborPct = total > 0 ? (laborBudget / total) * 100 : 0;
    const nonLaborPct = total > 0 ? (nonLaborBudget / total) * 100 : 0;

    return { laborBudget, nonLaborBudget, laborPct, nonLaborPct };
  }, [filteredRows, lineItems]);

  return (
    <Card>
      <CardHeader className="pb-3">
        {/* Two-zone header: Title + Summary on left, Controls + Visual on right */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          
          {/* Left Zone: Title + 5 KPI Summary Cards */}
          <div className="flex-1 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Matriz del Mes — Vista Ejecutiva
                </CardTitle>
                <Badge variant="outline" className="text-xs">
                  M{actualMonthIndex}
                </Badge>
              </div>
              
              {/* Toggle Button (mobile only - desktop in right zone) */}
              <div className="lg:hidden">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={toggleCollapsed}
                        className="gap-2"
                        aria-expanded={!isCollapsed}
                        aria-label={isCollapsed ? 'Expandir desglose' : 'Colapsar a resumen'}
                      >
                        <ChevronsUpDown className="h-4 w-4" />
                        <span className="text-xs font-medium">
                          {isCollapsed ? 'Expandir' : 'Resumir'}
                        </span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {isCollapsed ? 'Ver desglose completo' : 'Ver resumen ejecutivo'}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            {/* Summary Strip - Only in expanded view */}
            {!isCollapsed && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                <div className="rounded-lg border bg-background px-3 py-2">
                  <div className="text-xs text-muted-foreground">Presupuesto</div>
                  <div className="text-base font-semibold">
                    {formatCurrency(summaryForMonth.budget)}
                  </div>
                </div>

                <div className="rounded-lg border bg-background px-3 py-2">
                  <div className="text-xs text-muted-foreground">Pronóstico</div>
                  <div className="text-base font-semibold">
                    {formatCurrency(summaryForMonth.forecast)}
                  </div>
                </div>

                <div className="rounded-lg border bg-background px-3 py-2">
                  <div className="text-xs text-muted-foreground">Real</div>
                  <div className="text-base font-semibold text-blue-700">
                    {formatCurrency(summaryForMonth.actual)}
                  </div>
                </div>

                <div className="rounded-lg border bg-background px-3 py-2">
                  <div className="text-xs text-muted-foreground">% Consumo</div>
                  <div className="text-base font-semibold">
                    {summaryForMonth.consumoPct.toFixed(1)}%
                  </div>
                </div>

                <div className="rounded-lg border bg-background px-3 py-2">
                  <div className="text-xs text-muted-foreground">Varianza</div>
                  <div
                    className={cn(
                      "text-base font-semibold",
                      summaryForMonth.varianceAbs > 0 ? "text-red-600" : "text-emerald-600"
                    )}
                  >
                    {summaryForMonth.varianceAbs > 0 ? "+" : ""}
                    {formatCurrency(summaryForMonth.varianceAbs)}{" "}
                    <span className="text-xs">
                      ({summaryForMonth.variancePct > 0 ? "+" : ""}
                      {summaryForMonth.variancePct.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Zone: Controls + Mini Visual (desktop only in header) */}
          {!isCollapsed && (
            <div className="lg:w-[280px] space-y-3">
              {/* Toggle Button (desktop only) */}
              <div className="hidden lg:flex justify-end">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={toggleCollapsed}
                        className="gap-2"
                        aria-expanded={!isCollapsed}
                        aria-label={isCollapsed ? 'Expandir desglose' : 'Colapsar a resumen'}
                      >
                        <ChevronsUpDown className="h-4 w-4" />
                        <span className="text-xs font-medium">
                          {isCollapsed ? 'Expandir' : 'Resumir'}
                        </span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {isCollapsed ? 'Ver desglose completo' : 'Ver resumen ejecutivo'}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              {/* Month Selector */}
              <div className="space-y-1">
                <Label htmlFor="month-select-header" className="text-xs text-muted-foreground">
                  Período
                </Label>
                <Select
                  value={String(selectedMonth)}
                  onValueChange={(value) => {
                    if (value === 'current' || value === 'previous') {
                      setSelectedMonth(value);
                    } else {
                      setSelectedMonth(parseInt(value));
                    }
                  }}
                >
                  <SelectTrigger id="month-select-header" className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map(opt => (
                      <SelectItem key={String(opt.value)} value={String(opt.value)}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Grouping Toggle */}
              <div className="space-y-1">
                <Label htmlFor="grouping-select-header" className="text-xs text-muted-foreground">
                  Agrupar por
                </Label>
                <Select
                  value={groupingMode}
                  onValueChange={(value) => setGroupingMode(value as GroupingMode)}
                >
                  <SelectTrigger id="grouping-select-header" className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="project">Por Proyecto</SelectItem>
                    <SelectItem value="rubro">Por Rubro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Cost Type Filter */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Tipo de costo</Label>
                <div className="flex rounded-md border bg-background p-0.5">
                  <Button
                    type="button"
                    size="sm"
                    variant={costTypeFilter === 'all' ? 'default' : 'ghost'}
                    className="flex-1 px-2 text-xs h-7"
                    onClick={() => setCostTypeFilter('all')}
                  >
                    Todos
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={costTypeFilter === 'labor' ? 'default' : 'ghost'}
                    className="flex-1 px-2 text-xs h-7"
                    onClick={() => setCostTypeFilter('labor')}
                  >
                    Labor
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={costTypeFilter === 'non-labor' ? 'default' : 'ghost'}
                    className="flex-1 px-2 text-xs h-7"
                    onClick={() => setCostTypeFilter('non-labor')}
                  >
                    No Labor
                  </Button>
                </div>
              </div>

              {/* Mini Labor vs No-Labor Visual */}
              <div className="rounded-lg border bg-muted/30 px-3 py-2 space-y-2">
                <div className="text-xs font-medium text-muted-foreground">
                  Presupuesto M{actualMonthIndex}
                </div>
                
                {/* Stacked bar visualization */}
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden flex">
                  {laborBreakdown.laborPct > 0 && (
                    <div 
                      className="bg-blue-500 h-full"
                      style={{ width: `${laborBreakdown.laborPct}%` }}
                      title={`Labor: ${laborBreakdown.laborPct.toFixed(1)}%`}
                    />
                  )}
                  {laborBreakdown.nonLaborPct > 0 && (
                    <div 
                      className="bg-emerald-500 h-full"
                      style={{ width: `${laborBreakdown.nonLaborPct}%` }}
                      title={`No Labor: ${laborBreakdown.nonLaborPct.toFixed(1)}%`}
                    />
                  )}
                </div>

                {/* Legend */}
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm bg-blue-500" />
                    <span className="text-muted-foreground">
                      Labor {laborBreakdown.laborPct.toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm bg-emerald-500" />
                    <span className="text-muted-foreground">
                      No Labor {laborBreakdown.nonLaborPct.toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Live region for screen readers */}
        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {isCollapsed ? 'Mostrando vista resumida' : 'Mostrando desglose completo'}
        </div>

        {/* Collapsed View: Summary */}
        {isCollapsed ? (
          <MonthlySnapshotSummary
            month={actualMonthIndex}
            totalBudget={summaryTotals.totalBudget}
            totalForecast={summaryTotals.totalForecast}
            totalActual={summaryTotals.totalActual}
            variances={sortedRows.map(row => ({
              id: row.id,
              name: row.name,
              code: row.code,
              varianceBudget: row.varianceBudget,
              varianceBudgetPercent: row.varianceBudgetPercent,
              projectId: row.projectId,
              rubroId: row.rubroId,
            }))}
            formatCurrency={formatCurrency}
            onVarianceClick={handleSummaryVarianceClick}
          />
        ) : (
          <>
            {/* Expanded View: Search and Filters */}
            <div className="flex flex-wrap items-end gap-3">
              {/* Search */}
              <div className="flex-grow min-w-[200px] max-w-[300px]">
                <Label htmlFor="search-input" className="text-xs text-muted-foreground mb-1">
                  Buscar
                </Label>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search-input"
                    type="text"
                    placeholder="Proyecto o rubro..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-9 pl-8 text-sm"
                  />
                </div>
              </div>

              {/* Variance Filter */}
              <div className="flex items-center gap-2 pt-5">
                <input
                  type="checkbox"
                  id="variance-filter"
                  checked={showOnlyVariance}
                  onChange={(e) => setShowOnlyVariance(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="variance-filter" className="text-sm cursor-pointer">
                  Solo con variación
                </Label>
              </div>
            </div>

        {/* Consolidated Info Banner */}
        {(selectedMonth === 'current' || !useMonthlyBudget) && (
          <div className="flex flex-wrap gap-2 text-xs">
            {selectedMonth === 'current' && (
              <div className="flex-1 min-w-[250px] p-1.5 rounded bg-blue-50 text-blue-900 border border-blue-100">
                📅 Mostrando solo el mes actual (M{actualMonthIndex})
              </div>
            )}
            {!useMonthlyBudget && (
              <div className="flex-1 min-w-[250px] p-1.5 rounded bg-amber-50 text-amber-900 border border-amber-100">
                ℹ️ Presupuesto mensual no configurado. Active el presupuesto mensual para ver métricas precisas.
              </div>
            )}
          </div>
        )}

        {/* Grid Table */}
        <div className="overflow-x-auto border rounded-lg">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="min-w-[250px]">
                  {groupingMode === 'project' ? 'Proyecto / Rubro' : 'Rubro / Proyecto'}
                </TableHead>
                <TableHead className="text-right min-w-[120px]">Presupuesto</TableHead>
                <TableHead className="text-right min-w-[120px]">Pronóstico</TableHead>
                <TableHead className="text-right min-w-[120px]">Real</TableHead>
                <TableHead className="text-right min-w-[150px]">
                  Var vs Presupuesto
                </TableHead>
                <TableHead className="text-right min-w-[150px]">
                  Var vs Pronóstico
                </TableHead>
                <TableHead className="text-center min-w-[130px]">Estado</TableHead>
                <TableHead className="text-center min-w-[150px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No hay datos disponibles para el mes seleccionado
                  </TableCell>
                </TableRow>
              ) : (
                sortedRows.map(row => (
                  <>
                    {/* Group Row */}
                    <TableRow key={row.id} className="bg-muted/30 font-medium hover:bg-muted/50">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => toggleGroup(row.id)}
                          >
                            {expandedGroups.has(row.id) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                          <span className="font-semibold">{row.name}</span>
                          {row.code && (
                            <Badge variant="outline" className="text-[10px]">
                              {row.code}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {row.budget > 0 ? formatCurrency(row.budget) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(row.forecast)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(row.actual)}
                      </TableCell>
                      <TableCell className="text-right">
                        {(() => {
                          const { text, percentText, color } = formatVariance(
                            row.varianceBudget,
                            row.varianceBudgetPercent
                          );
                          return (
                            <div className={`${color} font-semibold`}>
                              <div>{text}</div>
                              <div className="text-xs">({percentText})</div>
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-right">
                        {(() => {
                          const { text, percentText, color } = formatVariance(
                            row.varianceForecast,
                            row.varianceForecastPercent
                          );
                          return (
                            <div className={`${color} font-semibold`}>
                              <div>{text}</div>
                              <div className="text-xs">({percentText})</div>
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={getStatusColor(row.status)}>
                          {row.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* Ver detalle mensual */}
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => handleScrollToDetail({ projectId: row.projectId || row.id })}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Ver detalle mensual</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          {/* Ir a conciliación */}
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => handleNavigateToReconciliation(row)}
                                >
                                  <FileSpreadsheet className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Ir a conciliación</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          {/* Estructura de costos (catalog) - only for project rows */}
                          {groupingMode === 'project' && onNavigateToCostCatalog && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => handleNavigateToCostCatalog(row)}
                                  >
                                    <Layers className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Estructura de costos</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}

                          {/* Budget request */}
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => handleOpenBudgetRequest(row)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Solicitar ajuste de presupuesto</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* Child Rows (when expanded) */}
                    {expandedGroups.has(row.id) && row.children && row.children.map(child => (
                      <TableRow key={child.id} className="hover:bg-muted/20">
                        <TableCell className="pl-12">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{child.name}</span>
                            {child.code && (
                              <Badge variant="outline" className="text-[10px]">
                                {child.code}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {child.budget > 0 ? formatCurrency(child.budget) : '—'}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {formatCurrency(child.forecast)}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {formatCurrency(child.actual)}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {(() => {
                            const { text, percentText, color } = formatVariance(
                              child.varianceBudget,
                              child.varianceBudgetPercent
                            );
                            return (
                              <div className={color}>
                                <div>{text}</div>
                                <div className="text-xs">({percentText})</div>
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {(() => {
                            const { text, percentText, color } = formatVariance(
                              child.varianceForecast,
                              child.varianceForecastPercent
                            );
                            return (
                              <div className={color}>
                                <div>{text}</div>
                                <div className="text-xs">({percentText})</div>
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-[10px]">
                            {child.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={() => handleNavigateToReconciliation(child)}
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Ir a conciliación</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </>
                ))
              )}
              
              {/* Totals Row */}
              {sortedRows.length > 0 && (
                <TableRow className="bg-muted/50 border-t-2 border-primary/30 font-semibold">
                  <TableCell className="sticky left-0 bg-muted/50 z-10">
                    {groupingMode === 'project' ? 'Total (Todos los Proyectos)' : 'Total (Todos los Rubros)'}
                  </TableCell>
                  <TableCell className="text-right bg-muted/50">
                    {formatCurrency(summaryTotals.totalBudget)}
                  </TableCell>
                  <TableCell className="text-right bg-muted/50">
                    {formatCurrency(summaryTotals.totalForecast)}
                  </TableCell>
                  <TableCell className="text-right text-blue-600 bg-muted/50">
                    {formatCurrency(summaryTotals.totalActual)}
                  </TableCell>
                  <TableCell className="text-right bg-muted/50">
                    {(() => {
                      const variance = summaryTotals.totalForecast - summaryTotals.totalBudget;
                      return (
                        <span className={variance >= 0 ? 'text-red-600' : 'text-green-600'}>
                          {variance >= 0 ? '+' : ''}
                          {formatCurrency(variance)}
                        </span>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="text-right bg-muted/50">
                    {(() => {
                      const variance = summaryTotals.totalActual - summaryTotals.totalForecast;
                      return (
                        <span className={variance >= 0 ? 'text-red-600' : 'text-green-600'}>
                          {variance >= 0 ? '+' : ''}
                          {formatCurrency(variance)}
                        </span>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="text-center bg-muted/50">
                    —
                  </TableCell>
                  <TableCell className="text-center bg-muted/50">
                    —
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Results summary */}
        <div className="text-xs text-muted-foreground text-right">
          Mostrando {sortedRows.length} {groupingMode === 'project' ? 'proyectos' : 'rubros'}
          {searchQuery && ` (filtrado por "${searchQuery}")`}
          {showOnlyVariance && ' con variación'}
        </div>
          </>
        )}
      </CardContent>

      {/* Budget Request Modal */}
      <Dialog open={budgetRequestModal.open} onOpenChange={(open) => setBudgetRequestModal({ open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar Ajuste de Presupuesto</DialogTitle>
            <DialogDescription>
              Complete los detalles de su solicitud de ajuste de presupuesto para{' '}
              <strong>{budgetRequestModal.row?.name}</strong> en el mes M{actualMonthIndex}.
            </DialogDescription>
          </DialogHeader>

          {budgetRequestModal.row && (
            <div className="space-y-4">
              {/* Context Info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Presupuesto actual</div>
                  <div className="font-semibold">
                    {formatCurrency(budgetRequestModal.row.budget)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Pronóstico</div>
                  <div className="font-semibold">
                    {formatCurrency(budgetRequestModal.row.forecast)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Real</div>
                  <div className="font-semibold">
                    {formatCurrency(budgetRequestModal.row.actual)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Variación</div>
                  <div className={`font-semibold ${budgetRequestModal.row.varianceBudget > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(budgetRequestModal.row.varianceBudget)}
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="budget-notes">
                  Notas / Justificación <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="budget-notes"
                  placeholder="Explique la razón del ajuste solicitado..."
                  value={budgetRequestNotes}
                  onChange={(e) => setBudgetRequestNotes(e.target.value)}
                  rows={4}
                  className="text-sm"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBudgetRequestModal({ open: false })}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmitBudgetRequest}
              disabled={!budgetRequestNotes.trim()}
            >
              Enviar Solicitud
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
