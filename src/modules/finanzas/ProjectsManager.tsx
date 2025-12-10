/*
 * Finanzas endpoints used here
 * - GET /projects?limit=50 → listar proyectos existentes
 * - POST /projects → crear un nuevo proyecto
 */
import React from "react";
import { type ProjectCreate, ProjectCreateSchema } from "@/api/finanzasClient";
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
import { getProjectDisplay } from "@/lib/projects/display";
import { ES_TEXTS } from "@/lib/i18n/es";
import { getPayrollDashboard, type MODProjectionByMonth } from "@/api/finanzas";

export default function ProjectsManager() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const { projects, loading, refreshing, error, reload, create } = useProjects();
  const pageSize = 10;
  const [page, setPage] = React.useState(0);
  const [selectedProjectId, setSelectedProjectId] = React.useState<string | null>(
    null,
  );
  const [viewMode, setViewMode] = React.useState<"portfolio" | "project">(
    "portfolio",
  );
  const [searchTerm, setSearchTerm] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [sortKey, setSortKey] = React.useState<"code" | "start_date" | "status">(
    "code",
  );
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">(
    "asc",
  );
  const [lastCreatedCode, setLastCreatedCode] = React.useState<string | null>(
    null,
  );
  const [payrollDashboard, setPayrollDashboard] = React.useState<MODProjectionByMonth[]>([]);
  const [payrollLoading, setPayrollLoading] = React.useState(false);
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

  const filteredProjects = React.useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return projects.filter((project) => {
      const display = getProjectDisplay(project);
      const matchesTerm = term
        ? [display.code, display.name, display.client, display.id]
            .filter(Boolean)
            .some((value) => value!.toLowerCase().includes(term))
        : true;

      const normalizedStatus = (project.status || "Desconocido").toLowerCase();
      const matchesStatus =
        statusFilter === "all"
          ? true
          : normalizedStatus === statusFilter.toLowerCase();

      return matchesTerm && matchesStatus;
    });
  }, [projects, searchTerm, statusFilter]);

  const sortedProjects = React.useMemo(() => {
    const direction = sortDirection === "asc" ? 1 : -1;
    const sorters: Record<typeof sortKey, (a: ProjectForUI, b: ProjectForUI) => number> = {
      code: (a, b) => a.code.localeCompare(b.code),
      start_date: (a, b) => {
        const aDate = a.start_date ? new Date(a.start_date).getTime() : 0;
        const bDate = b.start_date ? new Date(b.start_date).getTime() : 0;
        return aDate - bDate;
      },
      status: (a, b) => (a.status || "").localeCompare(b.status || ""),
    };

    return [...filteredProjects].sort((a, b) => sorters[sortKey](a, b) * direction);
  }, [filteredProjects, sortDirection, sortKey]);

  const totalPages = Math.max(1, Math.ceil(sortedProjects.length / pageSize));

  React.useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages - 1));
  }, [sortedProjects.length, totalPages]);

  React.useEffect(() => {
    setPage(0);
  }, [searchTerm, sortKey, sortDirection, statusFilter]);

  const selectedProject = React.useMemo(
    () => sortedProjects.find((project) => project.id === selectedProjectId) || null,
    [sortedProjects, selectedProjectId],
  );

  const projectsForView = React.useMemo(() => {
    if (viewMode === "project" && selectedProject) {
      return [selectedProject];
    }

    return sortedProjects;
  }, [sortedProjects, selectedProject, viewMode]);

  const visibleProjects = React.useMemo(
    () =>
      sortedProjects.slice(
        page * pageSize,
        page * pageSize + pageSize,
      ),
    [sortedProjects, page, pageSize],
  );

  const statusOptions = React.useMemo(
    () =>
      Array.from(
        new Set(
          projects
            .map((project) => project.status || "Desconocido")
            .filter(Boolean),
        ),
      ),
    [projects],
  );
  const isRefreshingList = loading || refreshing;

  const coverageChartData = React.useMemo(() => {
    if (payrollDashboard.length === 0) {
      // Fallback to status chart if no payroll data is available yet.
      // This ensures the chart always shows useful information during the initial load
      // or when the payroll dashboard endpoint is unavailable.
      const counts: Record<string, number> = {};
      projectsForView.forEach((project) => {
        const status = project.status || "Desconocido";
        counts[status] = (counts[status] ?? 0) + 1;
      });
      return Object.entries(counts).map(([label, value]) => ({ name: label, value }));
    }

    // Calculate coverage: compare total MOD projected against total target
    const totalTarget = payrollDashboard.reduce((sum, item) => sum + (item.payrollTarget || 0), 0);
    const totalProjected = payrollDashboard.reduce(
      (sum, item) => sum + (item.totalForecastMOD || item.totalPlanMOD || 0),
      0
    );

    if (totalTarget === 0) {
      // No target set, show 100% projected
      return [{ name: "MOD proyectada", value: totalProjected }];
    }

    const covered = Math.min(totalProjected, totalTarget);
    const uncovered = Math.max(totalTarget - totalProjected, 0);

    const data = [];
    if (covered > 0) {
      data.push({ name: "Meta cubierta", value: covered });
    }
    if (uncovered > 0) {
      data.push({ name: "Meta no cubierta", value: uncovered });
    }

    return data.length > 0 ? data : [{ name: "Sin datos", value: 1 }];
  }, [projectsForView, payrollDashboard]);

  const modChartData = React.useMemo(() => {
    // Use payroll dashboard data if available, otherwise fallback to simple aggregation
    if (payrollDashboard.length > 0) {
      return payrollDashboard
        .sort((a, b) => a.month.localeCompare(b.month))
        .map((item) => ({
          month: item.month,
          "Meta objetivo": item.payrollTarget ?? 0,
          // Prefer forecast over plan, but only if forecast is explicitly set (not undefined)
          "MOD proyectada": item.totalForecastMOD !== undefined ? item.totalForecastMOD : (item.totalPlanMOD ?? 0),
          "MOD real": item.totalActualMOD ?? 0,
        }));
    }

    // Fallback: simple aggregation by project start month
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
      .map(([label, value]) => ({
        month: label,
        "Meta objetivo": value * 1.1, // 110% of plan as target
        "MOD proyectada": value,
        "MOD real": 0,
      }));
  }, [projectsForView, payrollDashboard]);

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

  const loadPayrollDashboard = React.useCallback(async () => {
    try {
      setPayrollLoading(true);
      const data = await getPayrollDashboard();
      setPayrollDashboard(data);
    } catch (err) {
      console.error("Error loading payroll dashboard:", err);
      // Don't show toast error for dashboard data - it's optional
    } finally {
      setPayrollLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadPayrollDashboard();
  }, [loadPayrollDashboard]);

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

      setLastCreatedCode(validatedPayload.code);
      setSearchTerm(validatedPayload.code);
      setPage(0);
      setSelectedProjectId(null);
      setViewMode("portfolio");

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
        title={ES_TEXTS.portfolio.title}
        description={ES_TEXTS.portfolio.description}
        badge="Finanzas"
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={loadProjects}
              disabled={isRefreshingList}
              className="gap-2"
            >
              <RefreshCcw className="h-4 w-4" />
              {isRefreshingList ? "Actualizando" : ES_TEXTS.actions.refresh}
            </Button>
            {canCreateProject && (
              <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
                <Plus size={16} />
                {ES_TEXTS.portfolio.createProject}
              </Button>
            )}
          </div>
        }
      />

      {isRefreshingList && (
        <div
          className="flex items-center gap-2 text-sm text-muted-foreground"
          aria-live="polite"
          role="status"
        >
          <RefreshCcw className="h-4 w-4 animate-spin" />
          <span>Actualizando lista de proyectos…</span>
        </div>
      )}

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

      <div className="grid gap-3 md:grid-cols-3 md:items-end">
        <div className="flex flex-col gap-2">
          <Label htmlFor="projectSearch">Buscar proyecto</Label>
          <Input
            id="projectSearch"
            name="projectSearch"
            placeholder="Código, nombre o cliente"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoComplete="off"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="statusFilter">Estado</Label>
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value)}
          >
            <SelectTrigger id="statusFilter">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {statusOptions.map((status) => (
                <SelectItem key={status} value={status.toLowerCase()}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="sortKey">Ordenar por</Label>
          <div className="flex gap-2">
            <Select
              value={sortKey}
              onValueChange={(value) => setSortKey(value as typeof sortKey)}
            >
              <SelectTrigger id="sortKey" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="code">Código</SelectItem>
                <SelectItem value="start_date">Fecha de inicio</SelectItem>
                <SelectItem value="status">Estado</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              aria-label="Cambiar orden"
              onClick={() =>
                setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
              }
            >
              {sortDirection === "asc" ? "↑" : "↓"}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <DonutChart
          data={coverageChartData}
          title="Cobertura de Meta de Nómina"
          subtitle="Comparación entre meta de recursos humanos y MOD del portafolio"
          className="h-full"
        />
        <LineChartComponent
          data={modChartData}
          lines={[
            { dataKey: "Meta objetivo", name: "Meta objetivo de nómina", color: "#8b5cf6" },
            { dataKey: "MOD proyectada", name: "MOD proyectada", color: "#3b82f6" },
            { dataKey: "MOD real", name: "MOD real", color: "#10b981" },
          ]}
          title="Desempeño de MOD vs Meta Objetivo"
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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Proyectos disponibles</CardTitle>
              <p className="text-sm text-muted-foreground">
                Los proyectos se almacenan en DynamoDB y se sincronizan en tiempo real. Cada error o vacío se muestra con contexto.
              </p>
            </div>
            <div className="text-sm text-muted-foreground">
              Total proyectos: <span className="font-semibold text-foreground">{projects.length}</span>
            </div>
          </div>
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
                        const display = getProjectDisplay(project);
                        const durationMonths = calculateDurationInMonths(
                          project.start_date,
                          project.end_date,
                        );
                        const modMensual =
                          durationMonths && durationMonths > 0
                            ? project.mod_total / durationMonths
                            : null;

                        const isSelected = project.id === selectedProjectId;
                        const isNewlyCreated =
                          lastCreatedCode && project.code === lastCreatedCode;

                        return (
                          <tr
                            key={`${project.id}-${project.code}`}
                            className={`border-b last:border-0 cursor-pointer transition-colors ${isSelected ? "bg-muted/60 border-l-4 border-primary" : "hover:bg-muted/40"} ${isNewlyCreated ? "bg-primary/10 ring-1 ring-primary/50" : ""}`}
                            onClick={() => setSelectedProjectId(project.id)}
                          >
                            <td className="py-2 pr-4 text-muted-foreground font-medium">
                              {display.code || "—"}
                            </td>
                            <td className="py-2 pr-4 font-semibold text-foreground">
                              {display.name || "Proyecto sin nombre"}
                          </td>
                          <td className="py-2 pr-4 text-muted-foreground">
                            {display.client || "—"}
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
                    name="name"
                    placeholder="Ej: Mobile Banking App MVP"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    minLength={3}
                    maxLength={200}
                    autoComplete="off"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="code">Código *</Label>
                  <Input
                    id="code"
                    name="code"
                    placeholder="PROJ-2025-001"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    required
                    pattern="PROJ-\d{4}-\d{3}"
                    autoComplete="off"
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
                  name="client"
                  placeholder="Ej: Global Bank Corp"
                  value={client}
                  onChange={(e) => setClient(e.target.value)}
                  required
                  minLength={2}
                  maxLength={200}
                  autoComplete="organization"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="startDate">Fecha de Inicio *</Label>
                  <Input
                    id="startDate"
                    name="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    autoComplete="off"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="endDate">Fecha de Fin *</Label>
                  <Input
                    id="endDate"
                    name="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                    autoComplete="off"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="modTotal">Presupuesto Total (MOD) *</Label>
                  <Input
                    id="modTotal"
                    name="modTotal"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={modTotal}
                    onChange={(e) => setModTotal(e.target.value)}
                    required
                    autoComplete="off"
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
                  <input type="hidden" name="currency" value={currency} />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">Descripción (opcional)</Label>
                <Input
                  id="description"
                  name="description"
                  placeholder="Descripción del proyecto..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={1000}
                  autoComplete="off"
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