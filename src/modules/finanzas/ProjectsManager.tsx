/*
 * Finanzas endpoints used here
 * - GET /projects?limit=50 → listar proyectos existentes
 * - POST /projects → crear un nuevo proyecto
 */
import React from "react";
import finanzasClient, { type ProjectCreate, type Project } from "@/api/finanzasClient";
import { getProjects } from "@/api/finanzas";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, RefreshCcw } from "lucide-react";
import DataContainer from "@/components/DataContainer";
import PageHeader from "@/components/PageHeader";
import DonutChart from "@/components/charts/DonutChart";
import LineChartComponent from "@/components/charts/LineChart";

export default function ProjectsManager() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isLoadingProjects, setIsLoadingProjects] = React.useState(true);
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  // Form state
  const [name, setName] = React.useState("");
  const [code, setCode] = React.useState("");
  const [client, setClient] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [currency, setCurrency] = React.useState<"USD" | "EUR" | "MXN">("USD");
  const [modTotal, setModTotal] = React.useState("");
  const [description, setDescription] = React.useState("");

  const statusChartData = React.useMemo(() => {
    const labels: Record<string, string> = {
      active: "Activos",
      completed: "Completados",
      on_hold: "En espera",
      cancelled: "Cancelados",
    };

    const counts = projects.reduce<Record<string, number>>((acc, project) => {
      const key = project.status || "sin_estado";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts).map(([key, value]) => ({
      name: labels[key] || "Sin estado",
      value,
    }));
  }, [projects]);

  const budgetByStartMonth = React.useMemo(() => {
    const monthTotals = new Map<number, number>();

    projects.forEach((project) => {
      if (!project.start_date || !project.mod_total) return;
      const startMonth = new Date(project.start_date).getMonth() + 1;
      const current = monthTotals.get(startMonth) || 0;
      monthTotals.set(startMonth, current + project.mod_total);
    });

    return Array.from(monthTotals.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([month, total]) => ({ month, "MOD total": total }));
  }, [projects]);

  const formatCurrency = React.useCallback(
    (value: number) =>
      new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(value),
    [],
  );

  const formatDate = (value?: string | null) => {
    if (!value) return "—";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString();
  };

  const normalizeProjects = React.useCallback((payload: unknown): Project[] => {
    const items = Array.isArray((payload as any)?.data)
      ? (payload as any).data
      : Array.isArray(payload)
      ? (payload as any)
      : Array.isArray((payload as any)?.items)
      ? (payload as any).items
      : [];

    if (!Array.isArray(items) || items.length === 0) return [];

    return items
      .map((project: any): Project => ({
        id:
          String(
            project?.id || project?.project_id || project?.projectId || "",
          ).trim() || "",
        name:
          String(
            project?.name || project?.nombre || project?.project_name || "",
          ).trim() || "Proyecto sin nombre",
        client: project?.client || project?.cliente || "",
        start_date: project?.start_date || project?.fecha_inicio || "",
        end_date: project?.end_date || project?.fecha_fin || "",
        currency: project?.currency || project?.moneda || "USD",
        mod_total: Number(
          project?.mod_total ?? project?.presupuesto_total ?? 0,
        ),
        description: project?.description || project?.descripcion || "",
        code: project?.code || project?.codigo || "",
        status: (project?.status || project?.estado || "active") as Project["status"],
        created_at: project?.created_at || project?.fecha_creacion || "",
        updated_at: project?.updated_at || project?.fecha_actualizacion || "",
      }))
      .filter((p) => p.id || p.name);
  }, []);

  const loadProjects = React.useCallback(async () => {
    try {
      setIsLoadingProjects(true);
      setLoadError(null);
      const data = await getProjects();
      const parsed = normalizeProjects(data);
      setProjects(parsed);
    } catch (e: any) {
      const message = e?.message || "No se pudieron cargar los proyectos";
      setLoadError(message);
      toast.error(message);
    } finally {
      setIsLoadingProjects(false);
    }
  }, [normalizeProjects]);

  React.useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleSubmitCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !code || !client || !startDate || !endDate || !modTotal) {
      toast.error("Por favor completa todos los campos requeridos");
      return;
    }

    try {
      setIsSubmitting(true);

      const payload: ProjectCreate = {
        name,
        code,
        client,
        start_date: startDate,
        end_date: endDate,
        currency,
        mod_total: parseFloat(modTotal),
        description: description || undefined,
      };

      const result = await finanzasClient.createProject(payload);

      toast.success(`Proyecto "${result.name}" creado exitosamente con ID: ${result.id}`);
      setIsCreateDialogOpen(false);

      await loadProjects();

      // Reset form
      setName("");
      setCode("");
      setClient("");
      setStartDate("");
      setEndDate("");
      setCurrency("USD");
      setModTotal("");
      setDescription("");
    } catch (e: any) {
      console.error("Error creating project:", e);

      const errorMessage = e?.message || "Error al crear el proyecto";

      if (errorMessage.includes("501")) {
        toast.error(
          "Esta función aún no está implementada en el servidor (501). El backend necesita completar este handler."
        );
      } else if (
        errorMessage.includes("signed in") ||
        errorMessage.includes("401") ||
        errorMessage.includes("403")
      ) {
        toast.error(errorMessage);
      } else if (errorMessage.includes("HTML") || errorMessage.includes("login page")) {
        toast.error("No se pudo conectar con la API de Finanzas. Por favor contacta a soporte.");
        console.error("API configuration issue:", errorMessage);
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <PageHeader
        title="Gestión de Proyectos"
        description="Consulta los proyectos que llegan desde la API de Finanzas (DynamoDB) y registra nuevos con el branding Ikusi/CVDEx."
        badge="Finanzas"
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={loadProjects}
              disabled={isLoadingProjects}
              className="gap-2"
            >
              <RefreshCcw className="h-4 w-4" />
              {isLoadingProjects ? "Actualizando" : "Refrescar"}
            </Button>
            <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
              <Plus size={16} />
              Crear Proyecto
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <DonutChart
          data={statusChartData}
          title="Distribución por estado"
          className="h-full"
        />
        <LineChartComponent
          data={budgetByStartMonth}
          lines={[{ dataKey: "MOD total", name: "MOD total" }]}
          title="MOD proyectado por mes de inicio"
          className="h-full"
          labelPrefix="Mes"
          valueFormatter={formatCurrency}
          xTickFormatter={(value) => `M${value}`}
        />
      </div>

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Proyectos disponibles</CardTitle>
          <p className="text-sm text-muted-foreground">
            Los proyectos se almacenan en DynamoDB y se sincronizan en tiempo real. Cada error o vacío se muestra con contexto.
          </p>
        </CardHeader>
        <CardContent>
          <DataContainer
            data={projects}
            isLoading={isLoadingProjects}
            error={loadError}
            onRetry={loadProjects}
            loadingType="table"
            emptyTitle="No se encontraron proyectos"
            emptyMessage="Crea un proyecto nuevo o verifica los permisos de la API de Finanzas."
          >
            {(items) => (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b">
                      <th className="py-2 pr-4 font-medium">Nombre</th>
                      <th className="py-2 pr-4 font-medium">Cliente</th>
                      <th className="py-2 pr-4 font-medium">Inicio</th>
                      <th className="py-2 pr-4 font-medium">Fin</th>
                      <th className="py-2 pr-4 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(items as Project[]).map((project) => (
                      <tr key={project.id} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-medium text-foreground">
                          {project.name || "Proyecto sin nombre"}
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {project.client || "—"}
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {formatDate(project.start_date)}
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {formatDate(project.end_date)}
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground capitalize">
                          {project.status || "active"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DataContainer>
        </CardContent>
      </Card>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Crear Nuevo Proyecto</DialogTitle>
            <DialogDescription>
              Completa la información del proyecto para agregarlo al sistema Finanzas
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitCreate}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Nombre del Proyecto *</Label>
                  <Input
                    id="name"
                    placeholder="Ej: Mobile Banking App MVP"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    minLength={3}
                    maxLength={200}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="code">Código *</Label>
                  <Input
                    id="code"
                    placeholder="PROJ-2025-001"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    required
                    pattern="PROJ-\d{4}-\d{3}"
                  />
                  <p className="text-xs text-muted-foreground">
                    Formato: PROJ-YYYY-NNN
                  </p>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="client">Cliente *</Label>
                <Input
                  id="client"
                  placeholder="Ej: Global Bank Corp"
                  value={client}
                  onChange={(e) => setClient(e.target.value)}
                  required
                  minLength={2}
                  maxLength={200}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="startDate">Fecha de Inicio *</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="endDate">Fecha de Fin *</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="modTotal">Presupuesto Total (MOD) *</Label>
                  <Input
                    id="modTotal"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={modTotal}
                    onChange={(e) => setModTotal(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="currency">Moneda *</Label>
                  <Select value={currency} onValueChange={(v) => setCurrency(v as any)}>
                    <SelectTrigger id="currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="MXN">MXN</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">Descripción (opcional)</Label>
                <Input
                  id="description"
                  placeholder="Descripción del proyecto..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={1000}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creando..." : "Crear Proyecto"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
