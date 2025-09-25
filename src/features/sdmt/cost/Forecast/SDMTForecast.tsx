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
import { Share2, Download, TrendingUp, TrendingDown, AlertTriangle, ExternalLink, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { ChartInsightsPanel } from '@/components/ChartInsightsPanel';
import LineChartComponent from '@/components/charts/LineChart';
import { StackedColumnsChart } from '@/components/charts/StackedColumnsChart';
import ModuleBadge from '@/components/ModuleBadge';
import type { ForecastCell, LineItem } from '@/types/domain.d.ts';
import { useAuth } from '@/components/AuthProvider';
import { useProject } from '@/contexts/ProjectContext';
import { useNavigate } from 'react-router-dom';
import ApiService from '@/lib/api';
import { excelExporter, downloadExcelFile } from '@/lib/excel-export';
import { PDFExporter, formatReportCurrency, formatReportPercentage, getChangeType } from '@/lib/pdf-export';

export function SDMTForecast() {
  const [forecastData, setForecastData] = useState<ForecastCell[]>([]);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCell, setEditingCell] = useState<{ line_item_id: string; month: number; type: 'forecast' | 'actual' } | null>(null);
  const [editValue, setEditValue] = useState('');
  const { user } = useAuth();
  const { selectedProjectId, selectedPeriod, currentProject, projectChangeCount } = useProject();
  const navigate = useNavigate();

  // Load data when project or period changes
  useEffect(() => {
    if (selectedProjectId) {
      console.log('🔄 Forecast: Loading data for project:', selectedProjectId, 'change count:', projectChangeCount);
      loadForecastData();
      loadLineItems();
    }
  }, [selectedProjectId, selectedPeriod, projectChangeCount]);

  const loadForecastData = async () => {
    try {
      setLoading(true);
      console.log('📊 Loading forecast data for project:', selectedProjectId);
      console.log('🔄 Project changed! Loading new forecast data...');
      
      const data = await ApiService.getForecastData(selectedProjectId, parseInt(selectedPeriod));
      console.log('📈 Raw forecast data received:', data.length, 'records');
      console.log('📈 Sample forecast data:', data.slice(0, 2));
      
      // Get matched invoices and sync with actuals
      const invoices = await ApiService.getInvoices(selectedProjectId);
      console.log('🧾 Invoices loaded:', invoices.length, 'records');
      console.log('🧾 Sample invoice data:', invoices.slice(0, 2));
      
      const matchedInvoices = invoices.filter(inv => inv.status === 'Matched');
      
      // Update forecast data with actual amounts from matched invoices
      const updatedData = data.map(cell => {
        const matchedInvoice = matchedInvoices.find(inv => 
          inv.line_item_id === cell.line_item_id && inv.month === cell.month
        );
        
        if (matchedInvoice) {
          return {
            ...cell,
            actual: matchedInvoice.amount,
            variance: cell.forecast - cell.planned // Keep forecast-based variance
          };
        }
        
        return cell;
      });
      
      setForecastData(updatedData);
      console.log('✅ Forecast data processed and set:', updatedData.length, 'cells for project', selectedProjectId);
      console.log('💰 Total planned amount:', updatedData.reduce((sum, cell) => sum + cell.planned, 0));
      console.log('💰 Total forecast amount:', updatedData.reduce((sum, cell) => sum + cell.forecast, 0));
    } catch (error) {
      toast.error('Failed to load forecast data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadLineItems = async () => {
    try {
      console.log('📋 Loading line items for project:', selectedProjectId);
      const items = await ApiService.getLineItems(selectedProjectId);
      console.log('📋 Line items loaded:', items.length, 'items for project', selectedProjectId);
      console.log('📋 Sample line items:', items.slice(0, 2).map(item => ({ id: item.id, description: item.description, category: item.category })));
      setLineItems(items);
    } catch (error) {
      console.error('Failed to load line items:', error);
    }
  };

  const handleCellEdit = (line_item_id: string, month: number, type: 'forecast' | 'actual') => {
    const cell = forecastData.find(c => c.line_item_id === line_item_id && c.month === month);
    setEditingCell({ line_item_id, month, type });
    const currentValue = type === 'forecast' ? cell?.forecast : cell?.actual;
    setEditValue(currentValue?.toString() || '0');
  };

  const handleCellSave = () => {
    if (editingCell) {
      const updatedData = forecastData.map(cell => {
        if (cell.line_item_id === editingCell.line_item_id && cell.month === editingCell.month) {
          const newValue = parseFloat(editValue) || 0;
          const updates = editingCell.type === 'forecast' 
            ? { forecast: newValue, variance: newValue - cell.planned }
            : { actual: newValue };
          
          return {
            ...cell,
            ...updates,
            last_updated: new Date().toISOString(),
            updated_by: user?.login || 'current-user'
          };
        }
        return cell;
      });
      setForecastData(updatedData);
      setEditingCell(null);
      toast.success(`${editingCell.type === 'forecast' ? 'Forecast' : 'Actual'} updated successfully`);
    }
  };

  // Check if user can edit forecast (PMO role) or actuals (SDMT role)
  const canEditForecast = user?.current_role === 'PMO' || user?.current_role === 'SDMT';
  const canEditActual = user?.current_role === 'SDMT';

  // Function to navigate to reconciliation with filters
  const navigateToReconciliation = (line_item_id: string, month?: number) => {
    const params = new URLSearchParams();
    params.set('line_item', line_item_id);
    if (month) params.set('month', month.toString());
    navigate(`/sdmt/cost/reconciliation?${params.toString()}`);
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

    // Check if the line item has any non-zero values to show
    const hasNonZeroValues = monthlyData.some(cell => 
      cell.planned > 0 || cell.forecast > 0 || cell.actual > 0
    );

    return { 
      lineItem, 
      monthlyData,
      hasNonZeroValues
    };
  }).filter(item => item.hasNonZeroValues); // Only show items with data

  // Calculate totals and metrics
  const totalVariance = forecastData.reduce((sum, cell) => sum + cell.variance, 0);
  const totalPlanned = forecastData.reduce((sum, cell) => sum + cell.planned, 0);
  const totalForecast = forecastData.reduce((sum, cell) => sum + cell.forecast, 0);
  const totalActual = forecastData.reduce((sum, cell) => sum + cell.actual, 0);
  const variancePercentage = totalPlanned > 0 ? (totalVariance / totalPlanned) * 100 : 0;
  const actualVariance = totalActual - totalForecast;
  const actualVariancePercentage = totalForecast > 0 ? (actualVariance / totalForecast) * 100 : 0;

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

  // Format currency for grid display (full amounts, not abbreviated)
  const formatGridCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
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

  // Export functions
  const handleExcelExport = async () => {
    try {
      const exporter = excelExporter;
      const buffer = await exporter.exportForecastGrid(forecastData, lineItems);
      const filename = `forecast-data-${new Date().toISOString().split('T')[0]}.xlsx`;
      downloadExcelFile(buffer, filename);
      toast.success('Excel report exported successfully');
    } catch (error) {
      toast.error('Failed to export Excel report');
      console.error(error);
    }
  };

  const handlePDFExport = async () => {
    try {
      const reportData = {
        title: 'Cost Forecast Analysis',
        subtitle: 'Executive Summary & Variance Report',
        generated: new Date().toLocaleDateString(),
        metrics: [
          {
            label: 'Total Planned Budget',
            value: formatReportCurrency(totalPlanned),
            color: '#64748b'
          },
          {
            label: 'Current Forecast',
            value: formatReportCurrency(totalForecast),
            change: formatReportPercentage(((totalForecast - totalPlanned) / totalPlanned) * 100),
            changeType: getChangeType(totalForecast - totalPlanned),
            color: '#2BB673'
          },
          {
            label: 'Actual Expenses',
            value: formatReportCurrency(totalActual),
            change: formatReportPercentage(((totalActual - totalPlanned) / totalPlanned) * 100),
            changeType: getChangeType(totalActual - totalPlanned),
            color: '#14B8A6'
          },
          {
            label: 'Budget Variance',
            value: formatReportCurrency(Math.abs(totalVariance)),
            change: formatReportPercentage(Math.abs(variancePercentage)),
            changeType: getChangeType(-Math.abs(totalVariance)),
            color: totalVariance > 0 ? '#ef4444' : '#22c55e'
          }
        ],
        summary: [
          `Total project budget variance: ${formatReportCurrency(totalVariance)} (${variancePercentage.toFixed(1)}%)`,
          `${forecastData.filter(f => f.variance > 0).length} line items showing cost overruns`,
          `${forecastData.filter(f => f.variance < 0).length} line items under budget`,
          `Current forecast accuracy: ${(100 - Math.abs(variancePercentage)).toFixed(1)}%`
        ],
        recommendations: [
          totalVariance > 50000 ? 'Immediate budget review required for significant overruns' : 'Budget variance within acceptable range',
          'Focus on line items with highest variance impact for cost optimization',
          'Consider updating forecast models based on actual performance trends',
          'Implement enhanced tracking for high-risk cost categories'
        ]
      };

      await PDFExporter.exportToPDF(reportData);
      toast.success('Professional forecast report generated');
    } catch (error) {
      toast.error('Failed to generate PDF summary');
      console.error(error);
    }
  };

  return (
    <div className="max-w-full mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Forecast Management</h1>
          <p className="text-muted-foreground">
            Track planned vs forecast vs actual costs across time periods
            {currentProject && (
              <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                {currentProject.name} | Change #{projectChangeCount}
              </span>
            )}
          </p>
        </div>
        <ModuleBadge />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{formatCurrency(totalPlanned)}</div>
            <p className="text-sm text-muted-foreground">Total Planned</p>
            <p className="text-xs text-muted-foreground">From Planview</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{formatCurrency(totalForecast)}</div>
            <p className="text-sm text-muted-foreground">Total Forecast</p>
            <p className="text-xs text-muted-foreground">PMO Adjusted</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(totalActual)}</div>
            <p className="text-sm text-muted-foreground">Total Actual</p>
            <p className="text-xs text-muted-foreground">SDMT Tracked</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className={`text-2xl font-bold ${totalVariance >= 0 ? 'text-red-600' : 'text-green-600'}`}>
              {formatCurrency(Math.abs(totalVariance))}
            </div>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              {getVarianceIcon(totalVariance)}
              Forecast Variance
            </p>
            <p className="text-xs text-muted-foreground">{Math.abs(variancePercentage).toFixed(1)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className={`text-2xl font-bold ${actualVariance >= 0 ? 'text-red-600' : 'text-green-600'}`}>
              {formatCurrency(Math.abs(actualVariance))}
            </div>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              {getVarianceIcon(actualVariance)}
              Actual Variance
            </p>
            <p className="text-xs text-muted-foreground">{Math.abs(actualVariancePercentage).toFixed(1)}%</p>
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
                  <Share2 size={16} />
                  Share
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Share Forecast Data</DialogTitle>
                  <DialogDescription>
                    Export and share forecast data in multiple formats for stakeholders and reporting.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Button 
                      variant="outline" 
                      className="h-20 flex flex-col gap-2"
                      onClick={handleExcelExport}
                    >
                      <FileSpreadsheet size={24} />
                      <span>Excel Report</span>
                      <span className="text-xs text-muted-foreground">Detailed forecast with formulas</span>
                    </Button>
                    <Button 
                      variant="outline" 
                      className="h-20 flex flex-col gap-2"
                      onClick={handlePDFExport}
                    >
                      <Share2 size={24} />
                      <span>PDF Summary</span>
                      <span className="text-xs text-muted-foreground">Executive summary format</span>
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
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
              <div className="text-center space-y-3">
                <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center mx-auto mb-2 animate-pulse">
                  <span className="text-primary font-bold text-sm">📊</span>
                </div>
                <div className="text-muted-foreground">
                  Loading forecast data{currentProject ? ` for ${currentProject.name}` : ''}...
                </div>
                <div className="text-xs text-muted-foreground">
                  Project Change #{projectChangeCount}
                </div>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background min-w-[300px]">Line Item</TableHead>
                    {Array.from({ length: 12 }, (_, i) => (
                      <TableHead key={i + 1} className="text-center min-w-[140px]">
                        M{i + 1}
                        <div className="text-xs font-normal text-muted-foreground mt-1">
                          P / F / A
                        </div>
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
                      {monthlyData.map(cell => (
                        <TableCell key={cell.month} className="p-2">
                          <div className="space-y-2 text-xs">
                            {/* Planned (Read-only) - only show if > 0 */}
                            {cell.planned > 0 && (
                              <div className="text-muted-foreground bg-muted/20 px-2 py-1 rounded">
                                P: {formatGridCurrency(cell.planned)}
                              </div>
                            )}
                            
                            {/* Forecast (Editable by PMO/SDMT) - only show if > 0 or planned > 0 */}
                            {(cell.forecast > 0 || cell.planned > 0) && (
                              <div>
                                {editingCell?.line_item_id === cell.line_item_id && 
                                 editingCell?.month === cell.month && 
                                 editingCell?.type === 'forecast' ? (
                                  <Input
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={handleCellSave}
                                    onKeyDown={(e) => e.key === 'Enter' && handleCellSave()}
                                    className="h-7 text-xs"
                                    autoFocus
                                  />
                                ) : (
                                  <div
                                    className={`px-2 py-1 rounded transition-colors ${
                                      canEditForecast 
                                        ? 'cursor-pointer hover:bg-primary/10 bg-primary/5 text-primary font-medium'
                                        : 'cursor-default bg-muted/10 text-muted-foreground'
                                    }`}
                                    onClick={() => canEditForecast && handleCellEdit(cell.line_item_id, cell.month, 'forecast')}
                                    title={canEditForecast ? 'Click to edit forecast' : 'No permission to edit forecast'}
                                  >
                                    F: {formatGridCurrency(cell.forecast)}
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {/* Actual (Editable by SDMT only) - only show if > 0 or there's forecast/planned */}
                            {(cell.actual > 0 || cell.forecast > 0 || cell.planned > 0) && (
                              <div>
                                {editingCell?.line_item_id === cell.line_item_id && 
                                 editingCell?.month === cell.month && 
                                 editingCell?.type === 'actual' ? (
                                  <Input
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={handleCellSave}
                                    onKeyDown={(e) => e.key === 'Enter' && handleCellSave()}
                                    className="h-7 text-xs"
                                    autoFocus
                                  />
                                ) : (
                                  <div className="flex items-center gap-1">
                                    <div
                                      className={`px-2 py-1 rounded flex-1 transition-colors ${
                                        canEditActual 
                                          ? 'cursor-pointer hover:bg-blue-50 bg-blue-50/50 text-blue-700 font-medium'
                                          : 'cursor-default bg-muted/10 text-muted-foreground'
                                      }`}
                                      onClick={() => canEditActual && handleCellEdit(cell.line_item_id, cell.month, 'actual')}
                                      title={canEditActual ? 'Click to edit actual' : 'No permission to edit actuals'}
                                    >
                                      A: {formatGridCurrency(cell.actual)}
                                    </div>
                                    {cell.actual > 0 && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-5 w-5 p-0 hover:bg-blue-100"
                                        onClick={() => navigateToReconciliation(cell.line_item_id, cell.month)}
                                        title="View related invoices"
                                      >
                                        <ExternalLink size={12} />
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {/* Variance Indicator */}
                            {cell.variance !== 0 && (
                              <div className={`px-2 py-1 rounded text-xs font-medium text-center ${getVarianceColor(cell.variance)}`}>
                                {cell.variance > 0 ? '+' : ''}{formatGridCurrency(cell.variance)}
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
        onExport={handleExcelExport}
      />
    </div>
  );
}

export default SDMTForecast;