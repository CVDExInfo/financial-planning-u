/**
 * Portfolio Summary View Component
 * Displays a collapsed summary view by default for "Todos (All Projects)" mode
 * with expandable project details on demand (progressive disclosure)
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, Folder, FolderOpen } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { ForecastCell, LineItem } from '@/types/domain';

type ForecastRow = ForecastCell & { projectId?: string; projectName?: string };
type ProjectLineItem = LineItem & { projectId?: string; projectName?: string };

interface PortfolioSummaryViewProps {
  forecastData: ForecastRow[];
  lineItems: ProjectLineItem[];
  formatCurrency: (amount: number) => string;
  onViewProject?: (projectId: string) => void;
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
}: PortfolioSummaryViewProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

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
          <div className="grid grid-cols-5 gap-4 p-4 bg-muted/50 rounded-lg border-2 border-primary/20">
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
    </Collapsible>
  );
}
