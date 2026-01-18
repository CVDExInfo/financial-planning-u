/**
 * Portfolio Summary View Component
 * Displays a collapsed summary view by default for "Todos (All Projects)" mode
 * with expandable project details on demand (progressive disclosure)
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, Folder, FolderOpen, Calendar, Info } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ForecastCell, LineItem } from '@/types/domain';
import type { MonthlyAllocation, RunwayMetrics } from './budgetAllocation';
import { calculateVariances } from './budgetAllocation';

// Budget consumption thresholds
const OVER_BUDGET_THRESHOLD = 100; // Percentage
const WARNING_THRESHOLD = 90; // Percentage

// Feature flags for portfolio summary view customization
const ONLY_SHOW_MONTHLY_BREAKDOWN_TRANSPOSED =
  import.meta.env.VITE_FINZ_ONLY_SHOW_MONTHLY_BREAKDOWN_TRANSPOSED === 'true';
const HIDE_EXPANDABLE_PROJECT_LIST =
  import.meta.env.VITE_FINZ_HIDE_EXPANDABLE_PROJECT_LIST === 'true';
const HIDE_RUNWAY_METRICS =
  import.meta.env.VITE_FINZ_HIDE_RUNWAY_METRICS === 'true';
const NEW_FORECAST_LAYOUT_ENABLED =
  import.meta.env.VITE_FINZ_NEW_FORECAST_LAYOUT === 'true';

type ForecastRow = ForecastCell & { projectId?: string; projectName?: string };
type ProjectLineItem = LineItem & { projectId?: string; projectName?: string };

interface PortfolioSummaryViewProps {
  forecastData: ForecastRow[];
  lineItems: ProjectLineItem[];
  formatCurrency: (amount: number) => string;
  onViewProject?: (projectId: string) => void;
  monthlyBudgetAllocations?: MonthlyAllocation[];
  runwayMetrics?: RunwayMetrics[];
  selectedPeriod?: string;
  getCurrentMonthIndex?: () => number;
  allProjects?: Array<{ id: string; name: string }>; // All projects from context, including those with zero data
}

interface ProjectSummary {
  projectId: string;
  projectName: string;
  totalPlanned: number;
  totalForecast: number;
  totalActual: number;
  totalVariance: number;
  lineItemCount: number;
}

export function PortfolioSummaryView({
  forecastData,
  lineItems,
  formatCurrency,
  onViewProject,
  monthlyBudgetAllocations,
  runwayMetrics,
  selectedPeriod = '12',
  getCurrentMonthIndex = () => new Date().getMonth() + 1,
  allProjects = [],
}: PortfolioSummaryViewProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [showMonthlyBreakdown, setShowMonthlyBreakdown] = useState(false);
  const navigate = useNavigate();

  // Check if we have runway metrics to display
  const hasRunwayMetrics = runwayMetrics && runwayMetrics.length > 0;

  // Calculate overall portfolio summary
  const portfolioSummary = {
    totalPlanned: forecastData.reduce((sum, cell) => sum + (cell.planned || 0), 0),
    totalForecast: forecastData.reduce((sum, cell) => sum + (cell.forecast || 0), 0),
    totalActual: forecastData.reduce((sum, cell) => sum + (cell.actual || 0), 0),
    totalVariance: forecastData.reduce((sum, cell) => sum + (cell.variance || 0), 0),
    projectCount: new Set(forecastData.map(cell => cell.projectId).filter(Boolean)).size,
    lineItemCount: lineItems.length,
  };

  // Group forecast data by project - include all projects from allProjects list
  const projectSummaries: ProjectSummary[] = allProjects.length > 0
    ? allProjects.map(project => {
        const projectData = forecastData.filter(cell => cell.projectId === project.id);
        const projectLineItems = lineItems.filter(item => item.projectId === project.id);
        
        return {
          projectId: project.id,
          projectName: project.name,
          totalPlanned: projectData.reduce((sum, cell) => sum + (cell.planned || 0), 0),
          totalForecast: projectData.reduce((sum, cell) => sum + (cell.forecast || 0), 0),
          totalActual: projectData.reduce((sum, cell) => sum + (cell.actual || 0), 0),
          totalVariance: projectData.reduce((sum, cell) => sum + (cell.variance || 0), 0),
          lineItemCount: projectLineItems.length,
        };
      })
    : // Fallback: if allProjects not provided, derive from forecastData only
      Array.from(
        new Set(forecastData.map(cell => cell.projectId).filter(Boolean))
      ).map(projectId => {
        const projectData = forecastData.filter(cell => cell.projectId === projectId);
        const projectLineItems = lineItems.filter(item => item.projectId === projectId);
        const projectName = projectData[0]?.projectName || 'Unknown Project';

        return {
          projectId: projectId!,
          projectName,
          totalPlanned: projectData.reduce((sum, cell) => sum + (cell.planned || 0), 0),
          totalForecast: projectData.reduce((sum, cell) => sum + (cell.forecast || 0), 0),
          totalActual: projectData.reduce((sum, cell) => sum + (cell.actual || 0), 0),
          totalVariance: projectData.reduce((sum, cell) => sum + (cell.variance || 0), 0),
          lineItemCount: projectLineItems.length,
        };
      });

  const toggleProjectExpanded = (projectId: string) => {
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

  // Navigate helpers (keeps backward compatibility via onViewProject prop)
  const goToReconciliation = (projectId: string) => {
    if (onViewProject) {
      onViewProject(projectId);
    } else {
      // Navigate to reconciliation with projectId as query param
      navigate(`/sdmt/reconciliation?projectId=${encodeURIComponent(projectId)}`);
    }
  };

  const goToRubros = (projectId: string) => {
    // Route to the Estructura de Costos del Proyecto (rubros) page.
    // Adjust path if your router uses a different route.
    navigate(`/projects/${encodeURIComponent(projectId)}/cost-structure`);
  };

  const getVarianceColor = (variance: number) => {
    if (variance > 0) return 'text-red-600';
    if (variance < 0) return 'text-green-600';
    return 'text-muted-foreground';
  };

  /**
   * Get month status badge based on consumption percentage
   * 🟢 On Budget (< 90%)
   * 🟡 Risk (90-100%)
   * 🔴 Over Budget (> 100%)
   */
  const getMonthStatusBadge = (percentConsumed: number) => {
    if (percentConsumed > OVER_BUDGET_THRESHOLD) {
      return {
        variant: 'destructive' as const,
        label: '🔴 Over Budget',
        className: 'bg-red-600 text-white'
      };
    } else if (percentConsumed > WARNING_THRESHOLD) {
      return {
        variant: 'default' as const,
        label: '🟡 Risk',
        className: 'bg-yellow-500 text-white'
      };
    } else {
      return {
        variant: 'default' as const,
        label: '🟢 On Budget',
        className: 'bg-green-600 text-white'
      };
    }
  };

  /**
   * Helper component to render a row label with an info tooltip
   */
  const RowLabelWithTooltip = ({ label, tooltip }: { label: string; tooltip: string }) => (
    <div className="flex items-center gap-2">
      <span className="font-medium">{label}</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="text-sm">{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Resumen de Portafolio</CardTitle>
              <Badge variant="outline" className="ml-2">
                {portfolioSummary.projectCount} proyectos
              </Badge>
            </div>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-2"
                aria-label={isExpanded ? "Colapsar detalles" : "Expandir detalles"}
              >
                {isExpanded ? (
                  <>
                    <span className="text-sm">Ocultar detalles</span>
                    <ChevronUp className="h-4 w-4" />
                  </>
                ) : (
                  <>
                    <span className="text-sm">Ver detalles por proyecto</span>
                    <ChevronDown className="h-4 w-4" />
                  </>
                )}
              </Button>
            </CollapsibleTrigger>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Portfolio-level Summary Row - ONLY show when NEW_FORECAST_LAYOUT is disabled */}
          {/* When NEW_FORECAST_LAYOUT is enabled, these KPIs are shown in ForecastSummaryBar instead */}
          {!NEW_FORECAST_LAYOUT_ENABLED && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 p-4 bg-muted/50 rounded-lg border-2 border-primary/20">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Total Planificado</div>
              <div className="text-xl font-bold">{formatCurrency(portfolioSummary.totalPlanned)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Total Pronóstico</div>
              <div className="text-xl font-bold">{formatCurrency(portfolioSummary.totalForecast)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Total Real</div>
              <div className="text-xl font-bold text-blue-600">{formatCurrency(portfolioSummary.totalActual)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Variación Total</div>
              <div className={`text-xl font-bold ${getVarianceColor(portfolioSummary.totalVariance)}`}>
                {formatCurrency(Math.abs(portfolioSummary.totalVariance))}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Consumo (%)</div>
              <div className="text-xl font-bold text-purple-600">
                {portfolioSummary.totalPlanned > 0
                  ? ((portfolioSummary.totalActual / portfolioSummary.totalPlanned) * 100).toFixed(1)
                  : '0.0'}%
              </div>
            </div>
          </div>
          )}

          {/* Runway Metrics Summary - Only show if runway metrics are available and not hidden by flag */}
          {!HIDE_RUNWAY_METRICS && hasRunwayMetrics && runwayMetrics.length > 0 && (() => {
            // Get latest month with actuals
            const latestWithActuals = [...runwayMetrics].reverse().find(r => r.actualForMonth > 0);
            const latestMetrics = latestWithActuals || runwayMetrics[runwayMetrics.length - 1];
            const monthsWithOverspend = runwayMetrics.filter(r => r.isOverBudget).length;
            
            return (
              <div className="p-4 bg-blue-50/50 border-2 border-blue-200 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-blue-900">
                    📊 Runway & Control Presupuestario
                  </h4>
                  {monthsWithOverspend > 0 && (
                    <Badge variant="destructive">
                      {monthsWithOverspend} {monthsWithOverspend === 1 ? 'mes' : 'meses'} sobre presupuesto
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <div className="text-xs text-blue-700 mb-1">Presupuesto Anual Restante</div>
                    <div className={`text-2xl font-bold ${
                      latestMetrics.remainingAnnualBudget <= 0 
                        ? 'text-red-600' 
                        : latestMetrics.percentConsumed > 80 
                          ? 'text-yellow-600' 
                          : 'text-green-600'
                    }`}>
                      {formatCurrency(latestMetrics.remainingAnnualBudget)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-blue-700 mb-1">% Consumido (Anual)</div>
                    <div className="text-2xl font-bold text-blue-900">
                      {latestMetrics.percentConsumed.toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-blue-700 mb-1">Consumido hasta M{latestMetrics.month}</div>
                    <div className="text-2xl font-bold text-blue-900">
                      {formatCurrency(
                        runwayMetrics
                          .filter(r => r.month <= latestMetrics.month)
                          .reduce((sum, r) => sum + r.actualForMonth, 0)
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-blue-700 mb-1">Presupuesto Meses Restantes</div>
                    <div className="text-2xl font-bold text-blue-900">
                      {formatCurrency(latestMetrics.remainingMonthlyBudget)}
                    </div>
                  </div>
                </div>
                {latestMetrics.remainingAnnualBudget <= 0 && (
                  <div className="mt-3 text-sm text-red-900 font-medium">
                    ⚠️ Presupuesto anual agotado. Gastos futuros excederán el presupuesto.
                  </div>
                )}
                {latestMetrics.percentConsumed > 80 && latestMetrics.remainingAnnualBudget > 0 && (
                  <div className="mt-3 text-sm text-yellow-900 font-medium">
                    ⚠️ Más del 80% del presupuesto anual consumido. Monitorear gastos restantes.
                  </div>
                )}
              </div>
            );
          })()}

          {/* Expandable Project List - hide if flag is set */}
          {!HIDE_EXPANDABLE_PROJECT_LIST && (
            <CollapsibleContent>
              <div className="space-y-2 mt-4 pt-4 border-t">
                <div className="text-sm font-medium text-muted-foreground mb-3">
                  Desglose por proyecto ({projectSummaries.length} proyectos)
                </div>
              {projectSummaries.map(project => (
                <Collapsible
                  key={project.projectId}
                  open={expandedProjects.has(project.projectId)}
                  onOpenChange={() => toggleProjectExpanded(project.projectId)}
                >
                  <div className="border rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between p-3 bg-card hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3 flex-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => {
                            toggleProjectExpanded(project.projectId);
                            // also navigate to Reconciliation for this project
                            goToReconciliation(project.projectId);
                          }}
                          aria-label={
                            expandedProjects.has(project.projectId)
                              ? `Colapsar ${project.projectName} y ver conciliación`
                              : `Expandir ${project.projectName} y ver conciliación`
                          }
                        >
                          {expandedProjects.has(project.projectId) ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                        <Folder className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="font-medium truncate">{project.projectName}</div>
                            {project.totalPlanned === 0 && project.totalForecast === 0 && project.totalActual === 0 && (
                              <Badge variant="outline" className="text-xs">
                                Sin datos
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {project.lineItemCount > 0 ? `${project.lineItemCount} rubros` : 'No hay datos de pronóstico disponibles'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-6 text-sm">
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">Planificado</div>
                          <div className="font-medium">{formatCurrency(project.totalPlanned)}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">Pronóstico</div>
                          <div className="font-medium">{formatCurrency(project.totalForecast)}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">Real</div>
                          <div className="font-medium text-blue-600">{formatCurrency(project.totalActual)}</div>
                        </div>
                        <div className="text-right min-w-[100px]">
                          <div className="text-xs text-muted-foreground">Variación</div>
                          <div className={`font-medium ${getVarianceColor(project.totalVariance)}`}>
                            {project.totalVariance >= 0 ? '+' : '-'}
                            {formatCurrency(Math.abs(project.totalVariance))}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => goToRubros(project.projectId)}
                        >
                          Ver Rubros
                        </Button>
                      </div>
                    </div>
                    <CollapsibleContent>
                      <div className="p-4 bg-muted/30 border-t text-sm">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-muted-foreground">Precisión de Pronóstico:</span>{' '}
                            <span className="font-medium">
                              {project.totalPlanned > 0
                                ? (100 - Math.abs((project.totalVariance / project.totalPlanned) * 100)).toFixed(1)
                                : '0.0'}%
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">% Consumo Real:</span>{' '}
                            <span className="font-medium">
                              {project.totalPlanned > 0
                                ? ((project.totalActual / project.totalPlanned) * 100).toFixed(1)
                                : '0.0'}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
            </div>
          </CollapsibleContent>
          )}
        </CardContent>
      </Card>

      {/* Monthly Breakdown Table - TRANSPOSED: Months as Columns */}
      {(ONLY_SHOW_MONTHLY_BREAKDOWN_TRANSPOSED || showMonthlyBreakdown) && 
       monthlyBudgetAllocations && monthlyBudgetAllocations.some(m => m.budgetAllocated > 0) && (
        <Card className="mt-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Desglose Mensual vs Presupuesto</CardTitle>
                <Badge variant="secondary" className="ml-2">
                  M1-M12
                </Badge>
              </div>
              {!ONLY_SHOW_MONTHLY_BREAKDOWN_TRANSPOSED && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-2"
                  onClick={() => setShowMonthlyBreakdown(!showMonthlyBreakdown)}
                  aria-label={showMonthlyBreakdown ? "Ocultar desglose mensual" : "Mostrar desglose mensual"}
                >
                  <span className="text-sm">
                    {showMonthlyBreakdown ? 'Ocultar' : 'Ver desglose'}
                  </span>
                  {showMonthlyBreakdown ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
          </CardHeader>
          {(ONLY_SHOW_MONTHLY_BREAKDOWN_TRANSPOSED || showMonthlyBreakdown) && (
            <CardContent>
              <div className="overflow-x-auto">
                <TooltipProvider>
                  <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-background min-w-[180px]">Concepto</TableHead>
                      {monthlyBudgetAllocations.map((allocation) => {
                        const runway = hasRunwayMetrics 
                          ? runwayMetrics.find(r => r.month === allocation.month)
                          : null;
                        const variances = calculateVariances(allocation);
                        const statusBadge = getMonthStatusBadge(variances.percentConsumedActual);
                        
                        return (
                          <TableHead key={allocation.month} className="text-center min-w-[100px]">
                            <div className="flex flex-col items-center gap-1">
                              <div className="font-semibold flex items-center gap-1">
                                M{allocation.month}
                                {runway?.isOverBudget && (
                                  <span className="text-red-600 text-xs">⚠️</span>
                                )}
                              </div>
                              {/* Month Status Badge */}
                              <Badge 
                                variant={statusBadge.variant}
                                className={`text-[9px] py-0 px-1.5 ${statusBadge.className}`}
                              >
                                {statusBadge.label}
                              </Badge>
                              {allocation.isEstimated && (
                                <Badge variant="outline" className="text-[9px] py-0 px-1">
                                  Est.
                                </Badge>
                              )}
                            </div>
                          </TableHead>
                        );
                      })}
                      <TableHead className="text-center font-bold min-w-[120px] bg-muted/50">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* GROUP A: INPUTS */}
                    {/* Row 1: Presupuesto */}
                    <TableRow className="bg-blue-50/30">
                      <TableCell className="sticky left-0 bg-blue-50/30">
                        <RowLabelWithTooltip 
                          label="Presupuesto" 
                          tooltip="Presupuesto mensual asignado. Es el límite de gasto para el mes." 
                        />
                      </TableCell>
                      {monthlyBudgetAllocations.map((allocation) => (
                        <TableCell key={allocation.month} className="text-center text-primary font-medium bg-blue-50/30">
                          {formatCurrency(allocation.budgetAllocated)}
                        </TableCell>
                      ))}
                      <TableCell className="text-center font-bold bg-muted/50 text-primary">
                        {formatCurrency(monthlyBudgetAllocations.reduce((sum, m) => sum + m.budgetAllocated, 0))}
                      </TableCell>
                    </TableRow>

                    {/* Row 2: Planificado */}
                    <TableRow className="bg-blue-50/30">
                      <TableCell className="sticky left-0 bg-blue-50/30">
                        <RowLabelWithTooltip 
                          label="Planificado" 
                          tooltip="Gasto planificado según baseline y distribución mensual de rubros. Es lo que se debería gastar basado en la planificación." 
                        />
                      </TableCell>
                      {monthlyBudgetAllocations.map((allocation) => (
                        <TableCell key={allocation.month} className="text-center text-muted-foreground bg-blue-50/30">
                          {formatCurrency(allocation.planned)}
                        </TableCell>
                      ))}
                      <TableCell className="text-center font-bold bg-muted/50">
                        {formatCurrency(monthlyBudgetAllocations.reduce((sum, m) => sum + m.planned, 0))}
                      </TableCell>
                    </TableRow>

                    {/* Row 3: Pronóstico */}
                    <TableRow className="bg-blue-50/30">
                      <TableCell className="sticky left-0 bg-blue-50/30">
                        <RowLabelWithTooltip 
                          label="Pronóstico" 
                          tooltip="Pronóstico ajustado por el SDM mes a mes. Inicialmente igual al Planificado, luego se ajusta según la realidad del proyecto." 
                        />
                      </TableCell>
                      {monthlyBudgetAllocations.map((allocation) => (
                        <TableCell key={allocation.month} className="text-center bg-blue-50/30">
                          {formatCurrency(allocation.forecast)}
                        </TableCell>
                      ))}
                      <TableCell className="text-center font-bold bg-muted/50">
                        {formatCurrency(monthlyBudgetAllocations.reduce((sum, m) => sum + m.forecast, 0))}
                      </TableCell>
                    </TableRow>

                    {/* Row 4: Real */}
                    <TableRow className="bg-blue-50/30">
                      <TableCell className="sticky left-0 bg-blue-50/30">
                        <RowLabelWithTooltip 
                          label="Real" 
                          tooltip="Gastos reales del mes. Se obtiene de nómina, prefacturas y entradas MOD." 
                        />
                      </TableCell>
                      {monthlyBudgetAllocations.map((allocation) => (
                        <TableCell key={allocation.month} className="text-center text-blue-600 font-medium bg-blue-50/30">
                          {formatCurrency(allocation.actual)}
                        </TableCell>
                      ))}
                      <TableCell className="text-center font-bold bg-muted/50 text-blue-600">
                        {formatCurrency(monthlyBudgetAllocations.reduce((sum, m) => sum + m.actual, 0))}
                      </TableCell>
                    </TableRow>

                    {/* GROUP B: CONTROL */}
                    {/* Row 5: Variación Pron vs Pres */}
                    <TableRow className="border-t-2 bg-yellow-50/30">
                      <TableCell className="sticky left-0 bg-yellow-50/30">
                        <RowLabelWithTooltip 
                          label="Variación Pron vs Pres" 
                          tooltip="Pronóstico - Presupuesto. Negativo = bajo presupuesto, Positivo = sobre presupuesto. Responde: '¿Si seguimos el pronóstico, respetamos el presupuesto del mes?'" 
                        />
                      </TableCell>
                      {monthlyBudgetAllocations.map((allocation) => {
                        const variances = calculateVariances(allocation);
                        return (
                          <TableCell 
                            key={allocation.month} 
                            className={`text-center font-medium bg-yellow-50/30 ${
                              variances.varianceForecastVsBudget > 0 
                                ? 'text-red-600' 
                                : variances.varianceForecastVsBudget < 0 
                                  ? 'text-green-600' 
                                  : 'text-muted-foreground'
                            }`}
                          >
                            {variances.varianceForecastVsBudget >= 0 ? '+' : ''}
                            {formatCurrency(variances.varianceForecastVsBudget)}
                          </TableCell>
                        );
                      })}
                    </TableRow>

                    {/* Row 6: Variación Real vs Presupuesto */}
                    <TableRow className="bg-yellow-50/30">
                      <TableCell className="sticky left-0 bg-yellow-50/30">
                        <RowLabelWithTooltip 
                          label="Variación Real vs Pres" 
                          tooltip="Real - Presupuesto. Positivo = presupuesto rebasado, Negativo = presupuesto seguro. Este es el KPI más importante de Finanzas." 
                        />
                      </TableCell>
                      {monthlyBudgetAllocations.map((allocation) => {
                        const variances = calculateVariances(allocation);
                        return (
                          <TableCell 
                            key={allocation.month} 
                            className={`text-center font-medium bg-yellow-50/30 ${
                              variances.varianceActualVsBudget > 0 
                                ? 'text-red-600' 
                                : variances.varianceActualVsBudget < 0 
                                  ? 'text-green-600' 
                                  : 'text-muted-foreground'
                            }`}
                          >
                            {variances.varianceActualVsBudget >= 0 ? '+' : ''}
                            {formatCurrency(variances.varianceActualVsBudget)}
                          </TableCell>
                        );
                      })}
                    </TableRow>

                    {/* Row 7: % Consumo Real */}
                    <TableRow className="bg-yellow-50/30">
                      <TableCell className="sticky left-0 bg-yellow-50/30">
                        <RowLabelWithTooltip 
                          label="% Consumo Real" 
                          tooltip="(Real ÷ Presupuesto) × 100. Indica qué porcentaje del presupuesto mensual fue realmente consumido. 🟢 <90% OK, 🟡 90-100% Riesgo, 🔴 >100% Sobre presupuesto." 
                        />
                      </TableCell>
                      {monthlyBudgetAllocations.map((allocation) => {
                        const variances = calculateVariances(allocation);
                        return (
                          <TableCell 
                            key={allocation.month} 
                            className={`text-center font-medium bg-yellow-50/30 ${
                              variances.percentConsumedActual > OVER_BUDGET_THRESHOLD 
                                ? 'text-red-600' 
                                : variances.percentConsumedActual > WARNING_THRESHOLD 
                                  ? 'text-yellow-600' 
                                  : 'text-green-600'
                            }`}
                          >
                            {variances.percentConsumedActual.toFixed(1)}%
                          </TableCell>
                        );
                      })}
                    </TableRow>

                    {/* GROUP C: STRATEGIC */}
                    {/* Row 8: Runway Restante (only if runway metrics available) */}
                    {hasRunwayMetrics && (
                      <TableRow className="border-t-2 bg-green-50/30">
                        <TableCell className="sticky left-0 bg-green-50/30">
                          <RowLabelWithTooltip 
                            label="Runway Restante" 
                            tooltip="Presupuesto Anual - Real Acumulado. Muestra el presupuesto anual restante después de este mes. El pequeño texto '10% usado' indica: Real Acumulado ÷ Presupuesto Anual." 
                          />
                        </TableCell>
                        {monthlyBudgetAllocations.map((allocation) => {
                          const runway = runwayMetrics.find(r => r.month === allocation.month);
                          return (
                            <TableCell key={allocation.month} className="text-center bg-green-50/30">
                              {runway && (
                                <div className="text-sm">
                                  <div className={`font-medium ${
                                    runway.remainingAnnualBudget <= 0 
                                      ? 'text-red-600' 
                                      : runway.percentConsumed > 80 
                                        ? 'text-yellow-600' 
                                        : 'text-green-600'
                                  }`}>
                                    {formatCurrency(runway.remainingAnnualBudget)}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {runway.percentConsumed.toFixed(0)}% usado
                                  </div>
                                </div>
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TooltipProvider>
              </div>
              <div className="mt-4 text-xs text-muted-foreground space-y-1">
                <p>
                  <strong>Presupuesto Asignado:</strong> Distribuido proporcionalmente según costos planificados mensuales.
                </p>
                <p>
                  <strong>Variación Positiva (+):</strong> Sobre presupuesto | <strong>Variación Negativa (-):</strong> Bajo presupuesto
                </p>
                <p>
                  <strong>🟢 Verde:</strong> Bajo presupuesto | <strong>🟡 Amarillo:</strong> Advertencia (&gt;90%) | <strong>🔴 Rojo:</strong> Sobre presupuesto (&gt;100%)
                </p>
              </div>
            </CardContent>
          )}
        </Card>
      )}
    </Collapsible>
  );
}
