import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ExternalLink, Calendar } from 'lucide-react';

/**
 * Props for ForecastMonthlyGrid component
 */
interface ForecastMonthlyGridProps {
  forecastData: Array<{
    line_item_id: string;
    description?: string;
    category?: string;
    [key: string]: any;
  }>;
  lineItems: Array<{
    line_item_id: string;
    description?: string;
    category?: string;
  }>;
  months: number; // up to 60
  maxMonths?: number; // default 60
  showRangeIcon?: boolean; // default false
  defaultExpanded?: boolean; // default true
  monthlyBudgets?: number[];
  useMonthlyBudget?: boolean;
  onScrollToDetail?: () => void;
  onNavigateToReconciliation?: () => void;
  formatCurrency?: (value: number) => string;
}

/**
 * ForecastMonthlyGrid - Grid component showing forecast data by month
 * 
 * @component
 * @param {ForecastMonthlyGridProps} props - Component props
 * @returns {JSX.Element} Monthly forecast grid with horizontal scrolling
 */
export function ForecastMonthlyGrid({
  forecastData,
  lineItems,
  months,
  maxMonths = 60,
  showRangeIcon = false,
  defaultExpanded = true,
  monthlyBudgets,
  useMonthlyBudget,
  onScrollToDetail,
  onNavigateToReconciliation,
  formatCurrency = (value: number) =>
    new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value),
}: ForecastMonthlyGridProps) {
  const displayMonths = Math.min(months, maxMonths);

  // Calculate totals for each month
  const monthlyTotals = useMemo(() => {
    const totals: number[] = Array(displayMonths).fill(0);
    
    forecastData.forEach((row) => {
      for (let i = 0; i < displayMonths; i++) {
        const monthKey = `month_${i + 1}`;
        const value = parseFloat(row[monthKey]) || 0;
        totals[i] += value;
      }
    });
    
    return totals;
  }, [forecastData, displayMonths]);

  const grandTotal = monthlyTotals.reduce((sum, val) => sum + val, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            Pronóstico Mensual
            {showRangeIcon && <Calendar className="h-5 w-5 text-muted-foreground" />}
          </CardTitle>
          <div className="flex gap-2">
            {onScrollToDetail && (
              <Button
                variant="outline"
                size="sm"
                onClick={onScrollToDetail}
                aria-label="Ver detalle"
              >
                Ver Detalle
              </Button>
            )}
            {onNavigateToReconciliation && (
              <Button
                variant="outline"
                size="sm"
                onClick={onNavigateToReconciliation}
                aria-label="Ir a reconciliación"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Reconciliación
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-10 bg-background min-w-[200px]">
                  Partida
                </TableHead>
                {Array.from({ length: displayMonths }, (_, i) => (
                  <TableHead key={i} className="text-center min-w-[100px]">
                    M{i + 1}
                  </TableHead>
                ))}
                <TableHead className="text-right font-bold min-w-[120px]">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Monthly Budget Row */}
              {useMonthlyBudget && monthlyBudgets && (
                <TableRow className="bg-blue-50 hover:bg-blue-100">
                  <TableCell className="sticky left-0 z-10 bg-blue-50 font-medium">
                    Presupuesto Mensual
                  </TableCell>
                  {monthlyBudgets.slice(0, displayMonths).map((budget, index) => (
                    <TableCell key={index} className="text-center">
                      {formatCurrency(budget)}
                    </TableCell>
                  ))}
                  <TableCell className="text-right font-bold">
                    {formatCurrency(
                      monthlyBudgets.slice(0, displayMonths).reduce((sum, val) => sum + val, 0)
                    )}
                  </TableCell>
                </TableRow>
              )}

              {/* Forecast Data Rows */}
              {forecastData.map((row) => {
                const lineItem = lineItems.find((item) => item.line_item_id === row.line_item_id);
                const rowTotal = Array.from({ length: displayMonths }, (_, i) => {
                  const monthKey = `month_${i + 1}`;
                  return parseFloat(row[monthKey]) || 0;
                }).reduce((sum, val) => sum + val, 0);

                return (
                  <TableRow key={row.line_item_id}>
                    <TableCell className="sticky left-0 z-10 bg-background">
                      <div>
                        <p className="font-medium">{lineItem?.description || row.description || row.line_item_id}</p>
                        {lineItem?.category && (
                          <p className="text-xs text-muted-foreground">{lineItem.category}</p>
                        )}
                      </div>
                    </TableCell>
                    {Array.from({ length: displayMonths }, (_, i) => {
                      const monthKey = `month_${i + 1}`;
                      const value = parseFloat(row[monthKey]) || 0;
                      return (
                        <TableCell key={i} className="text-center">
                          {value > 0 ? formatCurrency(value) : '-'}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-right font-medium">
                      {formatCurrency(rowTotal)}
                    </TableCell>
                  </TableRow>
                );
              })}

              {/* Totals Row */}
              <TableRow className="bg-muted font-bold">
                <TableCell className="sticky left-0 z-10 bg-muted">Total</TableCell>
                {monthlyTotals.map((total, index) => (
                  <TableCell key={index} className="text-center">
                    {formatCurrency(total)}
                  </TableCell>
                ))}
                <TableCell className="text-right">{formatCurrency(grandTotal)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
