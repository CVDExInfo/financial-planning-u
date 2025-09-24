import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Upload, Download, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { ChartInsightsPanel } from '@/components/ChartInsightsPanel';
import LineChartComponent from '@/components/charts/LineChart';
import { StackedColumnsChart } from '@/components/charts/StackedColumnsChart';
import type { ForecastCell, LineItem } from '@/types/domain';
import ApiService from '@/lib/api';

export function SDMTForecast() {
  const [forecastData, setForecastData] = useState<ForecastCell[]>([]);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCell, setEditingCell] = useState<{ line_item_id: string; month: number } | null>(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    loadForecastData();
    loadLineItems();
  }, []);

  const loadForecastData = async () => {
    try {
      setLoading(true);
      const data = await ApiService.getForecastData('current-project', 12);
      setForecastData(data);
    } catch (error) {
      toast.error('Failed to load forecast data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadLineItems = async () => {
    try {
      const items = await ApiService.getLineItems('current-project');
      setLineItems(items);
    } catch (error) {
      console.error('Failed to load line items:', error);
    }
  };

  const handleCellEdit = (line_item_id: string, month: number) => {
    const cell = forecastData.find(c => c.line_item_id === line_item_id && c.month === month);
    setEditingCell({ line_item_id, month });
    setEditValue(cell?.forecast?.toString() || '0');
  };

  const handleCellSave = () => {
    if (editingCell) {
      const updatedData = forecastData.map(cell => {
        if (cell.line_item_id === editingCell.line_item_id && cell.month === editingCell.month) {
          const newForecast = parseFloat(editValue) || 0;
          return {
            ...cell,
            forecast: newForecast,
            variance: newForecast - cell.planned,
            last_updated: new Date().toISOString(),
            updated_by: 'current-user'
          };
        }
        return cell;
      });
      setForecastData(updatedData);
      setEditingCell(null);
      toast.success('Forecast updated successfully');
    }
  };

  // Group forecast data by line item and month for display
  const forecastGrid = lineItems.map(lineItem => {
    const itemForecasts = forecastData.filter(f => f.line_item_id === lineItem.id);
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    
    const monthlyData = months.map(month => {
      const cell = itemForecasts.find(f => f.month === month);
      return cell || {
        line_item_id: lineItem.id,
        month,
        planned: 0,
        forecast: 0,
        actual: 0,
        variance: 0,
        last_updated: '',
        updated_by: ''
      };
    });

    return { lineItem, monthlyData };
  });

  // Calculate totals and metrics
  const totalVariance = forecastData.reduce((sum, cell) => sum + cell.variance, 0);
  const totalPlanned = forecastData.reduce((sum, cell) => sum + cell.planned, 0);
  const totalForecast = forecastData.reduce((sum, cell) => sum + cell.forecast, 0);
  const variancePercentage = totalPlanned > 0 ? (totalVariance / totalPlanned) * 100 : 0;

  // Chart data
  const monthlyTrends = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const monthData = forecastData.filter(cell => cell.month === month);
    return {
      month,
      Planned: monthData.reduce((sum, cell) => sum + cell.planned, 0),
      Forecast: monthData.reduce((sum, cell) => sum + cell.forecast, 0),
      Actual: monthData.reduce((sum, cell) => sum + cell.actual, 0)
    };
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getVarianceColor = (variance: number) => {
    if (variance > 0) return 'text-red-600 bg-red-50';
    if (variance < 0) return 'text-green-600 bg-green-50';
    return 'text-muted-foreground bg-muted';
  };

  const getVarianceIcon = (variance: number) => {
    if (variance > 0) return <TrendingUp size={14} className="text-red-600" />;
    if (variance < 0) return <TrendingDown size={14} className="text-green-600" />;
    return null;
  };

  return (
    <div className="max-w-full mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Forecast Management</h1>
          <p className="text-muted-foreground">Track planned vs forecast vs actual costs across time periods</p>
        </div>
        <Badge className="module-badge-sdmt">SDMT Module</Badge>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{formatCurrency(totalPlanned)}</div>
            <p className="text-sm text-muted-foreground">Total Planned</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{formatCurrency(totalForecast)}</div>
            <p className="text-sm text-muted-foreground">Total Forecast</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className={`text-2xl font-bold ${totalVariance >= 0 ? 'text-red-600' : 'text-green-600'}`}>
              {formatCurrency(Math.abs(totalVariance))}
            </div>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              {getVarianceIcon(totalVariance)}
              Total Variance
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className={`text-2xl font-bold ${variancePercentage >= 0 ? 'text-red-600' : 'text-green-600'}`}>
              {Math.abs(variancePercentage).toFixed(1)}%
            </div>
            <p className="text-sm text-muted-foreground">Variance %</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <Card>
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <Dialog>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Upload size={16} />
                  Import Forecast
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Import Forecast Data</DialogTitle>
                  <DialogDescription>
                    Upload CSV or Excel file with forecast data. The file should contain columns for 
                    line_item_id, month, and forecast values.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-6">
                  <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                    <Upload size={48} className="mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground mb-4">
                      Drag and drop your file here, or click to browse
                    </p>
                    <Button variant="outline">Choose File</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Button variant="outline" className="gap-2">
              <Download size={16} />
              Export Forecast
            </Button>
          </div>
          <div className="text-sm text-muted-foreground">
            Last updated: {new Date().toLocaleDateString()}
          </div>
        </CardContent>
      </Card>

      {/* Forecast Grid */}
      <Card>
        <CardHeader>
          <CardTitle>12-Month Forecast Grid</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-muted-foreground">Loading forecast data...</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background min-w-[250px]">Line Item</TableHead>
                    <TableHead className="text-center">Type</TableHead>
                    {Array.from({ length: 12 }, (_, i) => (
                      <TableHead key={i + 1} className="text-center min-w-[120px]">
                        M{i + 1}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {forecastGrid.map(({ lineItem, monthlyData }) => (
                    <TableRow key={lineItem.id}>
                      <TableCell className="sticky left-0 bg-background">
                        <div>
                          <div className="font-medium">{lineItem.description}</div>
                          <div className="text-sm text-muted-foreground">{lineItem.category}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-xs">
                          P/F/A
                        </Badge>
                      </TableCell>
                      {monthlyData.map(cell => (
                        <TableCell key={cell.month} className="p-1">
                          <div className="space-y-1 text-xs">
                            <div className="text-muted-foreground">
                              P: ${(cell.planned / 1000).toFixed(0)}k
                            </div>
                            <div>
                              {editingCell?.line_item_id === cell.line_item_id && 
                               editingCell?.month === cell.month ? (
                                <Input
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onBlur={handleCellSave}
                                  onKeyDown={(e) => e.key === 'Enter' && handleCellSave()}
                                  className="h-6 text-xs"
                                  autoFocus
                                />
                              ) : (
                                <div
                                  className="cursor-pointer hover:bg-muted rounded p-1"
                                  onClick={() => handleCellEdit(cell.line_item_id, cell.month)}
                                >
                                  F: ${(cell.forecast / 1000).toFixed(0)}k
                                </div>
                              )}
                            </div>
                            <div className="text-muted-foreground">
                              A: ${(cell.actual / 1000).toFixed(0)}k
                            </div>
                            {cell.variance !== 0 && (
                              <div className={`px-1 rounded text-xs ${getVarianceColor(cell.variance)}`}>
                                {cell.variance > 0 ? '+' : ''}${(cell.variance / 1000).toFixed(0)}k
                              </div>
                            )}
                          </div>
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Charts and Analytics */}
      <ChartInsightsPanel
        title="Forecast Analytics & Trends"
        charts={[
          <LineChartComponent
            key="forecast-trends"
            data={monthlyTrends}
            lines={[
              { dataKey: 'Planned', name: 'Planned', color: 'oklch(0.45 0.12 200)', strokeDasharray: '5 5' },
              { dataKey: 'Forecast', name: 'Forecast', color: 'oklch(0.61 0.15 160)', strokeWidth: 3 },
              { dataKey: 'Actual', name: 'Actual', color: 'oklch(0.72 0.15 65)' }
            ]}
            title="Monthly Forecast Trends"
          />,
          <StackedColumnsChart
            key="variance-analysis"
            data={monthlyTrends.map(month => ({
              month: month.month,
              'Over Budget': Math.max(0, month.Forecast - month.Planned),
              'Under Budget': Math.min(0, month.Forecast - month.Planned)
            }))}
            stacks={[
              { dataKey: 'Over Budget', name: 'Over Budget', color: 'oklch(0.65 0.2 30)' },
              { dataKey: 'Under Budget', name: 'Under Budget', color: 'oklch(0.55 0.15 140)' }
            ]}
            title="Variance Analysis"
          />
        ]}
        insights={[
          {
            title: "Forecast Accuracy",
            value: `${(100 - Math.abs(variancePercentage)).toFixed(1)}%`,
            type: variancePercentage < 5 ? 'positive' : variancePercentage > 15 ? 'negative' : 'neutral'
          },
          {
            title: "Largest Variance",
            value: formatCurrency(Math.max(...forecastData.map(c => Math.abs(c.variance)))),
            type: 'neutral'
          },
          {
            title: "Forecast vs Planned",
            value: totalForecast > totalPlanned ? 'Over Budget' : totalForecast < totalPlanned ? 'Under Budget' : 'On Target',
            type: totalForecast > totalPlanned ? 'negative' : totalForecast < totalPlanned ? 'positive' : 'neutral'
          }
        ]}
        onExport={() => toast.success('Forecast data exported successfully')}
      />
    </div>
  );
}

export default SDMTForecast;