import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DonutChartProps {
  data: Array<{
    name: string;
    value: number;
    color?: string;
  }>;
  title?: string;
  subtitle?: string;
  innerRadius?: number;
  outerRadius?: number;
  className?: string;
}

const COLORS = [
  'oklch(0.61 0.15 160)', // Primary green
  'oklch(0.58 0.15 180)', // SDMT teal
  'oklch(0.72 0.15 65)',  // Accent orange
  'oklch(0.45 0.12 200)', // Blue
  'oklch(0.65 0.2 30)',   // Red
  'oklch(0.55 0.15 280)', // Purple
];

export function DonutChart({ 
  data, 
  title,
  subtitle,
  innerRadius = 60, 
  outerRadius = 100,
  className = ""
}: DonutChartProps) {
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{data.name}</p>
          <p className="text-primary">
            {new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
              minimumFractionDigits: 0,
            }).format(data.value)}
          </p>
        </div>
      );
    }
    return null;
  };

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.05) return null; // Don't show labels for slices smaller than 5%
    
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        className="text-xs font-medium"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  // Filter out zero-value entries and check if we have meaningful data
  const meaningfulData = data.filter(item => item.value > 0);
  
  if (!data || data.length === 0 || meaningfulData.length === 0) {
    return (
      <Card className={className}>
        {title && (
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{title}</CardTitle>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
          </CardHeader>
        )}
        <CardContent className="flex items-center justify-center h-[300px]">
          <div className="text-center space-y-2">
            <p className="text-muted-foreground">No hay datos disponibles</p>
            <p className="text-xs text-muted-foreground">
              {data.length > 0 && meaningfulData.length === 0 
                ? "Todos los valores son cero"
                : "Agrega proyectos con presupuesto para ver la distribución"}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Use meaningful data only (filter zero values for better visualization)
  const displayData = meaningfulData.map((item, index) => ({
    ...item,
    color: item.color || COLORS[index % COLORS.length]
  }));

  return (
    <Card className={className}>
      {title && (
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{title}</CardTitle>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          )}
        </CardHeader>
      )}
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={displayData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderCustomizedLabel}
              outerRadius={outerRadius}
              innerRadius={innerRadius}
              fill="#8884d8"
              dataKey="value"
            >
              {displayData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              verticalAlign="bottom" 
              height={36}
              formatter={(value) => <span className="text-sm">{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export default DonutChart;