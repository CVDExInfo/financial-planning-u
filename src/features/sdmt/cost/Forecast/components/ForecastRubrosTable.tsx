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

import { useState, useMemo } from 'react';
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
import { Search, Edit2, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import type { CategoryTotals, CategoryRubro, PortfolioTotals } from '../categoryGrouping';
import LoadingSpinner from '@/components/LoadingSpinner';
import VarianceChip from './VarianceChip';

interface ForecastRubrosTableProps {
  categoryTotals: Map<string, CategoryTotals>;
  categoryRubros: Map<string, CategoryRubro[]>;
  portfolioTotals: PortfolioTotals;
  monthlyBudgets: Array<{ month: number; budget: number }>;
  onSaveBudget: (budgets: Array<{ month: number; budget: number }>) => Promise<void>;
  formatCurrency: (amount: number) => string;
  canEditBudget: boolean;
}

export function ForecastRubrosTable({
  categoryTotals,
  categoryRubros,
  portfolioTotals,
  monthlyBudgets,
  onSaveBudget,
  formatCurrency,
  canEditBudget,
}: ForecastRubrosTableProps) {
  const [searchFilter, setSearchFilter] = useState('');
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [editedBudgets, setEditedBudgets] = useState<Array<{ month: number; budget: number }>>([]);
  const [savingBudget, setSavingBudget] = useState(false);

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

  // Filter categories and rubros based on search
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
          {/* Search Filter */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por rubro o categoría"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="pl-8 w-64"
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
                          >
                            <X className="h-3 w-3" />
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

                {/* Category and Rubro Rows */}
                {filteredData.categories.map(([category, categoryTotal]) => {
                  const rubros = categoryRubros.get(category) || [];
                  const filteredRubros = searchFilter.trim()
                    ? rubros.filter(r =>
                        r.description.toLowerCase().includes(searchFilter.toLowerCase())
                      )
                    : rubros;

                  return (
                    <React.Fragment key={category}>
                      {/* Individual Rubro Rows */}
                      {filteredRubros.map(rubro => (
                        <TableRow key={rubro.rubroId} className="hover:bg-muted/20">
                          <TableCell className="sticky left-0 bg-background pl-6">
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
                    </React.Fragment>
                  );
                })}

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

// Add React import
import React from 'react';
