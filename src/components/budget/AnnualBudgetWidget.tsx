/**
 * Annual All-In Budget Widget
 * Displays and allows editing of organization-wide annual budget
 * Shows comparison with total adjusted forecast
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DollarSign, Save, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { getAnnualBudget, setAnnualBudget } from "@/api/finanzas";
import { useAuth } from "@/hooks/useAuth";

interface AnnualBudgetWidgetProps {
  year?: number;
  totalAdjustedForecast?: number;
  onBudgetUpdate?: (budget: {
    year: number;
    amount: number;
    currency: string;
  }) => void;
}

export function AnnualBudgetWidget({
  year: initialYear,
  totalAdjustedForecast = 0,
  onBudgetUpdate,
}: AnnualBudgetWidgetProps) {
  const { user } = useAuth();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(initialYear || currentYear);
  const [budgetAmount, setBudgetAmount] = useState<string>("");
  const [currency, setCurrency] = useState<"USD" | "EUR" | "MXN">("USD");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [existingBudget, setExistingBudget] = useState<{
    year: number;
    amount: number;
    currency: string;
    lastUpdated: string;
    updatedBy: string;
  } | null>(null);

  // Only ADMIN and EXEC_RO can edit (not PMO)
  const canEdit = user?.current_role === 'ADMIN' || user?.current_role === 'EXEC_RO';

  // Load existing budget for the selected year
  useEffect(() => {
    loadBudget();
  }, [year]);

  const loadBudget = async () => {
    setLoading(true);
    try {
      const budget = await getAnnualBudget(year);
      if (budget) {
        setExistingBudget(budget);
        setBudgetAmount(budget.amount.toString());
        setCurrency(budget.currency as "USD" | "EUR" | "MXN");
      } else {
        setExistingBudget(null);
        setBudgetAmount("");
      }
    } catch (error) {
      console.error("Failed to load budget:", error);
      toast.error("No se pudo cargar el presupuesto anual");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const amount = parseFloat(budgetAmount);
    if (isNaN(amount) || amount < 0) {
      toast.error("Por favor ingresa un monto válido");
      return;
    }

    setSaving(true);
    try {
      const result = await setAnnualBudget(year, amount, currency);
      setExistingBudget(result);
      toast.success(`Presupuesto anual ${year} guardado exitosamente`);
      if (onBudgetUpdate) {
        onBudgetUpdate(result);
      }
    } catch (error) {
      console.error("Failed to save budget:", error);
      toast.error("No se pudo guardar el presupuesto anual");
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (value: number, curr: string = currency) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: curr,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const budgetValue = existingBudget?.amount || parseFloat(budgetAmount) || 0;
  const consumed = totalAdjustedForecast;
  const remaining = budgetValue - consumed;
  const consumedPercent = budgetValue > 0 ? (consumed / budgetValue) * 100 : 0;
  const isOverBudget = remaining < 0;

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Presupuesto All-In Anual
            </CardTitle>
            <CardDescription>
              Presupuesto organizacional vs pronóstico ajustado
            </CardDescription>
          </div>
          <Select
            value={year.toString()}
            onValueChange={(value) => setYear(parseInt(value))}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 5 }, (_, i) => currentYear - 2 + i).map((y) => (
                <SelectItem key={y} value={y.toString()}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Budget Input */}
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 space-y-2">
            <Label htmlFor="budget-amount">Monto Presupuestado</Label>
            <Input
              id="budget-amount"
              type="number"
              placeholder="5000000"
              value={budgetAmount}
              onChange={(e) => setBudgetAmount(e.target.value)}
              disabled={loading || saving || !canEdit}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="currency">Moneda</Label>
            <Select 
              value={currency} 
              onValueChange={(v) => setCurrency(v as any)}
              disabled={!canEdit}
            >
              <SelectTrigger id="currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
                <SelectItem value="MXN">MXN</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          onClick={handleSave}
          disabled={loading || saving || !budgetAmount || !canEdit}
          className="w-full"
        >
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Guardando..." : "Guardar Presupuesto"}
        </Button>

        {/* Budget Comparison */}
        {existingBudget && (
          <div className="space-y-4 pt-4 border-t">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Presupuesto Total</p>
                <p className="text-2xl font-bold">{formatCurrency(budgetValue)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Pronóstico Ajustado</p>
                <p className="text-2xl font-bold">{formatCurrency(consumed)}</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {isOverBudget ? "Excedente" : "Disponible"}
                </span>
                <span className={`text-sm font-bold ${isOverBudget ? "text-red-600" : "text-green-600"}`}>
                  {formatCurrency(Math.abs(remaining))}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className={`h-2.5 rounded-full ${
                    isOverBudget ? "bg-red-600" : consumedPercent > 80 ? "bg-yellow-600" : "bg-green-600"
                  }`}
                  style={{ width: `${Math.min(consumedPercent, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {consumedPercent.toFixed(1)}% consumido
              </p>
            </div>

            {isOverBudget && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
                <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-900">
                    Presupuesto Excedido
                  </p>
                  <p className="text-xs text-red-700 mt-1">
                    El pronóstico ajustado excede el presupuesto anual en{" "}
                    {formatCurrency(Math.abs(remaining))}
                  </p>
                </div>
              </div>
            )}

            {existingBudget.lastUpdated && (
              <p className="text-xs text-muted-foreground">
                Última actualización: {new Date(existingBudget.lastUpdated).toLocaleDateString("es-MX")}{" "}
                por {existingBudget.updatedBy}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
