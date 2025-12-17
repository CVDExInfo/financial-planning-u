import { useState, useEffect, useMemo } from 'react';
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
import LoadingSpinner from '@/components/LoadingSpinner';
import type { ForecastCell, LineItem } from '@/types/domain';
import { useAuth } from '@/hooks/useAuth';
import { ALL_PROJECTS_ID, useProject } from '@/contexts/ProjectContext';
import { handleFinanzasApiError } from '@/features/sdmt/cost/utils/errorHandling';
import { useNavigate, useLocation } from 'react-router-dom';
import { excelExporter, downloadExcelFile } from '@/lib/excel-export';
import { PDFExporter, formatReportCurrency, formatReportPercentage, getChangeType } from '@/lib/pdf-export';
import { normalizeForecastCells } from '@/features/sdmt/cost/utils/dataAdapters';
import { useProjectLineItems } from '@/hooks/useProjectLineItems';
import { bulkUploadPayrollActuals, type PayrollActualInput, getProjectRubros } from '@/api/finanzas';
import { getForecastPayload, getProjectInvoices } from './forecastService';
import { ES_TEXTS } from '@/lib/i18n/es';
import { BaselineStatusPanel } from '@/components/baseline/BaselineStatusPanel';

type ForecastRow = ForecastCell & { projectId?: string; projectName?: string };
type ProjectLineItem = LineItem & { projectId?: string; projectName?: string };

