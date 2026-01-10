/**
 * TopVarianceRubrosTable Component
 * Displays top N rubros/categories sorted by variance vs budget
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
import { TrendingUp, TrendingDown, List } from 'lucide-react';
import type { CategoryTotals } from '../categoryGrouping';

interface TopVarianceRubrosTableProps {
  categories: Map<string, CategoryTotals>;
  budgetOverall: number; // Total annual budget to allocate proportionally
  formatCurrency: (amount: number) => string;
  onCategoryClick: (category: string) => void;
  topN?: number;
}

interface CategoryWithVariance {
  category: string;
  plannedOverall: number;
  budgetOverall: number;
  forecastOverall: number;
  actualOverall: number;
  varianceBudget: number;
  varianceBudgetPercent: number;
  consumptionPercent: number;
  absVariance: number;
}

export function TopVarianceRubrosTable({
  categories,
  budgetOverall,
  formatCurrency,
  onCategoryClick,
  topN = 5,
}: TopVarianceRubrosTableProps) {
  // Calculate variances and sort
  const topCategories = useMemo(() => {
    // First, calculate total planned across all categories for proportional budget allocation
    const totalPlanned = Array.from(categories.values()).reduce(
      (sum, cat) => sum + cat.overall.planned,
      0
    );

    const categoriesWithVariance: CategoryWithVariance[] = Array.from(categories.entries())
      .map(([_, categoryData]) => {
        // Allocate budget proportionally based on planned
        const budgetForCategory = totalPlanned > 0
          ? budgetOverall * (categoryData.overall.planned / totalPlanned)
          : 0;

        const varianceBudget = categoryData.overall.forecast - budgetForCategory;
        const varianceBudgetPercent = budgetForCategory > 0
          ? (varianceBudget / budgetForCategory) * 100
          : 0;
        const consumptionPercent = budgetForCategory > 0
          ? (categoryData.overall.actual / budgetForCategory) * 100
          : 0;

        return {
          category: categoryData.category,
          plannedOverall: categoryData.overall.planned,
          budgetOverall: budgetForCategory,
          forecastOverall: categoryData.overall.forecast,
          actualOverall: categoryData.overall.actual,
          varianceBudget,
          varianceBudgetPercent,
          consumptionPercent,
          absVariance: Math.abs(varianceBudget),
        };
      })
      .filter(c => c.absVariance > 0) // Only show categories with variance
      .sort((a, b) => b.absVariance - a.absVariance) // Sort by absolute variance descending
      .slice(0, topN);

    return categoriesWithVariance;
  }, [categories, budgetOverall, topN]);

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

  if (topCategories.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Rubros con mayor variación</CardTitle>
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
          <List className="h-5 w-5" />
          Rubros con mayor variación
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rubro / Categoría</TableHead>
              <TableHead className="text-right">Presupuesto</TableHead>
              <TableHead className="text-right">Pronóstico</TableHead>
              <TableHead className="text-right">Real</TableHead>
              <TableHead className="text-right">Variación</TableHead>
              <TableHead className="text-right">% Consumo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {topCategories.map(category => (
              <TableRow
                key={category.category}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => onCategoryClick(category.category)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onCategoryClick(category.category);
                  }
                }}
              >
                <TableCell>
                  <div className="font-medium">{category.category}</div>
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(category.budgetOverall)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(category.forecastOverall)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(category.actualOverall)}
                </TableCell>
                <TableCell className="text-right">
                  <div className={`flex items-center justify-end gap-1 font-medium ${getVarianceColor(category.varianceBudget)}`}>
                    {category.varianceBudget > 0 ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : (
                      <TrendingDown className="h-4 w-4" />
                    )}
                    <span>
                      {category.varianceBudget > 0 ? '+' : ''}
                      {formatCurrency(category.varianceBudget)}
                    </span>
                  </div>
                  <div className={`text-xs ${getVarianceColor(category.varianceBudget)}`}>
                    {category.varianceBudgetPercent > 0 ? '+' : ''}
                    {category.varianceBudgetPercent.toFixed(1)}%
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Badge
                    variant="outline"
                    className={`${getConsumptionColor(category.consumptionPercent)}`}
                  >
                    {category.consumptionPercent.toFixed(1)}%
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
