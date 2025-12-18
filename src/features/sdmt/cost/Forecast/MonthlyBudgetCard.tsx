/**
 * Monthly Budget Input Component
 * Provides UI for Finance/PMO to enter monthly budgets (M1-M12)
 * Supports both full manual entry and hybrid (some months manual, rest auto-filled)
 */

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Info, AlertTriangle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { MonthlyBudgetInput } from './budgetAllocation';

interface MonthlyBudgetCardProps {
  monthlyBudgets: MonthlyBudgetInput[];
  annualBudgetReference: number; // Annual budget for comparison
  onMonthlyBudgetsChange: (budgets: MonthlyBudgetInput[]) => void;
  disabled?: boolean;
}

export function MonthlyBudgetCard({
  monthlyBudgets,
  annualBudgetReference,
  onMonthlyBudgetsChange,
  disabled = false,
}: MonthlyBudgetCardProps) {
  const [localBudgets, setLocalBudgets] = useState<Record<number, string>>(() => {
    // Initialize from props
    const initial: Record<number, string> = {};
    monthlyBudgets.forEach(mb => {
      if (mb.budget > 0) {
        initial[mb.month] = mb.budget.toString();
      }
    });
    return initial;
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const sanitizeInput = (value: string): number => {
    const cleaned = value.replace(/[$,\s]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : Math.max(0, parsed);
  };

  const handleMonthBudgetChange = (month: number, value: string) => {
    // Update local state
    const newLocal = { ...localBudgets };
    if (value.trim() === '') {
      delete newLocal[month];
    } else {
      newLocal[month] = value;
    }
    setLocalBudgets(newLocal);

    // Convert to MonthlyBudgetInput array
    const budgets: MonthlyBudgetInput[] = Object.entries(newLocal)
      .map(([m, v]) => ({
        month: parseInt(m),
        budget: sanitizeInput(v),
      }))
      .filter(b => b.budget > 0);

    onMonthlyBudgetsChange(budgets);
  };

  // Calculate totals and warnings
  const totalEntered = useMemo(() => {
    return Object.values(localBudgets)
      .reduce((sum, v) => sum + sanitizeInput(v), 0);
  }, [localBudgets]);

  const enteredCount = useMemo(() => {
    return Object.keys(localBudgets).length;
  }, [localBudgets]);

  const remaining = Math.max(0, annualBudgetReference - totalEntered);
  const percentUsed = annualBudgetReference > 0 
    ? (totalEntered / annualBudgetReference) * 100 
    : 0;

  const isOverAnnual = totalEntered > annualBudgetReference;
  const monthsRemaining = 12 - enteredCount;

  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  return (
    <Card className="border-2 border-blue-500/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg">Presupuesto Mensual (Nómina MOD)</CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-sm">
                  <p className="text-sm">
                    Ingrese el presupuesto mensual para cada mes. Los meses sin valor se auto-llenarán
                    proporcionalmente usando el presupuesto anual restante.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={enteredCount > 0 ? 'default' : 'outline'}>
              {enteredCount}/12 meses
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-3 p-3 bg-muted/50 rounded-lg">
          <div>
            <div className="text-xs text-muted-foreground">Total Ingresado</div>
            <div className={`text-lg font-bold ${isOverAnnual ? 'text-red-600' : 'text-foreground'}`}>
              {formatCurrency(totalEntered)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Presupuesto Anual</div>
            <div className="text-lg font-bold text-blue-600">
              {formatCurrency(annualBudgetReference)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">
              {isOverAnnual ? 'Sobre Presupuesto' : 'Restante'}
            </div>
            <div className={`text-lg font-bold ${isOverAnnual ? 'text-red-600' : 'text-green-600'}`}>
              {formatCurrency(Math.abs(remaining))}
            </div>
          </div>
        </div>

        {/* Warning if over annual */}
        {isOverAnnual && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-900">
              <strong>Advertencia:</strong> La suma de presupuestos mensuales ({formatCurrency(totalEntered)}) 
              excede el presupuesto anual de referencia ({formatCurrency(annualBudgetReference)}).
            </div>
          </div>
        )}

        {/* Monthly Input Grid */}
        <div>
          <Label className="text-sm font-medium mb-2 block">
            Presupuesto por Mes (M1-M12)
          </Label>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 12 }, (_, i) => {
              const month = i + 1;
              const value = localBudgets[month] || '';
              const hasValue = value !== '';
              
              return (
                <div key={month} className="space-y-1">
                  <Label 
                    htmlFor={`month-${month}`} 
                    className="text-xs text-muted-foreground flex items-center justify-between"
                  >
                    <span>{monthNames[i]} (M{month})</span>
                    {!hasValue && (
                      <Badge variant="outline" className="text-[9px] py-0 px-1">
                        Estimado
                      </Badge>
                    )}
                  </Label>
                  <Input
                    id={`month-${month}`}
                    type="text"
                    placeholder="0"
                    value={value}
                    onChange={(e) => handleMonthBudgetChange(month, e.target.value)}
                    disabled={disabled}
                    className={`h-9 text-sm ${hasValue ? 'border-blue-500 bg-blue-50/50' : ''}`}
                    aria-label={`Presupuesto para ${monthNames[i]}`}
                  />
                  {hasValue && (
                    <div className="text-[10px] text-muted-foreground">
                      {formatCurrency(sanitizeInput(value))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Helper Text */}
        <div className="pt-2 border-t text-xs text-muted-foreground space-y-1">
          <p>
            <strong>💡 Auto-llenado:</strong> Los meses sin presupuesto se distribuirán automáticamente
            usando el presupuesto anual restante ({formatCurrency(remaining)}) entre {monthsRemaining} meses.
          </p>
          <p>
            <strong>Porcentaje usado:</strong> {percentUsed.toFixed(1)}% del presupuesto anual
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
