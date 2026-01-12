/**
 * ForecastRubrosTable Component
 * 
 * Displays grouped rubros table for TODOS (ALL_PROJECTS) mode:
 * - Category subtotal rows
 * - Individual rubro rows (indented)
 * - Grand total row (sticky footer)
 * - Inline budget editing row
 * - Variance highlighting
 * - Search/filter functionality
 */

import { useState, useMemo, useEffect, Fragment } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { Search, Edit2, Check, X as XIcon, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import type { CategoryTotals, CategoryRubro, PortfolioTotals } from '../categoryGrouping';
import type { ProjectTotals, ProjectRubro } from '../projectGrouping';
import LoadingSpinner from '@/components/LoadingSpinner';
import VarianceChip from './VarianceChip';
import { isLabor } from '@/lib/rubros-category-utils';
import { useProject } from '@/contexts/ProjectContext';
import { useAuth } from '@/hooks/useAuth';

type FilterMode = 'labor' | 'all' | 'non-labor';
type ViewMode = 'category' | 'project';

interface ForecastRubrosTableProps {
  categoryTotals: Map<string, CategoryTotals>;
  categoryRubros: Map<string, CategoryRubro[]>;
  projectTotals?: Map<string, ProjectTotals>;
  projectRubros?: Map<string, ProjectRubro[]>;
  portfolioTotals: PortfolioTotals;
  monthlyBudgets: Array<{ month: number; budget: number }>;
  onSaveBudget: (budgets: Array<{ month: number; budget: number }>) => Promise<void>;
  formatCurrency: (amount: number) => string;
  canEditBudget: boolean;
  defaultFilter?: FilterMode;
}

export function ForecastRubrosTable({
  categoryTotals,
  categoryRubros,
  projectTotals,
  projectRubros,
  portfolioTotals,
  monthlyBudgets,
  onSaveBudget,
  formatCurrency,
  canEditBudget,
  defaultFilter = 'labor',
}: ForecastRubrosTableProps) {
  const { selectedProject } = useProject();
  const { user } = useAuth();
  const [searchFilter, setSearchFilter] = useState('');
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [editedBudgets, setEditedBudgets] = useState<Array<{ month: number; budget: number }>>([]);
  const [savingBudget, setSavingBudget] = useState(false);
  const [filterMode, setFilterMode] = useState<FilterMode>(defaultFilter);
  const [viewMode, setViewMode] = useState<ViewMode>('category');
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  // Session storage key for persistence
  const sessionKey = useMemo(() => {
    const projectId = selectedProject?.id || 'unknown';
    const userEmail = user?.email || user?.login || 'user';
    return `forecastGridFilter:${projectId}:${userEmail}`;
  }, [selectedProject?.id, user?.email, user?.login]);

  const viewModeSessionKey = useMemo(() => {
    const projectId = selectedProject?.id || 'unknown';
    const userEmail = user?.email || user?.login || 'user';
    return `forecastGridViewMode:${projectId}:${userEmail}`;
  }, [selectedProject?.id, user?.email, user?.login]);

  // Load filter from sessionStorage on mount (robust normalization)
  useEffect(() => {
    try {
      const savedRaw = sessionStorage.getItem(sessionKey);
      if (!savedRaw) return;

      // Normalize: canonicalize unicode, trim, lower-case, replace non-word/hyphen with hyphen
      const saved = savedRaw
        .normalize('NFKC')
        .toLowerCase()
        .trim()
        // convert any non-alphanum/hyphen sequences to single hyphen (helps with odd invisible chars)
        .replace(/[^a-z0-9-]+/g, '-')
        // collapse multiple hyphens
        .replace(/-+/g, '-')
        // trim stray hyphens
        .replace(/(^-|-$)/g, '');

      if (saved === 'labor' || saved === 'all' || saved === 'non-labor') {
        setFilterMode(saved as FilterMode);
      } else {
        // Attempt to match common patterns like 'nonlabor' or 'non labor' -> 'non-labor'
        // Pattern requires starting with 'non' and ending with 'labor'
        if (/^non.*labor$/.test(saved)) {
          setFilterMode('non-labor');
        }
      }
    } catch (err) {
      // Be defensive; on error we silently fall back to default
      console.warn('[ForecastRubrosTable] failed to read saved filter mode', err);
    }
  }, [sessionKey]);

  // Persist filter to sessionStorage when it changes
  useEffect(() => {
    sessionStorage.setItem(sessionKey, filterMode);
  }, [filterMode, sessionKey]);

  // Load viewMode from sessionStorage on mount
  useEffect(() => {
    try {
      const savedViewMode = sessionStorage.getItem(viewModeSessionKey);
      if (savedViewMode === 'category' || savedViewMode === 'project') {
        setViewMode(savedViewMode as ViewMode);
      }
    } catch (err) {
      console.warn('[ForecastRubrosTable] failed to read saved view mode', err);
    }
  }, [viewModeSessionKey]);

  // Persist viewMode to sessionStorage when it changes
  useEffect(() => {
    sessionStorage.setItem(viewModeSessionKey, viewMode);
  }, [viewMode, viewModeSessionKey]);

  // Load expanded projects from sessionStorage
  useEffect(() => {
    if (viewMode !== 'project') return;
    
    try {
      const projectId = selectedProject?.id || 'ALL_PROJECTS';
      const key = `forecast:projectOpen:${projectId}`;
      const saved = sessionStorage.getItem(key);
      if (saved) {
        const expandedSet = new Set<string>(JSON.parse(saved));
        setExpandedProjects(expandedSet);
      }
    } catch (err) {
      console.warn('[ForecastRubrosTable] failed to load expanded projects', err);
    }
  }, [viewMode, selectedProject?.id]);

  // Persist expanded projects to sessionStorage
  useEffect(() => {
    if (viewMode !== 'project') return;
    
    try {
      const projectId = selectedProject?.id || 'ALL_PROJECTS';
      const key = `forecast:projectOpen:${projectId}`;
      sessionStorage.setItem(key, JSON.stringify(Array.from(expandedProjects)));
    } catch (err) {
      console.warn('[ForecastRubrosTable] failed to save expanded projects', err);
    }
  }, [expandedProjects, viewMode, selectedProject?.id]);

  // Toggle project expansion
  const toggleProject = (projectId: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  // Start budget editing
  const handleStartEditBudget = () => {
    setEditedBudgets([...monthlyBudgets]);
    setIsEditingBudget(true);
  };

  // Cancel budget editing
  const handleCancelEditBudget = () => {
    setEditedBudgets([]);
    setIsEditingBudget(false);
  };

  // Save budget changes
  const handleSaveBudget = async () => {
    setSavingBudget(true);
    try {
      await onSaveBudget(editedBudgets);
      setIsEditingBudget(false);
      setEditedBudgets([]);
      toast.success('Presupuesto mensual guardado exitosamente');
    } catch (error) {
      console.error('Error saving budget:', error);
      toast.error('Error al guardar presupuesto mensual');
    } finally {
      setSavingBudget(false);
    }
  };

  // Update budget for a specific month
  const handleBudgetChange = (month: number, value: string) => {
    const numValue = parseFloat(value) || 0;
    setEditedBudgets(prev =>
      prev.map(b => (b.month === month ? { ...b, budget: numValue } : b))
    );
  };

  // Calculate YTD budget
  const budgetYTD = useMemo(() => {
    const budgets = isEditingBudget ? editedBudgets : monthlyBudgets;
    return budgets.reduce((sum, b) => sum + (b.budget || 0), 0);
  }, [monthlyBudgets, editedBudgets, isEditingBudget]);

  // Helper to recalculate category totals from filtered rubros
  // IMPORTANT: Must be declared BEFORE visibleCategories useMemo to avoid TDZ error
  const recalculateCategoryTotals = (rubros: CategoryRubro[]): CategoryTotals => {
    const byMonth: Record<number, { forecast: number; actual: number; planned: number }> = {};
    let overallForecast = 0;
    let overallActual = 0;
    let overallPlanned = 0;

    rubros.forEach(rubro => {
      // Aggregate monthly data
      Object.keys(rubro.byMonth).forEach(monthStr => {
        const month = parseInt(monthStr, 10);
        if (!byMonth[month]) {
          byMonth[month] = { forecast: 0, actual: 0, planned: 0 };
        }
        const monthData = rubro.byMonth[month];
        byMonth[month].forecast += monthData.forecast || 0;
        byMonth[month].actual += monthData.actual || 0;
        byMonth[month].planned += monthData.planned || 0;
      });

      // Aggregate overall totals
      overallForecast += rubro.overall.forecast || 0;
      overallActual += rubro.overall.actual || 0;
      overallPlanned += rubro.overall.planned || 0;
    });

    return {
      byMonth,
      overall: {
        forecast: overallForecast,
        actual: overallActual,
        planned: overallPlanned,
        varianceActual: overallActual - overallPlanned,
        varianceForecast: overallForecast - overallPlanned,
        percentConsumption: overallForecast > 0 ? (overallActual / overallForecast) * 100 : 0,
      },
    };
  };

  // Helper to recalculate project totals from filtered rubros
  // IMPORTANT: Must be declared BEFORE visibleProjects useMemo to avoid TDZ error
  const recalculateProjectTotals = (rubros: ProjectRubro[]): ProjectTotals => {
    const byMonth: Record<number, { forecast: number; actual: number; planned: number }> = {};
    let overallForecast = 0;
    let overallActual = 0;
    let overallPlanned = 0;

    rubros.forEach(rubro => {
      // Aggregate monthly data
      Object.keys(rubro.byMonth).forEach(monthStr => {
        const month = parseInt(monthStr, 10);
        if (!byMonth[month]) {
          byMonth[month] = { forecast: 0, actual: 0, planned: 0 };
        }
        const monthData = rubro.byMonth[month];
        byMonth[month].forecast += monthData.forecast || 0;
        byMonth[month].actual += monthData.actual || 0;
        byMonth[month].planned += monthData.planned || 0;
      });

      // Aggregate overall totals
      overallForecast += rubro.overall.forecast || 0;
      overallActual += rubro.overall.actual || 0;
      overallPlanned += rubro.overall.planned || 0;
    });

    // Use project info from first rubro (they all have same projectId/name)
    const projectId = rubros.length > 0 ? rubros[0].projectId : 'unknown';
    const projectName = rubros.length > 0 ? rubros[0].projectName : 'Unknown Project';

    return {
      projectId,
      projectName,
      byMonth,
      overall: {
        forecast: overallForecast,
        actual: overallActual,
        planned: overallPlanned,
        varianceForecast: overallForecast - overallPlanned,
        varianceActual: overallActual - overallPlanned,
        percentConsumption: overallForecast > 0 ? (overallActual / overallForecast) * 100 : 0,
      },
    };
  };

  // Filter categories and rubros based on search and filter mode
  const visibleCategories = useMemo(() => {
    const lowerSearch = searchFilter.toLowerCase().trim();
    const filtered: Array<[string, CategoryTotals, CategoryRubro[]]> = [];

    categoryTotals.forEach((categoryTotal, category) => {
      const rubros = categoryRubros.get(category) || [];
      
      // Apply search filter
      let searchFilteredRubros = rubros;
      if (lowerSearch) {
        const categoryMatches = category.toLowerCase().includes(lowerSearch);
        searchFilteredRubros = rubros.filter(r =>
          categoryMatches || r.description.toLowerCase().includes(lowerSearch)
        );
      }
      
      // Apply labor/non-labor filter
      const filteredRubros = searchFilteredRubros.filter(rubro => {
        // Determine if this rubro is labor
        // Check category first, then fallback to role/subtype from rubro data
        const rubroCategory = rubro.category || category;
        const rubroRole = (rubro as any).role || (rubro as any).subtype || '';
        const isLaborRubro = isLabor(rubroCategory, rubroRole);
        
        if (filterMode === 'labor') return isLaborRubro;
        if (filterMode === 'non-labor') return !isLaborRubro;
        return true; // 'all'
      });

      // Include category only if it has visible rubros
      // Special case: always include labor category if filter is 'labor' even if empty
      if (filteredRubros.length > 0 || (filterMode === 'labor' && category.toLowerCase().includes('mano de obra'))) {
        // Recalculate category totals based on filtered rubros
        const recalculatedTotals = recalculateCategoryTotals(filteredRubros);
        filtered.push([category, recalculatedTotals, filteredRubros]);
      }
    });

    return filtered;
  }, [searchFilter, categoryTotals, categoryRubros, filterMode]);

  // Filter projects and rubros based on search and filter mode
  const visibleProjects = useMemo(() => {
    if (!projectTotals || !projectRubros) {
      return [];
    }

    const lowerSearch = searchFilter.toLowerCase().trim();
    const filtered: Array<[string, ProjectTotals, ProjectRubro[], string]> = [];

    projectTotals.forEach((projectTotal, projectId) => {
      const rubros = projectRubros.get(projectId) || [];
      
      // Apply search filter
      let searchFilteredRubros = rubros;
      if (lowerSearch) {
        const projectMatches = projectTotal.projectName.toLowerCase().includes(lowerSearch);
        searchFilteredRubros = rubros.filter(r =>
          projectMatches || r.description.toLowerCase().includes(lowerSearch)
        );
      }
      
      // Apply labor/non-labor filter
      const filteredRubros = searchFilteredRubros.filter(rubro => {
        // Determine if this rubro is labor
        // Check category first, then fallback to role/subtype from rubro data
        const rubroCategory = rubro.category || '';
        const rubroRole = (rubro as any).role || (rubro as any).subtype || '';
        const isLaborRubro = isLabor(rubroCategory, rubroRole);
        
        if (filterMode === 'labor') return isLaborRubro;
        if (filterMode === 'non-labor') return !isLaborRubro;
        return true; // 'all'
      });

      // Include project only if it has visible rubros
      if (filteredRubros.length > 0) {
        // Recalculate project totals based on filtered rubros
        const recalculatedTotals = recalculateProjectTotals(filteredRubros);
        filtered.push([projectId, recalculatedTotals, filteredRubros, projectTotal.projectName]);
      }
    });

    return filtered;
  }, [searchFilter, projectTotals, projectRubros, filterMode]);

  // Old filteredData for compatibility (now deprecated, use visibleCategories)
  const filteredData = useMemo(() => {
    if (!searchFilter.trim()) {
      return { categories: Array.from(categoryTotals.entries()), allVisible: true };
    }

    const lowerSearch = searchFilter.toLowerCase();
    const filtered: Array<[string, CategoryTotals]> = [];

    categoryTotals.forEach((totals, category) => {
      const categoryMatches = category.toLowerCase().includes(lowerSearch);
      const rubros = categoryRubros.get(category) || [];
      const matchingRubros = rubros.filter(r =>
        r.description.toLowerCase().includes(lowerSearch)
      );

      if (categoryMatches || matchingRubros.length > 0) {
        filtered.push([category, totals]);
      }
    });

    return { categories: filtered, allVisible: false };
  }, [searchFilter, categoryTotals, categoryRubros]);

  // Get variance color
  const getVarianceColor = (actual: number, forecast: number): string => {
    if (actual > forecast) {
      return 'bg-red-50 text-red-700';
    }
    return '';
  };

  // Get consumption color
  const getConsumptionColor = (percent: number): string => {
    if (percent > 100) {
      return 'text-red-600 font-bold';
    }
    return '';
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Rubros por Categoría</CardTitle>
          {/* Search Filter and Labor/Non-Labor Filter */}
          <div className="flex items-center gap-3">
            {/* View Mode Toggle (Category / Project) */}
            {projectTotals && projectRubros && (
              <div className="flex items-center gap-1 border rounded-md p-1 bg-muted/30">
                <button
                  onClick={() => setViewMode('category')}
                  className={`px-3 py-1 text-xs rounded transition-colors ${
                    viewMode === 'category'
                      ? 'bg-primary text-primary-foreground font-medium shadow-sm'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                  aria-label="Ver por Rubro"
                  aria-pressed={viewMode === 'category'}
                  role="button"
                >
                  Rubro
                </button>
                <button
                  onClick={() => setViewMode('project')}
                  className={`px-3 py-1 text-xs rounded transition-colors ${
                    viewMode === 'project'
                      ? 'bg-primary text-primary-foreground font-medium shadow-sm'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                  aria-label="Ver por Proyecto"
                  aria-pressed={viewMode === 'project'}
                  role="button"
                >
                  Por Proyecto
                </button>
              </div>
            )}
            
            {/* Labor Filter Segmented Control */}
            <div className="flex items-center gap-1 border rounded-md p-1 bg-muted/30">
              <button
                onClick={() => setFilterMode('labor')}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  filterMode === 'labor'
                    ? 'bg-primary text-primary-foreground font-medium shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
                aria-label="Filtrar por Mano de Obra (MOD)"
                aria-pressed={filterMode === 'labor'}
                role="button"
              >
                Mano de Obra (MOD)
              </button>
              <button
                onClick={() => setFilterMode('all')}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  filterMode === 'all'
                    ? 'bg-primary text-primary-foreground font-medium shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
                aria-label="Mostrar todo"
                aria-pressed={filterMode === 'all'}
                role="button"
              >
                Todo
              </button>
              <button
                onClick={() => setFilterMode('non-labor')}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  filterMode === 'non-labor'
                    ? 'bg-primary text-primary-foreground font-medium shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
                aria-label="Filtrar por No Mano de Obra"
                aria-pressed={filterMode === 'non-labor'}
                role="button"
              >
                No Mano de Obra
              </button>
            </div>
            
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={viewMode === 'project' ? 'Buscar por proyecto o rubro' : 'Buscar por rubro o categoría'}
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="pl-8 w-64"
                aria-label={viewMode === 'project' ? 'Buscar por proyecto o rubro' : 'Buscar por rubro o categoría'}
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <TooltipProvider>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background min-w-[250px]">
                    Categoría / Rubro
                  </TableHead>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                    <TableHead key={month} className="text-center min-w-[100px]">
                      M{month}
                    </TableHead>
                  ))}
                  <TableHead className="text-center min-w-[120px] bg-muted/50 font-bold">
                    Total Año
                  </TableHead>
                  <TableHead className="text-center min-w-[100px] bg-muted/50 font-bold">
                    % Consumo
                  </TableHead>
                  <TableHead className="text-center min-w-[140px] bg-muted/50 font-bold">
                    Variación
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Budget Row (Editable) */}
                <TableRow className="bg-blue-50/40 border-b-2 border-blue-200">
                  <TableCell className="sticky left-0 bg-blue-50/40">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-primary">Presupuesto All-In</span>
                      {!isEditingBudget && canEditBudget && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={handleStartEditBudget}
                          title="Editar presupuesto"
                          aria-label="Editar presupuesto"
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                      )}
                      {isEditingBudget && (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-green-600"
                            onClick={handleSaveBudget}
                            disabled={savingBudget}
                            title="Guardar"
                            aria-label="Guardar presupuesto"
                          >
                            {savingBudget ? (
                              <LoadingSpinner size="sm" />
                            ) : (
                              <Check className="h-3 w-3" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-red-600"
                            onClick={handleCancelEditBudget}
                            disabled={savingBudget}
                            title="Cancelar"
                            aria-label="Cancelar edición de presupuesto"
                          >
                            <XIcon className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(month => {
                    const budget = isEditingBudget
                      ? editedBudgets.find(b => b.month === month)
                      : monthlyBudgets.find(b => b.month === month);
                    const value = budget?.budget || 0;

                    return (
                      <TableCell key={month} className="text-center bg-blue-50/40">
                        {isEditingBudget ? (
                          <Input
                            type="number"
                            value={value}
                            onChange={(e) => handleBudgetChange(month, e.target.value)}
                            className="h-8 text-xs text-center"
                            disabled={savingBudget}
                          />
                        ) : (
                          <span className="text-primary font-medium">
                            {formatCurrency(value)}
                          </span>
                        )}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-center bg-muted/50 font-bold text-primary">
                    {formatCurrency(budgetYTD)}
                  </TableCell>
                  <TableCell className="text-center bg-muted/50">—</TableCell>
                  <TableCell className="text-center bg-muted/50">—</TableCell>
                </TableRow>

                {/* Category and Rubro Rows OR Project and Rubro Rows */}
                {viewMode === 'category' ? (
                  /* Category View */
                  visibleCategories.length === 0 ? (
                    /* Empty State */
                    <TableRow>
                      <TableCell colSpan={15} className="h-32 text-center">
                        <div className="flex flex-col items-center justify-center space-y-3">
                          <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
                            <Search className="h-6 w-6 text-muted-foreground" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">
                              No se encontraron rubros que coincidan con el filtro
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {filterMode === 'labor' && 'No hay rubros de Mano de Obra (MOD) disponibles'}
                              {filterMode === 'non-labor' && 'No hay rubros de No Mano de Obra disponibles'}
                              {filterMode === 'all' && searchFilter && `No hay resultados para "${searchFilter}"`}
                            </p>
                          </div>
                          {filterMode !== 'all' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setFilterMode('all')}
                              className="mt-2"
                            >
                              Mostrar todo
                            </Button>
                          )}
                        </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleCategories.map(([category, categoryTotal, filteredRubros]) => (
                    <Fragment key={category}>
                      {/* Individual Rubro Rows */}
                      {filteredRubros.map(rubro => (
                        <TableRow key={rubro.rubroId} className="hover:bg-muted/20">
                          <TableCell className="sticky left-0 bg-background pl-6" title={rubro.description}>
                            <span className="text-sm">{rubro.description}</span>
                          </TableCell>
                          {Array.from({ length: 12 }, (_, i) => i + 1).map(month => {
                            const monthData = rubro.byMonth[month] || {
                              forecast: 0,
                              actual: 0,
                              planned: 0,
                            };
                            const hasVariance = monthData.actual > monthData.forecast;

                            return (
                              <TableCell
                                key={month}
                                className={`text-center text-xs ${
                                  hasVariance ? getVarianceColor(monthData.actual, monthData.forecast) : ''
                                }`}
                              >
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="cursor-help">
                                      {monthData.forecast > 0 && (
                                        <div className="text-muted-foreground">
                                          {formatCurrency(monthData.forecast)}
                                        </div>
                                      )}
                                      {monthData.actual > 0 && (
                                        <div className="text-blue-600 font-medium">
                                          ({formatCurrency(monthData.actual)})
                                        </div>
                                      )}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <div className="text-xs space-y-1">
                                      <div>Plan: {formatCurrency(monthData.planned)}</div>
                                      <div>Pronóstico: {formatCurrency(monthData.forecast)}</div>
                                      <div>Real: {formatCurrency(monthData.actual)}</div>
                                      <div>
                                        Desviación: {formatCurrency(monthData.actual - monthData.forecast)}
                                      </div>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center bg-muted/30 text-xs">
                            <div>{formatCurrency(rubro.overall.forecast)}</div>
                            {rubro.overall.actual > 0 && (
                              <div className="text-blue-600 font-medium">
                                ({formatCurrency(rubro.overall.actual)})
                              </div>
                            )}
                          </TableCell>
                          <TableCell
                            className={`text-center bg-muted/30 text-xs ${getConsumptionColor(
                              rubro.overall.percentConsumption
                            )}`}
                          >
                            {rubro.overall.percentConsumption.toFixed(1)}%
                          </TableCell>
                          <TableCell className="text-center bg-muted/30 text-xs">
                            <VarianceChip
                              value={rubro.overall.varianceActual}
                              percent={rubro.overall.forecast !== 0 ? (rubro.overall.varianceActual / rubro.overall.forecast) * 100 : null}
                              ariaLabel={`Variación para ${rubro.description}: ${rubro.overall.varianceActual}`}
                            />
                          </TableCell>
                        </TableRow>
                      ))}

                      {/* Category Subtotal Row */}
                      <TableRow className="bg-muted/60 font-semibold border-t-2">
                        <TableCell className="sticky left-0 bg-muted/60">
                          <span className="font-bold">Subtotal – {category}</span>
                        </TableCell>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(month => {
                          const monthData = categoryTotal.byMonth[month] || {
                            forecast: 0,
                            actual: 0,
                            planned: 0,
                          };

                          return (
                            <TableCell key={month} className="text-center text-xs bg-muted/60">
                              <div className="text-primary">
                                {formatCurrency(monthData.forecast)}
                              </div>
                              {monthData.actual > 0 && (
                                <div className="text-blue-600">
                                  ({formatCurrency(monthData.actual)})
                                </div>
                              )}
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-center bg-muted/80 text-xs font-bold">
                          <div>{formatCurrency(categoryTotal.overall.forecast)}</div>
                          {categoryTotal.overall.actual > 0 && (
                            <div className="text-blue-600">
                              ({formatCurrency(categoryTotal.overall.actual)})
                            </div>
                          )}
                        </TableCell>
                        <TableCell
                          className={`text-center bg-muted/80 text-xs font-bold ${getConsumptionColor(
                            categoryTotal.overall.percentConsumption
                          )}`}
                        >
                          {categoryTotal.overall.percentConsumption.toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-center bg-muted/80 text-xs font-bold">
                          <VarianceChip
                            value={categoryTotal.overall.varianceActual}
                            percent={categoryTotal.overall.forecast !== 0 ? (categoryTotal.overall.varianceActual / categoryTotal.overall.forecast) * 100 : null}
                            ariaLabel={`Variación subtotal para ${category}: ${categoryTotal.overall.varianceActual}`}
                          />
                        </TableCell>
                      </TableRow>
                    </Fragment>
                  ))
                )
                ) : (
                  /* Project View */
                  visibleProjects.length === 0 ? (
                    /* Empty State */
                    <TableRow>
                      <TableCell colSpan={15} className="h-32 text-center">
                        <div className="flex flex-col items-center justify-center space-y-3">
                          <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
                            <Search className="h-6 w-6 text-muted-foreground" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">
                              No se encontraron proyectos que coincidan con el filtro
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {filterMode === 'labor' && 'No hay rubros de Mano de Obra (MOD) en ningún proyecto'}
                              {filterMode === 'non-labor' && 'No hay rubros de No Mano de Obra en ningún proyecto'}
                              {filterMode === 'all' && searchFilter && `No hay resultados para "${searchFilter}"`}
                            </p>
                          </div>
                          {filterMode !== 'all' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setFilterMode('all')}
                              className="mt-2"
                            >
                              Mostrar todo
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    visibleProjects.map(([projectId, projectTotal, filteredRubros, projectName]) => {
                      const isExpanded = expandedProjects.has(projectId);
                      
                      return (
                        <Fragment key={projectId}>
                          {/* Project Header Row (Collapsible) */}
                          <TableRow className="bg-primary/10 font-semibold border-t-2 hover:bg-primary/15 transition-colors">
                            <TableCell className="sticky left-0 bg-primary/10">
                              <button
                                onClick={() => toggleProject(projectId)}
                                className="flex items-center gap-2 w-full text-left hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
                                aria-expanded={isExpanded}
                                aria-controls={`project-${projectId}-panel`}
                                title={isExpanded ? "Ocultar rubros del proyecto" : "Mostrar rubros del proyecto"}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-primary transition-transform" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-primary transition-transform" />
                                )}
                                <span className="font-bold text-primary">{projectName}</span>
                              </button>
                            </TableCell>
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(month => {
                              const monthData = projectTotal.byMonth[month] || {
                                forecast: 0,
                                actual: 0,
                                planned: 0,
                              };

                              return (
                                <TableCell key={month} className="text-center text-xs bg-primary/10">
                                  <div className="text-primary font-medium">
                                    {formatCurrency(monthData.forecast)}
                                  </div>
                                  {monthData.actual > 0 && (
                                    <div className="text-blue-600">
                                      ({formatCurrency(monthData.actual)})
                                    </div>
                                  )}
                                </TableCell>
                              );
                            })}
                            <TableCell className="text-center bg-primary/15 text-xs font-bold">
                              <div>{formatCurrency(projectTotal.overall.forecast)}</div>
                              {projectTotal.overall.actual > 0 && (
                                <div className="text-blue-600">
                                  ({formatCurrency(projectTotal.overall.actual)})
                                </div>
                              )}
                            </TableCell>
                            <TableCell
                              className={`text-center bg-primary/15 text-xs font-bold ${getConsumptionColor(
                                projectTotal.overall.percentConsumption
                              )}`}
                            >
                              {projectTotal.overall.percentConsumption.toFixed(1)}%
                            </TableCell>
                            <TableCell className="text-center bg-primary/15 text-xs font-bold">
                              <VarianceChip
                                value={projectTotal.overall.varianceActual}
                                percent={projectTotal.overall.forecast !== 0 ? (projectTotal.overall.varianceActual / projectTotal.overall.forecast) * 100 : null}
                                ariaLabel={`Variación total para ${projectName}: ${projectTotal.overall.varianceActual}`}
                              />
                            </TableCell>
                          </TableRow>

                          {/* Collapsible Rubro Rows */}
                          {isExpanded && filteredRubros.map(rubro => (
                            <TableRow key={rubro.rubroId} className="hover:bg-muted/20" id={`project-${projectId}-panel`}>
                              <TableCell className="sticky left-0 bg-background pl-8" title={rubro.description}>
                                <span className="text-sm text-muted-foreground">↳ {rubro.description}</span>
                              </TableCell>
                              {Array.from({ length: 12 }, (_, i) => i + 1).map(month => {
                                const monthData = rubro.byMonth[month] || {
                                  forecast: 0,
                                  actual: 0,
                                  planned: 0,
                                };
                                const hasVariance = monthData.actual > monthData.forecast;

                                return (
                                  <TableCell
                                    key={month}
                                    className={`text-center text-xs ${
                                      hasVariance ? getVarianceColor(monthData.actual, monthData.forecast) : ''
                                    }`}
                                  >
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="cursor-help">
                                          {monthData.forecast > 0 && (
                                            <div className="text-muted-foreground">
                                              {formatCurrency(monthData.forecast)}
                                            </div>
                                          )}
                                          {monthData.actual > 0 && (
                                            <div className="text-blue-600 font-medium">
                                              ({formatCurrency(monthData.actual)})
                                            </div>
                                          )}
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <div className="text-xs space-y-1">
                                          <div>Plan: {formatCurrency(monthData.planned)}</div>
                                          <div>Pronóstico: {formatCurrency(monthData.forecast)}</div>
                                          <div>Real: {formatCurrency(monthData.actual)}</div>
                                          <div>
                                            Desviación: {formatCurrency(monthData.actual - monthData.forecast)}
                                          </div>
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TableCell>
                                );
                              })}
                              <TableCell className="text-center bg-muted/30 text-xs">
                                <div>{formatCurrency(rubro.overall.forecast)}</div>
                                {rubro.overall.actual > 0 && (
                                  <div className="text-blue-600 font-medium">
                                    ({formatCurrency(rubro.overall.actual)})
                                  </div>
                                )}
                              </TableCell>
                              <TableCell
                                className={`text-center bg-muted/30 text-xs ${getConsumptionColor(
                                  rubro.overall.percentConsumption
                                )}`}
                              >
                                {rubro.overall.percentConsumption.toFixed(1)}%
                              </TableCell>
                              <TableCell className="text-center bg-muted/30 text-xs">
                                <VarianceChip
                                  value={rubro.overall.varianceActual}
                                  percent={rubro.overall.forecast !== 0 ? (rubro.overall.varianceActual / rubro.overall.forecast) * 100 : null}
                                  ariaLabel={`Variación para ${rubro.description}: ${rubro.overall.varianceActual}`}
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </Fragment>
                      );
                    })
                  )
                )}

                {/* Grand Total Row (Sticky Footer) */}
                <TableRow className="bg-primary/10 font-bold border-t-4 border-primary">
                  <TableCell className="sticky left-0 bg-primary/10">
                    <span className="text-lg">Total Portafolio</span>
                  </TableCell>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(month => {
                    const monthData = portfolioTotals.byMonth[month] || {
                      forecast: 0,
                      actual: 0,
                      planned: 0,
                    };

                    return (
                      <TableCell key={month} className="text-center bg-primary/10">
                        <div className="text-primary font-bold">
                          {formatCurrency(monthData.forecast)}
                        </div>
                        {monthData.actual > 0 && (
                          <div className="text-blue-600 font-bold">
                            ({formatCurrency(monthData.actual)})
                          </div>
                        )}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-center bg-primary/20 font-bold text-lg">
                    <div>{formatCurrency(portfolioTotals.overall.forecast)}</div>
                    {portfolioTotals.overall.actual > 0 && (
                      <div className="text-blue-600">
                        ({formatCurrency(portfolioTotals.overall.actual)})
                      </div>
                    )}
                  </TableCell>
                  <TableCell
                    className={`text-center bg-primary/20 font-bold text-lg ${getConsumptionColor(
                      portfolioTotals.overall.percentConsumption
                    )}`}
                  >
                    {portfolioTotals.overall.percentConsumption.toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-center bg-primary/20 font-bold text-lg">
                    <VarianceChip
                      value={portfolioTotals.overall.varianceActual}
                      percent={portfolioTotals.overall.forecast !== 0 ? (portfolioTotals.overall.varianceActual / portfolioTotals.overall.forecast) * 100 : null}
                      ariaLabel={`Variación total del portafolio: ${portfolioTotals.overall.varianceActual}`}
                    />
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TooltipProvider>
        </div>

        {/* Legend */}
        <div className="mt-4 text-xs text-muted-foreground space-y-1 border-t pt-3">
          <p>
            <strong>Nota:</strong> Valores entre paréntesis () indican gastos reales.
          </p>
          <p>
            <strong>% Consumo:</strong> (Real / Pronóstico) × 100. Valores &gt;100% en{' '}
            <span className="text-red-600 font-bold">rojo</span> indican sobrecosto.
          </p>
          <p>
            <strong>Celdas destacadas:</strong> Fondo rojo indica que Real &gt; Pronóstico en ese mes.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

