import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GitBranch, Copy, Plus } from '@phosphor-icons/react';

export function ScenarioManager() {
  const scenarios = [
    {
      id: 'base',
      name: 'Baseline',
      type: 'baseline',
      total_cost: 1200000,
      created_date: '2024-01-01',
      status: 'active'
    },
    {
      id: 'scenario_1',
      name: 'Optimistic - 15% Rate Reduction',
      type: 'scenario',
      total_cost: 1020000,
      created_date: '2024-01-15',
      status: 'draft'
    },
    {
      id: 'scenario_2', 
      name: 'Conservative - FX Risk (20% COP devaluation)',
      type: 'scenario',
      total_cost: 1440000,
      created_date: '2024-01-20',
      status: 'review'
    }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <GitBranch size={32} className="text-sdmt" />
            <div>
              <h1 className="text-3xl font-bold text-foreground">Scenario Manager</h1>
              <p className="text-muted-foreground mt-1">
                Create and compare different cost scenarios and what-if analyses
              </p>
            </div>
          </div>
          
          <Button className="flex items-center space-x-2">
            <Plus size={16} />
            <span>Create Scenario</span>
          </Button>
        </div>
      </div>

      {/* Scenarios Grid */}
      <div className="grid gap-6">
        {scenarios.map((scenario) => (
          <Card key={scenario.id} className="glass-card hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-3">
                    <h3 className="text-xl font-semibold">{scenario.name}</h3>
                    <Badge variant={scenario.type === 'baseline' ? 'default' : 'secondary'}>
                      {scenario.type === 'baseline' ? 'Baseline' : 'Scenario'}
                    </Badge>
                    <Badge variant={
                      scenario.status === 'active' ? 'default' :
                      scenario.status === 'review' ? 'secondary' : 'outline'
                    }>
                      {scenario.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Total Project Cost</div>
                      <div className="text-2xl font-bold text-foreground">
                        ${scenario.total_cost.toLocaleString()}
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-sm text-muted-foreground">Variance from Baseline</div>
                      <div className={`text-2xl font-bold ${
                        scenario.total_cost > 1200000 ? 'text-destructive' : 
                        scenario.total_cost < 1200000 ? 'text-primary' : 'text-muted-foreground'
                      }`}>
                        {scenario.total_cost === 1200000 ? 'Baseline' : 
                         `${scenario.total_cost > 1200000 ? '+' : ''}${((scenario.total_cost - 1200000) / 1200000 * 100).toFixed(1)}%`}
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-sm text-muted-foreground">Created</div>
                      <div className="text-lg font-semibold">{scenario.created_date}</div>
                    </div>
                  </div>

                  {/* Scenario Details */}
                  {scenario.id === 'scenario_1' && (
                    <div className="mt-4 p-4 bg-muted/30 rounded-lg">
                      <div className="text-sm font-medium mb-2">Adjustments:</div>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• Senior Developer rates: -15% ($7,225 → $6,141)</li>
                        <li>• Junior Developer rates: -15% ($4,200 → $3,570)</li>
                        <li>• Assumes improved market conditions</li>
                      </ul>
                    </div>
                  )}

                  {scenario.id === 'scenario_2' && (
                    <div className="mt-4 p-4 bg-muted/30 rounded-lg">
                      <div className="text-sm font-medium mb-2">Adjustments:</div>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• USD/COP rate: 4,200 → 5,040 (+20%)</li>
                        <li>• COP-denominated costs increased accordingly</li>
                        <li>• Hedging costs added (+2%)</li>
                      </ul>
                    </div>
                  )}
                </div>

                <div className="flex space-x-2 ml-4">
                  <Button size="sm" variant="outline" className="flex items-center space-x-2">
                    <Copy size={14} />
                    <span>Clone</span>
                  </Button>
                  <Button size="sm">View Details</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Scenario Comparison */}
      <Card className="glass-card mt-8">
        <CardHeader>
          <CardTitle>Scenario Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-muted/30 rounded-lg p-8 text-center">
            <GitBranch size={48} className="mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Detailed Comparison View</h3>
            <p className="text-muted-foreground">
              Side-by-side comparison of scenarios with waterfall variance analysis
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}