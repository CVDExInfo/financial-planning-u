import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronDown, ChevronUp, Save } from 'lucide-react';

/**
 * Props for PayrollMonthlyBudget component
 */
interface PayrollMonthlyBudgetProps {
  budgetYear: number;
  monthlyBudgets: number[]; // 12 entries
  onChangeMonthlyBudgets: (budgets: number[]) => void;
  onSave: () => void;
  useMonthlyBudget: boolean;
  setUseMonthlyBudget: (value: boolean) => void;
  canEditBudget: boolean;
  onYearChange?: (year: number) => void;
}

/**
 * PayrollMonthlyBudget - Collapsible component for managing monthly payroll budgets
 * 
 * @component
 * @param {PayrollMonthlyBudgetProps} props - Component props
 * @returns {JSX.Element} Monthly budget management interface
 */
export function PayrollMonthlyBudget({
  budgetYear,
  monthlyBudgets,
  onChangeMonthlyBudgets,
  onSave,
  useMonthlyBudget,
  setUseMonthlyBudget,
  canEditBudget,
  onYearChange,
}: PayrollMonthlyBudgetProps) {
  const [isOpen, setIsOpen] = useState(false);

  const yearlyBudget = monthlyBudgets.reduce((sum, budget) => sum + budget, 0);

  const handleMonthChange = (monthIndex: number, value: string) => {
    const numValue = parseFloat(value) || 0;
    const newBudgets = [...monthlyBudgets];
    newBudgets[monthIndex] = numValue;
    onChangeMonthlyBudgets(newBudgets);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear - 2 + i);

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              Presupuesto Mensual de Nómina
              {useMonthlyBudget && (
                <span className="text-sm font-normal text-muted-foreground">
                  (Total: {formatCurrency(yearlyBudget)})
                </span>
              )}
            </CardTitle>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" aria-label={isOpen ? 'Colapsar' : 'Expandir'}>
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            {/* Year Selector */}
            <div className="flex items-center gap-4">
              <Label htmlFor="budget-year" className="whitespace-nowrap">
                Año Presupuestal:
              </Label>
              <Select
                value={budgetYear.toString()}
                onValueChange={(value) => onYearChange?.(parseInt(value))}
                disabled={!canEditBudget}
              >
                <SelectTrigger id="budget-year" className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Monthly Budget Inputs */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {monthlyBudgets.map((budget, index) => (
                <div key={index} className="space-y-2">
                  <Label htmlFor={`month-${index}`} className="text-xs font-medium">
                    M{index + 1}
                  </Label>
                  <Input
                    id={`month-${index}`}
                    type="number"
                    value={budget}
                    onChange={(e) => handleMonthChange(index, e.target.value)}
                    disabled={!canEditBudget || !useMonthlyBudget}
                    min="0"
                    step="0.01"
                    className="text-sm"
                    aria-label={`Presupuesto para mes ${index + 1}`}
                  />
                </div>
              ))}
            </div>

            {/* Yearly Total */}
            <div className="flex items-center justify-between pt-4 border-t">
              <span className="text-sm font-medium">Total Anual:</span>
              <span className="text-lg font-bold text-primary">
                {formatCurrency(yearlyBudget)}
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-4 pt-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="use-monthly-budget"
                  checked={useMonthlyBudget}
                  onChange={(e) => setUseMonthlyBudget(e.target.checked)}
                  disabled={!canEditBudget}
                  className="h-4 w-4 rounded border-gray-300"
                  aria-label="Usar presupuesto mensual"
                />
                <Label htmlFor="use-monthly-budget" className="text-sm cursor-pointer">
                  Usar presupuesto mensual
                </Label>
              </div>
              <Button
                onClick={onSave}
                disabled={!canEditBudget}
                size="sm"
                className="ml-auto"
                aria-label="Guardar presupuesto mensual"
              >
                <Save className="h-4 w-4 mr-2" />
                Guardar
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