export function SDMTForecast() {
  const [forecastData, setForecastData] = useState<ForecastRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [forecastError, setForecastError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null);
  const [editingCell, setEditingCell] = useState<{ line_item_id: string; month: number; type: 'forecast' | 'actual' } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [dataSource, setDataSource] = useState<'api' | 'mock'>('api');
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [portfolioLineItems, setPortfolioLineItems] = useState<ProjectLineItem[]>([]);
  const [dirtyActuals, setDirtyActuals] = useState<Record<string, ForecastRow>>({});
  const [savingActuals, setSavingActuals] = useState(false);
  const { user, login } = useAuth();
  const { selectedProjectId, selectedPeriod, currentProject, projectChangeCount, projects } = useProject();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    lineItems,
    isLoading: isLineItemsLoading,
    error: lineItemsError,
  } = useProjectLineItems();
  const safeLineItems = useMemo(
    () => (Array.isArray(lineItems) ? lineItems : []),
    [lineItems]
  );
  const isPortfolioView = selectedProjectId === ALL_PROJECTS_ID;
  const lineItemsForGrid = isPortfolioView ? portfolioLineItems : safeLineItems;

  // Load data when project or period changes
  useEffect(() => {
    if (selectedProjectId) {
      console.log('🔄 Forecast: Loading data for project:', selectedProjectId, 'change count:', projectChangeCount, 'baseline:', currentProject?.baselineId);
      // Reset state before loading new data
      setForecastData([]);
      setPortfolioLineItems([]);
      loadForecastData();
    }
  }, [selectedProjectId, selectedPeriod, projectChangeCount, currentProject?.baselineId]);

  // Reload data when returning from reconciliation with refresh parameter
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const refreshParam = urlParams.get('_refresh');
    if (refreshParam && selectedProjectId) {
      console.log('🔄 Forecast: Refreshing after reconciliation');
      loadForecastData();
    }
  }, [location.search]);

  useEffect(() => {
    if (!lineItemsError) return;

    const message = handleFinanzasApiError(lineItemsError, {
      onAuthError: login,
      fallback: 'No se pudieron cargar los rubros para forecast.',
    });
    setForecastError((prev) => prev || message);
  }, [lineItemsError, login]);

  const loadForecastData = async () => {
    if (!selectedProjectId) {
      console.log('❌ No project selected, skipping forecast load');
      return;
    }

    try {
      setLoading(true);
      setForecastError(null);
      setDirtyActuals({});
      const months = parseInt(selectedPeriod);
      if (import.meta.env.DEV) {
        console.debug('[Forecast] Loading data', { projectId: selectedProjectId, months });
      }

      if (isPortfolioView) {
        await loadPortfolioForecast(months);
      } else {
        await loadSingleProjectForecast(selectedProjectId, months);
      }
    } catch (error) {
      console.error('❌ Failed to load forecast data for project:', selectedProjectId, error);
      const message = handleFinanzasApiError(error, {
        onAuthError: login,
        fallback: 'No se pudo cargar el forecast.',
      });
      setForecastError(message);
      setForecastData([]); // Clear data on error
    } finally {
      setLoading(false);
    }
  };

  const loadSingleProjectForecast = async (projectId: string, months: number) => {
    const payload = await getForecastPayload(projectId, months);
    const normalized = normalizeForecastCells(payload.data);
    setDataSource(payload.source);
    setGeneratedAt(payload.generatedAt);
    setPortfolioLineItems([]);

    // Get matched invoices and sync with actuals
    const invoices = await getProjectInvoices(projectId);
    const matchedInvoices = invoices.filter(inv => inv.status === 'Matched');

    const updatedData: ForecastRow[] = normalized.map(cell => {
      const matchedInvoice = matchedInvoices.find(inv =>
        inv.line_item_id === cell.line_item_id && inv.month === cell.month
      );

      const withActuals = matchedInvoice
        ? {
            ...cell,
            actual: matchedInvoice.amount || 0,
            variance: cell.forecast - cell.planned // Keep forecast-based variance
          }
        : cell;

      return {
        ...withActuals,
        projectId,
        projectName: currentProject?.name,
      };
    });

    if (import.meta.env.DEV) {
      console.debug('[Forecast] data pipeline', {
        projectId,
        rawCells: Array.isArray(payload.data) ? payload.data.length : 0,
        normalizedCells: normalized.length,
        invoices: invoices.length,
        matchedInvoices: matchedInvoices.length,
        lineItems: safeLineItems.length,
        generatedAt: payload.generatedAt,
      });
    }

    setForecastData(updatedData);

    if (import.meta.env.DEV) {
      console.debug('[Forecast] Data loaded', {
        projectId,
        source: payload.source,
        records: updatedData.length,
      });
    }
  };

  const loadPortfolioForecast = async (months: number) => {
    const candidateProjects = projects.filter(project => project.id && project.id !== ALL_PROJECTS_ID);

    if (candidateProjects.length === 0) {
      setForecastError('No hay proyectos disponibles para consolidar.');
      setForecastData([]);
      return;
    }

    const portfolioResults = await Promise.all(
      candidateProjects.map(async project => {
        const [payload, invoices, projectLineItems] = await Promise.all([
          getForecastPayload(project.id, months),
          getProjectInvoices(project.id),
          getProjectRubros(project.id).catch(() => [] as LineItem[]),
        ]);

        const normalized = normalizeForecastCells(payload.data);
        const matchedInvoices = invoices.filter(inv => inv.status === 'Matched');

        const projectData: ForecastRow[] = normalized.map(cell => {
          const matchedInvoice = matchedInvoices.find(inv =>
            inv.line_item_id === cell.line_item_id && inv.month === cell.month
          );

          const withActuals = matchedInvoice
            ? { ...cell, actual: matchedInvoice.amount || 0, variance: cell.forecast - cell.planned }
            : cell;

          return {
            ...withActuals,
            projectId: project.id,
            projectName: project.name,
          };
        });

        return {
          project,
          data: projectData,
          lineItems: projectLineItems.map(item => ({ ...item, projectId: project.id, projectName: project.name })),
          generatedAt: payload.generatedAt,
        };
      })
    );

    const aggregatedData = portfolioResults.flatMap(result => result.data);
    const aggregatedLineItems = portfolioResults.flatMap(result => result.lineItems);
    const firstGeneratedAt = portfolioResults.find(result => result.generatedAt)?.generatedAt;

    setDataSource('api');
    setGeneratedAt(firstGeneratedAt || new Date().toISOString());
    setPortfolioLineItems(aggregatedLineItems);
    setForecastData(aggregatedData);

    if (import.meta.env.DEV) {
      console.debug('[Forecast] Portfolio data loaded', {
        projects: candidateProjects.length,
        records: aggregatedData.length,
        lineItems: aggregatedLineItems.length,
      });
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
      let pendingChange: ForecastRow | null = null;
      const updatedData = forecastData.map(cell => {
        if (cell.line_item_id === editingCell.line_item_id && cell.month === editingCell.month) {
          const newValue = parseFloat(editValue) || 0;
          const updates = editingCell.type === 'forecast'
            ? { forecast: newValue, variance: newValue - cell.planned }
            : { actual: newValue };

          const nextCell: ForecastRow = {
            ...cell,
            ...updates,
            last_updated: new Date().toISOString(),
            updated_by: user?.login || 'current-user'
          };
          if (editingCell.type === 'actual') {
            pendingChange = nextCell;
          }
          return nextCell;
        }
        return cell;
      });
      setForecastData(updatedData);
      if (pendingChange) {
        const changeKey = `${pendingChange.projectId || selectedProjectId}-${pendingChange.line_item_id}-${pendingChange.month}`;
        setDirtyActuals(prev => ({ ...prev, [changeKey]: pendingChange as ForecastRow }));
      }
      setEditingCell(null);
      toast.success(`${editingCell.type === 'forecast' ? 'Pronóstico' : 'Real'} actualizado correctamente`);
    }
  };

  const handlePersistActuals = async () => {
    const entries = Object.values(dirtyActuals);
    if (entries.length === 0) {
      toast.info('No hay cambios de valores reales para guardar');
      return;
    }

    setSavingActuals(true);
    try {
      const currentYear = new Date().getFullYear();
      const payload: PayrollActualInput[] = entries
        .map(cell => {
          const projectId = cell.projectId || selectedProjectId;
          const matchedLineItem = lineItemsForGrid.find(item =>
            item.id === cell.line_item_id && (!item.projectId || item.projectId === projectId)
          );
          const monthKey = `${currentYear}-${String(cell.month).padStart(2, '0')}`;

          if (!projectId) return null;

          return {
            projectId,
            month: monthKey,
            rubroId: cell.line_item_id,
            amount: Number(cell.actual) || 0,
            currency: matchedLineItem?.currency || 'USD',
            resourceCount: matchedLineItem?.qty ? Number(matchedLineItem.qty) : undefined,
            notes: cell.notes,
            uploadedBy: user?.email || user?.login,
            source: 'sdmt-forecast',
          } satisfies PayrollActualInput;
        })
        .filter((row): row is PayrollActualInput => Boolean(row));

      if (payload.length === 0) {
        toast.error('No pudimos construir los datos para guardar en nómina.');
        return;
      }

      await bulkUploadPayrollActuals(payload);
      toast.success('Valores reales enviados a Nómina (DynamoDB)');
      setDirtyActuals({});
    } catch (error) {
      console.error('❌ Error al guardar valores reales', error);
      const message = handleFinanzasApiError(error, {
        onAuthError: login,
        fallback: 'No pudimos guardar los valores reales.',
      });
      setForecastError(prev => prev || message);
    } finally {
      setSavingActuals(false);
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
    
    // Add returnUrl so user can navigate back to Forecast
    const currentPath = location.pathname + location.search;
    params.set('returnUrl', currentPath);
    
    navigate(`/sdmt/cost/reconciliation?${params.toString()}`);
  };

  // Group forecast data by line item and month for display
  const forecastGrid = useMemo(() => {
    const grid = lineItemsForGrid.map(lineItem => {
      const itemForecasts = forecastData.filter(f =>
        f.line_item_id === lineItem.id && (!lineItem.projectId || f.projectId === lineItem.projectId)
      );
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
          updated_by: '',
          projectId: lineItem.projectId,
          projectName: lineItem.projectName,
        };
      });

      // Check if the line item has any non-zero values to show
      const hasNonZeroValues = monthlyData.some(cell => 
        (cell.planned || 0) > 0 || (cell.forecast || 0) > 0 || (cell.actual || 0) > 0
      );

      return { 
        lineItem, 
        monthlyData,
        hasNonZeroValues
      };
    }).filter(item => item.hasNonZeroValues); // Only show items with data

    if (import.meta.env.DEV && grid.length > 0) {
      console.debug('[Forecast] Grid recalculated', { projectId: selectedProjectId, rows: grid.length });
    }

    return grid;
  }, [lineItemsForGrid, forecastData, selectedProjectId]);

  const totalFTE = useMemo(() => {
    return lineItemsForGrid.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
  }, [lineItemsForGrid]);

  // Calculate totals and metrics - using useMemo to ensure it updates when data changes
  const metrics = useMemo(() => {
    const totalPlanned = forecastData.reduce((sum, cell) => sum + (cell.planned || 0), 0);
    const totalForecast = forecastData.reduce((sum, cell) => sum + (cell.forecast || 0), 0);
    const totalActual = forecastData.reduce((sum, cell) => sum + (cell.actual || 0), 0);
    
    // SDMT ALIGNMENT FIX: Calculate variances at aggregate level, not sum of cell variances
    // Variación de Pronóstico = difference between total forecast and total planned
    const totalVariance = totalForecast - totalPlanned;
    const variancePercentage = totalPlanned > 0 ? (totalVariance / totalPlanned) * 100 : 0;
    
    // Variación Real = difference between actual and planned (not actual vs forecast)
    // This represents how much actual costs deviate from the original plan/baseline.
    // Previously calculated as (actual - forecast), but business requirement per screenshots
    // shows this should be (actual - planned) to measure variance from baseline budget.
    const actualVariance = totalActual - totalPlanned;
    const actualVariancePercentage = totalPlanned > 0 ? (actualVariance / totalPlanned) * 100 : 0;

    if (import.meta.env.DEV && forecastData.length > 0) {
      console.debug('[Forecast] Metrics recalculated', {
        projectId: selectedProjectId,
        totalPlanned,
        totalForecast,
        totalActual,
        totalVariance,
        actualVariance,
      });
    }

    return {
      totalVariance,
      totalPlanned,
      totalForecast,
      totalActual,
      variancePercentage,
      actualVariance,
      actualVariancePercentage
    };
  }, [forecastData, selectedProjectId]);

  const {
    totalVariance,
    totalPlanned,
    totalForecast,
    totalActual,
    variancePercentage,
    actualVariance,
    actualVariancePercentage
  } = metrics;
  const dirtyActualCount = useMemo(() => Object.keys(dirtyActuals).length, [dirtyActuals]);

  const isLoadingState = loading || isLineItemsLoading;
  const hasGridData = forecastGrid.length > 0;
  const isEmptyState = !isLoadingState && !forecastError && forecastData.length === 0;

  // Chart data - recalculate when forecastData changes
  const monthlyTrends = useMemo(() => {
    const trends = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const monthData = forecastData.filter(cell => cell.month === month);
      return {
        month,
        Planned: monthData.reduce((sum, cell) => sum + (cell.planned || 0), 0),
        Forecast: monthData.reduce((sum, cell) => sum + (cell.forecast || 0), 0),
        Actual: monthData.reduce((sum, cell) => sum + (cell.actual || 0), 0)
      };
    });

    if (import.meta.env.DEV && forecastData.length > 0) {
      console.debug('[Forecast] Chart trends recalculated', { projectId: selectedProjectId });
    }
    
    return trends;
  }, [forecastData, selectedProjectId]);

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
    if (exporting) return;
    
    try {
      setExporting('excel');
      const exporter = excelExporter;
      const buffer = await exporter.exportForecastGrid(forecastData, lineItemsForGrid);
      const filename = `forecast-data-${new Date().toISOString().split('T')[0]}.xlsx`;
      downloadExcelFile(buffer, filename);
      toast.success('Reporte Excel exportado exitosamente');
    } catch (error) {
      toast.error('Error al exportar reporte Excel');
      console.error(error);
    } finally {
      setExporting(null);
    }
  };

  const handlePDFExport = async () => {
    if (exporting) return;
    
    try {
      setExporting('pdf');
      const reportData = {
        title: 'Análisis de Pronóstico de Costos',
        subtitle: 'Resumen Ejecutivo y Reporte de Variaciones',
        generated: new Date().toLocaleDateString(),
        metrics: [
          {
            label: 'Presupuesto Planeado Total',
            value: formatReportCurrency(totalPlanned),
            color: '#64748b'
          },
          {
            label: 'Pronóstico Actual',
            value: formatReportCurrency(totalForecast),
            change: formatReportPercentage(((totalForecast - totalPlanned) / totalPlanned) * 100),
            changeType: getChangeType(totalForecast - totalPlanned),
            color: '#2BB673'
          },
          {
            label: 'Gastos Reales',
            value: formatReportCurrency(totalActual),
            change: formatReportPercentage(((totalActual - totalPlanned) / totalPlanned) * 100),
            changeType: getChangeType(totalActual - totalPlanned),
            color: '#14B8A6'
          },
          {
            label: 'Variación de Presupuesto',
            value: formatReportCurrency(Math.abs(totalVariance)),
            change: formatReportPercentage(Math.abs(variancePercentage)),
            changeType: getChangeType(-Math.abs(totalVariance)),
            color: totalVariance > 0 ? '#ef4444' : '#22c55e'
          }
        ],
        summary: [
          `Variación total del presupuesto del proyecto: ${formatReportCurrency(totalVariance)} (${variancePercentage.toFixed(1)}%)`,
          `${forecastData.filter(f => f.variance > 0).length} rubros mostrando sobrecostos`,
          `${forecastData.filter(f => f.variance < 0).length} rubros bajo presupuesto`,
          `Precisión actual del pronóstico: ${(100 - Math.abs(variancePercentage)).toFixed(1)}%`
        ],
        recommendations: [
          totalVariance > 50000 ? 'Se requiere revisión inmediata del presupuesto por sobrecostos significativos' : 'Variación de presupuesto dentro del rango aceptable',
          'Enfocar en rubros con mayor impacto de variación para optimización de costos',
          'Considerar actualizar modelos de pronóstico basados en tendencias de desempeño real',
          'Implementar seguimiento mejorado para categorías de costo de alto riesgo'
        ]
      };

      await PDFExporter.exportToPDF(reportData);
      toast.success('Reporte profesional de pronóstico generado');
    } catch (error) {
      toast.error('Error al generar resumen PDF');
      console.error(error);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="max-w-full mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{ES_TEXTS.forecast.title}</h1>
          <p className="text-muted-foreground">
            {ES_TEXTS.forecast.description}
            {currentProject && (
              <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                {currentProject.name} | Change #{projectChangeCount}
              </span>
            )}
          </p>
          {/* Debug info */}
          <div className="mt-2 text-xs text-muted-foreground space-x-4">
            <span>Project: {selectedProjectId}</span>
            <span>Data points: {forecastData.length}</span>
            <span>Line items: {lineItemsForGrid.length}</span>
            <span>Grid rows: {forecastGrid.length}</span>
            <Badge variant={dataSource === 'mock' ? 'outline' : 'secondary'}>
              {dataSource === 'mock' ? 'Datos de prueba' : 'Datos de API'}
            </Badge>
            {generatedAt && (
              <span>Last updated: {new Date(generatedAt).toLocaleString()}</span>
            )}
          </div>
        </div>
        <ModuleBadge />
      </div>

      {/* Baseline Status Panel */}
      <BaselineStatusPanel />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{formatCurrency(totalPlanned)}</div>
            <p className="text-sm text-muted-foreground">Total Planeado</p>
            <p className="text-xs text-muted-foreground">De Planview</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{formatCurrency(totalForecast)}</div>
            <p className="text-sm text-muted-foreground">Pronóstico Total</p>
            <p className="text-xs text-muted-foreground">Ajustado PMO</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(totalActual)}</div>
            <p className="text-sm text-muted-foreground">Total Real</p>
            <p className="text-xs text-muted-foreground">Seguimiento SDMT</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{totalFTE.toLocaleString()}</div>
            <p className="text-sm text-muted-foreground">Total FTE</p>
            <p className="text-xs text-muted-foreground">Basado en rubros de baseline</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className={`text-2xl font-bold ${totalVariance >= 0 ? 'text-red-600' : 'text-green-600'}`}>
              {formatCurrency(Math.abs(totalVariance))}
            </div>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              {getVarianceIcon(totalVariance)}
              Variación de Pronóstico
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
              Variación Real
            </p>
            <p className="text-xs text-muted-foreground">{Math.abs(actualVariancePercentage).toFixed(1)}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <Card>
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <Button
              onClick={handlePersistActuals}
              disabled={savingActuals || dirtyActualCount === 0}
              className="gap-2"
            >
              {savingActuals ? <LoadingSpinner size="sm" /> : null}
              Guardar
              <Badge variant="secondary" className="ml-2">
                {dirtyActualCount} pendientes
              </Badge>
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Share2 size={16} />
                  Share
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Compartir Datos de Pronóstico</DialogTitle>
                  <DialogDescription>
                    Exportar y compartir datos de pronóstico en múltiples formatos para interesados y reportes.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Button 
                      variant="outline" 
                      className="h-20 flex flex-col gap-2"
                      onClick={handleExcelExport}
                      disabled={exporting !== null}
                    >
                      {exporting === 'excel' ? (
                        <LoadingSpinner size="sm" />
                      ) : (
                        <FileSpreadsheet size={24} />
                      )}
                      <span>Reporte Excel</span>
                      <span className="text-xs text-muted-foreground">
                        {exporting === 'excel' ? 'Generando...' : 'Pronóstico detallado con fórmulas'}
                      </span>
                    </Button>
                    <Button 
                      variant="outline" 
                      className="h-20 flex flex-col gap-2"
                      onClick={handlePDFExport}
                      disabled={exporting !== null}
                    >
                      {exporting === 'pdf' ? (
                        <LoadingSpinner size="sm" />
                      ) : (
                        <Share2 size={24} />
                      )}
                      <span>Resumen PDF</span>
                      <span className="text-xs text-muted-foreground">
                        {exporting === 'pdf' ? 'Generando...' : 'Formato de resumen ejecutivo'}
                      </span>
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
          <CardTitle>Cuadrícula de Pronóstico 12 Meses</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingState ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-center space-y-3">
                <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center mx-auto mb-2 animate-pulse">
                  <span className="text-primary font-bold text-sm">📊</span>
                </div>
                <div className="text-muted-foreground">
                  Cargando datos de pronóstico{currentProject ? ` para ${currentProject.name}` : ''}...
                </div>
                <div className="text-xs text-muted-foreground">
                  Project: {selectedProjectId} | Change #{projectChangeCount}
                </div>
              </div>
            </div>
          ) : forecastError ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-center space-y-3">
                <div className="w-8 h-8 bg-destructive/10 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <span className="text-destructive font-bold text-sm">⚠️</span>
                </div>
                <div className="text-destructive">{forecastError}</div>
                <div className="text-xs text-muted-foreground">Project ID: {selectedProjectId}</div>
              </div>
            </div>
          ) : isEmptyState ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-center space-y-3">
                <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center mx-auto mb-2">
                  <span className="text-muted-foreground font-bold text-sm">🗂️</span>
                </div>
                <div className="text-muted-foreground">
                  No hay datos de pronóstico disponibles aún para {currentProject?.name || 'este proyecto'}.
                </div>
                <div className="text-xs text-muted-foreground">
                  Project ID: {selectedProjectId} | Última generación: {generatedAt ? new Date(generatedAt).toLocaleString() : 'sin registro'}
                </div>
              </div>
            </div>
          ) : !hasGridData ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-center space-y-3">
                <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center mx-auto mb-2">
                  <span className="text-muted-foreground font-bold text-sm">📋</span>
                </div>
                <div className="text-muted-foreground">
                  No hay datos de pronóstico disponibles para {currentProject?.name || 'este proyecto'}
                </div>
                <div className="text-xs text-muted-foreground">
                  Project ID: {selectedProjectId}
                </div>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background min-w-[300px]">Rubro</TableHead>
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
                        <div className="space-y-1">
                          <div className="font-medium flex items-center gap-2">
                            {lineItem.description}
                            {lineItem.projectName && (
                              <Badge variant="outline" className="text-[10px]">
                                {lineItem.projectName}
                              </Badge>
                            )}
                          </div>
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
                                    id={`forecast-input-${cell.line_item_id}-${cell.month}`}
                                    name={`forecast-${cell.line_item_id}-${cell.month}`}
                                    aria-label={`Forecast value for ${cell.line_item_id} month ${cell.month}`}
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
                                    id={`actual-input-${cell.line_item_id}-${cell.month}`}
                                    name={`actual-${cell.line_item_id}-${cell.month}`}
                                    aria-label={`Actual value for ${cell.line_item_id} month ${cell.month}`}
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
                                    {/* Always show reconciliation icon for organic actuals entry */}
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-5 w-5 p-0 hover:bg-blue-100"
                                      onClick={() => navigateToReconciliation(cell.line_item_id, cell.month)}
                                      title={cell.actual > 0 ? 'View/Edit Factura' : 'Add Factura / Enter Actuals'}
                                    >
                                      <ExternalLink size={12} />
                                    </Button>
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
      {!loading && forecastData.length > 0 && (
        <ChartInsightsPanel
          title="Forecast Analytics & Trends"
          charts={[
            <LineChartComponent
              key={`forecast-trends-${selectedProjectId}`}
              data={monthlyTrends}
              lines={[
                { dataKey: 'Planned', name: 'Planned', color: 'oklch(0.45 0.12 200)', strokeDasharray: '5 5' },
                { dataKey: 'Forecast', name: 'Forecast', color: 'oklch(0.61 0.15 160)', strokeWidth: 3 },
                { dataKey: 'Actual', name: 'Actual', color: 'oklch(0.72 0.15 65)' }
              ]}
              title="Monthly Forecast Trends"
            />,
            <StackedColumnsChart
              key={`variance-analysis-${selectedProjectId}`}
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
              value: formatCurrency(Math.max(...forecastData.map(c => Math.abs(c.variance || 0)))),
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
      )}
    </div>
  );
}

export default SDMTForecast;