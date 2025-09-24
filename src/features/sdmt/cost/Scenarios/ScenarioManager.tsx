import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Copy, GitBranch, TrendUp, TrendDown } from '@phosphor-icons/react';
import ApiService from '@/lib/api';
import type { Scenario } from '@/types/domain';

export function ScenarioManager() {
  const [selectedScenario, setSelectedScenario] = useState<string>('SCN-001');
  
  const { data: scenarios = [], isLoading } = useQuery({
    queryKey: ['scenarios', 'PRJ-IKUSI-PLATFORM'],
    queryFn: () => ApiService.getScenarios('PRJ-IKUSI-PLATFORM'),
  });

  const currentScenario = scenarios.find(s => s.id === selectedScenario);

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-6"></div>
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-48 bg-muted rounded"></div>
            ))}
          </div>
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
            <span>Scenario Manager</span>
            <Badge className="module-badge-sdmt">SDMT</Badge>
          </h1>
          <p className="text-muted-foreground">
            Clone baselines and explore "what-if" scenarios with adjustable parameters
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" className="flex items-center space-x-2">
            <Copy size={16} />
            <span>Clone Baseline</span>
          </Button>
          <Button className="flex items-center space-x-2 bg-sdmt hover:bg-sdmt/90">
            <Plus size={16} />
            <span>New Scenario</span>
          </Button>
        </div>
      </div>

      {/* Scenario Selector */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <GitBranch size={20} />
              <div>
                <div className="font-medium">Current Scenario</div>
                <div className="text-sm text-muted-foreground">
                  Compare different planning assumptions
                </div>
              </div>
            </div>
            <Select value={selectedScenario} onValueChange={setSelectedScenario}>
              <SelectTrigger className="w-64">
                <SelectValue />
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
        </CardContent>
      </Card>

      {/* Scenario Cards */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        {scenarios.map((scenario) => (
          <Card 
            key={scenario.id} 
            className={`cursor-pointer transition-all ${
              selectedScenario === scenario.id ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => setSelectedScenario(scenario.id)}
          >
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{scenario.name}</span>
                {scenario.id === 'SCN-001' && (
                  <Badge variant="outline">Baseline</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">
                  {scenario.deltas.length} adjustments
                </div>
                {scenario.deltas.length > 0 && (
                  <div className="space-y-1">
                    {scenario.deltas.slice(0, 2).map((delta, index) => (
                      <div key={index} className="text-xs bg-accent/50 rounded px-2 py-1">
                        {delta.type === 'fx_adjustment' && `FX Rate ${((delta.factor - 1) * 100).toFixed(0)}%`}
                        {delta.type === 'timeline_shift' && `Delayed ${delta.months}M`}
                      </div>
                    ))}
                  </div>
                )}
                {scenario.deltas.length === 0 && (
                  <div className="text-xs text-muted-foreground">Original baseline</div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Scenario Details */}
      {currentScenario && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Scenario Details: {currentScenario.name}</CardTitle>
          </CardHeader>
          <CardContent>
            {currentScenario.deltas.length > 0 ? (
              <div className="space-y-4">
                <h4 className="font-medium">Applied Adjustments</h4>
                <div className="grid grid-cols-2 gap-4">
                  {currentScenario.deltas.map((delta, index) => (
                    <div key={index} className="border border-border rounded-lg p-3">
                      <div className="font-medium mb-1">
                        {delta.type === 'fx_adjustment' && 'Foreign Exchange Adjustment'}
                        {delta.type === 'timeline_shift' && 'Timeline Shift'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {delta.type === 'fx_adjustment' && `Rate multiplier: ${delta.factor}x`}
                        {delta.type === 'timeline_shift' && `Delay: ${delta.months} months`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <div className="text-lg mb-2">📋 Baseline Scenario</div>
                <div className="text-sm">Original project baseline without modifications</div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Scenario Controls */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Scenario Controls</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-3">Financial Adjustments</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 border border-border rounded-lg">
                  <div>
                    <div className="font-medium">FTE Rates</div>
                    <div className="text-sm text-muted-foreground">Adjust labor rates</div>
                  </div>
                  <Button size="sm" variant="outline">
                    <TrendUp size={14} />
                  </Button>
                </div>
                <div className="flex items-center justify-between p-3 border border-border rounded-lg">
                  <div>
                    <div className="font-medium">FX Rate</div>
                    <div className="text-sm text-muted-foreground">Currency adjustment</div>
                  </div>
                  <Button size="sm" variant="outline">
                    <TrendUp size={14} />
                  </Button>
                </div>
                <div className="flex items-center justify-between p-3 border border-border rounded-lg">
                  <div>
                    <div className="font-medium">Indexation %</div>
                    <div className="text-sm text-muted-foreground">Inflation rate</div>
                  </div>
                  <Button size="sm" variant="outline">
                    <TrendUp size={14} />
                  </Button>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-3">Timeline & Scope</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 border border-border rounded-lg">
                  <div>
                    <div className="font-medium">CAPEX Deferral</div>
                    <div className="text-sm text-muted-foreground">Delay capital expenses</div>
                  </div>
                  <Button size="sm" variant="outline">
                    <TrendDown size={14} />
                  </Button>
                </div>
                <div className="flex items-center justify-between p-3 border border-border rounded-lg">
                  <div>
                    <div className="font-medium">License Tiers</div>
                    <div className="text-sm text-muted-foreground">Adjust software costs</div>
                  </div>
                  <Button size="sm" variant="outline">
                    <TrendUp size={14} />
                  </Button>
                </div>
                <div className="flex items-center justify-between p-3 border border-border rounded-lg">
                  <div>
                    <div className="font-medium">Timeline Shift</div>
                    <div className="text-sm text-muted-foreground">Project delay</div>
                  </div>
                  <Button size="sm" variant="outline">
                    <TrendDown size={14} />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delta Waterfall Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Delta Waterfall</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-center">
            <div>
              <div className="text-lg mb-2">📊 Waterfall Chart</div>
              <div className="text-sm text-muted-foreground">
                Visual breakdown of cost changes from baseline to current scenario
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}