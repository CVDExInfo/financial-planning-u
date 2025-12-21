/**
 * Portfolio Summary View Component
 * Displays a collapsed summary view by default for "Todos (All Projects)" mode
 * with expandable project details on demand (progressive disclosure)
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, Folder, FolderOpen, Calendar } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
}: PortfolioSummaryViewProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [showMonthlyBreakdown, setShowMonthlyBreakdown] = useState(false);

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

  // Group forecast data by project
  const projectSummaries: ProjectSummary[] = Array.from(
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

  const getVarianceColor = (variance: number) => {
    if (variance > 0) return 'text-red-600';
    if (variance < 0) return 'text-green-600';
    return 'text-muted-foreground';
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Resumen de todos los proyectos</CardTitle>
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
          {/* Portfolio-level Summary Row */}
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

          {/* Runway Metrics Summary - Only show if runway metrics are available */}
          {hasRunwayMetrics && runwayMetrics.length > 0 && (() => {
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

          {/* Expandable Project List */}
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
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            aria-label={
                              expandedProjects.has(project.projectId)
                                ? `Colapsar ${project.projectName}`
                                : `Expandir ${project.projectName}`
                            }
                          >
                            {expandedProjects.has(project.projectId) ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                        <Folder className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{project.projectName}</div>
                          <div className="text-xs text-muted-foreground">
                            {project.lineItemCount} rubros
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
                        {onViewProject && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => onViewProject(project.projectId)}
                          >
                            Ver Rubros
                          </Button>
                        )}
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
        </CardContent>
      </Card>

      {/* Monthly Breakdown Table - TRANSPOSED: Months as Columns */}
      {monthlyBudgetAllocations && monthlyBudgetAllocations.some(m => m.budgetAllocated > 0) && (
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
            </div>
          </CardHeader>
          {showMonthlyBreakdown && (
            <CardContent>
              {(() => {
                // Filter to current month when in CURRENT_MONTH mode
                const isCurrentMonthMode = selectedPeriod === 'CURRENT_MONTH';
                const currentMonthIndex = isCurrentMonthMode ? getCurrentMonthIndex() : 0;
                const allocationsToShow = isCurrentMonthMode && monthlyBudgetAllocations
                  ? monthlyBudgetAllocations.filter(a => a.month === currentMonthIndex)
                  : monthlyBudgetAllocations;
                
                return (
                  <div className="overflow-x-auto">
                    {isCurrentMonthMode && (
                      <div className="mb-3 p-2 bg-blue-50 rounded text-sm text-blue-900">
                        📅 Mostrando solo el mes actual (M{currentMonthIndex})
                      </div>
                    )}
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="sticky left-0 bg-background min-w-[180px]">Concepto</TableHead>
                          {allocationsToShow.map((allocation) => {
                            const runway = hasRunwayMetrics 
                              ? runwayMetrics.find(r => r.month === allocation.month)
                              : null;
                            return (
                              <TableHead key={allocation.month} className="text-center min-w-[100px]">
                                <div className="flex flex-col items-center gap-1">
                                  <div className="font-semibold flex items-center gap-1">
                                    M{allocation.month}
                                    {runway?.isOverBudget && (
                                      <span className="text-red-600 text-xs">⚠️</span>
                                    )}
                                  </div>
                                  {allocation.isEstimated && (
                                    <Badge variant="outline" className="text-[9px] py-0 px-1">
                                      Est.
                                    </Badge>
                                  )}
                                </div>
                              </TableHead>
                            );
                          })}
                          {!isCurrentMonthMode && (
                            <TableHead className="text-center font-bold min-w-[120px] bg-muted/50">Total</TableHead>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {/* Row 1: Presupuesto */}
                        <TableRow>
                          <TableCell className="sticky left-0 bg-background font-medium">
                            Presupuesto
                          </TableCell>
                          {allocationsToShow.map((allocation) => (
                            <TableCell key={allocation.month} className="text-center text-primary font-medium">
                              {formatCurrency(allocation.budgetAllocated)}
                            </TableCell>
                          ))}
                          {!isCurrentMonthMode && (
                            <TableCell className="text-center font-bold bg-muted/50 text-primary">
                              {formatCurrency(allocationsToShow.reduce((sum, m) => sum + m.budgetAllocated, 0))}
                            </TableCell>
                          )}
                        </TableRow>

                        {/* Row 2: Planificado */}
                        <TableRow>
                          <TableCell className="sticky left-0 bg-background font-medium">
                            Planificado
                          </TableCell>
                          {allocationsToShow.map((allocation) => (
                            <TableCell key={allocation.month} className="text-center text-muted-foreground">
                              {formatCurrency(allocation.planned)}
                            </TableCell>
                          ))}
                          {!isCurrentMonthMode && (
                            <TableCell className="text-center font-bold bg-muted/50">
                              {formatCurrency(allocationsToShow.reduce((sum, m) => sum + m.planned, 0))}
                            </TableCell>
                          )}
                        </TableRow>

                        {/* Row 3: Pronóstico */}
                        <TableRow>
                          <TableCell className="sticky left-0 bg-background font-medium">
                            Pronóstico
                          </TableCell>
                          {allocationsToShow.map((allocation) => (
                            <TableCell key={allocation.month} className="text-center">
                              {formatCurrency(allocation.forecast)}
                            </TableCell>
                          ))}
                          {!isCurrentMonthMode && (
                            <TableCell className="text-center font-bold bg-muted/50">
                              {formatCurrency(allocationsToShow.reduce((sum, m) => sum + m.forecast, 0))}
                            </TableCell>
                          )}
                        </TableRow>

                        {/* Row 4: Real */}
                        <TableRow>
                          <TableCell className="sticky left-0 bg-background font-medium">
                            Real
                          </TableCell>
                          {allocationsToShow.map((allocation) => (
                            <TableCell key={allocation.month} className="text-center text-blue-600 font-medium">
                              {formatCurrency(allocation.actual)}
                            </TableCell>
                          ))}
                          {!isCurrentMonthMode && (
                            <TableCell className="text-center font-bold bg-muted/50 text-blue-600">
                              {formatCurrency(allocationsToShow.reduce((sum, m) => sum + m.actual, 0))}
                            </TableCell>
                          )}
                        </TableRow>

                        {/* Row 5: Variación vs Presupuesto (Pronóstico) */}
                        <TableRow className="border-t-2">
                          <TableCell className="sticky left-0 bg-background font-medium">
                            Variación Pron vs Pres
                          </TableCell>
                          {allocationsToShow.map((allocation) => {
                            const variances = calculateVariances(allocation);
                            return (
                              <TableCell 
                                key={allocation.month} 
                                className={`text-center font-medium ${
                                  variances.varianceForecastVsBudget > 0 
                                    ? 'text-red-600 bg-red-50/50' 
                                    : variances.varianceForecastVsBudget < 0 
                                      ? 'text-green-600 bg-green-50/50' 
                                      : 'text-muted-foreground'
                                }`}
                              >
                                {variances.varianceForecastVsBudget >= 0 ? '+' : ''}
                                {formatCurrency(variances.varianceForecastVsBudget)}
                              </TableCell>
                            );
                          })}
                          {!isCurrentMonthMode && (
                            <TableCell className="text-center font-bold bg-muted/50">
                              {formatCurrency(
                                allocationsToShow.reduce((sum, m) => {
                                  const v = calculateVariances(m);
                                  return sum + v.varianceForecastVsBudget;
                                }, 0)
                              )}
                            </TableCell>
                          )}
                        </TableRow>

                        {/* Row 6: Variación Real vs Presupuesto */}
                        <TableRow>
                          <TableCell className="sticky left-0 bg-background font-medium">
                            Variación Real vs Pres
                          </TableCell>
                          {allocationsToShow.map((allocation) => {
                            const variances = calculateVariances(allocation);
                            return (
                              <TableCell 
                                key={allocation.month} 
                                className={`text-center font-medium ${
                                  variances.varianceActualVsBudget > 0 
                                    ? 'text-red-600 bg-red-50/50' 
                                    : variances.varianceActualVsBudget < 0 
                                      ? 'text-green-600 bg-green-50/50' 
                                      : 'text-muted-foreground'
                                }`}
                              >
                                {variances.varianceActualVsBudget >= 0 ? '+' : ''}
                                {formatCurrency(variances.varianceActualVsBudget)}
                              </TableCell>
                            );
                          })}
                          {!isCurrentMonthMode && (
                            <TableCell className="text-center font-bold bg-muted/50">
                              {formatCurrency(
                                allocationsToShow.reduce((sum, m) => {
                                  const v = calculateVariances(m);
                                  return sum + v.varianceActualVsBudget;
                                }, 0)
                              )}
                            </TableCell>
                          )}
                        </TableRow>

                        {/* Row 7: % Consumo Real */}
                        <TableRow>
                          <TableCell className="sticky left-0 bg-background font-medium">
                            % Consumo Real
                          </TableCell>
                          {allocationsToShow.map((allocation) => {
                            const variances = calculateVariances(allocation);
                            return (
                              <TableCell 
                                key={allocation.month} 
                                className={`text-center font-medium ${
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
                          {!isCurrentMonthMode && (
                            <TableCell className="text-center font-bold bg-muted/50">
                              {(() => {
                                const totalBudget = allocationsToShow.reduce((sum, m) => sum + m.budgetAllocated, 0);
                                const totalActual = allocationsToShow.reduce((sum, m) => sum + m.actual, 0);
                                return totalBudget > 0 ? ((totalActual / totalBudget) * 100).toFixed(1) : '0.0';
                              })()}%
                            </TableCell>
                          )}
                        </TableRow>

                        {/* Row 8: Runway Restante (only if runway metrics available) */}
                        {hasRunwayMetrics && (
                          <TableRow className="border-t-2">
                            <TableCell className="sticky left-0 bg-background font-medium">
                              Runway Restante
                            </TableCell>
                            {allocationsToShow.map((allocation) => {
                              const runway = runwayMetrics.find(r => r.month === allocation.month);
                              return (
                                <TableCell key={allocation.month} className="text-center">
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
                                {!isCurrentMonthMode && (
                                  <TableCell className="text-center font-bold bg-muted/50">
                                    {hasRunwayMetrics && runwayMetrics.length > 0 && (() => {
                                      const lastRunway = runwayMetrics[runwayMetrics.length - 1];
                                      return (
                                        <div className="text-sm">
                                          <div className={`font-medium ${
                                            lastRunway.remainingAnnualBudget <= 0 
                                              ? 'text-red-600' 
                                              : lastRunway.percentConsumed > 80 
                                                ? 'text-yellow-600' 
                                                : 'text-green-600'
                                          }`}>
                                            {formatCurrency(lastRunway.remainingAnnualBudget)}
                                          </div>
                                          <div className="text-xs text-muted-foreground">
                                            Final
                                          </div>
                                        </div>
                                      );
                                    })()}
                                  </TableCell>
                                )}
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    );
                  })()}
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
