import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendUp, TrendDown, Download, ChartLine } from '@phosphor-icons/react';
import ApiService from '@/lib/api';

export function CashFlowAnalysis() {
  const { data: cashFlowData, isLoading } = useQuery({
    queryKey: ['cashflow', 'PRJ-IKUSI-PLATFORM'],
    queryFn: () => ApiService.getCashFlow('PRJ-IKUSI-PLATFORM'),
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (pct: number) => {
    return `${pct.toFixed(1)}%`;
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-6"></div>
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className="h-64 bg-muted rounded"></div>
            <div className="h-64 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!cashFlowData) return null;

  const totalInflows = cashFlowData.inflows.reduce((sum, item) => sum + item.amount, 0);
  const totalOutflows = cashFlowData.outflows.reduce((sum, item) => sum + item.amount, 0);
  const netCashFlow = totalInflows - totalOutflows;
  const averageMargin = cashFlowData.margin_pct.reduce((sum, item) => sum + item.pct, 0) / cashFlowData.margin_pct.length;

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center space-x-2">
            <span>Cash Flow & Margin Analysis</span>
            <Badge className="module-badge-sdmt">SDMT</Badge>
          </h1>
          <p className="text-muted-foreground">
            Monitor project profitability and cash position with drill-down capability
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" className="flex items-center space-x-2">
            <Download size={16} />
            <span>Export Report</span>
          </Button>
          <Button variant="outline" className="flex items-center space-x-2">
            <ChartLine size={16} />
            <span>Drill to Forecast</span>
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-6 text-center">
            <div className="flex items-center justify-center mb-2">
              <TrendUp size={24} className="text-green-600" />
            </div>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(totalInflows)}
            </div>
            <div className="text-sm text-muted-foreground">Total Inflows</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <div className="flex items-center justify-center mb-2">
              <TrendDown size={24} className="text-red-600" />
            </div>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(totalOutflows)}
            </div>
            <div className="text-sm text-muted-foreground">Total Outflows</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(netCashFlow)}
            </div>
            <div className="text-sm text-muted-foreground">Net Cash Flow</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-bold text-purple-600">
              {formatPercentage(averageMargin)}
            </div>
            <div className="text-sm text-muted-foreground">Average Margin</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Placeholder */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Cash Flow Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center text-center">
              <div>
                <div className="text-lg mb-2">📊 Area Chart</div>
                <div className="text-sm text-muted-foreground">
                  Overlay chart showing inflows vs outflows by month
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Margin Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center text-center">
              <div>
                <div className="text-lg mb-2">📈 Line Chart</div>
                <div className="text-sm text-muted-foreground">
                  Margin percentage trend over time
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Breakdown */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Monthly Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-3 font-medium">Month</th>
                  <th className="text-right p-3 font-medium">Inflows</th>
                  <th className="text-right p-3 font-medium">Outflows</th>
                  <th className="text-right p-3 font-medium">Net</th>
                  <th className="text-right p-3 font-medium">Margin %</th>
                </tr>
              </thead>
              <tbody>
                {cashFlowData.inflows.slice(0, 6).map((inflow) => {
                  const outflow = cashFlowData.outflows.find(o => o.month === inflow.month);
                  const margin = cashFlowData.margin_pct.find(m => m.month === inflow.month);
                  const net = inflow.amount - (outflow?.amount || 0);
                  
                  return (
                    <tr key={inflow.month} className="border-b border-border hover:bg-accent/50">
                      <td className="p-3 font-medium">Month {inflow.month}</td>
                      <td className="p-3 text-right text-green-600 font-medium">
                        {formatCurrency(inflow.amount)}
                      </td>
                      <td className="p-3 text-right text-red-600 font-medium">
                        {formatCurrency(outflow?.amount || 0)}
                      </td>
                      <td className={`p-3 text-right font-medium ${
                        net >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatCurrency(net)}
                      </td>
                      <td className="p-3 text-right font-medium text-purple-600">
                        {formatPercentage(margin?.pct || 0)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Category Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Cost Category Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-center">
            <div>
              <div className="text-lg mb-2">🍩 Donut Chart</div>
              <div className="text-sm text-muted-foreground">
                Outflow breakdown by cost category (Labor, Software, Hardware, Services)
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}