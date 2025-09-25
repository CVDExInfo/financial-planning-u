import { useState } from 'react';
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
import { AlertCircle, TrendingUp, TrendingDown, Plus, Copy, BarChart3, GitCompareIcon, DollarSign, Calendar, Users, Cpu, Zap } from 'lucide-react';
import ModuleBadge from '@/components/ModuleBadge';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Mock data for scenario comparison
const mockScenarioData = [
  {
    month: 'Jan 24',
    baseline: 42500,
    optimistic: 38250,
    conservative: 46750,
    riskAdjusted: 47500
  },
  {
    month: 'Feb 24',
    baseline: 41200,
    optimistic: 37080,
    conservative: 45320,
    riskAdjusted: 45900
  },
  {
    month: 'Mar 24',
    baseline: 43800,
    optimistic: 39420,
    conservative: 48180,
    riskAdjusted: 48800
  },
  {
    month: 'Apr 24',
    baseline: 44100,
    optimistic: 39690,
    conservative: 48510,
    riskAdjusted: 49100
  },
  {
    month: 'May 24',
    baseline: 42900,
    optimistic: 38610,
    conservative: 47190,
    riskAdjusted: 47800
  },
  {
    month: 'Jun 24',
    baseline: 45200,
    optimistic: 40680,
    conservative: 49720,
    riskAdjusted: 50400
  },
];

const scenarios = [
  {
    id: 'baseline',
    name: 'Baseline Scenario',
    description: 'Original approved baseline',
    totalCost: 485000,
    impact: 0,
    color: '#6366f1',
    parameters: {
      laborCostChange: 0,
      fxRateChange: 0,
      inflationRate: 3.2,
      efficiencyGain: 0,
      vendorDiscount: 0,
      scopeChange: 0
    }
  },
  {
    id: 'optimistic',
    name: 'Optimistic Scenario',
    description: '10% efficiency improvements, favorable FX',
    totalCost: 436500,
    impact: -48500,
    color: '#22c55e',
    parameters: {
      laborCostChange: -5,
      fxRateChange: -3,
      inflationRate: 2.8,
      efficiencyGain: 10,
      vendorDiscount: 5,
      scopeChange: 0
    }
  },
  {
    id: 'conservative',
    name: 'Conservative Scenario',
    description: 'Higher costs, unfavorable market conditions',
    totalCost: 533500,
    impact: 48500,
    color: '#f97316',
    parameters: {
      laborCostChange: 8,
      fxRateChange: 5,
      inflationRate: 4.5,
      efficiencyGain: -2,
      vendorDiscount: 0,
      scopeChange: 3
    }
  },
  {
    id: 'riskAdjusted',
    name: 'Risk-Adjusted Scenario',
    description: 'Includes contingency and risk premiums',
    totalCost: 558200,
    impact: 73200,
    color: '#ef4444',
    parameters: {
      laborCostChange: 5,
      fxRateChange: 8,
      inflationRate: 4.2,
      efficiencyGain: 0,
      vendorDiscount: 0,
      scopeChange: 5
    }
  }
];

interface ScenarioParameters {
  laborCostChange: number;
  fxRateChange: number;
  inflationRate: number;
  efficiencyGain: number;
  vendorDiscount: number;
  scopeChange: number;
}

