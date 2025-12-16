/**
 * Hub de Desempeño - Financial Performance Hub
 * Executive dashboard for SDMT and EXEC_RO roles
 * 
 * Provides consolidated view of:
 * - Budget performance (baseline vs adjusted vs actual)
 * - Cashflow implications
 * - Risk concentration
 * - Project health and attention needs
 */

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Download,
  RefreshCw,
  Calendar,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { DonutChart } from "@/components/charts/DonutChart";
import { toast } from "sonner";
import { useProject } from "@/contexts/ProjectContext";

interface HubSummary {
  scope: string;
  currency: string;
  asOf: string;
  kpis: {
    baselineMOD: number;
    allocations: number;
    adjustedMOD: number;
    actualPayroll: number;
    variance: number;
    variancePercent: number;
    burnRate: number;
    paidMonthsCount: number;
    riskFlagsCount: number;
  };
  projectsCount: number;
}

interface ModPerformance {
  scope: string;
  currency: string;
  asOf: string;
  months: Array<{
    month: string;
    monthIndex: number;
    allocations: number;
    projectedAdjusted: number;
    actualPayroll: number;
    paid: boolean;
  }>;
}

interface RubrosBreakdown {
  scope: string;
  currency: string;
  asOf: string;
  modOnly: boolean;
  byCategory: Array<{
    category: string;
    amount: number;
    percentage: number;
  }>;
  byRubro: Array<{
    rubro: string;
    amount: number;
    percentage: number;
  }>;
  total: number;
}

interface Cashflow {
  scope: string;
  currency: string;
  asOf: string;
  months: Array<{
    month: string;
    monthIndex: number;
    forecastedOutflow: number;
    actualOutflow: number;
    variance: number;
    topDrivers: Array<{
      rubro: string;
      amount: number;
    }>;
  }>;
}

