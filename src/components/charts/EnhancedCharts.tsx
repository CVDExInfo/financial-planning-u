import { useRef } from 'react';
import type { FC } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Maximize2, Filter } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface ChartData {
  [key: string]: any;
}

export interface ChartConfig {
  title: string;
  description?: string;
  dataKey: string;
  nameKey?: string;
  color?: string;
  colors?: string[];
  format?: 'currency' | 'percentage' | 'number';
  showLegend?: boolean;
  showGrid?: boolean;
  allowExport?: boolean;
  height?: number;
}

interface BaseChartProps {
  data: ChartData[];
  config: ChartConfig;
  className?: string;
  onExportPNG?: () => void;
  onExportPDF?: () => void;
  onDrillDown?: (dataPoint: any) => void;
}

/**
 * Enhanced Area Chart with overlay capabilities for cash flow analysis
 */
export const AreaOverlayChart: FC<BaseChartProps & {
  secondaryData?: ChartData[];
  secondaryConfig?: Partial<ChartConfig>;
}> = ({
  data,
  config,
  secondaryData,
  secondaryConfig,
  className,
  onExportPNG,
  onExportPDF,
  onDrillDown
}) => {
  const chartRef = useRef<HTMLDivElement>(null);

  const handleExportPNG = () => {
    if (chartRef.current && onExportPNG) {
      // Convert chart to PNG using html2canvas or similar
      onExportPNG();
    }
  };

  const formatValue = (value: number) => {
    switch (config.format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(value);
      case 'percentage':
        return `${(value * 100).toFixed(1)}%`;
      default:
        return new Intl.NumberFormat('en-US').format(value);
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass-card p-3 border rounded-lg shadow-lg">
          <p className="font-medium text-sm">{`Month ${label}`}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {`${entry.dataKey}: ${formatValue(entry.value)}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Card className={`glass-card ${className}`}>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg font-semibold">{config.title}</CardTitle>
          {config.description && (
            <CardDescription className="text-sm text-muted-foreground">
              {config.description}
            </CardDescription>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {config.allowExport && (
            <>
              <Button variant="outline" size="sm" onClick={handleExportPNG}>
                <Download className="h-4 w-4 mr-1" />
                PNG
              </Button>
              <Button variant="outline" size="sm" onClick={onExportPDF}>
                <Download className="h-4 w-4 mr-1" />
                PDF
              </Button>
            </>
          )}
          <Button variant="outline" size="sm">
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent ref={chartRef}>
        <ResponsiveContainer width="100%" height={config.height || 300}>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" opacity={config.showGrid ? 1 : 0} />
            <XAxis 
              dataKey={config.nameKey || 'month'} 
              className="text-sm"
              tick={{ fontSize: 12 }}
            />
            <YAxis 
              className="text-sm"
              tick={{ fontSize: 12 }}
              tickFormatter={formatValue}
            />
            <Tooltip content={<CustomTooltip />} />
            {config.showLegend && <Legend />}
            
            {/* Primary area */}
            <Area
              type="monotone"
              dataKey={config.dataKey}
              stroke={config.color || 'var(--primary)'}
              fill={config.color || 'var(--primary)'}
              fillOpacity={0.6}
              strokeWidth={2}
            />
            
            {/* Secondary overlay area */}
            {secondaryData && secondaryConfig && (
              <Area
                type="monotone"
                dataKey={secondaryConfig.dataKey || 'secondary'}
                stroke={secondaryConfig.color || 'var(--accent)'}
                fill={secondaryConfig.color || 'var(--accent)'}
                fillOpacity={0.3}
                strokeWidth={2}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

/**
 * Variance Waterfall Chart for showing budget changes
 */
export const VarianceWaterfallChart: FC<BaseChartProps & {
  baseline?: number;
}> = ({
  data,
  config,
  baseline = 0,
  className,
  onExportPNG,
  onExportPDF,
  onDrillDown
}) => {
  const chartRef = useRef<HTMLDivElement>(null);

  // Calculate cumulative values for waterfall effect
  const waterfallData = data.map((item, index) => {
    const previousTotal = index === 0 ? baseline : 
      baseline + data.slice(0, index).reduce((sum, d) => sum + (d[config.dataKey] || 0), 0);
    const currentValue = item[config.dataKey] || 0;
    const currentTotal = previousTotal + currentValue;

    return {
      ...item,
      previousTotal,
      currentValue,
      currentTotal,
      isPositive: currentValue >= 0,
      barHeight: Math.abs(currentValue),
      barStart: currentValue >= 0 ? previousTotal : currentTotal,
    };
  });

  const formatValue = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="glass-card p-3 border rounded-lg shadow-lg">
          <p className="font-medium text-sm">{label}</p>
          <p className="text-sm">
            {`Change: ${data.isPositive ? '+' : ''}${formatValue(data.currentValue)}`}
          </p>
          <p className="text-sm">
            {`Total: ${formatValue(data.currentTotal)}`}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className={`glass-card ${className}`}>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg font-semibold">{config.title}</CardTitle>
          {config.description && (
            <CardDescription>{config.description}</CardDescription>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {config.allowExport && (
            <>
              <Button variant="outline" size="sm" onClick={onExportPNG}>
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={() => onDrillDown && onDrillDown(data)}>
            <Filter className="h-4 w-4 mr-1" />
            Drill Down
          </Button>
        </div>
      </CardHeader>
      <CardContent ref={chartRef}>
        <ResponsiveContainer width="100%" height={config.height || 350}>
          <BarChart data={waterfallData}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis 
              dataKey={config.nameKey || 'name'} 
              className="text-sm"
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis 
              className="text-sm"
              tick={{ fontSize: 12 }}
              tickFormatter={formatValue}
            />
            <Tooltip content={<CustomTooltip />} />
            
            <Bar dataKey="barHeight" stackId="waterfall">
              {waterfallData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.isPositive ? 'var(--sdmt-accent)' : 'var(--destructive)'} 
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

/**
 * Multi-Series Line Chart for forecast vs actual trends
 */
export const MultiLineChart: FC<BaseChartProps & {
  series: Array<{
    dataKey: string;
    name: string;
    color: string;
    strokeDasharray?: string;
  }>;
}> = ({
  data,
  config,
  series,
  className,
  onExportPNG,
  onExportPDF,
  onDrillDown
}) => {
  const chartRef = useRef<HTMLDivElement>(null);

  const formatValue = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass-card p-3 border rounded-lg shadow-lg">
          <p className="font-medium text-sm">{`Month ${label}`}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {`${entry.name}: ${formatValue(entry.value)}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Card className={`glass-card ${className}`}>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg font-semibold">{config.title}</CardTitle>
          {config.description && (
            <CardDescription>{config.description}</CardDescription>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1">
            {series.map((s, index) => (
              <Badge key={index} variant="outline" style={{ borderColor: s.color }}>
                <div 
                  className="w-2 h-2 rounded-full mr-1" 
                  style={{ backgroundColor: s.color }}
                />
                {s.name}
              </Badge>
            ))}
          </div>
          {config.allowExport && (
            <Button variant="outline" size="sm" onClick={onExportPNG}>
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent ref={chartRef}>
        <ResponsiveContainer width="100%" height={config.height || 300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis 
              dataKey={config.nameKey || 'month'} 
              className="text-sm"
              tick={{ fontSize: 12 }}
            />
            <YAxis 
              className="text-sm"
              tick={{ fontSize: 12 }}
              tickFormatter={formatValue}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            
            {series.map((s, index) => (
              <Line
                key={index}
                type="monotone"
                dataKey={s.dataKey}
                stroke={s.color}
                strokeWidth={2}
                strokeDasharray={s.strokeDasharray}
                dot={{ r: 4, fill: s.color }}
                activeDot={{ r: 6, fill: s.color }}
                name={s.name}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

/**
 * Stacked Column Chart for category breakdown
 */
export const StackedColumnChart: FC<BaseChartProps & {
  stacks: Array<{
    dataKey: string;
    name: string;
    color: string;
  }>;
}> = ({
  data,
  config,
  stacks,
  className,
  onExportPNG,
  onExportPDF,
  onDrillDown
}) => {
  const chartRef = useRef<HTMLDivElement>(null);

  const formatValue = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const total = payload.reduce((sum: number, entry: any) => sum + entry.value, 0);
      return (
        <div className="glass-card p-3 border rounded-lg shadow-lg">
          <p className="font-medium text-sm">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {`${entry.name}: ${formatValue(entry.value)} (${((entry.value / total) * 100).toFixed(1)}%)`}
            </p>
          ))}
          <hr className="my-1" />
          <p className="text-sm font-medium">Total: {formatValue(total)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className={`glass-card ${className}`}>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg font-semibold">{config.title}</CardTitle>
          {config.description && (
            <CardDescription>{config.description}</CardDescription>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {config.allowExport && (
            <Button variant="outline" size="sm" onClick={onExportPNG}>
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent ref={chartRef}>
        <ResponsiveContainer width="100%" height={config.height || 350}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis 
              dataKey={config.nameKey || 'name'} 
              className="text-sm"
              tick={{ fontSize: 12 }}
            />
            <YAxis 
              className="text-sm"
              tick={{ fontSize: 12 }}
              tickFormatter={formatValue}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            
            {stacks.map((stack, index) => (
              <Bar
                key={index}
                dataKey={stack.dataKey}
                stackId="category"
                fill={stack.color}
                name={stack.name}
                onClick={(data, index) => onDrillDown && onDrillDown(data)}
                className="cursor-pointer hover:opacity-80 transition-opacity"
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

/**
 * Enhanced Donut Chart with center metrics
 */
export const DonutChart: FC<BaseChartProps & {
  centerMetric?: {
    value: number;
    label: string;
    format?: 'currency' | 'percentage' | 'number';
  };
}> = ({
  data,
  config,
  centerMetric,
  className,
  onExportPNG,
  onExportPDF,
  onDrillDown
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  
  const RADIAN = Math.PI / 180;
  const colors = config.colors || ['var(--primary)', 'var(--secondary)', 'var(--accent)', 'var(--muted)'];

  const formatValue = (value: number) => {
    switch (config.format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(value);
      case 'percentage':
        return `${(value * 100).toFixed(1)}%`;
      default:
        return new Intl.NumberFormat('en-US').format(value);
    }
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      const total = data.payload.total || 0;
      const percentage = total ? (data.value / total) * 100 : 0;
      
      return (
        <div className="glass-card p-3 border rounded-lg shadow-lg">
          <p className="font-medium text-sm">{data.name}</p>
          <p className="text-sm">{formatValue(data.value)}</p>
          <p className="text-xs text-muted-foreground">{percentage.toFixed(1)}% of total</p>
        </div>
      );
    }
    return null;
  };

  const renderCustomizedLabel = ({
    cx, cy, midAngle, innerRadius, outerRadius, percent
  }: any) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    if (percent < 0.05) return null; // Hide labels for small slices

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        fontSize={12}
        fontWeight="bold"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  const CenterMetric = () => {
    if (!centerMetric) return null;
    
    return (
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
        <tspan x="50%" dy="-0.5em" fontSize="24" fontWeight="bold" fill="var(--foreground)">
          {formatValue(centerMetric.value)}
        </tspan>
        <tspan x="50%" dy="1.5em" fontSize="14" fill="var(--muted-foreground)">
          {centerMetric.label}
        </tspan>
      </text>
    );
  };

  return (
    <Card className={`glass-card ${className}`}>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg font-semibold">{config.title}</CardTitle>
          {config.description && (
            <CardDescription>{config.description}</CardDescription>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {config.allowExport && (
            <Button variant="outline" size="sm" onClick={onExportPNG}>
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent ref={chartRef}>
        <ResponsiveContainer width="100%" height={config.height || 300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderCustomizedLabel}
              outerRadius={100}
              innerRadius={50}
              fill="#8884d8"
              dataKey={config.dataKey}
              onClick={(data, index) => onDrillDown && onDrillDown(data)}
              className="cursor-pointer"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <CenterMetric />
          </PieChart>
        </ResponsiveContainer>
        
        {/* Legend */}
        <div className="flex flex-wrap justify-center mt-4 gap-3">
          {data.map((entry, index) => (
            <div key={entry.name} className="flex items-center space-x-2">
              <div 
                className="w-3 h-3 rounded-sm" 
                style={{ backgroundColor: colors[index % colors.length] }}
              />
              <span className="text-sm text-foreground">{entry[config.nameKey || 'name']}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};