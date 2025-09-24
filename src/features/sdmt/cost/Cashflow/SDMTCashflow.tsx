import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { ChartInsightsPanel } from '@/components/ChartInsightsPanel';
import LineChartComponent from '@/components/charts/LineChart';

export function SDMTCashflow() {
  // Mock data for demonstration
  const cashflowData = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    Inflows: 100000 + Math.random() * 20000,
    Outflows: 85000 + Math.random() * 15000,
    'Net Flow': 0
  })).map(item => ({
    ...item,
    'Net Flow': item.Inflows - item.Outflows
  }));

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Cash Flow & Margin Analysis</h1>
          <p className="text-muted-foreground">Monitor project cash flows and profitability metrics</p>
        </div>
        <Badge className="module-badge-sdmt">SDMT Module</Badge>
      </div>

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

      <ChartInsightsPanel
        title="Cash Flow Analysis"
        charts={[
          <LineChartComponent
            key="cashflow-trends"
            data={cashflowData}
            lines={[
              { dataKey: 'Inflows', name: 'Inflows', color: 'oklch(0.55 0.15 140)' },
              { dataKey: 'Outflows', name: 'Outflows', color: 'oklch(0.65 0.2 30)' },
              { dataKey: 'Net Flow', name: 'Net Cash Flow', color: 'oklch(0.61 0.15 160)', strokeWidth: 3 }
            ]}
            title="Monthly Cash Flow Trends"
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
    </div>
  );
}

export default SDMTCashflow;