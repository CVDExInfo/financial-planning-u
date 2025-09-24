import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, TrendingUp, TrendingDown, DollarSign, AlertTriangle } from 'lucide-react';
import { 
  AreaOverlayChart, 
  VarianceWaterfallChart, 
  MultiLineChart, 
  StackedColumnChart, 
  DonutChart,
  ChartConfig 
} from '@/components/charts/EnhancedCharts';
import { LineItem, ForecastCell, MonthTotal } from '@/types/domain';
import { excelExporter, downloadExcelFile } from '@/lib/excel-export';
import { toast } from 'sonner';

interface ChartInsightsPanelProps {
  lineItems?: LineItem[];
  forecastData?: ForecastCell[];
  monthlyTotals?: MonthTotal[];
  billingPlan?: MonthTotal[];
  mode: 'estimator' | 'forecast' | 'cashflow' | 'reconciliation';
  className?: string;
}

/**
 * Comprehensive charts and insights panel with export capabilities
 */
export const ChartInsightsPanel: React.FC<ChartInsightsPanelProps> = ({
  lineItems = [],
  forecastData = [],
  monthlyTotals = [],
  billingPlan = [],
  mode,
  className
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [timeRange, setTimeRange] = useState('12'); // months
  const [isExporting, setIsExporting] = useState(false);

  // Process data for different chart types
  const chartData = useMemo(() => {
    const filteredMonths = parseInt(timeRange);
    
    // Cost breakdown by category
    const categoryBreakdown = lineItems.reduce((acc, item) => {
      const category = item.category;
      const total = item.qty * item.unit_cost;
      acc[category] = (acc[category] || 0) + total;
      return acc;
    }, {} as Record<string, number>);

    const categoryChartData = Object.entries(categoryBreakdown).map(([category, total]) => ({
      name: category,
      value: total,
      category
    }));

    // Monthly forecast trends (if forecast data available)
    const monthlyForecastData = Array.from({ length: filteredMonths }, (_, i) => {
      const month = i + 1;
      const planned = forecastData.filter(f => f.month === month).reduce((sum, f) => sum + f.planned, 0);
      const forecast = forecastData.filter(f => f.month === month).reduce((sum, f) => sum + f.forecast, 0);
      const actual = forecastData.filter(f => f.month === month).reduce((sum, f) => sum + f.actual, 0);
      const variance = forecast - planned;

      return {
        month,
        planned,
        forecast,
        actual,
        variance,
        billing: billingPlan.find(b => b.month === month)?.amount_planned || 0
      };
    });

    // Labor vs Non-Labor breakdown
    const laborTotal = lineItems.filter(item => item.category === 'Labor')
      .reduce((sum, item) => sum + (item.qty * item.unit_cost), 0);
    const nonLaborTotal = lineItems.filter(item => item.category !== 'Labor')
      .reduce((sum, item) => sum + (item.qty * item.unit_cost), 0);

    const laborNonLaborData = [
      { category: 'Labor', amount: laborTotal, percentage: laborTotal / (laborTotal + nonLaborTotal) },
      { category: 'Non-Labor', amount: nonLaborTotal, percentage: nonLaborTotal / (laborTotal + nonLaborTotal) }
    ];

    // Variance drivers
    const varianceByReason = forecastData.reduce((acc, f) => {
      const reason = f.variance_reason || 'Other';
      acc[reason] = (acc[reason] || 0) + f.variance;
      return acc;
    }, {} as Record<string, number>);

    const varianceDriversData = Object.entries(varianceByReason)
      .map(([reason, variance]) => ({
        name: reason,
        value: Math.abs(variance),
        variance,
        isNegative: variance < 0
      }))
      .sort((a, b) => b.value - a.value);

    return {
      categoryBreakdown: categoryChartData,
      monthlyForecast: monthlyForecastData,
      laborNonLabor: laborNonLaborData,
      varianceDrivers: varianceDriversData,
      totalBudget: laborTotal + nonLaborTotal,
      totalVariance: forecastData.reduce((sum, f) => sum + f.variance, 0)
    };
  }, [lineItems, forecastData, billingPlan, timeRange]);

  // Export all charts to Excel
  const handleExportCharts = async () => {
    setIsExporting(true);
    try {
      // Create a comprehensive dashboard export
      const dashboardData = {
        summary: {
          totalBudget: chartData.totalBudget,
          totalVariance: chartData.totalVariance,
          variancePercent: chartData.totalBudget ? (chartData.totalVariance / chartData.totalBudget) * 100 : 0,
          reportDate: new Date().toISOString()
        },
        charts: {
          categoryBreakdown: chartData.categoryBreakdown,
          monthlyTrends: chartData.monthlyForecast,
          varianceDrivers: chartData.varianceDrivers
        }
      };

      // For now, just download the chart data as JSON
      // In a real implementation, you'd generate an Excel file with embedded charts
      const blob = new Blob([JSON.stringify(dashboardData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${mode}-dashboard-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Dashboard data exported successfully');
    } catch (error) {
      toast.error('Failed to export dashboard data');
    } finally {
      setIsExporting(false);
    }
  };

  // Render different chart sets based on mode
  const renderEstimatorCharts = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <StackedColumnChart
        data={chartData.laborNonLabor}
        config={{
          title: 'Labor vs Non-Labor Costs',
          description: 'Breakdown of project costs by category',
          dataKey: 'amount',
          nameKey: 'category',
          format: 'currency',
          allowExport: true,
          height: 300
        }}
        stacks={[
          { dataKey: 'amount', name: 'Cost', color: 'var(--primary)' }
        ]}
        className="col-span-1"
      />
      
      <DonutChart
        data={chartData.categoryBreakdown}
        config={{
          title: 'Cost Distribution',
          description: 'Breakdown by category',
          dataKey: 'value',
          nameKey: 'name',
          format: 'currency',
          allowExport: true,
          colors: ['var(--primary)', 'var(--secondary)', 'var(--accent)', 'var(--muted)'],
          height: 300
        }}
        centerMetric={{
          value: chartData.totalBudget,
          label: 'Total Budget',
          format: 'currency'
        }}
      />
    </div>
  );

  const renderForecastCharts = () => (
    <div className="space-y-6">
      <MultiLineChart
        data={chartData.monthlyForecast}
        config={{
          title: 'Forecast vs Planned Trends',
          description: `Monthly comparison over ${timeRange} months`,
          dataKey: 'planned',
          nameKey: 'month',
          format: 'currency',
          allowExport: true,
          height: 350
        }}
        series={[
          { dataKey: 'planned', name: 'Planned', color: 'var(--primary)' },
          { dataKey: 'forecast', name: 'Forecast', color: 'var(--accent)', strokeDasharray: '5 5' },
          { dataKey: 'actual', name: 'Actual', color: 'var(--sdmt-accent)' }
        ]}
      />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <VarianceWaterfallChart
          data={chartData.varianceDrivers.slice(0, 8)}
          config={{
            title: 'Top Variance Drivers',
            description: 'Key factors affecting forecast accuracy',
            dataKey: 'variance',
            nameKey: 'name',
            allowExport: true,
            height: 300
          }}
        />
        
        <DonutChart
          data={chartData.varianceDrivers}
          config={{
            title: 'Variance by Reason',
            description: 'Distribution of variance causes',
            dataKey: 'value',
            nameKey: 'name',
            format: 'currency',
            allowExport: true,
            height: 300
          }}
        />
      </div>
    </div>
  );

  const renderCashflowCharts = () => (
    <div className="space-y-6">
      <AreaOverlayChart
        data={chartData.monthlyForecast}
        config={{
          title: 'Cash Flow Analysis',
          description: 'Inflows vs Outflows with margin trends',
          dataKey: 'billing',
          nameKey: 'month',
          format: 'currency',
          allowExport: true,
          height: 350
        }}
        secondaryData={chartData.monthlyForecast}
        secondaryConfig={{
          dataKey: 'forecast',
          color: 'var(--destructive)'
        }}
      />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${chartData.monthlyForecast.reduce((sum, m) => sum + m.billing, 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {timeRange} month projection
            </p>
          </CardContent>
        </Card>
        
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Costs</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${chartData.monthlyForecast.reduce((sum, m) => sum + m.forecast, 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Forecasted spend
            </p>
          </CardContent>
        </Card>
        
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Margin</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(() => {
                const revenue = chartData.monthlyForecast.reduce((sum, m) => sum + m.billing, 0);
                const costs = chartData.monthlyForecast.reduce((sum, m) => sum + m.forecast, 0);
                const margin = revenue ? ((revenue - costs) / revenue) * 100 : 0;
                return `${margin.toFixed(1)}%`;
              })()}
            </div>
            <p className="text-xs text-muted-foreground">
              Projected margin
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderReconciliationCharts = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Invoice Matching Status</CardTitle>
          <CardDescription>Status of invoice reconciliation process</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Mock reconciliation status */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm">Matched</span>
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                {Math.floor(forecastData.length * 0.7)}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Pending</span>
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                {Math.floor(forecastData.length * 0.2)}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Disputed</span>
              <Badge variant="destructive">
                {Math.floor(forecastData.length * 0.1)}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <DonutChart
        data={chartData.varianceDrivers}
        config={{
          title: 'Variance Impact',
          description: 'Financial impact by variance type',
          dataKey: 'value',
          nameKey: 'name',
          format: 'currency',
          allowExport: true,
          height: 300
        }}
      />
    </div>
  );

  return (
    <Card className={`glass-card ${className}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-semibold flex items-center space-x-2">
              <TrendingUp className="h-5 w-5" />
              <span>Insights & Analytics</span>
            </CardTitle>
            <CardDescription>
              Interactive charts and key metrics for {mode} analysis
            </CardDescription>
          </div>
          <div className="flex items-center space-x-3">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="6">6 months</SelectItem>
                <SelectItem value="12">12 months</SelectItem>
                <SelectItem value="24">24 months</SelectItem>
                <SelectItem value="60">60 months</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              variant="outline" 
              onClick={handleExportCharts}
              disabled={isExporting}
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="trends">Trends</TabsTrigger>
            <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            {mode === 'estimator' && renderEstimatorCharts()}
            {mode === 'forecast' && renderForecastCharts()}
            {mode === 'cashflow' && renderCashflowCharts()}
            {mode === 'reconciliation' && renderReconciliationCharts()}
          </TabsContent>

          <TabsContent value="trends" className="mt-6">
            <MultiLineChart
              data={chartData.monthlyForecast}
              config={{
                title: 'Historical Trends',
                description: 'Key metrics over time',
                dataKey: 'planned',
                nameKey: 'month',
                format: 'currency',
                allowExport: true,
                height: 400
              }}
              series={[
                { dataKey: 'planned', name: 'Planned', color: 'var(--primary)' },
                { dataKey: 'forecast', name: 'Forecast', color: 'var(--accent)' },
                { dataKey: 'actual', name: 'Actual', color: 'var(--sdmt-accent)' }
              ]}
            />
          </TabsContent>

          <TabsContent value="breakdown" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <StackedColumnChart
                data={chartData.categoryBreakdown}
                config={{
                  title: 'Category Breakdown',
                  description: 'Detailed cost analysis',
                  dataKey: 'value',
                  nameKey: 'name',
                  format: 'currency',
                  allowExport: true,
                  height: 350
                }}
                stacks={[
                  { dataKey: 'value', name: 'Cost', color: 'var(--primary)' }
                ]}
              />
              
              <DonutChart
                data={chartData.categoryBreakdown}
                config={{
                  title: 'Cost Distribution',
                  description: 'Proportional breakdown',
                  dataKey: 'value',
                  nameKey: 'name',
                  format: 'currency',
                  allowExport: true,
                  height: 350
                }}
              />
            </div>
          </TabsContent>

          <TabsContent value="performance" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <VarianceWaterfallChart
                data={chartData.varianceDrivers}
                config={{
                  title: 'Performance Analysis',
                  description: 'Variance impact waterfall',
                  dataKey: 'variance',
                  nameKey: 'name',
                  allowExport: true,
                  height: 350
                }}
              />
              
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>Key Performance Indicators</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Budget Accuracy</span>
                    <Badge variant={Math.abs(chartData.totalVariance / chartData.totalBudget) < 0.05 ? 'secondary' : 'destructive'}>
                      {((1 - Math.abs(chartData.totalVariance / chartData.totalBudget)) * 100).toFixed(1)}%
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Forecast Reliability</span>
                    <Badge variant="secondary">High</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Data Quality</span>
                    <Badge variant="secondary">
                      {((forecastData.filter(f => f.actual > 0).length / forecastData.length) * 100).toFixed(0)}%
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};