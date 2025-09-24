import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, Download, Table } from '@phosphor-icons/react';
import ApiService from '@/lib/api';
import type { ForecastCell } from '@/types/domain';

export function ForecastGrid() {
  const [selectedPeriod, setSelectedPeriod] = useState(12);

  const { data: forecastData = [], isLoading } = useQuery({
    queryKey: ['forecast', 'PRJ-IKUSI-PLATFORM'],
    queryFn: () => ApiService.getForecast('PRJ-IKUSI-PLATFORM'),
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getVarianceColor = (variance: number) => {
    if (variance > 0) return 'text-green-600';
    if (variance < 0) return 'text-red-600';
    return 'text-muted-foreground';
  };

  // Group data by line item
  const groupedData = forecastData.reduce((acc, cell) => {
    if (!acc[cell.line_item_id]) {
      acc[cell.line_item_id] = [];
    }
    acc[cell.line_item_id].push(cell);
    return acc;
  }, {} as Record<string, ForecastCell[]>);

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-6"></div>
          <div className="h-96 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center space-x-2">
            <span>Forecast Grid</span>
            <Badge className="module-badge-sdmt">SDMT</Badge>
          </h1>
          <p className="text-muted-foreground">
            60-month planning vs forecast vs actual with variance analysis
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" className="flex items-center space-x-2">
            <Upload size={16} />
            <span>Import CSV/Excel</span>
          </Button>
          <Button variant="outline" className="flex items-center space-x-2">
            <Download size={16} />
            <span>Export Excel</span>
          </Button>
        </div>
      </div>

      {/* Controls */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium">View Period:</span>
              <div className="flex space-x-1">
                {[6, 12, 24, 60].map((months) => (
                  <Button
                    key={months}
                    size="sm"
                    variant={selectedPeriod === months ? 'default' : 'outline'}
                    onClick={() => setSelectedPeriod(months)}
                  >
                    {months}M
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Table size={16} />
              <span className="text-sm text-muted-foreground">
                {Object.keys(groupedData).length} line items
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Forecast Grid */}
      <Card>
        <CardHeader>
          <CardTitle>Financial Forecast - First 6 Months</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <div className="min-w-full">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-3 font-medium">Line Item</th>
                  {[1, 2, 3, 4, 5, 6].map((month) => (
                    <th key={month} className="text-center p-3 font-medium min-w-32">
                      Month {month}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(groupedData).map(([lineItemId, cells]) => {
                  const sortedCells = cells.sort((a, b) => a.month - b.month);
                  
                  return (
                    <tr key={lineItemId} className="border-b border-border hover:bg-accent/50">
                      <td className="p-3 font-medium">{lineItemId}</td>
                      {[1, 2, 3, 4, 5, 6].map((month) => {
                        const cell = sortedCells.find(c => c.month === month);
                        if (!cell) {
                          return <td key={month} className="p-3 text-center text-muted-foreground">-</td>;
                        }
                        
                        return (
                          <td key={month} className="p-3">
                            <div className="text-center space-y-1">
                              <div className="text-xs text-muted-foreground">Planned</div>
                              <div className="font-medium">{formatCurrency(cell.planned)}</div>
                              <div className="text-xs text-muted-foreground">Forecast</div>
                              <div className="font-medium text-blue-600">{formatCurrency(cell.forecast)}</div>
                              <div className="text-xs text-muted-foreground">Actual</div>
                              <div className="font-medium text-green-600">
                                {cell.actual > 0 ? formatCurrency(cell.actual) : '-'}
                              </div>
                              <div className="text-xs font-medium">
                                <span className={getVarianceColor(cell.variance)}>
                                  {cell.variance !== 0 && formatCurrency(cell.variance)}
                                </span>
                              </div>
                              {cell.variance_reason && (
                                <Badge variant="outline" className="text-xs">
                                  {cell.variance_reason}
                                </Badge>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mt-6">
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(
                forecastData.reduce((sum, cell) => sum + cell.planned, 0)
              )}
            </div>
            <div className="text-sm text-muted-foreground">Total Planned</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-bold text-purple-600">
              {formatCurrency(
                forecastData.reduce((sum, cell) => sum + cell.forecast, 0)
              )}
            </div>
            <div className="text-sm text-muted-foreground">Total Forecast</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(
                forecastData.reduce((sum, cell) => sum + cell.actual, 0)
              )}
            </div>
            <div className="text-sm text-muted-foreground">Total Actual</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <div className={`text-2xl font-bold ${
              forecastData.reduce((sum, cell) => sum + cell.variance, 0) >= 0 
                ? 'text-green-600' 
                : 'text-red-600'
            }`}>
              {formatCurrency(
                forecastData.reduce((sum, cell) => sum + cell.variance, 0)
              )}
            </div>
            <div className="text-sm text-muted-foreground">Net Variance</div>
          </CardContent>
        </Card>
      </div>

      {/* Insights Section */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <div className="text-lg mb-2">📊 Chart visualizations would appear here</div>
            <div className="text-sm">
              Line chart showing planned vs forecast vs actual trends, and variance waterfall
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}