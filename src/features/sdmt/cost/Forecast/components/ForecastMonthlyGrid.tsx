import { useMemo, useState } from 'react';
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
import { ExternalLink, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Props for ForecastMonthlyGrid component
 */
interface ForecastMonthlyGridProps {
  forecastData: Array<{
    line_item_id: string;
    description?: string;
    category?: string;
    projectId?: string;
    rubroId?: string;
    costType?: string;
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
 * Canonical key for deduplication
 */
function buildCanonicalKey(
  projectId: string,
  rubroId: string,
  lineItemId: string,
  costType: string
): string {
  return `${projectId}|${rubroId}|${lineItemId}|${costType}`;
}

/**
 * Normalize ID for case-insensitive matching
 */
function normalizeId(id: string | undefined | null): string {
  if (!id) return '';
  return id.trim().toLowerCase().replace(/[_\s-]+/g, '_');
}

/**
 * ForecastMonthlyGrid - Grid component showing forecast data by month with 12-month paging
 * 
 * @component
 * @param {ForecastMonthlyGridProps} props - Component props
 * @returns {JSX.Element} Monthly forecast grid with horizontal scrolling and paging
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
  const totalMonths = Math.min(months, maxMonths);
  const monthsPerPage = 12;
  const totalPages = Math.ceil(totalMonths / monthsPerPage);
  
  // State for current page (0-indexed)
  const [currentPage, setCurrentPage] = useState(0);
  
  // Calculate window of months to display
  const startMonth = currentPage * monthsPerPage + 1;
  const endMonth = Math.min((currentPage + 1) * monthsPerPage, totalMonths);
  const displayMonths = endMonth - startMonth + 1;

  /**
   * Deduplicate and aggregate forecast rows by canonical keys
   */
  const deduplicatedRows = useMemo(() => {
    const rowMap = new Map<string, any>();
    
    forecastData.forEach((row) => {
      const projectId = row.projectId || 'unknown';
      const rubroId = normalizeId(row.rubroId || row.line_item_id);
      const lineItemId = normalizeId(row.line_item_id);
      const costType = row.costType || 'other';
      
      const key = buildCanonicalKey(projectId, rubroId, lineItemId, costType);
      
      if (!rowMap.has(key)) {
        rowMap.set(key, { ...row });
      } else {
        // Aggregate: sum up monthly values
        const existing = rowMap.get(key);
        for (let m = 1; m <= totalMonths; m++) {
          const plannedKey = `month_${m}_planned`;
          const forecastKey = `month_${m}_forecast`;
          const actualKey = `month_${m}_actual`;
          
          existing[plannedKey] = (existing[plannedKey] || 0) + (row[plannedKey] || 0);
          existing[forecastKey] = (existing[forecastKey] || 0) + (row[forecastKey] || 0);
          existing[actualKey] = (existing[actualKey] || 0) + (row[actualKey] || 0);
        }
      }
    });
    
    return Array.from(rowMap.values());
  }, [forecastData, totalMonths]);

  // Calculate totals for the visible window
  const monthlyTotals = useMemo(() => {
    const totals: number[] = Array(displayMonths).fill(0);
    
    deduplicatedRows.forEach((row) => {
      for (let i = 0; i < displayMonths; i++) {
        const month = startMonth + i;
        const monthKey = `month_${month}`;
        const value = parseFloat(row[monthKey]) || 0;
        totals[i] += value;
      }
    });
    
    return totals;
  }, [deduplicatedRows, displayMonths, startMonth]);

  const windowTotal = monthlyTotals.reduce((sum, val) => sum + val, 0);
  
  // Calculate overall total (all months)
  const overallTotal = useMemo(() => {
    let total = 0;
    deduplicatedRows.forEach((row) => {
      for (let m = 1; m <= totalMonths; m++) {
        const monthKey = `month_${m}`;
        total += parseFloat(row[monthKey]) || 0;
      }
    });
    return total;
  }, [deduplicatedRows, totalMonths]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            Pronóstico Mensual
            {showRangeIcon && <Calendar className="h-5 w-5 text-muted-foreground" />}
            <span className="text-sm font-normal text-muted-foreground">
              ({deduplicatedRows.length} partidas)
            </span>
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
        
        {/* Month paging controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              Mostrando meses {startMonth}-{endMonth} de {totalMonths}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                disabled={currentPage === 0}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Anterior
              </Button>
              <div className="text-sm font-medium px-3">
                Página {currentPage + 1} de {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
                disabled={currentPage === totalPages - 1}
              >
                Siguiente
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="relative overflow-x-auto min-w-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-10 bg-background min-w-[200px]">
                  Partida
                </TableHead>
                {Array.from({ length: displayMonths }, (_, i) => (
                  <TableHead key={i} className="text-center min-w-[100px]">
                    M{startMonth + i}
                  </TableHead>
                ))}
                <TableHead className="text-right font-bold min-w-[120px]">Total Ventana</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Monthly Budget Row */}
              {useMonthlyBudget && monthlyBudgets && (
                <TableRow className="bg-blue-50 hover:bg-blue-100">
                  <TableCell className="sticky left-0 z-10 bg-blue-50 font-medium">
                    Presupuesto Mensual
                  </TableCell>
                  {Array.from({ length: displayMonths }, (_, i) => {
                    const monthIndex = startMonth + i - 1; // Convert to 0-indexed
                    const budget = monthlyBudgets[monthIndex] || 0;
                    return (
                      <TableCell key={i} className="text-center">
                        {formatCurrency(budget)}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-right font-bold">
                    {formatCurrency(
                      Array.from({ length: displayMonths }, (_, i) => {
                        const monthIndex = startMonth + i - 1;
                        return monthlyBudgets[monthIndex] || 0;
                      }).reduce((sum, val) => sum + val, 0)
                    )}
                  </TableCell>
                </TableRow>
              )}

              {/* Forecast Data Rows */}
              {deduplicatedRows.map((row) => {
                const lineItem = lineItems.find((item) => item.line_item_id === row.line_item_id);
                const rowTotal = Array.from({ length: displayMonths }, (_, i) => {
                  const month = startMonth + i;
                  const monthKey = `month_${month}`;
                  return parseFloat(row[monthKey]) || 0;
                }).reduce((sum, val) => sum + val, 0);

                return (
                  <TableRow key={row.line_item_id}>
                    <TableCell className="sticky left-0 z-10 bg-background">
                      <div>
                        <p className="font-medium">{lineItem?.description || row.description || row.line_item_id}</p>
                        {(lineItem?.category || row.category) && (
                          <p className="text-xs text-muted-foreground">{lineItem?.category || row.category}</p>
                        )}
                      </div>
                    </TableCell>
                    {Array.from({ length: displayMonths }, (_, i) => {
                      const month = startMonth + i;
                      const monthKey = `month_${month}`;
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
                <TableCell className="sticky left-0 z-10 bg-muted">Total (Ventana)</TableCell>
                {monthlyTotals.map((total, index) => (
                  <TableCell key={index} className="text-center">
                    {formatCurrency(total)}
                  </TableCell>
                ))}
                <TableCell className="text-right">{formatCurrency(windowTotal)}</TableCell>
              </TableRow>
              
              {/* Overall Total Row (all months) */}
              {totalPages > 1 && (
                <TableRow className="bg-primary/10 font-bold">
                  <TableCell className="sticky left-0 z-10 bg-primary/10">
                    Total General ({totalMonths} meses)
                  </TableCell>
                  <TableCell colSpan={displayMonths} className="text-center text-muted-foreground">
                    Ver todas las páginas para detalle
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(overallTotal)}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
