/**
 * ForecastChartsPanel Component
 * 
 * Displays interactive charts for TODOS (ALL_PROJECTS) mode:
 * - Monthly Trend (line chart)
 * - By Category (bar chart)
 * - Cumulative (line chart)
 * 
 * Uses tabs for switching between chart modes
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronDown } from 'lucide-react';
import LineChartComponent from '@/components/charts/LineChart';
import type { PortfolioTotals, CategoryTotals } from '../categoryGrouping';
import { 
  Bar,
  BarChart, 
  CartesianGrid, 
  ComposedChart,
  LabelList,
  Legend,
  Line,
  ResponsiveContainer, 
  Tooltip, 
  XAxis, 
  YAxis, 
} from 'recharts';

interface ForecastChartsPanelProps {
  portfolioTotals: PortfolioTotals;
  categoryTotals: Map<string, CategoryTotals>;
  monthlyBudgets?: Array<{ month: number; budget: number }>;
  useMonthlyBudget?: boolean;
  formatCurrency: (amount: number) => string;
  projectsPerMonth?: Array<{ month: number; count: number }>;
}

// Consistent color palette for charts
const CHART_COLORS = {
  forecast: 'oklch(0.61 0.15 160)', // Teal
  actual: 'oklch(0.72 0.15 65)', // Blue
  budget: 'oklch(0.5 0.2 350)', // Gray/Green
  planned: 'oklch(0.45 0.12 200)', // Light Blue
  projects: 'oklch(0.65 0.18 30)', // Orange for projects bar
};

// Chart styling constants
const CHART_STYLES = {
  barOpacity: 0.7,
};

export function ForecastChartsPanel({
  portfolioTotals,
  categoryTotals,
  monthlyBudgets = [],
  useMonthlyBudget = false,
  formatCurrency,
  projectsPerMonth = [],
}: ForecastChartsPanelProps) {
  const [activeTab, setActiveTab] = useState<'monthly' | 'category' | 'cumulative'>('monthly');

  // Build monthly trend data
  const monthlyTrendData = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const monthData = portfolioTotals.byMonth[month] || {
      forecast: 0,
      actual: 0,
      planned: 0,
    };
    
    const budgetData = monthlyBudgets.find(b => b.month === month);
    const projectCount = projectsPerMonth.find(p => p.month === month)?.count || 0;
    
    return {
      month,
      Forecast: monthData.forecast,
      Actual: monthData.actual,
      Proyectos: projectCount,
      ...(useMonthlyBudget && budgetData ? { Budget: budgetData.budget } : {}),
    };
  });

  // Build category data (total for the year)
  const categoryData = Array.from(categoryTotals.entries()).map(([category, totals]) => ({
    name: category,
    Forecast: totals.overall.forecast,
    Actual: totals.overall.actual,
  }));

  // Build cumulative data
  const cumulativeData = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    let cumForecast = 0;
    let cumActual = 0;
    let cumBudget = 0;

    // Sum up to current month
    for (let m = 1; m <= month; m++) {
      const monthData = portfolioTotals.byMonth[m];
      if (monthData) {
        cumForecast += monthData.forecast;
        cumActual += monthData.actual;
      }
      
      const budgetData = monthlyBudgets.find(b => b.month === m);
      if (budgetData && useMonthlyBudget) {
        cumBudget += budgetData.budget;
      }
    }

    return {
      month,
      'Forecast Acumulado': cumForecast,
      'Actual Acumulado': cumActual,
      ...(useMonthlyBudget ? { 'Budget Acumulado': cumBudget } : {}),
    };
  });

  // Custom tooltip for bar chart
  const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium mb-2">{label}</p>
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
                {formatCurrency(entry.value)}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  // Custom tooltip for monthly trend (supports both currency and count)
  const CustomMonthlyTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium mb-2">Mes {label}</p>
          {payload.map((entry: any, index: number) => {
            const isProjectCount = entry.dataKey === 'Proyectos';
            return (
              <div key={index} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-sm">{entry.name}:</span>
                </div>
                <span className="text-sm font-medium">
                  {isProjectCount ? entry.value : formatCurrency(entry.value)}
                </span>
              </div>
            );
          })}
        </div>
      );
    }
    return null;
  };

  return (
    <Collapsible defaultOpen={false}>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Gráficos de Tendencias</CardTitle>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                aria-label="Expandir/Colapsar gráficos de tendencias"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent>
        <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)}>
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="monthly">Tendencia Mensual</TabsTrigger>
            <TabsTrigger value="category">Por Rubro</TabsTrigger>
            <TabsTrigger value="cumulative">Acumulado</TabsTrigger>
          </TabsList>

          {/* Monthly Trend Tab */}
          <TabsContent value="monthly">
            <Card className="border-0 shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Tendencia Mensual</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <ComposedChart
                    data={monthlyTrendData}
                    margin={{
                      top: 10,
                      right: 40,
                      left: 0,
                      bottom: 10,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.90 0.02 160)" />
                    <XAxis
                      dataKey="month"
                      stroke="oklch(0.45 0 0)"
                      fontSize={12}
                      label={{ value: 'Mes', position: 'insideBottom', offset: -5 }}
                    />
                    {/* Left Y-axis for currency values */}
                    <YAxis
                      yAxisId="left"
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
                    {/* Right Y-axis for project count */}
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      stroke="oklch(0.45 0 0)"
                      fontSize={12}
                      label={{ value: 'Proyectos', angle: 90, position: 'insideRight' }}
                      tickFormatter={(value) => Math.round(value).toString()}
                    />
                    <Tooltip content={<CustomMonthlyTooltip />} />
                    <Legend formatter={(value) => <span className="text-sm">{value}</span>} />
                    
                    {/* Lines for financial data */}
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="Forecast"
                      name="Pronóstico"
                      stroke={CHART_COLORS.forecast}
                      strokeWidth={3}
                      dot={{ fill: CHART_COLORS.forecast, r: 4 }}
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="Actual"
                      name="Real"
                      stroke={CHART_COLORS.actual}
                      strokeWidth={2}
                      dot={{ fill: CHART_COLORS.actual, r: 3 }}
                    />
                    {useMonthlyBudget && (
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="Budget"
                        name="Presupuesto"
                        stroke={CHART_COLORS.budget}
                        strokeWidth={2}
                        strokeDasharray="8 4"
                        dot={{ fill: CHART_COLORS.budget, r: 3 }}
                      />
                    )}
                    
                    {/* Bar for project count */}
                    <Bar
                      yAxisId="right"
                      dataKey="Proyectos"
                      name="Proyectos (M/M)"
                      fill="#6366f1"
                      fillOpacity={0.16}
                      stroke="#6366f1"
                      barSize={12}
                    >
                      <LabelList 
                        dataKey="Proyectos" 
                        position="top" 
                        style={{ fontSize: 10, fill: '#475569', opacity: 0.85 }} 
                      />
                    </Bar>
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* By Category Tab */}
          <TabsContent value="category">
            <Card className="border-0 shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Por Rubro (Total Año)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={categoryData}
                    margin={{
                      top: 20,
                      right: 30,
                      left: 20,
                      bottom: 5,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.90 0.02 160)" />
                    <XAxis
                      dataKey="name"
                      stroke="oklch(0.45 0 0)"
                      fontSize={12}
                      angle={-45}
                      textAnchor="end"
                      height={80}
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
                    <Tooltip content={<CustomBarTooltip />} />
                    <Legend formatter={(value) => <span className="text-sm">{value}</span>} />
                    <Bar dataKey="Forecast" name="Pronóstico" fill={CHART_COLORS.forecast} />
                    <Bar dataKey="Actual" name="Real" fill={CHART_COLORS.actual} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Cumulative Tab */}
          <TabsContent value="cumulative">
            <LineChartComponent
              data={cumulativeData}
              lines={[
                {
                  dataKey: 'Forecast Acumulado',
                  name: 'Pronóstico Acumulado',
                  color: CHART_COLORS.forecast,
                  strokeWidth: 3,
                },
                {
                  dataKey: 'Actual Acumulado',
                  name: 'Real Acumulado',
                  color: CHART_COLORS.actual,
                  strokeWidth: 2,
                },
                ...(useMonthlyBudget
                  ? [
                      {
                        dataKey: 'Budget Acumulado',
                        name: 'Presupuesto Acumulado',
                        color: CHART_COLORS.budget,
                        strokeDasharray: '8 4',
                        strokeWidth: 2,
                      },
                    ]
                  : []),
              ]}
              title="Tendencia Acumulada"
              labelPrefix="Mes"
              valueFormatter={formatCurrency}
            />
          </TabsContent>
        </Tabs>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
