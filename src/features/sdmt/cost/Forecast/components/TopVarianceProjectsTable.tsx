/**
 * TopVarianceProjectsTable Component
 * Displays top N projects sorted by variance vs budget (|forecastTotal - budgetTotal|)
 * Used in TODOS/ALL_PROJECTS mode for executive view
 */

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface ProjectData {
  id: string;
  name: string;
  code?: string;
  plannedTotal: number;
  budgetTotal: number;
  forecastTotal: number;
  actualTotal: number;
}

interface TopVarianceProjectsTableProps {
  projects: ProjectData[];
  formatCurrency: (amount: number) => string;
  onProjectClick: (projectId: string) => void;
  topN?: number;
}

interface ProjectWithVariance extends ProjectData {
  varianceBudget: number;
  varianceBudgetPercent: number;
  consumptionPercent: number;
  absVariance: number;
}

export function TopVarianceProjectsTable({
  projects,
  formatCurrency,
  onProjectClick,
  topN = 5,
}: TopVarianceProjectsTableProps) {
  // Calculate variances and sort
  const topProjects = useMemo(() => {
    const projectsWithVariance: ProjectWithVariance[] = projects
      .map(project => {
        const varianceBudget = project.forecastTotal - project.budgetTotal;
        const varianceBudgetPercent = project.budgetTotal > 0 
          ? (varianceBudget / project.budgetTotal) * 100 
          : 0;
        const consumptionPercent = project.budgetTotal > 0
          ? (project.actualTotal / project.budgetTotal) * 100
          : 0;

        return {
          ...project,
          varianceBudget,
          varianceBudgetPercent,
          consumptionPercent,
          absVariance: Math.abs(varianceBudget),
        };
      })
      .filter(p => p.absVariance > 0) // Only show projects with variance
      .sort((a, b) => b.absVariance - a.absVariance) // Sort by absolute variance descending
      .slice(0, topN);

    return projectsWithVariance;
  }, [projects, topN]);

  // Helper to get consumption badge color
  const getConsumptionColor = (percent: number): string => {
    if (percent > 100) return 'bg-red-100 text-red-800 border-red-300';
    if (percent > 90) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    return 'bg-green-100 text-green-800 border-green-300';
  };

  // Helper to get variance color
  const getVarianceColor = (variance: number): string => {
    if (variance > 0) {
      // Over budget - red
      return 'text-red-600';
    }
    // Under budget - green
    return 'text-green-600';
  };

  if (topProjects.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Proyectos con mayor variación</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground text-sm">
            No hay datos de variación disponibles
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Proyectos con mayor variación
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Proyecto</TableHead>
              <TableHead className="text-right">Presupuesto</TableHead>
              <TableHead className="text-right">Pronóstico</TableHead>
              <TableHead className="text-right">Real</TableHead>
              <TableHead className="text-right">Variación</TableHead>
              <TableHead className="text-right">% Consumo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {topProjects.map(project => (
              <TableRow
                key={project.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => onProjectClick(project.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onProjectClick(project.id);
                  }
                }}
              >
                <TableCell>
                  <div className="font-medium">{project.name}</div>
                  {project.code && (
                    <div className="text-xs text-muted-foreground">{project.code}</div>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(project.budgetTotal)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(project.forecastTotal)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(project.actualTotal)}
                </TableCell>
                <TableCell className="text-right">
                  <div className={`flex items-center justify-end gap-1 font-medium ${getVarianceColor(project.varianceBudget)}`}>
                    {project.varianceBudget > 0 ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : (
                      <TrendingDown className="h-4 w-4" />
                    )}
                    <span>
                      {project.varianceBudget > 0 ? '+' : ''}
                      {formatCurrency(project.varianceBudget)}
                    </span>
                  </div>
                  <div className={`text-xs ${getVarianceColor(project.varianceBudget)}`}>
                    {project.varianceBudgetPercent > 0 ? '+' : ''}
                    {project.varianceBudgetPercent.toFixed(1)}%
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Badge
                    variant="outline"
                    className={`${getConsumptionColor(project.consumptionPercent)}`}
                  >
                    {project.consumptionPercent.toFixed(1)}%
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
