/**
 * BudgetAndSimulatorPanel Component
 * Two-column panel: Budget + Allocation Strategy (left) and Simulator (right, collapsible)
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { DollarSign } from 'lucide-react';
import LoadingSpinner from '@/components/LoadingSpinner';
import { BudgetSimulatorCard } from '../BudgetSimulatorCard';
import type { BudgetSimulationState } from '../budgetSimulation';

export type AllocationStrategy = 'equal' | 'by_planned' | 'by_forecast';

interface BudgetAndSimulatorPanelProps {
  // Budget props
  budgetYear: number;
  budgetAmount: string;
  budgetCurrency: string;
  budgetLastUpdated: string | null;
  loadingBudget: boolean;
  savingBudget: boolean;
  canEditBudget: boolean;
  onBudgetYearChange: (year: number) => void;
  onBudgetAmountChange: (amount: string) => void;
  onBudgetCurrencyChange: (currency: string) => void;
  onSaveBudget: () => void;
  
  // Allocation strategy props
  allocationStrategy: AllocationStrategy;
  onAllocationStrategyChange: (strategy: AllocationStrategy) => void;
  monthlyBudgetAverage?: number;
  maxPressureMonth?: { month: number; pressure: number } | null;
  formatCurrency: (amount: number) => string;
  
  // Simulator props
  isPortfolioView: boolean;
  simulationState: BudgetSimulationState;
  onSimulationChange: (state: BudgetSimulationState) => void;
}

export function BudgetAndSimulatorPanel({
  budgetYear,
  budgetAmount,
  budgetCurrency,
  budgetLastUpdated,
  loadingBudget,
  savingBudget,
  canEditBudget,
  onBudgetYearChange,
  onBudgetAmountChange,
  onBudgetCurrencyChange,
  onSaveBudget,
  allocationStrategy,
  onAllocationStrategyChange,
  monthlyBudgetAverage,
  maxPressureMonth,
  formatCurrency,
  isPortfolioView,
  simulationState,
  onSimulationChange,
}: BudgetAndSimulatorPanelProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Left: Budget Module */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Presupuesto Anual</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Budget Input Fields */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="budget-year" className="text-sm">Año</Label>
              <Input
                id="budget-year"
                type="number"
                value={budgetYear}
                onChange={(e) => onBudgetYearChange(parseInt(e.target.value))}
                min={2020}
                max={2100}
                disabled={loadingBudget || savingBudget || !canEditBudget}
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="budget-amount" className="text-sm">Monto</Label>
              <Input
                id="budget-amount"
                type="number"
                value={budgetAmount}
                onChange={(e) => onBudgetAmountChange(e.target.value)}
                placeholder="0"
                disabled={loadingBudget || savingBudget || !canEditBudget}
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="budget-currency" className="text-sm">Moneda</Label>
              <select
                id="budget-currency"
                value={budgetCurrency}
                onChange={(e) => onBudgetCurrencyChange(e.target.value)}
                disabled={loadingBudget || savingBudget || !canEditBudget}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="MXN">MXN</option>
              </select>
            </div>
          </div>

          <Button
            onClick={onSaveBudget}
            disabled={savingBudget || loadingBudget || !canEditBudget || !budgetAmount}
            className="w-full gap-2"
            size="sm"
          >
            {savingBudget ? <LoadingSpinner size="sm" /> : null}
            Guardar Presupuesto
          </Button>

          {budgetLastUpdated && (
            <p className="text-xs text-muted-foreground text-center">
              Actualizado: {new Date(budgetLastUpdated).toLocaleDateString('es-ES')}
            </p>
          )}

          {!canEditBudget && (
            <p className="text-xs text-amber-600 text-center">
              Solo usuarios SDMT pueden editar el presupuesto anual
            </p>
          )}

          {/* Allocation Strategy */}
          <div className="pt-4 border-t space-y-3">
            <Label className="text-sm font-medium">Distribución Mensual:</Label>
            <RadioGroup
              value={allocationStrategy}
              onValueChange={(value) => onAllocationStrategyChange(value as AllocationStrategy)}
              className="space-y-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="equal" id="strategy-equal" />
                <Label htmlFor="strategy-equal" className="text-sm font-normal cursor-pointer">
                  Igual (12 meses)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="by_planned" id="strategy-planned" />
                <Label htmlFor="strategy-planned" className="text-sm font-normal cursor-pointer">
                  Según Planeado
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="by_forecast" id="strategy-forecast" />
                <Label htmlFor="strategy-forecast" className="text-sm font-normal cursor-pointer">
                  Según Pronóstico
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Computed Outputs */}
          {monthlyBudgetAverage !== undefined && monthlyBudgetAverage > 0 && (
            <div className="pt-3 border-t space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Presupuesto mensual promedio:</span>
                <span className="font-medium">{formatCurrency(monthlyBudgetAverage)}</span>
              </div>
              {maxPressureMonth && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Mayor presión:</span>
                  <span className="font-medium text-amber-600">
                    Mes {maxPressureMonth.month} ({maxPressureMonth.pressure.toFixed(1)}%)
                  </span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Right: Simulator (only in portfolio view) */}
      {isPortfolioView && (
        <BudgetSimulatorCard
          simulationState={simulationState}
          onSimulationChange={onSimulationChange}
        />
      )}
    </div>
  );
}
