import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, DollarSign, AlertTriangle, Target, Calendar, Activity, ArrowRight, Download, Lock } from 'lucide-react';
import { ChartInsightsPanel } from '@/components/ChartInsightsPanel';
import LineChartComponent from '@/components/charts/LineChart';
import ModuleBadge from '@/components/ModuleBadge';
import { useProject } from '@/contexts/ProjectContext';
import ApiService from '@/lib/api';
import usePermissions from '@/hooks/usePermissions';
import { handleFinanzasApiError } from '@/features/sdmt/cost/utils/errorHandling';
import { useAuth } from "@/hooks/useAuth";

export function SDMTCashflow() {
  const { hasPremiumFinanzasFeatures } = usePermissions();
  const { selectedProjectId, currentProject, selectedPeriod, projectChangeCount } = useProject();
  const [cashflowData, setCashflowData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { login } = useAuth();

  // Load data when project changes
  useEffect(() => {
    if (!hasPremiumFinanzasFeatures) return;

    if (selectedProjectId) {
      console.log('💰 Cashflow: Loading data for project:', selectedProjectId, 'change count:', projectChangeCount);
      loadCashflowData();
    }
  }, [hasPremiumFinanzasFeatures, selectedProjectId, selectedPeriod, projectChangeCount]);

  const loadCashflowData = async () => {
    try {
      setLoading(true);
      const data = await ApiService.getCashFlowData(selectedProjectId, parseInt(selectedPeriod));
      
      // Transform API data to chart format
      const transformedData = Array.from({ length: 12 }, (_, i) => {
        const month = i + 1;
        const inflow = data.inflows.find(inf => inf.month === month);
        const outflow = data.outflows.find(out => out.month === month);
        const inflowAmount = inflow?.amount || 0;
        const outflowAmount = outflow?.amount || 0;
        
        return {
          month,
          Inflows: inflowAmount,
          Outflows: outflowAmount,
          'Net Flow': inflowAmount - outflowAmount
        };
      });
      
      setCashflowData(transformedData);
      console.log('✅ Cashflow data loaded for project:', selectedProjectId);
    } catch (error) {
      handleFinanzasApiError(error, {
        onAuthError: () => login(),
        fallback: 'No pudimos cargar el flujo de caja.',
      });
      setCashflowData([]);
    } finally {
      setLoading(false);
    }
  };

  // Project performance data
  const projectPerformanceData = [
    { name: 'Digital Platform', netCashFlow: 450000, status: 'positive' },
    { name: 'Cloud Migration', netCashFlow: 180000, status: 'positive' },
    { name: 'Security Enhancement', netCashFlow: -25000, status: 'negative' },
    { name: 'Mobile Development', netCashFlow: -35000, status: 'negative' }
  ];

  // Cost variance drivers data
  const costDriversData = [
    { driver: 'Labor Rate Increases', impact: 45000, percentage: 35 },
    { driver: 'FX Fluctuations', impact: 28000, percentage: 22 },
    { driver: 'Scope Changes', impact: 22000, percentage: 17 },
    { driver: 'Vendor Delays', impact: 18000, percentage: 14 },
    { driver: 'Infrastructure Costs', impact: 15000, percentage: 12 }
  ];

  // Margin trend data
  const marginTrendData = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    'Gross Margin': 24.5 + Math.sin(i * 0.5) * 2,
    'Net Margin': 18.2 + Math.sin(i * 0.5) * 1.5,
    Target: 20
  }));

  // Risk indicators
  const riskIndicators = [
    { 
      title: 'Budget Variance Risk',
      value: 'Medium',
      description: '8% over planned costs this quarter',
      icon: AlertTriangle,
      color: 'text-amber-600'
    },
    {
      title: 'Cash Flow Risk',
      value: 'Low',
      description: 'Stable payment schedule',
      icon: Target,
      color: 'text-green-600'
    },
    {
      title: 'Schedule Risk',
      value: 'High',
      description: '2 projects behind schedule',
      icon: Calendar,
      color: 'text-red-600'
    },
    {
      title: 'Performance Risk',
      value: 'Medium',
      description: 'Resource utilization at 85%',
      icon: Activity,
      color: 'text-amber-600'
    }
  ];

  if (!hasPremiumFinanzasFeatures) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-amber-600">
              <Lock className="w-5 h-5" />
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                Premium add-on
              </Badge>
            </div>
            <CardTitle className="text-xl">Cash Flow & Margin Analysis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-muted-foreground">
            <p>
              Cash Flow and Scenarios are available for premium Finanzas plans. Upgrade to access live charts,
              forecasts, and downloadable reports for your projects.
            </p>
            <p className="text-sm">Contact your administrator to enable the premium add-on.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold">Cash Flow & Margin Analysis</h1>
            <Badge 
              variant="outline" 
              className="bg-gradient-to-r from-amber-50 to-amber-100 text-amber-700 border-amber-200 font-medium"
            >
              🎁 Premium Add-on
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Monitor project cash flows and profitability metrics
            {currentProject && (
              <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                {currentProject.name} | Change #{projectChangeCount}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
          <ModuleBadge />
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <TrendingUp className="mx-auto mb-2 text-green-600" size={32} />
            <div className="text-2xl font-bold text-green-600">$1.2M</div>
            <p className="text-sm text-muted-foreground">Total Inflows</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <TrendingDown className="mx-auto mb-2 text-red-600" size={32} />
            <div className="text-2xl font-bold text-red-600">$985K</div>
            <p className="text-sm text-muted-foreground">Total Outflows</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <DollarSign className="mx-auto mb-2 text-primary" size={32} />
            <div className="text-2xl font-bold text-primary">$215K</div>
            <p className="text-sm text-muted-foreground">Net Profit</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-primary">18.2%</div>
            <p className="text-sm text-muted-foreground">Margin %</p>
          </CardContent>
        </Card>
      </div>

      {/* Cash Flow Trends */}
      <ChartInsightsPanel
        title="Cash Flow Trends"
        charts={[
          <LineChartComponent
            key="cashflow-trends"
            data={cashflowData}
            lines={[
              { dataKey: 'Inflows', name: 'Inflows', color: 'oklch(0.55 0.15 140)' },
              { dataKey: 'Outflows', name: 'Outflows', color: 'oklch(0.65 0.2 30)' },
              { dataKey: 'Net Flow', name: 'Net Cash Flow', color: 'oklch(0.61 0.15 160)', strokeWidth: 3 }
            ]}
            title="Monthly Cash Flow Analysis"
          />
        ]}
        insights={[
          {
            title: "Average Monthly Margin",
            value: "18.2%",
            type: 'positive'
          },
          {
            title: "Peak Net Flow",
            value: "$42.3K",
            type: 'positive'
          },
          {
            title: "Cash Flow Stability",
            value: "Good",
            type: 'positive'
          }
        ]}
      />

      {/* Two-column layout for additional sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Project Performance Comparison */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-semibold">Project Performance</CardTitle>
            <Button variant="ghost" size="sm">
              <Download className="w-4 h-4 mr-1" />
              Export
            </Button>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">Net cash flow comparison by project</p>
            
            <div className="space-y-4">
              {projectPerformanceData.map((project, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg border bg-card/50">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      project.status === 'positive' ? 'bg-green-500' : 'bg-red-500'
                    }`} />
                    <div>
                      <p className="font-medium">{project.name}</p>
                      <p className={`text-sm font-semibold ${
                        project.status === 'positive' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {project.status === 'positive' ? '+' : ''}${project.netCashFlow.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
            
            <div className="mt-4 p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-green-600 font-medium">2 Projects Positive</span>
                <div className="w-3 h-3 rounded-full bg-red-500 ml-4" />
                <span className="text-red-600 font-medium">2 Projects Negative</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Margin Analysis */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-semibold">Margin Analysis</CardTitle>
            <Button variant="ghost" size="sm">
              <Download className="w-4 h-4 mr-1" />
              Export
            </Button>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">Gross margin percentage trends and project comparison</p>
            
            <div className="h-48">
              <LineChartComponent
                data={marginTrendData}
                lines={[
                  { dataKey: 'Gross Margin', name: 'Gross Margin %', color: 'oklch(0.61 0.15 160)' },
                  { dataKey: 'Target', name: 'Target', color: 'oklch(0.65 0.2 30)', strokeDasharray: '5 5' }
                ]}
              />
            </div>

            <div className="mt-4 flex items-center justify-between text-sm">
              <div>
                <span className="text-muted-foreground">Current Margin:</span>
                <span className="ml-2 font-semibold text-primary">24.1%</span>
              </div>
              <div>
                <span className="text-muted-foreground">vs Target:</span>
                <span className="ml-2 font-semibold text-green-600">+4.1%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cost Variance Drivers */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Cost Increase Drivers</CardTitle>
            <p className="text-sm text-muted-foreground">Primary factors affecting budget variance</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {costDriversData.map((driver, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{driver.driver}</p>
                    <div className="w-full bg-muted rounded-full h-2 mt-1">
                      <div 
                        className="bg-gradient-to-r from-red-500 to-red-400 h-2 rounded-full transition-all"
                        style={{ width: `${(driver.percentage / 35) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="ml-4 text-right">
                    <p className="font-semibold text-sm">${driver.impact.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{driver.percentage}%</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm font-medium text-red-800">Total Variance Impact: $128,000</p>
              <p className="text-xs text-red-600 mt-1">8.5% over planned budget</p>
            </div>
          </CardContent>
        </Card>

        {/* Risk Indicators */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Risk Dashboard</CardTitle>
            <p className="text-sm text-muted-foreground">Key performance and financial risk indicators</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {riskIndicators.map((risk, index) => (
                <div key={index} className="p-3 rounded-lg border bg-card/50">
                  <div className="flex items-center gap-2 mb-2">
                    <risk.icon className={`w-4 h-4 ${risk.color}`} />
                    <span className={`text-sm font-medium ${risk.color}`}>
                      {risk.value}
                    </span>
                  </div>
                  <p className="text-sm font-medium mb-1">{risk.title}</p>
                  <p className="text-xs text-muted-foreground">{risk.description}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-800">
                  2 High Priority Items Require Attention
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default SDMTCashflow;