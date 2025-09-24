import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface StackedColumnsChartProps {
  data: Array<{
    month: number;
    [key: string]: number;
  }>;
  stacks: Array<{
    dataKey: string;
    name: string;
    color?: string;
  }>;
  title?: string;
  className?: string;
}

const DEFAULT_COLORS = [
  'oklch(0.61 0.15 160)', // Primary green
  'oklch(0.58 0.15 180)', // SDMT teal
  'oklch(0.72 0.15 65)',  // Accent orange
  'oklch(0.45 0.12 200)', // Blue
  'oklch(0.65 0.2 30)',   // Red
];

export function StackedColumnsChart({ 
  data, 
  stacks, 
  title,
  className = ""
}: StackedColumnsChartProps) {
  const stacksWithColors = stacks.map((stack, index) => ({
    ...stack,
    color: stack.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium mb-2">Month {label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded" 
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-sm">{entry.name}:</span>
              </div>
              <span className="text-sm font-medium">
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD',
                  minimumFractionDigits: 0,
                }).format(entry.value)}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  if (!data || data.length === 0) {
    return (
      <Card className={className}>
        {title && (
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{title}</CardTitle>
          </CardHeader>
        )}
        <CardContent className="flex items-center justify-center h-[300px]">
          <p className="text-muted-foreground">No data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      {title && (
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={data}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.90 0.02 160)" />
            <XAxis 
              dataKey="month" 
              stroke="oklch(0.45 0 0)"
              fontSize={12}
              tickFormatter={(value) => `M${value}`}
            />
            <YAxis 
              stroke="oklch(0.45 0 0)"
              fontSize={12}
              tickFormatter={(value) => 
                new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD',
                  minimumFractionDigits: 0,
                  notation: 'compact',
                }).format(value)
              }
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              formatter={(value) => <span className="text-sm">{value}</span>}
            />
            {stacksWithColors.map((stack) => (
              <Bar 
                key={stack.dataKey}
                dataKey={stack.dataKey} 
                name={stack.name}
                stackId="a" 
                fill={stack.color}
                radius={[2, 2, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export default StackedColumnsChart;