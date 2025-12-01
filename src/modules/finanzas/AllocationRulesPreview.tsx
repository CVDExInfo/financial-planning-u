/*
 * Finanzas endpoints used here
 * - GET /allocation-rules → cargar reglas de asignación
 */
import { useEffect, useState, useCallback, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCcw, Split } from "lucide-react";
import DataContainer from "@/components/DataContainer";
import PageHeader from "@/components/PageHeader";
import finanzasClient, { AllocationRule } from "@/api/finanzasClient";
import DonutChart from "@/components/charts/DonutChart";
import { toast } from "sonner";
import LoadingState from "@/components/LoadingState";

export default function AllocationRulesPreview() {
  const [rules, setRules] = useState<AllocationRule[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const hasRules = rules.length > 0;

  const driverChartData = useMemo(
    () =>
      rules.reduce<Record<string, number>>((acc, rule) => {
        const key = rule.driver || "Otro";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}),
    [rules]
  );

  const activationData = useMemo(
    () =>
      rules.reduce(
        (acc, rule) => {
          if (rule.active) acc.activos += 1;
          else acc.inactivos += 1;
          return acc;
        },
        { activos: 0, inactivos: 0 }
      ),
    [rules]
  );

  const ChartPlaceholder = ({ title, message }: { title: string; message: string }) => (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex h-[300px] items-center justify-center text-center">
        <div className="space-y-1 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Sin datos para mostrar</p>
          <p className="text-xs leading-relaxed">{message}</p>
        </div>
      </CardContent>
    </Card>
  );

  const loadRules = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await finanzasClient.getAllocationRules();
      setRules(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.error(e);
      const message =
        e?.message ||
        "No se pudieron cargar las reglas de asignación. Verifica la API de Finanzas o tus permisos.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <PageHeader
        title="Reglas de Asignación"
        description="Vista previa MVP de reglas devueltas por la API. Muestra drivers percentuales, montos fijos y splits, con estados claros de carga y error."
        badge="Finanzas"
        icon={<Split className="h-5 w-5 text-white" />}
        actions={
          <Button
            variant="outline"
            className="gap-2"
            onClick={loadRules}
            disabled={loading}
          >
            <RefreshCcw className="h-4 w-4" />
            {loading ? "Actualizando" : "Refrescar"}
          </Button>
        }
      />

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error al cargar reglas</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>
            <Button size="sm" variant="outline" onClick={loadRules} disabled={loading}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {hasRules ? (
          <DonutChart
            data={Object.entries(driverChartData).map(([name, value]) => ({ name, value }))}
            title="Drivers más usados"
            className="h-full"
          />
        ) : loading ? (
          <LoadingState type="chart" />
        ) : (
          <ChartPlaceholder
            title="Drivers más usados"
            message="Configura reglas de asignación para visualizar la distribución por driver."
          />
        )}
        {hasRules ? (
          <DonutChart
            data={[
              { name: "Activas", value: activationData.activos },
              { name: "Inactivas", value: activationData.inactivos },
            ]}
            title="Estado de reglas"
            className="h-full"
          />
        ) : loading ? (
          <LoadingState type="chart" />
        ) : (
          <ChartPlaceholder
            title="Estado de reglas"
            message="Cuando existan reglas activas o inactivas, verás el resumen aquí."
          />
        )}
      </div>

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Vista previa</CardTitle>
          <CardDescription>
            Las reglas muestran cómo se distribuyen los costos por driver. Cada tarjeta indica si la regla está activa e incluye los splits configurados.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataContainer
            data={rules}
            isLoading={loading}
            error={error}
            onRetry={loadRules}
            loadingType="grid"
            emptyTitle="No hay reglas de asignación configuradas"
            emptyMessage="Cuando se creen reglas para tu proyecto, aparecerán aquí y habilitarán las visualizaciones."
          >
            {(items) => {
              const safeRules = Array.isArray(items) ? (items as AllocationRule[]) : [];

              return (
                <div className="grid gap-4 sm:grid-cols-2">
                  {safeRules.map((r) => {
                    const splitRows = Array.isArray(r.split) ? r.split : [];
                    const fixedAmount = Number(r.fixed_amount ?? 0);

                    return (
                      <Card key={r.rule_id} className="border-border/80">
                        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                          <div className="space-y-1">
                            <CardTitle className="text-base font-semibold">{r.rule_id}</CardTitle>
                            <p className="text-xs text-muted-foreground">
                              Línea: {r.linea_codigo} • Driver: {r.driver}
                            </p>
                          </div>
                          <Badge variant={r.active ? "default" : "secondary"}>
                            {r.active ? "Activa" : "Inactiva"}
                          </Badge>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          {splitRows.length > 0 && (
                            <ul className="space-y-1 text-xs text-muted-foreground">
                              {splitRows.map((s, i) => (
                                <li key={i}>
                                  → {s.to.project_id || s.to.cost_center || "destino"} : {s.pct}%
                                </li>
                              ))}
                            </ul>
                          )}
                          {fixedAmount > 0 && (
                            <p className="text-xs text-muted-foreground">
                              Monto fijo: ${fixedAmount.toLocaleString()}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              );
            }}
          </DataContainer>
        </CardContent>
      </Card>
    </div>
  );
}
