import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreditCard, TrendUp, TrendDown } from '@phosphor-icons/react';

export function CashFlowAnalysis() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <div className="flex items-center space-x-3">
          <CreditCard size={32} className="text-sdmt" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Cash Flow & Margin Analysis</h1>
            <p className="text-muted-foreground mt-1">
              Track inflows vs outflows and project margin performance
            </p>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="glass-card">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <TrendUp size={24} className="text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">$1.5M</div>
                <p className="text-muted-foreground text-sm">Total Inflows</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-card">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-destructive/10 rounded-lg">
                <TrendDown size={24} className="text-destructive" />
              </div>
              <div>
                <div className="text-2xl font-bold">$1.2M</div>
                <p className="text-muted-foreground text-sm">Total Outflows</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-card">
          <CardContent className="pt-6">
            <div>
              <div className="text-2xl font-bold text-primary">$300K</div>
              <p className="text-muted-foreground text-sm">Net Cash Flow</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-card">
          <CardContent className="pt-6">
            <div>
              <div className="text-2xl font-bold text-primary">20%</div>
              <p className="text-muted-foreground text-sm">Margin %</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Cash Flow Overlay</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 bg-muted/30 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <CreditCard size={48} className="mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Inflows vs Outflows Chart</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Margin Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 bg-muted/30 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <TrendUp size={48} className="mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Margin % Over Time</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown */}
      <Card className="glass-card mt-8">
        <CardHeader>
          <CardTitle>Cost Category Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { category: 'Labor', amount: '$850K', percentage: '71%', color: 'bg-primary' },
              { category: 'Software', amount: '$180K', percentage: '15%', color: 'bg-accent' },
              { category: 'Infrastructure', amount: '$170K', percentage: '14%', color: 'bg-sdmt' },
            ].map((item) => (
              <div key={item.category} className="p-4 border border-border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold">{item.category}</span>
                  <span className="text-sm text-muted-foreground">{item.percentage}</span>
                </div>
                <div className="text-xl font-bold">{item.amount}</div>
                <div className="w-full bg-muted rounded-full h-2 mt-2">
                  <div className={`${item.color} h-2 rounded-full`} style={{ width: item.percentage }}></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}