export default function HubDesempeno() {
  const { projects, selectedProject, selectProject } = useProject();
  const [scope, setScope] = useState<string>("ALL");
  const [summary, setSummary] = useState<HubSummary | null>(null);
  const [modPerformance, setModPerformance] = useState<ModPerformance | null>(null);
  const [rubrosBreakdown, setRubrosBreakdown] = useState<RubrosBreakdown | null>(null);
  const [cashflow, setCashflow] = useState<Cashflow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [modOnly, setModOnly] = useState(true);

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

  useEffect(() => {
    if (selectedProject?.id) {
      setScope(selectedProject.id);
    }
  }, [selectedProject?.id]);

  const projectOptions = useMemo(
    () =>
      projects.map((project) => ({
        value: project.id,
        label: project.name || project.id,
        code: project.code,
      })),
    [projects]
  );

  const handleScopeChange = (value: string) => {
    setScope(value);
    const match = projects.find((project) => project.id === value);
    if (match) {
      selectProject(match);
    }
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("finz_jwt");
      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };

      // Fetch all data in parallel with allSettled to handle partial failures
      const results = await Promise.allSettled([
        fetch(`${apiBaseUrl}/finanzas/hub/summary?scope=${scope}`, { headers }).then(res => 
          res.ok ? res.json() : Promise.reject({ endpoint: 'summary', status: res.status })
        ),
        fetch(`${apiBaseUrl}/finanzas/hub/mod-performance?scope=${scope}`, { headers }).then(res => 
          res.ok ? res.json() : Promise.reject({ endpoint: 'mod-performance', status: res.status })
        ),
        fetch(`${apiBaseUrl}/finanzas/hub/rubros-breakdown?scope=${scope}&modOnly=${modOnly}`, { headers }).then(res => 
          res.ok ? res.json() : Promise.reject({ endpoint: 'rubros-breakdown', status: res.status })
        ),
        fetch(`${apiBaseUrl}/finanzas/hub/cashflow?scope=${scope}`, { headers }).then(res => 
          res.ok ? res.json() : Promise.reject({ endpoint: 'cashflow', status: res.status })
        ),
      ]);

      // Process results and set available data
      const [summaryResult, modPerfResult, rubrosResult, cashflowResult] = results;

      if (summaryResult.status === 'fulfilled') {
        setSummary(summaryResult.value);
      } else {
        console.error('Failed to fetch summary:', summaryResult.reason);
        setSummary(null);
      }

      if (modPerfResult.status === 'fulfilled') {
        setModPerformance(modPerfResult.value);
      } else {
        console.error('Failed to fetch mod-performance:', modPerfResult.reason);
        setModPerformance(null);
      }

      if (rubrosResult.status === 'fulfilled') {
        setRubrosBreakdown(rubrosResult.value);
      } else {
        console.error('Failed to fetch rubros-breakdown:', rubrosResult.reason);
        setRubrosBreakdown(null);
      }

      if (cashflowResult.status === 'fulfilled') {
        setCashflow(cashflowResult.value);
      } else {
        console.error('Failed to fetch cashflow:', cashflowResult.reason);
        setCashflow(null);
      }

      // Report failures to user if any
      const failures = results.filter(r => r.status === 'rejected');
      if (failures.length > 0) {
        const failedEndpoints = failures
          .map(f => f.status === 'rejected' && f.reason?.endpoint ? f.reason.endpoint : 'unknown')
          .join(', ');
        toast.warning(`Algunos datos no están disponibles: ${failedEndpoints}`, {
          description: "Mostrando datos parciales disponibles"
        });
      }

      setLastUpdate(new Date());
    } catch (error) {
      console.error("Error fetching hub data:", error);
      toast.error("Error al cargar los datos del Hub");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [scope, modOnly]);

  const handleExport = async () => {
    try {
      const token = localStorage.getItem("finz_jwt");
      const response = await fetch(`${apiBaseUrl}/finanzas/hub/export`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          scope,
          dateRange: "12months",
          sections: ["summary", "mod-performance", "cashflow", "rubros"],
        }),
      });

      if (!response.ok) {
        throw new Error("Export failed");
      }

      const result = await response.json();
      toast.success("Exportación iniciada", {
        description: "El reporte se generará en breve",
      });
    } catch (error) {
      console.error("Error exporting:", error);
      toast.error("Error al exportar el reporte");
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: summary?.currency || "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
  };

  // Transform rubros data for DonutChart
  const rubrosChartData = rubrosBreakdown?.byCategory.map((item) => ({
    name: item.category,
    value: item.amount,
  })) || [];

  // Generate insights
  const insights: string[] = [];
  if (summary) {
    if (Math.abs(summary.kpis.variancePercent) > 12) {
      insights.push(
        `Variación MOD de ${formatPercent(summary.kpis.variancePercent)} supera el umbral de alerta (±12%)`
      );
    }
    if (summary.kpis.riskFlagsCount > 0) {
      insights.push(
        `${summary.kpis.riskFlagsCount} proyecto${summary.kpis.riskFlagsCount > 1 ? "s" : ""} con riesgo alto requieren atención`
      );
    }
    if (summary.kpis.paidMonthsCount < 6) {
      insights.push(
        `Solo ${summary.kpis.paidMonthsCount} meses pagados - considerar actualizar nómina real`
      );
    }
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <PageHeader
        title="Hub de Desempeño"
        badge="Executive"
        description="Visión ejecutiva de MOD, costos, ajustes y nómina consolidada desde DynamoDB"
        icon={<TrendingUp className="h-5 w-5 text-white" />}
      />

      {/* Controls */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Select value={scope} onValueChange={handleScopeChange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Seleccionar alcance" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos los proyectos</SelectItem>
              {projectOptions.map((project) => (
                <SelectItem key={project.value} value={project.value}>
                  {project.label}
                  {project.code ? ` (${project.code})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={modOnly ? "true" : "false"} onValueChange={(v) => setModOnly(v === "true")}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtro rubros" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Solo MOD</SelectItem>
              <SelectItem value="false">Todos los rubros</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>Actualizado: {lastUpdate.toLocaleTimeString()}</span>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          <Button variant="default" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Exportar Excel
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* KPI Tiles */}
          {summary && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Baseline MOD</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(summary.kpis.baselineMOD)}</div>
                  <p className="text-xs text-muted-foreground">Presupuesto inicial aprobado</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Asignaciones</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(summary.kpis.allocations)}</div>
                  <p className="text-xs text-muted-foreground">MOD distribuido</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">MOD Ajustado</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(summary.kpis.adjustedMOD)}</div>
                  <p className="text-xs text-muted-foreground">Con ajustes aplicados</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Nómina Real</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(summary.kpis.actualPayroll)}</div>
                  <p className="text-xs text-muted-foreground">{summary.kpis.paidMonthsCount} meses pagados</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Variación</CardTitle>
                  {summary.kpis.variance >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-600" />
                  )}
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${summary.kpis.variance >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {formatCurrency(Math.abs(summary.kpis.variance))}
                  </div>
                  <p className="text-xs text-muted-foreground">{formatPercent(summary.kpis.variancePercent)}</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Insights Panel */}
          {insights.length > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Insights Clave</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1 mt-2">
                  {insights.map((insight, idx) => (
                    <li key={idx}>{insight}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Charts Row */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Rubros Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Distribución por Categoría</CardTitle>
                <CardDescription>
                  Breakdown de {modOnly ? "MOD" : "todos los rubros"} por categoría
                </CardDescription>
              </CardHeader>
              <CardContent>
                {rubrosChartData.length > 0 ? (
                  <DonutChart data={rubrosChartData} innerRadius={80} outerRadius={120} />
                ) : (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    No hay datos disponibles
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Cashflow Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Flujo de Caja (Últimos 6 Meses)</CardTitle>
                <CardDescription>Comparación forecast vs actual</CardDescription>
              </CardHeader>
              <CardContent>
                {cashflow && cashflow.months.length > 0 ? (
                  <div className="space-y-3">
                    {cashflow.months.slice(0, 6).map((month) => (
                      <div key={month.month} className="flex items-center justify-between">
                        <span className="text-sm font-medium">{month.month}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-muted-foreground">
                            {formatCurrency(month.forecastedOutflow)}
                          </span>
                          {month.actualOutflow > 0 && (
                            <>
                              <span className="text-sm font-semibold">
                                {formatCurrency(month.actualOutflow)}
                              </span>
                              <Badge
                                variant={month.variance >= 0 ? "default" : "destructive"}
                                className="min-w-[80px]"
                              >
                                {formatPercent((month.variance / month.forecastedOutflow) * 100)}
                              </Badge>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    No hay datos disponibles
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Projects Requiring Attention */}
          <Card>
            <CardHeader>
              <CardTitle>Proyectos Requiriendo Atención</CardTitle>
              <CardDescription>Proyectos con variación significativa o banderas de riesgo</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Proyecto</TableHead>
                    <TableHead>MOD Baseline</TableHead>
                    <TableHead>Nómina Actual</TableHead>
                    <TableHead>Variación</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Razón</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary && summary.kpis.riskFlagsCount > 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-sm text-muted-foreground">
                        {summary.kpis.riskFlagsCount} proyecto(s) con banderas de riesgo. Revisa los
                        tableros detallados para priorizar acciones.
                      </TableCell>
                    </TableRow>
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        <CheckCircle2 className="h-5 w-5 inline mr-2" />
                        No hay proyectos requiriendo atención inmediata
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
