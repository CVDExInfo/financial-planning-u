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
import { useAuth } from "@/hooks/useAuth";
import useProjects, { type ProjectForUI } from "./projects/useProjects";
import { Badge } from "@/components/ui/badge";
import ProjectDetailsPanel, { type ModChartPoint } from "./projects/ProjectDetailsPanel";
import { getProjectDisplay } from "@/lib/projects/display";
import { ES_TEXTS } from "@/lib/i18n/es";
import {
  getAdjustments,
  getAllocations,
  getBaseline,
  getPayroll,
  getPayrollDashboard,
  type MODProjectionByMonth,
} from "@/api/finanzas";
import { logoutWithHostedUI } from "@/config/aws";
import {
  buildModPerformanceSeries,
  isModRow,
  type ModChartPoint as ModSeriesPoint,
} from "./projects/modSeries";
import { normalizeApiRowForMod } from "./projects/normalizeForMod";

// Type for MOD chart data points
export type ModChartPoint = {
  month: string;
  "Allocations MOD": number;
  "Adjusted/Projected MOD": number;
  "Actual Payroll MOD": number;
};

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
  const [payrollDashboard, setPayrollDashboard] =
    React.useState<MODProjectionByMonth[]>([]);
  const [modChartDataForProject, setModChartDataForProject] =
    React.useState<ModSeriesPoint[]>([]);
  const [projectPayrollData, setProjectPayrollData] = React.useState<any[]>([]);
  const [allocationsRows, setAllocationsRows] = React.useState<any[]>([]);
  const [adjustmentsRows, setAdjustmentsRows] = React.useState<any[]>([]);
  const [baselineRows, setBaselineRows] = React.useState<any[]>([]);
  const [seriesLoading, setSeriesLoading] = React.useState(false);
  const [seriesError, setSeriesError] = React.useState<string | null>(null);
  const [modSources, setModSources] = React.useState({
    payroll: [] as any[],
    allocations: [] as any[],
    baseline: [] as any[],
    adjustments: [] as any[],
    normalizedPayroll: [] as any[],
    normalizedAllocations: [] as any[],
    normalizedBaseline: [] as any[],
    normalizedAdjustments: [] as any[],
  });
  const [isLoadingModSources, setIsLoadingModSources] = React.useState(false);
  const [modSourcesError, setModSourcesError] = React.useState<string | null>(
    null,
  );
  const developerPreviewEnabled = React.useMemo(() => {
    const envValue =
      (typeof import.meta !== "undefined" && (import.meta as any)?.env?.VITE_ENABLE_FIN_DEV_PREVIEW) ||
      (typeof process !== "undefined" ? process.env?.VITE_ENABLE_FIN_DEV_PREVIEW : undefined);

    return envValue === "true" ||
      (typeof process !== "undefined" && process.env?.NODE_ENV === "development");
  }, []);
  const [showModDebugPreview, setShowModDebugPreview] = React.useState(
    developerPreviewEnabled,
  );
  const { canCreateBaseline, isExecRO, canEdit, isSDM } = usePermissions();
  const canCreateProject = canCreateBaseline && canEdit && !isExecRO;
  
  // Get current user email for SDM auto-fill
  useAuth();

  // Form state
  const [name, setName] = React.useState("");
  const [code, setCode] = React.useState("");
  const [client, setClient] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [currency, setCurrency] = React.useState<"USD" | "EUR" | "MXN">("USD");
  const [modTotal, setModTotal] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [sdmEmail, setSdmEmail] = React.useState("");

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
    const sorters: Record<
      typeof sortKey,
      (a: ProjectForUI, b: ProjectForUI) => number
    > = {
      code: (a, b) => a.code.localeCompare(b.code),
      start_date: (a, b) => {
        const aDate = a.start_date ? new Date(a.start_date).getTime() : 0;
        const bDate = b.start_date ? new Date(b.start_date).getTime() : 0;
        return aDate - bDate;
      },
      status: (a, b) => (a.status || "").localeCompare(b.status || ""),
    };

    return [...filteredProjects].sort(
      (a, b) => sorters[sortKey](a, b) * direction,
    );
  }, [filteredProjects, sortDirection, sortKey]);

  const totalPages = Math.max(1, Math.ceil(sortedProjects.length / pageSize));

  React.useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages - 1));
  }, [sortedProjects.length, totalPages]);

  React.useEffect(() => {
    setPage(0);
  }, [searchTerm, sortKey, sortDirection, statusFilter]);

  const selectedProject = React.useMemo(
    () =>
      sortedProjects.find((project) => project.id === selectedProjectId) || null,
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
      // Fallback: Show portfolio budget distribution by project
      // This ensures the chart always shows useful information during the initial load
      // or when the payroll dashboard endpoint is unavailable.
      
      // If no projects have mod_total > 0, show count by status
      const hasProjectBudgets = projectsForView.some(p => (p.mod_total || 0) > 0);
      
      if (hasProjectBudgets) {
        // Show top 5 projects by budget, rest as "Otros"
        const sortedProjects = [...projectsForView]
          .filter(p => (p.mod_total || 0) > 0)
          .sort((a, b) => (b.mod_total || 0) - (a.mod_total || 0));
        
        const topProjects = sortedProjects.slice(0, 5);
        const otherProjects = sortedProjects.slice(5);
        
        const chartData = topProjects.map(p => ({
          name: p.name.length > 25 ? `${p.name.slice(0, 25)}...` : p.name,
          value: p.mod_total || 0,
        }));
        
        if (otherProjects.length > 0) {
          const otherTotal = otherProjects.reduce((sum, p) => sum + (p.mod_total || 0), 0);
          chartData.push({
            name: `Otros (${otherProjects.length})`,
            value: otherTotal,
          });
        }
        
        return chartData.length > 0 ? chartData : [{ name: "Sin presupuesto", value: 0 }];
      }
      
      // Fallback: show status distribution
      const counts: Record<string, number> = {};
      projectsForView.forEach((project) => {
        const status = project.status || "Desconocido";
        counts[status] = (counts[status] ?? 0) + 1;
      });
      return Object.entries(counts).map(([label, value]) => ({
        name: label,
        value,
      }));
    }

    // Calculate coverage: compare total MOD projected against total target
    const totalTarget = payrollDashboard.reduce(
      (sum, item) => sum + (item.payrollTarget || 0),
      0,
    );
    const totalProjected = payrollDashboard.reduce(
      (sum, item) => sum + (item.totalForecastMOD || item.totalPlanMOD || 0),
      0,
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

    return data.length > 0 ? data : [{ name: "Sin datos", value: 0 }];
  }, [projectsForView, payrollDashboard]);

  // Chart data: use payroll actuals when viewing a single project, otherwise show empty.
  // The chart is resilient and will render without data instead of crashing.
  const modChartData = React.useMemo(() => {
    if (
      viewMode === "project" &&
      selectedProject &&
      payrollDashboard.length > 0
    ) {
      return payrollDashboard.map((entry) => ({
        month: entry.month,
        "Meta objetivo": entry.payrollTarget ?? 0,
        "MOD proyectada":
          entry.totalForecastMOD ?? entry.totalPlanMOD ?? 0,
        "MOD real": entry.totalActualMOD ?? 0,
      }));
    }

    // Safe fallback: no payroll data → empty array, chart renders without error
    return [];
  }, [viewMode, selectedProject, payrollDashboard]);

  // Compute MOD chart data for ProjectDetailsPanel
  const modChartDataForDetails = React.useMemo<ModChartPoint[]>(() => {
    const payrollRows = (() => {
      if (viewMode !== "project") return payrollDashboard;

      if (projectPayrollData.length > 0) return projectPayrollData;

      // Avoid mixing unrelated portfolio payroll rows into a project view; only
      // consider rows for the selected project when the project-specific call
      // returns empty/403/404. If none exist, fall back to an empty array so the
      // chart renders safely without misleading data.
      return payrollDashboard.filter(
        (row) => row.projectId && row.projectId === selectedProjectId,
      );
    })();

    if (
      payrollRows.length === 0 &&
      allocationsRows.length === 0 &&
      adjustmentsRows.length === 0 &&
      baselineRows.length === 0
    ) {
      return [];
    }

    return buildModPerformanceSeries({
      selectedProjectId: viewMode === "project" ? selectedProjectId : null,
      payrollDashboardRows: payrollRows || [],
      allocationsRows: allocationsRows || [],
      adjustmentsRows: adjustmentsRows || [],
      baselineRows: baselineRows || [],
    }).sort((a, b) => a.month.localeCompare(b.month));
  }, [
    allocationsRows,
    adjustmentsRows,
    baselineRows,
    payrollDashboard,
    projectPayrollData,
    selectedProjectId,
    viewMode,
  ]);

  const modDebugSources = React.useMemo(
    () => [
      {
        key: "payroll",
        label: "Payroll",
        raw: modSources.payroll,
        normalized: modSources.normalizedPayroll,
      },
      {
        key: "allocations",
        label: "Allocations",
        raw: modSources.allocations,
        normalized: modSources.normalizedAllocations,
      },
      {
        key: "baseline",
        label: "Baseline",
        raw: modSources.baseline,
        normalized: modSources.normalizedBaseline,
      },
      {
        key: "adjustments",
        label: "Adjustments",
        raw: modSources.adjustments,
        normalized: modSources.normalizedAdjustments,
      },
    ].map((source) => ({
      ...source,
      accepted: source.normalized.filter(isModRow).length,
      sampleRaw: source.raw.slice(0, 3),
      sampleNormalized: source.normalized.slice(0, 3),
    })),
    [modSources],
  );

  const isModDebugEnabled = developerPreviewEnabled && showModDebugPreview;

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

      if (
        Number.isNaN(startDateObj.getTime()) ||
        Number.isNaN(endDateObj.getTime())
      ) {
        return null;
      }

      const diffInMs = Math.abs(
        endDateObj.getTime() - startDateObj.getTime(),
      );
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
    let variant: "default" | "secondary" | "outline" | "destructive" =
      "outline";

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
      const data = await getPayrollDashboard();
      setPayrollDashboard(data ?? []);
    } catch (err) {
      console.error("Error loading payroll dashboard:", err);
      // Dashboard data is optional; do not surface toast here
      setPayrollDashboard([]);
    }
  }, []);

  React.useEffect(() => {
    void loadPayrollDashboard();
  }, [loadPayrollDashboard]);

  React.useEffect(() => {
    let cancelled = false;

    async function loadModSources() {
      setIsLoadingModSources(true);
      setSeriesLoading(true);
      setModSourcesError(null);
      setSeriesError(null);

      const projectId =
        viewMode === "project" && selectedProjectId ? selectedProjectId : undefined;

      try {
        const loaders = [
          { name: "allocations", loader: () => getAllocations(projectId) },
          { name: "baseline", loader: () => getBaseline(projectId) },
          { name: "adjustments", loader: () => getAdjustments(projectId) },
        ];

        if (projectId) {
          loaders.push({ name: "payroll", loader: () => getPayroll(projectId) });
        }

        const settled = await Promise.allSettled(loaders.map((item) => item.loader()));

        const rawSources = {
          payroll: [] as any[],
          allocations: [] as any[],
          baseline: [] as any[],
          adjustments: [] as any[],
        };
        const failures: string[] = [];
        let hadForbidden = false;
        let hadUnauthorized = false;

        settled.forEach((result, idx) => {
          const key = loaders[idx].name as keyof typeof rawSources;
          if (result.status === "fulfilled") {
            rawSources[key] = result.value ?? [];
            return;
          }

          const reason = result.reason as any;
          const status = reason?.status ?? reason?.response?.status;
          hadForbidden = hadForbidden || status === 403;
          hadUnauthorized = hadUnauthorized || status === 401;
          failures.push(
            `${loaders[idx].name}: ${
              (reason as Error)?.message || reason || "error"
            }`,
          );
        });

        const normalizedPayroll = (
          projectId ? rawSources.payroll : payrollDashboard
        ).map(normalizeApiRowForMod);
        const normalizedAllocations = rawSources.allocations.map(
          normalizeApiRowForMod,
        );
        const normalizedBaseline = rawSources.baseline.map(normalizeApiRowForMod);
        const normalizedAdjustments = rawSources.adjustments.map(
          normalizeApiRowForMod,
        );

        const acceptedCounts = {
          payroll: normalizedPayroll.filter(isModRow).length,
          allocations: normalizedAllocations.filter(isModRow).length,
          baseline: normalizedBaseline.filter(isModRow).length,
          adjustments: normalizedAdjustments.filter(isModRow).length,
        };

        console.debug("[finanzas] MOD rows fetched", {
          payroll: projectId ? rawSources.payroll.length : payrollDashboard.length,
          allocations: rawSources.allocations.length,
          baseline: rawSources.baseline.length,
          adjustments: rawSources.adjustments.length,
          acceptedCounts,
        });

        const chartData = projectId
          ? buildModPerformanceSeries({
              selectedProjectId: projectId,
              payrollDashboardRows: normalizedPayroll,
              allocationsRows: normalizedAllocations,
              adjustmentsRows: normalizedAdjustments,
              baselineRows: normalizedBaseline,
            })
          : [];

        if (!cancelled) {
          setProjectPayrollData(projectId ? normalizedPayroll : []);
          setAllocationsRows(normalizedAllocations);
          setAdjustmentsRows(normalizedAdjustments);
          setBaselineRows(normalizedBaseline);
          setModSources({
            ...rawSources,
            normalizedPayroll,
            normalizedAllocations,
            normalizedBaseline,
            normalizedAdjustments,
          });
          setModChartDataForProject(chartData);

          if (failures.length > 0) {
            const message = failures.join("; ");
            setModSourcesError(message);
            setSeriesError(message);
            if (hadForbidden) {
              toast.error(
                "No tiene permisos para ver asignaciones/ajustes/linea base.",
              );
            } else {
              toast.error(
                "Algunas fuentes de MOD no se pudieron cargar. Revisa la consola para más detalles.",
              );
            }
          }

          if (hadUnauthorized) {
            logoutWithHostedUI();
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          const message = err?.message || "Error al cargar datos de MOD";
          setModSourcesError(message);
          setSeriesError(message);
          setModChartDataForProject([]);
          setProjectPayrollData([]);
          setAllocationsRows([]);
          setAdjustmentsRows([]);
          setBaselineRows([]);
          toast.error(message);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingModSources(false);
          setSeriesLoading(false);
        }
      }
    }

    void loadModSources();

    return () => {
      cancelled = true;
    };
  }, [selectedProjectId, viewMode, payrollDashboard]);

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

    if (!isSDM && !sdmEmail) {
      toast.error("Asigna el correo del responsable SDM para el proyecto.");
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
        ...(sdmEmail ? { sdm_manager_email: sdmEmail.trim() } : {}),
      };

      const validatedPayload = ProjectCreateSchema.parse(payload);

      await create(validatedPayload);

      setLastCreatedCode(validatedPayload.code);
      setSearchTerm(validatedPayload.code);
      setPage(0);
      setSelectedProjectId(null);
      setViewMode("portfolio");

      toast.success(
        `Proyecto "${validatedPayload.name}" creado exitosamente.`,
      );
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
      setSdmEmail("");
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
              {isRefreshingList
                ? "Actualizando"
                : ES_TEXTS.actions.refresh}
            </Button>
            {canCreateProject && (
              <Button
                onClick={() => setIsCreateDialogOpen(true)}
                className="gap-2"
              >
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
              ? `Proyecto seleccionado: ${
                  selectedProject.name || selectedProject.code
                }`
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
              onValueChange={(value) =>
                setSortKey(value as typeof sortKey)
              }
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
                setSortDirection((prev) =>
                  prev === "asc" ? "desc" : "asc",
                )
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
          title={payrollDashboard.length > 0 ? "Cobertura de Meta de Nómina" : "Distribución de Presupuesto por Proyecto"}
          subtitle={payrollDashboard.length > 0 
            ? "Comparación entre meta de recursos humanos y MOD del portafolio"
            : "Top 5 proyectos por monto total de MOD"}
          emptyStateMessage="No hay datos disponibles"
          emptyStateDetail="Agrega proyectos con presupuesto para ver la distribución"
          className="h-full"
        />
        <LineChartComponent
          data={modChartData}
          lines={[
            {
              dataKey: "Meta objetivo",
              name: "Meta objetivo de nómina",
              color: "#8b5cf6",
            },
            {
              dataKey: "MOD proyectada",
              name: "MOD proyectada",
              color: "#3b82f6",
            },
            {
              dataKey: "MOD real",
              name: "MOD real",
              color: "#10b981",
            },
          ]}
          title="Desempeño de MOD vs Meta Objetivo"
          className="h-full"
          labelPrefix="Mes"
          valueFormatter={formatCurrency}
          xTickFormatter={(value) => String(value)}
        />
      </div>

      {developerPreviewEnabled && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowModDebugPreview((prev) => !prev)}
            disabled={viewMode !== "project" || !selectedProject}
          >
            {showModDebugPreview
              ? "Ocultar Developer Data Preview"
              : "Mostrar Developer Data Preview"}
          </Button>
        </div>
      )}

      {seriesLoading && (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Cargando datos de asignaciones, ajustes y línea base…
        </p>
      )}
      {seriesError && (
        <p className="text-xs text-destructive">{seriesError}</p>
      )}

      {selectedProject && (
        <ProjectDetailsPanel
          project={selectedProject}
          formatCurrency={formatCurrency}
          calculateDurationInMonths={calculateDurationInMonths}
          formatDate={formatDate}
          modChartData={modChartDataForDetails}
          chartTitle={
            viewMode === "project"
              ? "MOD Performance (Allocations vs Adjusted/Projected vs Actual Payroll)"
              : "MOD Performance - All Projects"
          }
          debugModeEnabled={isModDebugEnabled}
          onOpenDebugPreview={() => setShowModDebugPreview(true)}
          modDataError={modSourcesError ?? undefined}
        />
      )}

      {isModDebugEnabled && selectedProject && (
        <Card className="border-dashed border-border/70">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              Developer Data Preview (MOD)
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Fuentes crudas vs normalizadas para construir la serie MOD. Se muestran los primeros elementos para validar el shape.
            </p>
            {isLoadingModSources && (
              <p className="text-xs text-muted-foreground">Cargando datos…</p>
            )}
            {modSourcesError && (
              <p className="text-xs text-destructive">{modSourcesError}</p>
            )}
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {modDebugSources.map((source) => (
              <div
                key={source.key}
                className="rounded-lg border bg-muted/40 p-3 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{source.label}</span>
                  <span className="text-muted-foreground">
                    {source.raw.length} raw · {source.normalized.length} normalized · {source.accepted} MOD
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Ejemplo normalizado (máx 1):
                </p>
                <pre className="mt-1 overflow-auto rounded bg-background p-2 text-[11px]">
                  {JSON.stringify(source.sampleNormalized[0] || source.sampleRaw[0] || {}, null, 2)}
                </pre>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">
                Proyectos disponibles
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Los proyectos se almacenan en DynamoDB y se sincronizan en
                tiempo real. Cada error o vacío se muestra con contexto.
              </p>
            </div>
            <div className="text-sm text-muted-foreground">
              Total proyectos:{" "}
              <span className="font-semibold text-foreground">
                {projects.length}
              </span>
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
                        <th className="py-2 pr-4 font-medium">
                          Fecha de inicio
                        </th>
                        <th className="py-2 pr-4 font-medium">
                          Fecha de fin
                        </th>
                        <th className="py-2 pr-4 font-medium">
                          Duración (meses)
                        </th>
                        <th className="py-2 pr-4 font-medium">MOD total</th>
                        <th className="py-2 pr-4 font-medium">
                          MOD mensual
                        </th>
                        <th className="py-2 pr-4 font-medium">Estado</th>
                        <th className="py-2 pr-4 font-medium">
                          Última actualización
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleProjects.map((project: ProjectForUI) => {
                        const display = getProjectDisplay(project);
                        const durationMonths =
                          calculateDurationInMonths(
                            project.start_date,
                            project.end_date,
                          );
                        const modMensual =
                          durationMonths && durationMonths > 0
                            ? project.mod_total / durationMonths
                            : null;

                        const isSelected =
                          project.id === selectedProjectId;
                        const isNewlyCreated =
                          lastCreatedCode &&
                          project.code === lastCreatedCode;

                        return (
                          <tr
                            key={`${project.id}-${project.code}`}
                            className={`border-b last:border-0 cursor-pointer transition-colors ${
                              isSelected
                                ? "bg-muted/60 border-l-4 border-primary"
                                : "hover:bg-muted/40"
                            } ${
                              isNewlyCreated
                                ? "bg-primary/10 ring-1 ring-primary/50"
                                : ""
                            }`}
                            onClick={() =>
                              setSelectedProjectId(project.id)
                            }
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
                              {formatCurrency(
                                project.mod_total,
                                project.currency,
                              )}
                            </td>
                            <td className="py-2 pr-4 text-muted-foreground">
                              {modMensual != null
                                ? formatCurrency(
                                    modMensual,
                                    project.currency,
                                  )
                                : "—"}
                            </td>
                            <td className="py-2 pr-4 text-muted-foreground">
                              {renderStatusBadge(project.status)}
                            </td>
                            <td className="py-2 pr-4 text-muted-foreground">
                              {formatDate(
                                project.updated_at || project.created_at,
                              )}
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
                    onClick={() =>
                      setPage((p) => Math.max(0, p - 1))
                    }
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
                    onClick={() =>
                      setPage((p) =>
                        Math.min(totalPages - 1, p + 1),
                      )
                    }
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            )}
          </DataContainer>
        </CardContent>
      </Card>

      <Dialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Crear Nuevo Proyecto</DialogTitle>
            <DialogDescription>
              Completa la información del proyecto para
              agregarlo al sistema Finanzas
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
                    pattern="PROJ-\\d{4}-\\d{3}"
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

              {!isSDM && (
                <div className="grid gap-2">
                  <Label htmlFor="sdmEmail">Responsable SDM (correo) *</Label>
                  <Input
                    id="sdmEmail"
                    name="sdmEmail"
                    type="email"
                    placeholder="sdm@empresa.com"
                    value={sdmEmail}
                    onChange={(e) => setSdmEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                  <p className="text-xs text-muted-foreground">
                    Este correo se usa para mostrar el proyecto al SDM asignado.
                  </p>
                </div>
              )}

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
                  <Label htmlFor="modTotal">
                    Presupuesto Total (MOD) *
                  </Label>
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
                  <Select
                    value={currency}
                    onValueChange={(v) =>
                      setCurrency(v as typeof currency)
                    }
                  >
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
                <Label htmlFor="description">
                  Descripción (opcional)
                </Label>
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
