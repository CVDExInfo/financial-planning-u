import { useState, useCallback, useEffect } from "react";
import { Layers, RefreshCcw } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import DonutChart from "@/components/charts/DonutChart";
import { useProject } from "@/contexts/ProjectContext";
import ApiService from "@/lib/api";
import type { Scenario } from "@/types/domain";
import { usePermissions } from "@/hooks/usePermissions";

export default function ScenariosDashboard() {
  const { selectedProjectId, currentProject, selectedPeriod } = useProject();
  const { isSDMT } = usePermissions();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isReadOnly = !isSDMT;

  const currencyFormatter = useCallback(
    (value: number) =>
      new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(value),
    []
  );

  const loadScenarios = useCallback(async () => {
    if (!selectedProjectId) return;

    try {
      setLoading(true);
      setError(null);
      const months = Math.max(parseInt(selectedPeriod || "12", 10), 1);
      const data = await ApiService.getScenarios(selectedProjectId, months);
      setScenarios(data);
    } catch (e: any) {
      setError(e?.message || "No se pudieron cargar los escenarios");
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    loadScenarios();
  }, [loadScenarios]);

  if (!selectedProjectId) {
    return (
      <div className="max-w-6xl mx-auto p-6 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Selecciona un proyecto</CardTitle>
            <CardDescription>
              Elige un proyecto en la barra superior para ver escenarios comparativos.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const impactChartData = scenarios.map((scenario) => ({
    name: scenario.name,
    value: Math.abs(scenario.total_impact || 0),
    color: scenario.total_impact < 0 ? "oklch(0.58 0.15 180)" : undefined,
  }));

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <PageHeader
        title="Escenarios"
        description="Explora impactos frente al baseline usando la misma data del módulo SDMT."
        badge="Finanzas"
        icon={<Layers className="h-5 w-5 text-white" />}
        actions={
          isReadOnly ? (
            <Badge variant="outline" className="text-xs">
              Vista de solo lectura
            </Badge>
          ) : (
            <Button variant="outline" onClick={loadScenarios} disabled={loading} className="gap-2">
              <RefreshCcw className="h-4 w-4" />
              {loading ? "Actualizando" : "Refrescar"}
            </Button>
          )
        }
      />

      {currentProject && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Baseline seleccionado</CardTitle>
            <CardDescription>
              {currentProject.name}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {error && (
        <Card>
          <CardContent className="text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      <DonutChart
        data={impactChartData}
        title="Impacto económico por escenario"
        className="h-full"
      />

      <div className="grid gap-4 md:grid-cols-2">
        {scenarios.map((scenario) => (
          <Card key={scenario.id} className="border-border/80 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">{scenario.name}</CardTitle>
              <CardDescription>{scenario.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Impacto:</span> {currencyFormatter(scenario.total_impact)}
              </p>
              <p>
                <span className="text-muted-foreground">Baseline:</span> {scenario.baseline_id}
              </p>
              <p className="text-muted-foreground text-xs">
                Creado por {scenario.created_by} · {new Date(scenario.created_at).toLocaleDateString()}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
