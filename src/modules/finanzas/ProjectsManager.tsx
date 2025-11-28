/*
 * Finanzas endpoints used here
 * - GET /projects?limit=50 → listar proyectos existentes
 * - POST /projects → crear un nuevo proyecto
 */
import React from "react";
import finanzasClient, {
  type ProjectCreate,
  type Project,
  ProjectCreateSchema,
} from "@/api/finanzasClient";
import { HttpError } from "@/lib/http-client";
import { FinanzasApiError, getProjects } from "@/api/finanzas";
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
import { usePermissions } from "@/hooks/usePermissions";
import useProjects, { type ProjectForUI } from "./projects/useProjects";
import { Badge } from "@/components/ui/badge";
import ProjectDetailsPanel from "./projects/ProjectDetailsPanel";

export default function ProjectsManager() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const { projects, loading, error, reload, create } = useProjects();
  const pageSize = 10;
  const [page, setPage] = React.useState(0);
  const [selectedProjectId, setSelectedProjectId] = React.useState<string | null>(
    null,
  );
  const [viewMode, setViewMode] = React.useState<"portfolio" | "project">(
    "portfolio",
  );
  const { canCreateBaseline, isExecRO, canEdit } = usePermissions();
  const canCreateProject = canCreateBaseline && canEdit && !isExecRO;

  // Form state
  const [name, setName] = React.useState("");
  const [code, setCode] = React.useState("");
  const [client, setClient] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [currency, setCurrency] = React.useState<"USD" | "EUR" | "MXN">("USD");
  const [modTotal, setModTotal] = React.useState("");
  const [description, setDescription] = React.useState("");

  const totalPages = Math.max(1, Math.ceil(projects.length / pageSize));

  React.useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages - 1));
  }, [projects.length, totalPages]);

  const selectedProject = React.useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || null,
    [projects, selectedProjectId],
  );

  const projectsForView = React.useMemo(() => {
    if (viewMode === "project" && selectedProject) {
      return [selectedProject];
    }

    return projects;
  }, [projects, selectedProject, viewMode]);

  const visibleProjects = React.useMemo(
    () => projects.slice(page * pageSize, page * pageSize + pageSize),
    [projects, page, pageSize],
  );

  const statusChartData = React.useMemo(() => {
    const counts: Record<string, number> = {};

    projectsForView.forEach((project) => {
      const status = project.status || "Desconocido";
      counts[status] = (counts[status] ?? 0) + 1;
    });

    return Object.entries(counts).map(([label, value]) => ({ name: label, value }));
  }, [projectsForView]);

  const budgetByStartMonth = React.useMemo(() => {
    const map: Record<string, number> = {};

    projectsForView.forEach((project) => {
      const date = project.start_date;
      if (!date) return;
      const monthKey = date.slice(0, 7);
      const mod = Number(project.mod_total ?? 0);
      map[monthKey] = (map[monthKey] ?? 0) + mod;
    });

    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, value]) => ({ month: label, "MOD total": value }));
  }, [projectsForView]);

  const formatCurrency = React.useCallback(
    (value: number, currencyCode: string = "USD") =>
      new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: currencyCode || "USD",
        maximumFractionDigits: 0,
      }).format(value || 0),
    [],
  );

  const calculateDurationInMonths = React.useCallback(
    (start?: string, end?: string) => {
      if (!start || !end) return null;

      const startDateObj = new Date(start);
      const endDateObj = new Date(end);

      if (Number.isNaN(startDateObj.getTime()) || Number.isNaN(endDateObj.getTime())) {
        return null;
      }

      const diffInMs = Math.abs(endDateObj.getTime() - startDateObj.getTime());
      const approxMonths = diffInMs / (1000 * 60 * 60 * 24 * 30);

      return Math.max(0, Math.round(approxMonths));
    },
    [],
  );

  const formatDate = (value?: string | null) => {
    if (!value) return "—";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString();
  };

  const renderStatusBadge = React.useCallback((status?: string) => {
    const normalized = (status || "desconocido").toLowerCase();
    let variant: "default" | "secondary" | "outline" | "destructive" = "outline";

    if (normalized.includes("activo") || normalized === "active") {
      variant = "default";
    } else if (normalized.includes("cerr")) {
      variant = "secondary";
    } else if (normalized.includes("borr") || normalized === "draft") {
      variant = "outline";
    } else if (normalized.includes("cancel")) {
      variant = "destructive";
    }

    return (
      <Badge variant={variant} className="text-xs px-2 py-1 capitalize">
        {status || "Desconocido"}
      </Badge>
    );
  }, []);

  const loadProjects = React.useCallback(async () => {
    await reload();
  }, [reload]);

  const handleSubmitCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canCreateProject) {
      toast.error("No tienes permiso para crear proyectos en Finanzas.");
      return;
    }

    if (!name || !code || !client || !startDate || !endDate || !modTotal) {
      toast.error("Por favor completa todos los campos requeridos");
      return;
    }

    const parsedModTotal = Number.parseFloat(modTotal);
    if (!Number.isFinite(parsedModTotal) || parsedModTotal < 0) {
      toast.error("El monto MOD debe ser un número válido mayor o igual a 0");
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
        mod_total: parsedModTotal,
        description: description || undefined,
      };

      const validatedPayload = ProjectCreateSchema.parse(payload);

      await create(validatedPayload);

      toast.success(`Proyecto "${validatedPayload.name}" creado exitosamente.`);
      setIsCreateDialogOpen(false);

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
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <PageHeader
        title="Gestión de Proyectos"
        description="Consulta los proyectos que llegan desde la API de Finanzas y registra nuevos según tus permisos."
        badge="Finanzas"
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={loadProjects}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCcw className="h-4 w-4" />
              {loading ? "Actualizando" : "Refrescar"}
            </Button>
            {canCreateProject && (
              <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
                <Plus size={16} />
                Crear Proyecto
              </Button>
            )}
          </div>
        }
      />

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-2">
          <Button
            variant={viewMode === "portfolio" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("portfolio")}
          >
            Portafolio
          </Button>
          <Button
            variant={viewMode === "project" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("project")}
            disabled={!selectedProject}
          >
            Proyecto seleccionado
          </Button>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            {selectedProject
              ? `Proyecto seleccionado: ${selectedProject.name || selectedProject.code}`
              : "Sin proyecto seleccionado"}
          </span>
          {selectedProject && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSelectedProjectId(null);
                setViewMode("portfolio");
              }}
              className="text-primary"
            >
              Quitar selección
            </Button>
          )}
        </div>
      </div>

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
          xTickFormatter={(value) => String(value)}
        />
      </div>

      {selectedProject && (
        <ProjectDetailsPanel
          project={selectedProject}
          formatCurrency={formatCurrency}
          calculateDurationInMonths={calculateDurationInMonths}
          formatDate={formatDate}
        />
      )}

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
            isLoading={loading}
            error={error ?? undefined}
            onRetry={loadProjects}
            loadingType="table"
            emptyTitle="No se encontraron proyectos"
            emptyMessage="Crea un proyecto nuevo o verifica los permisos de la API de Finanzas."
          >
            {() => (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-muted-foreground border-b">
                        <th className="py-2 pr-4 font-medium">Código</th>
                        <th className="py-2 pr-4 font-medium">Nombre</th>
                        <th className="py-2 pr-4 font-medium">Cliente</th>
                        <th className="py-2 pr-4 font-medium">Fecha de inicio</th>
                        <th className="py-2 pr-4 font-medium">Fecha de fin</th>
                        <th className="py-2 pr-4 font-medium">Duración (meses)</th>
                        <th className="py-2 pr-4 font-medium">MOD total</th>
                        <th className="py-2 pr-4 font-medium">MOD mensual</th>
                        <th className="py-2 pr-4 font-medium">Estado</th>
                        <th className="py-2 pr-4 font-medium">Última actualización</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleProjects.map((project: ProjectForUI) => {
                        const durationMonths = calculateDurationInMonths(
                          project.start_date,
                          project.end_date,
                        );
                        const modMensual =
                          durationMonths && durationMonths > 0
                            ? project.mod_total / durationMonths
                            : null;

                        const isSelected = project.id === selectedProjectId;

                        return (
                          <tr
                            key={`${project.id}-${project.code}`}
                            className={`border-b last:border-0 cursor-pointer transition-colors ${isSelected ? "bg-muted/60 border-l-4 border-primary" : "hover:bg-muted/40"}`}
                            onClick={() => setSelectedProjectId(project.id)}
                          >
                            <td className="py-2 pr-4 text-muted-foreground font-medium">
                              {project.code || "—"}
                            </td>
                            <td className="py-2 pr-4 font-semibold text-foreground">
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
                            <td className="py-2 pr-4 text-muted-foreground">
                              {durationMonths ?? "—"}
                            </td>
                            <td className="py-2 pr-4 text-muted-foreground">
                              {formatCurrency(project.mod_total, project.currency)}
                            </td>
                            <td className="py-2 pr-4 text-muted-foreground">
                              {modMensual != null
                                ? formatCurrency(modMensual, project.currency)
                                : "—"}
                            </td>
                            <td className="py-2 pr-4 text-muted-foreground">
                              {renderStatusBadge(project.status)}
                            </td>
                            <td className="py-2 pr-4 text-muted-foreground">
                              {formatDate(project.updated_at || project.created_at)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    Anterior
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {page + 1} / {totalPages || 1}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page + 1 >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  >
                    Siguiente
                  </Button>
                </div>
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