import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { ReactNode } from 'react';

interface ChartInsightsPanelProps {
  title: string;
  charts: ReactNode[];
  insights?: Array<{
    title: string;
    value: string;
    change?: number;
    type?: 'positive' | 'negative' | 'neutral';
  }>;
  onExport?: () => void;
  className?: string;
}

export function ChartInsightsPanel({ 
  title, 
  charts, 
  insights, 
  onExport, 
  className = "" 
}: ChartInsightsPanelProps) {
  const getChangeIcon = (type?: string) => {
    switch (type) {
      case 'positive':
        return <TrendingUp size={16} className="text-green-600" />;
      case 'negative':
        return <TrendingDown size={16} className="text-red-600" />;
      default:
        return <Minus size={16} className="text-muted-foreground" />;
    }
  };

  const getChangeColor = (type?: string) => {
    switch (type) {
      case 'positive':
        return 'text-green-600';
      case 'negative':
        return 'text-red-600';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <Card className={`mt-8 glass-card ${className}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
        {onExport && (
          <Button variant="outline" size="sm" onClick={onExport} className="gap-2">
            <Download size={16} />
            Export
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {/* Key Insights */}
        {insights && insights.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {insights.map((insight, index) => (
              <div key={index} className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {insight.title}
                    </p>
                    <p className="text-2xl font-bold text-foreground">
                      {insight.value}
                    </p>
                  </div>
                  {insight.change !== undefined && (
                    <div className={`flex items-center gap-1 ${getChangeColor(insight.type)}`}>
                      {getChangeIcon(insight.type)}
                      <span className="text-sm font-medium">
                        {Math.abs(insight.change)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {charts.map((chart, index) => (
            <div key={index} className="min-h-[300px]">
              {chart}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default ChartInsightsPanel;