export function SDMTScenarios() {
  const [selectedScenarios, setSelectedScenarios] = useState<string[]>(['baseline', 'optimistic']);
  const [customParameters, setCustomParameters] = useState<ScenarioParameters>({
    laborCostChange: 0,
    fxRateChange: 0,
    inflationRate: 3.2,
    efficiencyGain: 0,
    vendorDiscount: 0,
    scopeChange: 0
  });

  const calculateCustomScenarioImpact = () => {
    const baseAmount = 485000;
    const laborImpact = baseAmount * 0.6 * (customParameters.laborCostChange / 100);
    const fxImpact = baseAmount * 0.3 * (customParameters.fxRateChange / 100);
    const inflationImpact = baseAmount * ((customParameters.inflationRate - 3.2) / 100);
    const efficiencyImpact = baseAmount * (-customParameters.efficiencyGain / 100);
    const vendorImpact = baseAmount * 0.4 * (-customParameters.vendorDiscount / 100);
    const scopeImpact = baseAmount * (customParameters.scopeChange / 100);
    
    return laborImpact + fxImpact + inflationImpact + efficiencyImpact + vendorImpact + scopeImpact;
  };

  const customScenarioTotal = 485000 + calculateCustomScenarioImpact();

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold">Scenario Planning</h1>
            <Badge 
              variant="outline" 
              className="bg-gradient-to-r from-amber-50 to-amber-100 text-amber-700 border-amber-200 font-medium"
            >
              🎁 Premium Add-on
            </Badge>
          </div>
          <p className="text-muted-foreground">Model different cost scenarios and compare financial outcomes</p>
        </div>
        <ModuleBadge />
      </div>

      <Tabs defaultValue="comparison" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="scenarios">Scenario Library</TabsTrigger>
          <TabsTrigger value="comparison">Scenario Comparison</TabsTrigger>
          <TabsTrigger value="modeling">Scenario Modeling</TabsTrigger>
        </TabsList>

        <TabsContent value="scenarios" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Saved Scenarios</h2>
            <Button className="gap-2">
              <Plus size={16} />
              Create New Scenario
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {scenarios.map((scenario) => (
              <Card key={scenario.id} className={`border-l-4`} style={{ borderLeftColor: scenario.color }}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 size={20} style={{ color: scenario.color }} />
                    {scenario.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">{scenario.description}</p>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Total Cost:</span>
                      <span className="font-medium">${scenario.totalCost.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Impact:</span>
                      <span className={`font-medium ${scenario.impact === 0 ? 'text-muted-foreground' : scenario.impact < 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {scenario.impact === 0 ? 'Baseline' : `${scenario.impact > 0 ? '+' : ''}$${scenario.impact.toLocaleString()}`}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button variant="outline" size="sm" className="gap-2">
                      <Copy size={14} />
                      Clone
                    </Button>
                    <Button variant="outline" size="sm">
                      Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center p-8 text-center">
                <Plus size={32} className="text-muted-foreground mb-4" />
                <h3 className="font-medium mb-2">Create New Scenario</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Model different cost assumptions and compare outcomes
                </p>
                <Button className="gap-2">
                  <Plus size={16} />
                  New Scenario
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="comparison" className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <GitCompareIcon size={24} />
              <h2 className="text-xl font-semibold">Scenario Comparison</h2>
            </div>
            <div className="flex gap-2">
              <Select value={selectedScenarios[0]} onValueChange={(value) => setSelectedScenarios([value, selectedScenarios[1]])}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select first scenario" />
                </SelectTrigger>
                <SelectContent>
                  {scenarios.map((scenario) => (
                    <SelectItem key={scenario.id} value={scenario.id}>
                      {scenario.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedScenarios[1]} onValueChange={(value) => setSelectedScenarios([selectedScenarios[0], value])}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select second scenario" />
                </SelectTrigger>
                <SelectContent>
                  {scenarios.map((scenario) => (
                    <SelectItem key={scenario.id} value={scenario.id}>
                      {scenario.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Key Metrics Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {selectedScenarios.map((scenarioId) => {
              const scenario = scenarios.find(s => s.id === scenarioId);
              if (!scenario) return null;
              
              return (
                <Card key={scenarioId} className="border-l-4" style={{ borderLeftColor: scenario.color }}>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: scenario.color }}></div>
                      {scenario.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                      <DollarSign size={16} className="text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Total Cost</p>
                        <p className="font-semibold">${scenario.totalCost.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {scenario.impact < 0 ? 
                        <TrendingDown size={16} className="text-green-600" /> : 
                        scenario.impact > 0 ? 
                        <TrendingUp size={16} className="text-red-600" /> :
                        <div className="w-4 h-4" />
                      }
                      <div>
                        <p className="text-sm text-muted-foreground">vs Baseline</p>
                        <p className={`font-semibold ${scenario.impact === 0 ? '' : scenario.impact < 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {scenario.impact === 0 ? 'Baseline' : `${scenario.impact > 0 ? '+' : ''}$${scenario.impact.toLocaleString()}`}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            
            {/* Risk Assessment */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertCircle size={18} className="text-amber-500" />
                  Risk Assessment
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Market Risk</span>
                    <span className="text-sm font-medium text-amber-600">Medium</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">FX Risk</span>
                    <span className="text-sm font-medium text-red-600">High</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Delivery Risk</span>
                    <span className="text-sm font-medium text-green-600">Low</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Monthly Trend Comparison */}
          <Card>
            <CardHeader>
              <CardTitle>Monthly Cost Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={mockScenarioData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="month" 
                    className="text-muted-foreground"
                  />
                  <YAxis 
                    className="text-muted-foreground"
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip 
                    formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
                    labelStyle={{ color: 'var(--foreground)' }}
                    contentStyle={{ 
                      backgroundColor: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  {selectedScenarios.map((scenarioId) => {
                    const scenario = scenarios.find(s => s.id === scenarioId);
                    return (
                      <Line
                        key={scenarioId}
                        type="monotone"
                        dataKey={scenarioId}
                        stroke={scenario?.color}
                        strokeWidth={2}
                        name={scenario?.name}
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Parameter Comparison Table */}
          <Card>
            <CardHeader>
              <CardTitle>Parameter Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium">Parameter</th>
                      {selectedScenarios.map((scenarioId) => {
                        const scenario = scenarios.find(s => s.id === scenarioId);
                        return (
                          <th key={scenarioId} className="text-center py-3 px-4 font-medium">
                            {scenario?.name}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="py-3 px-4 text-muted-foreground">Labor Cost Change</td>
                      {selectedScenarios.map((scenarioId) => {
                        const scenario = scenarios.find(s => s.id === scenarioId);
                        const value = scenario?.parameters.laborCostChange || 0;
                        return (
                          <td key={scenarioId} className={`text-center py-3 px-4 ${value === 0 ? '' : value > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {value > 0 ? '+' : ''}{value}%
                          </td>
                        );
                      })}
                    </tr>
                    <tr className="border-b">
                      <td className="py-3 px-4 text-muted-foreground">FX Rate Change</td>
                      {selectedScenarios.map((scenarioId) => {
                        const scenario = scenarios.find(s => s.id === scenarioId);
                        const value = scenario?.parameters.fxRateChange || 0;
                        return (
                          <td key={scenarioId} className={`text-center py-3 px-4 ${value === 0 ? '' : value > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {value > 0 ? '+' : ''}{value}%
                          </td>
                        );
                      })}
                    </tr>
                    <tr className="border-b">
                      <td className="py-3 px-4 text-muted-foreground">Inflation Rate</td>
                      {selectedScenarios.map((scenarioId) => {
                        const scenario = scenarios.find(s => s.id === scenarioId);
                        const value = scenario?.parameters.inflationRate || 0;
                        return (
                          <td key={scenarioId} className="text-center py-3 px-4">
                            {value}%
                          </td>
                        );
                      })}
                    </tr>
                    <tr className="border-b">
                      <td className="py-3 px-4 text-muted-foreground">Efficiency Gains</td>
                      {selectedScenarios.map((scenarioId) => {
                        const scenario = scenarios.find(s => s.id === scenarioId);
                        const value = scenario?.parameters.efficiencyGain || 0;
                        return (
                          <td key={scenarioId} className={`text-center py-3 px-4 ${value === 0 ? '' : value > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {value > 0 ? '+' : ''}{value}%
                          </td>
                        );
                      })}
                    </tr>
                    <tr className="border-b">
                      <td className="py-3 px-4 text-muted-foreground">Vendor Discounts</td>
                      {selectedScenarios.map((scenarioId) => {
                        const scenario = scenarios.find(s => s.id === scenarioId);
                        const value = scenario?.parameters.vendorDiscount || 0;
                        return (
                          <td key={scenarioId} className={`text-center py-3 px-4 ${value === 0 ? '' : 'text-green-600'}`}>
                            {value > 0 ? '+' : ''}{value}%
                          </td>
                        );
                      })}
                    </tr>
                    <tr>
                      <td className="py-3 px-4 text-muted-foreground">Scope Changes</td>
                      {selectedScenarios.map((scenarioId) => {
                        const scenario = scenarios.find(s => s.id === scenarioId);
                        const value = scenario?.parameters.scopeChange || 0;
                        return (
                          <td key={scenarioId} className={`text-center py-3 px-4 ${value === 0 ? '' : value > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {value > 0 ? '+' : ''}{value}%
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="modeling" className="space-y-6">
          <div className="flex items-center gap-3">
            <Cpu size={24} />
            <h2 className="text-xl font-semibold">Custom Scenario Modeling</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Parameter Controls */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap size={20} />
                  Scenario Parameters
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Users size={16} />
                    Labor Cost Change: {customParameters.laborCostChange > 0 ? '+' : ''}{customParameters.laborCostChange}%
                  </Label>
                  <Slider
                    value={[customParameters.laborCostChange]}
                    onValueChange={([value]) => setCustomParameters(prev => ({ ...prev, laborCostChange: value }))}
                    min={-20}
                    max={30}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>-20% (Cost reduction)</span>
                    <span>+30% (Cost increase)</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>FX Rate Change: {customParameters.fxRateChange > 0 ? '+' : ''}{customParameters.fxRateChange}%</Label>
                  <Slider
                    value={[customParameters.fxRateChange]}
                    onValueChange={([value]) => setCustomParameters(prev => ({ ...prev, fxRateChange: value }))}
                    min={-15}
                    max={25}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>-15% (COP strengthens)</span>
                    <span>+25% (COP weakens)</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Annual Inflation Rate: {customParameters.inflationRate}%</Label>
                  <Slider
                    value={[customParameters.inflationRate]}
                    onValueChange={([value]) => setCustomParameters(prev => ({ ...prev, inflationRate: value }))}
                    min={1}
                    max={8}
                    step={0.1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>1% (Low inflation)</span>
                    <span>8% (High inflation)</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Efficiency Gains: {customParameters.efficiencyGain > 0 ? '+' : ''}{customParameters.efficiencyGain}%</Label>
                  <Slider
                    value={[customParameters.efficiencyGain]}
                    onValueChange={([value]) => setCustomParameters(prev => ({ ...prev, efficiencyGain: value }))}
                    min={-10}
                    max={25}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>-10% (Inefficiency)</span>
                    <span>+25% (Major efficiency)</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Vendor Discounts: {customParameters.vendorDiscount}%</Label>
                  <Slider
                    value={[customParameters.vendorDiscount]}
                    onValueChange={([value]) => setCustomParameters(prev => ({ ...prev, vendorDiscount: value }))}
                    min={0}
                    max={20}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0% (No discount)</span>
                    <span>20% (Major discount)</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Scope Changes: {customParameters.scopeChange > 0 ? '+' : ''}{customParameters.scopeChange}%</Label>
                  <Slider
                    value={[customParameters.scopeChange]}
                    onValueChange={([value]) => setCustomParameters(prev => ({ ...prev, scopeChange: value }))}
                    min={-10}
                    max={15}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>-10% (Scope reduction)</span>
                    <span>+15% (Scope increase)</span>
                  </div>
                </div>

                <Separator />
                
                <Button className="w-full gap-2">
                  <Copy size={16} />
                  Save Custom Scenario
                </Button>
              </CardContent>
            </Card>

            {/* Results */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign size={20} />
                  Impact Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="text-center space-y-2">
                  <p className="text-sm text-muted-foreground">Projected Total Cost</p>
                  <p className="text-3xl font-bold">
                    ${Math.round(customScenarioTotal).toLocaleString()}
                  </p>
                  <p className={`text-lg ${calculateCustomScenarioImpact() === 0 ? 'text-muted-foreground' : calculateCustomScenarioImpact() < 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {calculateCustomScenarioImpact() === 0 ? 'No change from baseline' : 
                     `${calculateCustomScenarioImpact() > 0 ? '+' : ''}$${Math.round(calculateCustomScenarioImpact()).toLocaleString()} vs Baseline`}
                  </p>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="font-medium">Impact Breakdown</h4>
                  <div className="space-y-3">
                    {[
                      { 
                        label: 'Labor Cost Impact', 
                        value: 485000 * 0.6 * (customParameters.laborCostChange / 100),
                        icon: Users
                      },
                      { 
                        label: 'FX Rate Impact', 
                        value: 485000 * 0.3 * (customParameters.fxRateChange / 100),
                        icon: DollarSign
                      },
                      { 
                        label: 'Inflation Impact', 
                        value: 485000 * ((customParameters.inflationRate - 3.2) / 100),
                        icon: TrendingUp
                      },
                      { 
                        label: 'Efficiency Impact', 
                        value: 485000 * (-customParameters.efficiencyGain / 100),
                        icon: Zap
                      },
                      { 
                        label: 'Vendor Discount', 
                        value: 485000 * 0.4 * (-customParameters.vendorDiscount / 100),
                        icon: Calendar
                      },
                      { 
                        label: 'Scope Change Impact', 
                        value: 485000 * (customParameters.scopeChange / 100),
                        icon: BarChart3
                      }
                    ].map((item, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <item.icon size={16} className="text-muted-foreground" />
                          <span className="text-sm">{item.label}</span>
                        </div>
                        <span className={`text-sm font-medium ${item.value === 0 ? 'text-muted-foreground' : item.value < 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {item.value === 0 ? '$0' : `${item.value > 0 ? '+' : ''}$${Math.round(item.value).toLocaleString()}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <h4 className="font-medium">Risk Indicators</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Budget Variance Risk</span>
                      <Badge variant={Math.abs(calculateCustomScenarioImpact()) < 25000 ? "default" : Math.abs(calculateCustomScenarioImpact()) < 75000 ? "secondary" : "destructive"}>
                        {Math.abs(calculateCustomScenarioImpact()) < 25000 ? 'Low' : Math.abs(calculateCustomScenarioImpact()) < 75000 ? 'Medium' : 'High'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Timeline Risk</span>
                      <Badge variant={customParameters.scopeChange <= 0 ? "default" : customParameters.scopeChange < 5 ? "secondary" : "destructive"}>
                        {customParameters.scopeChange <= 0 ? 'Low' : customParameters.scopeChange < 5 ? 'Medium' : 'High'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Market Risk</span>
                      <Badge variant={Math.abs(customParameters.fxRateChange) < 5 ? "default" : Math.abs(customParameters.fxRateChange) < 10 ? "secondary" : "destructive"}>
                        {Math.abs(customParameters.fxRateChange) < 5 ? 'Low' : Math.abs(customParameters.fxRateChange) < 10 ? 'Medium' : 'High'}
                      </Badge>
                    </div>
                  </div>
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