import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Upload, Download, Table } from '@phosphor-icons/react';
import ApiService from '@/lib/api';
import type { ForecastCell, LineItem } from '@/types/domain';
import { ImportWizard } from '@/components/ImportWizard';
import { ChartInsightsPanel } from '@/components/ChartInsightsPanel';
import { excelExporter, downloadExcelFile } from '@/lib/excel-export';
import { toast } from 'sonner';

export function ForecastGrid() {
  const [selectedPeriod, setSelectedPeriod] = useState(12);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);

  const { data: forecastData = [], isLoading } = useQuery({
    queryKey: ['forecast', 'PRJ-IKUSI-PLATFORM'],
    queryFn: () => ApiService.getForecast('PRJ-IKUSI-PLATFORM'),
  });

  const { data: lineItems = [] } = useQuery({
    queryKey: ['lineItems', 'PRJ-IKUSI-PLATFORM'],
    queryFn: () => ApiService.getLineItems('PRJ-IKUSI-PLATFORM'),
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

  const handleImportComplete = (data: any[], report: any) => {
    toast.success(`Successfully imported ${data.length} forecast records`);
    setIsImportDialogOpen(false);
    // In a real app, you'd refresh the data or update the state
  };

  const handleExcelExport = async () => {
    try {
      const buffer = await excelExporter.exportForecastGrid(forecastData, lineItems);
      downloadExcelFile(buffer, `Forecast_Grid_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Forecast grid exported successfully');
    } catch (error) {
      toast.error('Failed to export forecast grid');
    }
  };

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
          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex items-center space-x-2">
                <Upload size={16} />
                <span>Import CSV/Excel</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Import Forecast Data</DialogTitle>
                <DialogDescription>
                  Upload CSV or Excel files with forecast data using our advanced import wizard
                </DialogDescription>
              </DialogHeader>
              <ImportWizard
                onImportComplete={handleImportComplete}
                targetSchema="forecast"
              />
            </DialogContent>
          </Dialog>
          <Button variant="outline" className="flex items-center space-x-2" onClick={handleExcelExport}>
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

      {/* Enhanced Insights Section with Interactive Charts */}
      <ChartInsightsPanel
        lineItems={lineItems}
        forecastData={forecastData}
        mode="forecast"
        className="mt-6"
      />
    </div>
  );
}