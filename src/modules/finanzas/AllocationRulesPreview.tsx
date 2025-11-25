import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCcw, Split } from "lucide-react";
import DataContainer from "@/components/DataContainer";
import PageHeader from "@/components/PageHeader";
import finanzasClient, { AllocationRule } from "@/api/finanzasClient";
import DonutChart from "@/components/charts/DonutChart";

export default function AllocationRulesPreview() {
  const [rules, setRules] = useState<AllocationRule[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const driverChartData = rules.reduce<Record<string, number>>((acc, rule) => {
    const key = rule.driver || "Otro";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const activationData = rules.reduce(
    (acc, rule) => {
      if (rule.active) acc.activos += 1;
      else acc.inactivos += 1;
      return acc;
    },
    { activos: 0, inactivos: 0 }
  );

  const loadRules = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await finanzasClient.getAllocationRules();
      setRules(data);
    } catch (e: any) {
      console.error(e);
      setError(
        e?.message ||
          "No se pudieron cargar las reglas de asignación. Verifica la API de Finanzas o tus permisos."
      );
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

      <div className="grid gap-4 md:grid-cols-2">
        <DonutChart
          data={Object.entries(driverChartData).map(([name, value]) => ({ name, value }))}
          title="Drivers más usados"
          className="h-full"
        />
        <DonutChart
          data={[
            { name: "Activas", value: activationData.activos },
            { name: "Inactivas", value: activationData.inactivos },
          ]}
          title="Estado de reglas"
          className="h-full"
        />
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
            emptyTitle="No hay reglas configuradas"
            emptyMessage="Cuando el backend exponga reglas, aparecerán aquí."
          >
            {(items) => (
              <div className="grid gap-4 sm:grid-cols-2">
                {(items as AllocationRule[]).map((r) => (
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
                      {r.split && (
                        <ul className="space-y-1 text-xs text-muted-foreground">
                          {r.split.map((s, i) => (
                            <li key={i}>
                              → {s.to.project_id || s.to.cost_center} : {s.pct}%
                            </li>
                          ))}
                        </ul>
                      )}
                      {r.fixed_amount && (
                        <p className="text-xs text-muted-foreground">
                          Monto fijo: ${r.fixed_amount.toLocaleString()}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </DataContainer>
        </CardContent>
      </Card>
    </div>
  );
}
