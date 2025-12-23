import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  ExternalLink,
  Loader2,
  Info,
} from "lucide-react";
import { getProjects } from "@/lib/api";
import { toast } from "sonner";

type BaselineStatus = "pending" | "handed_off" | "accepted" | "rejected";

interface ProjectWithBaseline {
  id: string;
  name: string;
  client?: string | null;
  baseline_id?: string;
  baseline_status?: BaselineStatus | null;
  accepted_by?: string | null;
  baseline_accepted_at?: string;
  rejected_by?: string | null;
  baseline_rejected_at?: string;
  rejection_comment?: string;
  rubros_count?: number;
  labor_cost?: number;
  non_labor_cost?: number;
}

type SortField = "name" | "client" | "status" | "date" | "rubros_count" | "baseline_accepted_at";
type SortDirection = "asc" | "desc";

export function PMOBaselinesQueuePage() {
  const navigate = useNavigate();
  const [selectedStatus, setSelectedStatus] = useState<"all" | BaselineStatus>("all");
  const [showMissingRubros, setShowMissingRubros] = useState(false);
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const { data: projects, isLoading, error } = useQuery({
    queryKey: ["projects", "with-baselines"],
    queryFn: async () => {
      const result = await getProjects();
      // Filter to only projects with baselines
      return result.filter((p) => p.baseline_id) as ProjectWithBaseline[];
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const getStatusBadge = (status?: BaselineStatus | null) => {
    if (!status) return null;
    
    const normalized = status.toLowerCase();
    switch (normalized) {
      case "accepted":
        return (
          <Badge variant="default" className="bg-green-600 gap-1.5">
            <CheckCircle2 size={14} />
            Aceptado
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive" className="gap-1.5">
            <XCircle size={14} />
            Rechazado
          </Badge>
        );
      case "pending":
      case "handed_off":
        return (
          <Badge variant="secondary" className="gap-1.5">
            <Clock size={14} />
            Pendiente de Revisión
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1.5">
            <AlertCircle size={14} />
            {status}
          </Badge>
        );
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatCurrency = (amount?: number) => {
    if (typeof amount !== 'number') return "—";
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const filteredProjects = projects?.filter((p) => {
    if (selectedStatus === "all") {
      // If "Missing Rubros" is active, filter by rubros_count === 0
      if (showMissingRubros) {
        return p.rubros_count === 0;
      }
      return true;
    }
    // For "handed_off" filter, show both pending and handed_off statuses
    if (selectedStatus === "handed_off") {
      const matchesStatus = p.baseline_status === "pending" || p.baseline_status === "handed_off";
      if (showMissingRubros) {
        return matchesStatus && p.rubros_count === 0;
      }
      return matchesStatus;
    }
    const matchesStatus = p.baseline_status === selectedStatus;
    if (showMissingRubros) {
      return matchesStatus && p.rubros_count === 0;
    }
    return matchesStatus;
  });

  // Sort projects
  const sortedProjects = filteredProjects?.slice().sort((a, b) => {
    let aValue: string | number;
    let bValue: string | number;

    switch (sortField) {
      case "name":
        aValue = a.name?.toLowerCase() || "";
        bValue = b.name?.toLowerCase() || "";
        break;
      case "client":
        aValue = a.client?.toLowerCase() || "";
        bValue = b.client?.toLowerCase() || "";
        break;
      case "status": {
        const statusOrder = { accepted: 0, rejected: 1, handed_off: 2, pending: 3 };
        aValue = statusOrder[a.baseline_status as keyof typeof statusOrder] ?? 999;
        bValue = statusOrder[b.baseline_status as keyof typeof statusOrder] ?? 999;
        break;
      }
      case "rubros_count":
        aValue = a.rubros_count ?? -1;
        bValue = b.rubros_count ?? -1;
        break;
      case "baseline_accepted_at":
        aValue = a.baseline_accepted_at ? new Date(a.baseline_accepted_at).getTime() : 0;
        bValue = b.baseline_accepted_at ? new Date(b.baseline_accepted_at).getTime() : 0;
        break;
      case "date":
        aValue = a.baseline_status === "accepted" 
          ? new Date(a.baseline_accepted_at || 0).getTime()
          : a.baseline_status === "rejected"
          ? new Date(a.baseline_rejected_at || 0).getTime()
          : 0;
        bValue = b.baseline_status === "accepted"
          ? new Date(b.baseline_accepted_at || 0).getTime()
          : b.baseline_status === "rejected"
          ? new Date(b.baseline_rejected_at || 0).getTime()
          : 0;
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? "↑" : "↓";
  };

  const statusCounts = {
    all: projects?.length || 0,
    pending: projects?.filter((p) => p.baseline_status === "pending" || p.baseline_status === "handed_off").length || 0,
    accepted: projects?.filter((p) => p.baseline_status === "accepted").length || 0,
    rejected: projects?.filter((p) => p.baseline_status === "rejected").length || 0,
    missingRubros: projects?.filter((p) => p.rubros_count === 0).length || 0,
  };

  if (error) {
    toast.error("Failed to load baselines");
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Cola de Visibilidad de Baselines</h1>
          <p className="text-muted-foreground mt-1">
            Seguimiento del estado de envío y aceptación de baselines
          </p>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={selectedStatus === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedStatus("all")}
            >
              Todos ({statusCounts.all})
            </Button>
            <Button
              variant={selectedStatus === "pending" || selectedStatus === "handed_off" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedStatus("handed_off")}
            >
              <Clock className="mr-2 h-4 w-4" />
              Pendientes ({statusCounts.pending})
            </Button>
            <Button
              variant={selectedStatus === "accepted" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedStatus("accepted")}
              className={selectedStatus === "accepted" ? "bg-green-600 hover:bg-green-700" : ""}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Aceptados ({statusCounts.accepted})
            </Button>
            <Button
              variant={selectedStatus === "rejected" ? "destructive" : "outline"}
              size="sm"
              onClick={() => setSelectedStatus("rejected")}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Rechazados ({statusCounts.rejected})
            </Button>
            <div className="flex-1" />
            <Button
              variant={showMissingRubros ? "default" : "outline"}
              size="sm"
              onClick={() => setShowMissingRubros(!showMissingRubros)}
              className={showMissingRubros ? "bg-orange-600 hover:bg-orange-700" : ""}
            >
              <AlertCircle className="mr-2 h-4 w-4" />
              Sin Rubros ({statusCounts.missingRubros})
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Baselines Table */}
      <Card>
        <CardHeader>
          <CardTitle>Baselines de Proyectos</CardTitle>
          <CardDescription>
            Ver estado de aceptación y rechazo de baselines para todos los proyectos
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : sortedProjects && sortedProjects.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort("name")}
                    >
                      Proyecto <SortIcon field="name" />
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort("client")}
                    >
                      Cliente <SortIcon field="client" />
                    </TableHead>
                    <TableHead>ID de Baseline</TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort("status")}
                    >
                      Estado <SortIcon field="status" />
                    </TableHead>
                    <TableHead>Aceptado/Rechazado Por</TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort("rubros_count")}
                    >
                      Rubros <SortIcon field="rubros_count" />
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort("baseline_accepted_at")}
                    >
                      Fecha de Aceptación <SortIcon field="baseline_accepted_at" />
                    </TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedProjects.map((project) => (
                    <TableRow key={project.id}>
                      <TableCell className="font-medium">{project.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {project.client || "—"}
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {project.baseline_id}
                        </code>
                      </TableCell>
                      <TableCell>{getStatusBadge(project.baseline_status)}</TableCell>
                      <TableCell className="text-sm">
                        {project.baseline_status === "accepted" && project.accepted_by && (
                          <span className="text-green-700 dark:text-green-400">
                            {project.accepted_by}
                          </span>
                        )}
                        {project.baseline_status === "rejected" && project.rejected_by && (
                          <span className="text-red-700 dark:text-red-400">
                            {project.rejected_by}
                          </span>
                        )}
                        {(project.baseline_status === "pending" || project.baseline_status === "handed_off") && (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {typeof project.rubros_count === "number" ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-2 cursor-help">
                                  <span className="font-medium">{project.rubros_count}</span>
                                  {(project.labor_cost !== undefined || project.non_labor_cost !== undefined) && (
                                    <Info className="h-3 w-3 text-muted-foreground" />
                                  )}
                                </div>
                              </TooltipTrigger>
                              {(project.labor_cost !== undefined || project.non_labor_cost !== undefined) && (
                                <TooltipContent>
                                  <div className="text-xs space-y-1">
                                    <div className="font-semibold">Desglose de Costos</div>
                                    <div className="flex justify-between gap-4">
                                      <span className="text-muted-foreground">MOD (Labor):</span>
                                      <span className="font-medium">{formatCurrency(project.labor_cost)}</span>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                      <span className="text-muted-foreground">Indirectos:</span>
                                      <span className="font-medium">{formatCurrency(project.non_labor_cost)}</span>
                                    </div>
                                    <div className="border-t pt-1 flex justify-between gap-4">
                                      <span className="font-semibold">Total:</span>
                                      <span className="font-semibold">
                                        {formatCurrency((project.labor_cost || 0) + (project.non_labor_cost || 0))}
                                      </span>
                                    </div>
                                  </div>
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(project.baseline_accepted_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/finanzas/sdmt/cost/catalog?projectId=${project.id}&baseline=${project.baseline_id}`)}
                          >
                            Ver Rubros
                            <ExternalLink className="ml-2 h-3 w-3" />
                          </Button>
                          {project.baseline_status === "rejected" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/pmo/prefactura/estimator?project=${project.id}`)}
                            >
                              Revisar y reenviar
                              <ExternalLink className="ml-2 h-3 w-3" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/pmo/projects/${project.id}`)}
                          >
                            Ver Detalles
                            <ExternalLink className="ml-2 h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <AlertCircle className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>No se encontraron baselines con el filtro seleccionado</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rejection Comments Section - show if any rejected baselines */}
      {filteredProjects?.some((p) => p.baseline_status === "rejected" && p.rejection_comment) && (
        <Card>
          <CardHeader>
            <CardTitle>Comentarios de Rechazo</CardTitle>
            <CardDescription>
              Retroalimentación de SDMT sobre baselines rechazados
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {filteredProjects
              .filter((p) => p.baseline_status === "rejected" && p.rejection_comment)
              .map((project) => (
                <Card key={project.id} className="border-l-4 border-l-red-600">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{project.name}</CardTitle>
                      <Badge variant="destructive" className="gap-1.5">
                        <XCircle size={14} />
                        Rechazado
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      <strong>Rechazado por:</strong> {project.rejected_by || "Desconocido"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <strong>Fecha:</strong> {formatDate(project.baseline_rejected_at)}
                    </p>
                    <div className="mt-3 p-3 bg-muted rounded-md">
                      <p className="text-sm font-medium mb-1">Razón:</p>
                      <p className="text-sm">{project.rejection_comment}</p>
                    </div>
                    <div className="pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/pmo/prefactura/estimator?project=${project.id}`)}
                      >
                        Revisar y reenviar
                        <ExternalLink className="ml-2 h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default PMOBaselinesQueuePage;
