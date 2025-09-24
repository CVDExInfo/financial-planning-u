import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface LineChartProps {
  data: Array<{
    month: number;
    [key: string]: number;
  }>;
  lines: Array<{
    dataKey: string;
    name: string;
    color?: string;
    strokeWidth?: number;
    strokeDasharray?: string;
  }>;
  title?: string;
  className?: string;
}

const DEFAULT_COLORS = [
  'oklch(0.61 0.15 160)', // Primary green
  'oklch(0.72 0.15 65)',  // Accent orange
  'oklch(0.65 0.2 30)',   // Red
  'oklch(0.58 0.15 180)', // SDMT teal
  'oklch(0.45 0.12 200)', // Blue
];

export function LineChartComponent({ 
  data, 
  lines, 
  title,
  className = ""
}: LineChartProps) {
  const linesWithColors = lines.map((line, index) => ({
    ...line,
    color: line.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length],
    strokeWidth: line.strokeWidth || 2
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
                  className="w-3 h-0.5 rounded" 
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
          <LineChart
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
            {linesWithColors.map((line) => (
              <Line
                key={line.dataKey}
                type="monotone"
                dataKey={line.dataKey}
                name={line.name}
                stroke={line.color}
                strokeWidth={line.strokeWidth}
                strokeDasharray={line.strokeDasharray}
                dot={{ fill: line.color, strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: line.color, strokeWidth: 2 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export default LineChartComponent;