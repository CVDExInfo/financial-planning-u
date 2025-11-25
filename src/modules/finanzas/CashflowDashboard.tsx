import React from "react";
import { RefreshCcw, BarChart3 } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import StackedColumnsChart from "@/components/charts/StackedColumnsChart";
import LineChartComponent from "@/components/charts/LineChart";
import { useProject } from "@/contexts/ProjectContext";
import ApiService from "@/lib/api";
import { usePermissions } from "@/hooks/usePermissions";

export default function CashflowDashboard() {
  const { selectedProjectId, selectedPeriod, currentProject } = useProject();
  const { isSDMT } = usePermissions();
  const [cashflowData, setCashflowData] = React.useState<Array<{ month: number; Ingresos: number; Egresos: number; Neto: number }>>([]);
  const [marginData, setMarginData] = React.useState<Array<{ month: number; "Margen %": number }>>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const isReadOnly = !isSDMT;

  const months = Math.max(parseInt(selectedPeriod || "12", 10), 1);

  const currencyFormatter = React.useCallback(
    (value: number) =>
      new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(value),
    []
  );

  const loadCashflow = React.useCallback(async () => {
    if (!selectedProjectId) return;

    try {
      setLoading(true);
      setError(null);
      const data = await ApiService.getCashFlowData(selectedProjectId, months);

      const merged = Array.from({ length: months }, (_, index) => {
        const month = index + 1;
        const inflow = data.inflows.find((item) => item.month === month)?.amount || 0;
        const outflow = data.outflows.find((item) => item.month === month)?.amount || 0;
        return {
          month,
          Ingresos: inflow,
          Egresos: outflow,
          Neto: inflow - outflow,
        };
      });

      setCashflowData(merged);
      setMarginData(
        data.margin.map((item) => ({
          month: item.month,
          "Margen %": parseFloat(item.percentage.toFixed(1)),
        }))
      );
    } catch (e: any) {
      setError(e?.message || "No se pudo cargar el cash flow");
    } finally {
      setLoading(false);
    }
  }, [months, selectedProjectId]);

  React.useEffect(() => {
    loadCashflow();
  }, [loadCashflow]);

  if (!selectedProjectId) {
    return (
      <div className="max-w-6xl mx-auto p-6 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Selecciona un proyecto</CardTitle>
            <CardDescription>
              Elige un proyecto en la barra superior para cargar datos de flujo de caja.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const totalIngresos = cashflowData.reduce((sum, row) => sum + row.Ingresos, 0);
  const totalEgresos = cashflowData.reduce((sum, row) => sum + row.Egresos, 0);
  const neto = totalIngresos - totalEgresos;

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <PageHeader
        title="Flujo de Caja"
        description="Proyección mensual de ingresos y egresos con datos directos de Finanzas."
        badge="Finanzas"
        icon={<BarChart3 className="h-5 w-5 text-white" />}
        actions={
          isReadOnly ? (
            <Badge variant="outline" className="text-xs">
              Vista de solo lectura
            </Badge>
          ) : (
            <Button variant="outline" onClick={loadCashflow} disabled={loading} className="gap-2">
              <RefreshCcw className="h-4 w-4" />
              {loading ? "Actualizando" : "Refrescar"}
            </Button>
          )
        }
      />

      {currentProject && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contexto del proyecto</CardTitle>
            <CardDescription>
              {currentProject.name} · Periodo seleccionado: {months} meses
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Ingresos acumulados</p>
              <p className="text-lg font-semibold text-emerald-700">{currencyFormatter(totalIngresos)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Egresos acumulados</p>
              <p className="text-lg font-semibold text-red-600">{currencyFormatter(totalEgresos)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Neto</p>
              <p className="text-lg font-semibold">{currencyFormatter(neto)}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card>
          <CardContent className="text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <StackedColumnsChart
          data={cashflowData}
          stacks={[
            { dataKey: "Ingresos", name: "Ingresos" },
            { dataKey: "Egresos", name: "Egresos" },
          ]}
          title="Ingresos vs egresos"
          labelPrefix="Mes"
          valueFormatter={currencyFormatter}
        />
        <LineChartComponent
          data={cashflowData}
          lines={[
            { dataKey: "Neto", name: "Neto mensual" },
          ]}
          title="Flujo neto mensual"
          labelPrefix="Mes"
          valueFormatter={currencyFormatter}
        />
      </div>

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Margen</CardTitle>
          <CardDescription>Seguimiento de porcentaje de margen sobre ingresos mensuales.</CardDescription>
        </CardHeader>
        <CardContent>
          <LineChartComponent
            data={marginData}
            lines={[{ dataKey: "Margen %", name: "Margen %" }]}
            labelPrefix="Mes"
            valueFormatter={(value) => `${value.toFixed(1)}%`}
            xTickFormatter={(value) => `M${value}`}
          />
        </CardContent>
      </Card>
    </div>
  );
}
