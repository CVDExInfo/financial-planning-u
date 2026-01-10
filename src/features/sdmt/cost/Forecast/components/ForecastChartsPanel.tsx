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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import LineChartComponent from '@/components/charts/LineChart';
import type { PortfolioTotals, CategoryTotals } from '../categoryGrouping';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface ForecastChartsPanelProps {
  portfolioTotals: PortfolioTotals;
  categoryTotals: Map<string, CategoryTotals>;
  monthlyBudgets?: Array<{ month: number; budget: number }>;
  useMonthlyBudget?: boolean;
  formatCurrency: (amount: number) => string;
}

// Consistent color palette for charts
const CHART_COLORS = {
  forecast: 'oklch(0.61 0.15 160)', // Teal
  actual: 'oklch(0.72 0.15 65)', // Blue
  budget: 'oklch(0.5 0.2 350)', // Gray/Green
  planned: 'oklch(0.45 0.12 200)', // Light Blue
};

export function ForecastChartsPanel({
  portfolioTotals,
  categoryTotals,
  monthlyBudgets = [],
  useMonthlyBudget = false,
  formatCurrency,
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
    
    return {
      month,
      Forecast: monthData.forecast,
      Actual: monthData.actual,
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

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Gráficos de Tendencias</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)}>
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="monthly">Tendencia Mensual</TabsTrigger>
            <TabsTrigger value="category">Por Rubro</TabsTrigger>
            <TabsTrigger value="cumulative">Acumulado</TabsTrigger>
          </TabsList>

          {/* Monthly Trend Tab */}
          <TabsContent value="monthly">
            <LineChartComponent
              data={monthlyTrendData}
              lines={[
                {
                  dataKey: 'Forecast',
                  name: 'Pronóstico',
                  color: CHART_COLORS.forecast,
                  strokeWidth: 3,
                },
                {
                  dataKey: 'Actual',
                  name: 'Real',
                  color: CHART_COLORS.actual,
                  strokeWidth: 2,
                },
                ...(useMonthlyBudget
                  ? [
                      {
                        dataKey: 'Budget',
                        name: 'Presupuesto',
                        color: CHART_COLORS.budget,
                        strokeDasharray: '8 4',
                        strokeWidth: 2,
                      },
                    ]
                  : []),
              ]}
              title="Tendencia Mensual"
              labelPrefix="Mes"
              valueFormatter={formatCurrency}
            />
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
    </Card>
  );
}
