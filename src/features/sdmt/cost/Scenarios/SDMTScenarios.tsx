import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, TrendingUp, TrendingDown, Plus, Copy, BarChart3, GitCompareIcon, DollarSign, Calendar, Users, Cpu, Zap, Lock } from 'lucide-react';
import ModuleBadge from '@/components/ModuleBadge';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useProject } from '@/contexts/ProjectContext';
import ApiService from '@/lib/api';
import usePermissions from '@/hooks/usePermissions';
import type { Scenario } from '@/types/domain';

const scenarioColorPalette = ['#0ea5e9', '#22c55e', '#f59e0b', '#ef4444', '#a855f7'];

interface ScenarioParameters {
  laborCostChange: number;
  fxRateChange: number;
  inflationRate: number;
  efficiencyGain: number;
  vendorDiscount: number;
  scopeChange: number;
}

export function SDMTScenarios() {
  const { hasPremiumFinanzasFeatures } = usePermissions();
  const { selectedProjectId, selectedPeriod, currentProject, projectChangeCount } = useProject();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedScenarios, setSelectedScenarios] = useState<string[]>([]);
  const [scenarioChartData, setScenarioChartData] = useState<Array<Record<string, number | string>>>([]);
  const [scenarioTotals, setScenarioTotals] = useState<Record<string, number>>({});
  const [customParameters, setCustomParameters] = useState<ScenarioParameters>({
    laborCostChange: 0,
    fxRateChange: 0,
    inflationRate: 3.2,
    efficiencyGain: 0,
    vendorDiscount: 0,
    scopeChange: 0
  });

  // Load data when project changes
  useEffect(() => {
    if (!hasPremiumFinanzasFeatures) return;

    if (selectedProjectId) {
      console.log('🎯 Scenarios: Loading data for project:', selectedProjectId, 'change count:', projectChangeCount);
      loadScenarios();
    }
  }, [hasPremiumFinanzasFeatures, projectChangeCount, selectedPeriod, selectedProjectId]);

  const loadScenarios = async () => {
    try {
      setLoading(true);
      const months = Math.max(parseInt(selectedPeriod || '12', 10), 1);
      const [data, forecastCells] = await Promise.all([
        ApiService.getScenarios(selectedProjectId, months),
        ApiService.getForecastData(selectedProjectId, months)
      ]);
      setScenarios(data);
      setSelectedScenarios(data.map((scenario) => scenario.id));

      const chartRows = Array.from({ length: months }, (_, index) => {
        const monthNumber = index + 1;
        const monthLabel = `M${monthNumber.toString().padStart(2, '0')}`;
        const row: Record<string, number | string> = { month: monthLabel };

        data.forEach((scenario) => {
          const baseCells = forecastCells.filter((cell) => cell.month === monthNumber);
          let value = 0;

          if (scenario.id.startsWith('baseline')) {
            value = baseCells.reduce((sum, cell) => sum + (cell.planned || 0), 0);
          } else if (scenario.id.includes('forecast')) {
            value = baseCells.reduce((sum, cell) => sum + (cell.forecast || 0), 0);
          } else {
            value = baseCells.reduce((sum, cell) => sum + (cell.actual || 0), 0);
          }

          row[scenario.id] = value;
        });

        return row;
      });

      setScenarioChartData(chartRows);
      const totals: Record<string, number> = {};
      data.forEach((scenario) => {
        totals[scenario.id] = chartRows.reduce(
          (sum, row) => sum + (Number(row[scenario.id]) || 0),
          0
        );
      });
      setScenarioTotals(totals);
      console.log('✅ Scenarios loaded for project:', selectedProjectId);
    } catch (error) {
      console.error('Failed to load scenarios:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const scenariosWithColors = scenarios.map((scenario, index) => ({
    ...scenario,
    color: scenarioColorPalette[index % scenarioColorPalette.length],
  }));

  const baselineScenario = scenariosWithColors.find((scenario) =>
    scenario.id.startsWith('baseline')
  );
  const baselineTotal = baselineScenario ? scenarioTotals[baselineScenario.id] || 0 : 0;

  const riskLabel = (impact: number) => {
    if (impact > 0) return 'High';
    if (impact < 0) return 'Low';
    return 'Medium';
  };

  // Calculate delta waterfall data
  const waterfallData = [
    { name: 'Baseline', value: 485000, cumulative: 485000 },
    { name: 'Labor +5%', value: 24250, cumulative: 509250 },
    { name: 'FX Impact', value: -12000, cumulative: 497250 },
    { name: 'Inflation', value: 15600, cumulative: 512850 },
    { name: 'Efficiency', value: -18500, cumulative: 494350 },
    { name: 'Vendor Disc.', value: -8200, cumulative: 486150 },
    { name: 'Final', value: 0, cumulative: 486150 }
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
            <CardTitle className="text-xl">Scenario Analysis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-muted-foreground">
            <p>
              Scenario modeling is available for premium Finanzas plans. Enable the add-on to simulate impacts,
              compare scenarios, and export reports.
            </p>
            <p className="text-sm">Contact your administrator to upgrade.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center mx-auto mb-4 animate-pulse">
              <BarChart3 size={18} className="text-primary" />
            </div>
            <p className="text-muted-foreground">
              Loading scenarios{currentProject ? ` for ${currentProject.name}` : ''}...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Scenario Analysis</h1>
          <div className="flex items-center gap-2 mt-2">
            <p className="text-muted-foreground">
              Advanced scenario modeling and comparison tools
              {currentProject && (
                <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                  {currentProject.name}
                </span>
              )}
            </p>
            <Badge variant="outline" className="premium-tab text-xs opacity-70">
              Premium Add-on
            </Badge>
          </div>
        </div>
        <ModuleBadge />
      </div>

      <Tabs defaultValue="comparison" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="comparison">Scenario Comparison</TabsTrigger>
          <TabsTrigger value="modeling">What-If Modeling</TabsTrigger>
          <TabsTrigger value="analysis">Impact Analysis</TabsTrigger>
        </TabsList>

        {/* Scenario Comparison Tab */}
        <TabsContent value="comparison" className="space-y-6">
          {/* Scenario Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitCompareIcon size={20} />
                Compare Scenarios
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {scenariosWithColors.map((scenario) => (
                  <div
                    key={scenario.id}
                    className={`border rounded-lg p-4 cursor-pointer transition-all ${
                      selectedScenarios.includes(scenario.id)
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => {
                      setSelectedScenarios((prev) =>
                        prev.includes(scenario.id)
                          ? prev.filter((id) => id !== scenario.id)
                          : [...prev, scenario.id].slice(0, 4)
                      );
                    }}
                  >
                    <div className="flex items-center space-x-2 mb-2">
                      <Checkbox checked={selectedScenarios.includes(scenario.id)} />
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: scenario.color }}
                      />
                    </div>
                    <div className="font-medium">{scenario.name}</div>
                    <div className="text-sm text-muted-foreground mb-2">
                      {scenario.description}
                    </div>
                    <div
                      className={`text-sm font-medium ${
                        scenario.total_impact > 0
                          ? 'text-red-600'
                          : scenario.total_impact < 0
                            ? 'text-green-600'
                            : 'text-muted-foreground'
                      }`}
                    >
                      {scenario.total_impact !== 0 &&
                        (scenario.total_impact > 0 ? '+' : '')}
                      {formatCurrency(scenario.total_impact || 0)}
                    </div>
                  </div>
                ))}
              </div>
              {/* Comparison Chart */}
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={scenarioChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(value: number) => [formatCurrency(value), '']}
                      labelFormatter={(label) => `Mes: ${label}`}
                    />
                    <Legend />
                    {selectedScenarios.map((scenarioId) => {
                      const config = scenariosWithColors.find((s) => s.id === scenarioId);
                      if (!config) return null;
                      return (
                        <Line
                          key={scenarioId}
                          type="monotone"
                          dataKey={scenarioId}
                          stroke={config.color}
                          strokeWidth={2}
                          name={config.name}
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {/* Summary Table */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Scenario</th>
                      <th className="text-right p-2">Total Cost</th>
                      <th className="text-right p-2">vs Baseline</th>
                      <th className="text-right p-2">Risk Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedScenarios.map((scenarioId) => {
                      const config = scenariosWithColors.find((s) => s.id === scenarioId);
                      if (!config) return null;
                      const totalCost = scenarioTotals[scenarioId] ?? 0;
                      const deltaVsBaseline = totalCost - baselineTotal;
                      return (
                        <tr key={scenarioId} className="border-b">
                          <td className="p-2">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: config.color }}
                              />
                              {config.name}
                            </div>
                          </td>
                          <td className="text-right p-2 font-medium">
                            {formatCurrency(totalCost)}
                          </td>
                          <td className={`text-right p-2 ${
                            deltaVsBaseline > 0 ? 'text-red-600' :
                            deltaVsBaseline < 0 ? 'text-green-600' : 'text-muted-foreground'
                          }`}>
                            {deltaVsBaseline !== 0 && (deltaVsBaseline > 0 ? '+' : '')}{formatCurrency(deltaVsBaseline)}
                          </td>
                          <td className="text-right p-2">
                            <Badge variant={config.id.startsWith('baseline') ? 'default' : config.total_impact > 0 ? 'destructive' : 'secondary'}>
                              {riskLabel(config.total_impact)}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* What-If Modeling Tab */}
        <TabsContent value="modeling" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Parameter Controls */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap size={20} />
                  Model Parameters
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <Label className="flex items-center gap-2 mb-2">
                      <Users size={16} />
                      Labor Cost Change (%)
                    </Label>
                    <Slider
                      value={[customParameters.laborCostChange]}
                      onValueChange={(value) => setCustomParameters(prev => ({ ...prev, laborCostChange: value[0] }))}
                      min={-20}
                      max={30}
                      step={0.5}
                      className="mb-2"
                    />
                    <div className="text-sm text-muted-foreground">
                      Current: {customParameters.laborCostChange > 0 ? '+' : ''}{customParameters.laborCostChange}%
                    </div>
                  </div>

                  <div>
                    <Label className="flex items-center gap-2 mb-2">
                      <DollarSign size={16} />
                      FX Rate Impact (%)
                    </Label>
                    <Slider
                      value={[customParameters.fxRateChange]}
                      onValueChange={(value) => setCustomParameters(prev => ({ ...prev, fxRateChange: value[0] }))}
                      min={-15}
                      max={15}
                      step={0.1}
                      className="mb-2"
                    />
                    <div className="text-sm text-muted-foreground">
                      Current: {customParameters.fxRateChange > 0 ? '+' : ''}{customParameters.fxRateChange}%
                    </div>
                  </div>

                  <div>
                    <Label className="flex items-center gap-2 mb-2">
                      <TrendingUp size={16} />
                      Inflation Rate (%)
                    </Label>
                    <Slider
                      value={[customParameters.inflationRate]}
                      onValueChange={(value) => setCustomParameters(prev => ({ ...prev, inflationRate: value[0] }))}
                      min={0}
                      max={10}
                      step={0.1}
                      className="mb-2"
                    />
                    <div className="text-sm text-muted-foreground">
                      Current: {customParameters.inflationRate}%
                    </div>
                  </div>

                  <div>
                    <Label className="flex items-center gap-2 mb-2">
                      <Cpu size={16} />
                      Efficiency Gains (%)
                    </Label>
                    <Slider
                      value={[customParameters.efficiencyGain]}
                      onValueChange={(value) => setCustomParameters(prev => ({ ...prev, efficiencyGain: value[0] }))}
                      min={0}
                      max={25}
                      step={0.5}
                      className="mb-2"
                    />
                    <div className="text-sm text-muted-foreground">
                      Current: {customParameters.efficiencyGain}%
                    </div>
                  </div>

                  <div>
                    <Label className="flex items-center gap-2 mb-2">
                      <Calendar size={16} />
                      Scope Change (%)
                    </Label>
                    <Slider
                      value={[customParameters.scopeChange]}
                      onValueChange={(value) => setCustomParameters(prev => ({ ...prev, scopeChange: value[0] }))}
                      min={-10}
                      max={20}
                      step={0.5}
                      className="mb-2"
                    />
                    <div className="text-sm text-muted-foreground">
                      Current: {customParameters.scopeChange > 0 ? '+' : ''}{customParameters.scopeChange}%
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="flex gap-2">
                  <Button className="flex-1">
                    <Plus size={16} className="mr-2" />
                    Create Scenario
                  </Button>
                  <Button variant="outline">
                    <Copy size={16} className="mr-2" />
                    Copy from Baseline
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Impact Preview */}
            <Card>
              <CardHeader>
                <CardTitle>Impact Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-muted/20 rounded-lg">
                    <div className="text-2xl font-bold mb-2">
                      {formatCurrency(485000 * (1 + (customParameters.laborCostChange + customParameters.fxRateChange + customParameters.inflationRate - customParameters.efficiencyGain + customParameters.scopeChange) / 100))}
                    </div>
                    <div className="text-sm text-muted-foreground">Projected Total Cost</div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Baseline Cost</span>
                      <span className="font-medium">{formatCurrency(485000)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Labor Impact</span>
                      <span className={customParameters.laborCostChange >= 0 ? 'text-red-600' : 'text-green-600'}>
                        {formatCurrency(485000 * customParameters.laborCostChange / 100)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">FX Impact</span>
                      <span className={customParameters.fxRateChange >= 0 ? 'text-red-600' : 'text-green-600'}>
                        {formatCurrency(485000 * customParameters.fxRateChange / 100)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Efficiency Savings</span>
                      <span className="text-green-600">
                        -{formatCurrency(485000 * customParameters.efficiencyGain / 100)}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center font-medium">
                      <span>Net Impact</span>
                      <span className={(customParameters.laborCostChange + customParameters.fxRateChange + customParameters.inflationRate - customParameters.efficiencyGain + customParameters.scopeChange) >= 0 ? 'text-red-600' : 'text-green-600'}>
                        {formatCurrency(485000 * (customParameters.laborCostChange + customParameters.fxRateChange + customParameters.inflationRate - customParameters.efficiencyGain + customParameters.scopeChange) / 100)}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Impact Analysis Tab */}
        <TabsContent value="analysis" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 size={20} />
                Delta Waterfall Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={waterfallData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(value: number) => [formatCurrency(value), '']} />
                    <Bar dataKey="value" fill="#64748b" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle size={16} className="text-amber-600" />
                  <span className="text-sm font-medium">High Impact Factors</span>
                </div>
                <div className="space-y-1 text-sm">
                  <div>• Labor cost inflation</div>
                  <div>• Scope expansion risks</div>
                  <div>• Vendor rate adjustments</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp size={16} className="text-green-600" />
                  <span className="text-sm font-medium">Cost Drivers</span>
                </div>
                <div className="space-y-1 text-sm">
                  <div>• Market rate increases</div>
                  <div>• Technology complexity</div>
                  <div>• Compliance requirements</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown size={16} className="text-blue-600" />
                  <span className="text-sm font-medium">Savings Opportunities</span>
                </div>
                <div className="space-y-1 text-sm">
                  <div>• Process automation</div>
                  <div>• Vendor negotiations</div>
                  <div>• Resource optimization</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 size={16} className="text-primary" />
                  <span className="text-sm font-medium">Scenario Summary</span>
                </div>
                <div className="space-y-1 text-sm">
                  <div>• Best case: -10% cost</div>
                  <div>• Most likely: +5% cost</div>
                  <div>• Worst case: +15% cost</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default SDMTScenarios;