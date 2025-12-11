/*
 * Finanzas endpoints used here
 * - POST /adjustments → crear ajustes presupuestarios
 */
import React, { useMemo } from "react";
import finanzasClient, { type Adjustment, type AdjustmentCreate } from "@/api/finanzasClient";
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import PageHeader from "@/components/PageHeader";
import { ShieldCheck, Plus, RefreshCcw } from "lucide-react";
import DataContainer from "@/components/DataContainer";
import { usePermissions } from "@/hooks/usePermissions";
import { useFinanzasUser } from "@/hooks/useFinanzasUser";
import { useRBACProjects } from "@/hooks/useRBACProjects";
import { useRubrosTaxonomy } from "@/hooks/useRubrosTaxonomy";

export default function AdjustmentsManager() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [adjustments, setAdjustments] = React.useState<Adjustment[]>([]);

  const SHOW_ADJUSTMENT_CHARTS = false;

  const { hasGroup, canEdit, isExecRO } = usePermissions();
  const { isFIN, isSDMT, userEmail } = useFinanzasUser();
  const { projects: availableProjects } = useRBACProjects();
  const { categories, getRubrosByCategory, getRubroById } = useRubrosTaxonomy();
  
  const isFinReadOnly = hasGroup("FIN") && !canEdit;
  const canCreateAdjustment = canEdit && !isFinReadOnly && !isExecRO;

  // Form state
  const [projectId, setProjectId] = React.useState("");
  const [tipo, setTipo] = React.useState<"exceso" | "reduccion" | "reasignacion">("exceso");
  const [monto, setMonto] = React.useState("");
  const [origenRubroId, setOrigenRubroId] = React.useState("");
  const [destinoRubroId, setDestinoRubroId] = React.useState("");
  const [fechaInicio, setFechaInicio] = React.useState("");
  const [metodoDistribucion, setMetodoDistribucion] = React.useState<"pro_rata_forward" | "pro_rata_all" | "single_month">("pro_rata_forward");
  const [justificacion, setJustificacion] = React.useState("");
  const [solicitadoPor, setSolicitadoPor] = React.useState("");
  const [projectFilter, setProjectFilter] = React.useState("");
  
  // New rubro context fields
  const [categoriaRubro, setCategoriaRubro] = React.useState("");
  const [rubroId, setRubroId] = React.useState("");
  
  // Get rubros for selected category
  const availableRubros = useMemo(() => {
    if (!categoriaRubro) return [];
    return getRubrosByCategory(categoriaRubro);
  }, [categoriaRubro, getRubrosByCategory]);
  
  // Get taxonomy entry for selected rubro
  const selectedRubro = useMemo(() => {
    if (!rubroId) return null;
    return getRubroById(rubroId);
  }, [rubroId, getRubroById]);
  
  // Get selected project for display
  const selectedProject = useMemo(() => {
    return availableProjects.find(p => p.projectId === projectId);
  }, [projectId, availableProjects]);

  const loadAdjustments = React.useCallback(async () => {
    try {
      setIsLoading(true);
      setLoadError(null);
      const data = await finanzasClient.getAdjustments({
        projectId: projectFilter || undefined,
        limit: 50,
      });
      setAdjustments(data);
    } catch (error: any) {
      console.error("Error loading adjustments", error);
      setLoadError(error?.message || "No se pudieron cargar los ajustes");
    } finally {
      setIsLoading(false);
    }
  }, [projectFilter]);

  React.useEffect(() => {
    loadAdjustments();
  }, [loadAdjustments]);

  const handleSubmitCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!projectId || !monto || !fechaInicio || !solicitadoPor) {
      toast.error("Por favor completa todos los campos requeridos");
      return;
    }

    try {
      setIsSubmitting(true);

      const payload: AdjustmentCreate = {
        project_id: projectId,
        tipo,
        monto: parseFloat(monto),
        fecha_inicio: fechaInicio,
        solicitado_por: solicitadoPor,
        origen_rubro_id: origenRubroId || rubroId || undefined, // Use canonical rubroId if selected
        destino_rubro_id: destinoRubroId || undefined,
        metodo_distribucion: metodoDistribucion || undefined,
        justificacion: justificacion || undefined,
      };

      await finanzasClient.createAdjustment(payload);

      toast.success("Ajuste presupuestario creado exitosamente");
      setIsCreateDialogOpen(false);

      loadAdjustments();

      // Reset form
      setProjectId("");
      setTipo("exceso");
      setMonto("");
      setOrigenRubroId("");
      setDestinoRubroId("");
      setFechaInicio("");
      setMetodoDistribucion("pro_rata_forward");
      setJustificacion("");
      setSolicitadoPor("");
      setCategoriaRubro("");
      setRubroId("");
    } catch (e: any) {
      console.error("Error creating adjustment:", e);

      const errorMessage = e?.message || "Error al crear el ajuste";

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
  
  // Initialize form when dialog opens
  React.useEffect(() => {
    if (isCreateDialogOpen && userEmail && !solicitadoPor) {
      setSolicitadoPor(userEmail);
    }
  }, [isCreateDialogOpen, userEmail, solicitadoPor]);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <PageHeader
        title="Ajustes Presupuestarios"
        description="Gestiona excesos, reducciones o reasignaciones de presupuesto. El encabezado y el estado vacío siguen el estilo de acta-ui."
        badge="Finanzas"
        icon={<ShieldCheck className="h-5 w-5 text-white" />}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={loadAdjustments} className="gap-2" disabled={isLoading}>
              <RefreshCcw className="h-4 w-4" />
              {isLoading ? "Actualizando" : "Refrescar"}
            </Button>
            {canCreateAdjustment && (
              <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
                <Plus size={16} />
                Crear Ajuste
              </Button>
            )}
          </div>
        }
      />

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
          <CardDescription>Aplica un filtro rápido por proyecto para limitar los resultados.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1fr_auto] items-end">
          <div className="grid gap-2">
            <Label htmlFor="projectFilter">Proyecto</Label>
            <Input
              id="projectFilter"
              placeholder="proj_..."
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
            />
          </div>
          <Button onClick={loadAdjustments} disabled={isLoading} className="w-full md:w-auto">
            {isLoading ? "Cargando" : "Aplicar filtro"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Visualizaciones de ajustes</CardTitle>
          <CardDescription>
            Tendencias y distribución de ajustes aparecerán aquí con datos de la API de Finanzas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {SHOW_ADJUSTMENT_CHARTS ? (
            <p className="text-sm text-muted-foreground">Cargando gráficos…</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Próximamente: panel de gráficos para excesos, reducciones y reasignaciones cuando el endpoint expose datos.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Ajustes</CardTitle>
          <CardDescription>
            Los ajustes pueden ser excesos, reducciones o reasignaciones entre rubros.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataContainer
            data={adjustments}
            isLoading={isLoading}
            error={loadError}
            onRetry={loadAdjustments}
            loadingType="table"
            emptyTitle="No se encontraron ajustes"
            emptyMessage="Registra un ajuste o revisa tus permisos. FIN solo puede consultar."
          >
            {(items) => (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b">
                      <th className="py-2 pr-4 font-medium">Proyecto</th>
                      <th className="py-2 pr-4 font-medium">Tipo</th>
                      <th className="py-2 pr-4 font-medium">Monto</th>
                      <th className="py-2 pr-4 font-medium">Estado</th>
                      <th className="py-2 pr-4 font-medium">Inicio</th>
                      <th className="py-2 pr-4 font-medium">Solicitado por</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(items as Adjustment[]).map((adjustment) => (
                      <tr key={adjustment.id} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-medium">{adjustment.project_id}</td>
                        <td className="py-2 pr-4 capitalize">{adjustment.tipo}</td>
                        <td className="py-2 pr-4">
                          {new Intl.NumberFormat("es-MX", {
                            style: "currency",
                            currency: "USD",
                            maximumFractionDigits: 0,
                          }).format(adjustment.monto)}
                        </td>
                        <td className="py-2 pr-4 capitalize text-muted-foreground">
                          {adjustment.estado?.replace("_", " ") || "pendiente"}
                        </td>
                        <td className="py-2 pr-4">{adjustment.fecha_inicio || "—"}</td>
                        <td className="py-2 pr-4">{adjustment.solicitado_por}</td>
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
            <DialogTitle>Crear Ajuste Presupuestario</DialogTitle>
            <DialogDescription>
              Registra un ajuste de presupuesto con distribución automática
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitCreate}>
            <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
              {/* Project Selection - RBAC aware */}
              <div className="grid gap-2">
                <Label htmlFor="projectId">Proyecto *</Label>
                {isSDMT && selectedProject ? (
                  // Read-only for SDMT when in project context
                  <div className="flex items-center gap-2 p-2 border border-border rounded-md bg-muted/30">
                    <Badge variant="secondary">{selectedProject.code}</Badge>
                    <span className="text-sm font-medium">{selectedProject.name}</span>
                    {selectedProject.client && (
                      <span className="text-sm text-muted-foreground">· {selectedProject.client}</span>
                    )}
                  </div>
                ) : (
                  // Dropdown for FIN or when no project context
                  <Select value={projectId} onValueChange={setProjectId} required>
                    <SelectTrigger id="projectId">
                      <SelectValue placeholder="Selecciona un proyecto..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableProjects.map((proj) => (
                        <SelectItem key={proj.projectId} value={proj.projectId}>
                          <span className="font-medium">{proj.code}</span>
                          {' · '}
                          {proj.name}
                          {proj.client && (
                            <span className="text-muted-foreground"> · {proj.client}</span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="tipo">Tipo de Ajuste *</Label>
                  <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
                    <SelectTrigger id="tipo">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="exceso">Exceso</SelectItem>
                      <SelectItem value="reduccion">Reducción</SelectItem>
                      <SelectItem value="reasignacion">Reasignación</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="monto">Monto *</Label>
                  <Input
                    id="monto"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="fechaInicio">Mes de Inicio *</Label>
                <Input
                  id="fechaInicio"
                  placeholder="2025-11"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  required
                  pattern="\d{4}-\d{2}"
                />
                <p className="text-xs text-muted-foreground">Formato: YYYY-MM</p>
              </div>
              
              {/* Optional Rubro Context for traceability */}
              <div className="p-3 bg-muted/50 rounded-md border border-border space-y-3">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-semibold">Contexto de Rubro (Opcional)</Label>
                  <Badge variant="outline" className="text-xs">Recomendado para trazabilidad</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Asocia este ajuste con una categoría y rubro específico para mejor seguimiento
                </p>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="categoriaRubro" className="text-xs">Categoría</Label>
                    <Select value={categoriaRubro} onValueChange={setCategoriaRubro}>
                      <SelectTrigger id="categoriaRubro" className="h-9">
                        <SelectValue placeholder="Selecciona..." />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.codigo} value={cat.codigo}>
                            {cat.codigo} · {cat.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="rubroId" className="text-xs">Línea de Gasto</Label>
                    <Select 
                      value={rubroId} 
                      onValueChange={setRubroId}
                      disabled={!categoriaRubro}
                    >
                      <SelectTrigger id="rubroId" className="h-9">
                        <SelectValue placeholder={
                          categoriaRubro ? "Selecciona..." : "Primero categoría"
                        } />
                      </SelectTrigger>
                      <SelectContent>
                        {availableRubros.map((rubro) => (
                          <SelectItem key={rubro.id} value={rubro.id}>
                            {rubro.linea_codigo} · {rubro.linea_gasto}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {selectedRubro && (
                  <div className="text-xs text-muted-foreground p-2 bg-background rounded">
                    {selectedRubro.descripcion}
                  </div>
                )}
              </div>

              {tipo === "reasignacion" && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="origenRubroId">Rubro Origen</Label>
                    <Input
                      id="origenRubroId"
                      placeholder="rubro_xyz..."
                      value={origenRubroId}
                      onChange={(e) => setOrigenRubroId(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="destinoRubroId">Rubro Destino</Label>
                    <Input
                      id="destinoRubroId"
                      placeholder="rubro_xyz..."
                      value={destinoRubroId}
                      onChange={(e) => setDestinoRubroId(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="metodoDistribucion">Método de Distribución</Label>
                <Select value={metodoDistribucion} onValueChange={(v) => setMetodoDistribucion(v as any)}>
                  <SelectTrigger id="metodoDistribucion">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pro_rata_forward">Pro-rata Forward</SelectItem>
                    <SelectItem value="pro_rata_all">Pro-rata All</SelectItem>
                    <SelectItem value="single_month">Mes Único</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="solicitadoPor">Solicitado Por (Email) *</Label>
                <Input
                  id="solicitadoPor"
                  type="email"
                  placeholder="usuario@empresa.com"
                  value={solicitadoPor}
                  onChange={(e) => setSolicitadoPor(e.target.value)}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="justificacion">Justificación</Label>
                <Input
                  id="justificacion"
                  placeholder="Razón del ajuste..."
                  value={justificacion}
                  onChange={(e) => setJustificacion(e.target.value)}
                  maxLength={2000}
                />
              </div>
              
              {/* Approval flow hint */}
              <div className="text-xs text-muted-foreground p-3 bg-blue-50 dark:bg-blue-950/20 rounded border border-blue-200 dark:border-blue-900">
                <p className="font-medium mb-1">💡 Flujo de aprobación</p>
                <p>
                  {isSDMT 
                    ? "Como SDMT, los ajustes a tu proyecto pueden ser auto-aprobados o requerir revisión según monto y tipo."
                    : "Los ajustes creados por FIN fluyen al proceso de aprobación SDMT cuando corresponda según políticas de gobierno."
                  }
                </p>
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
                {isSubmitting ? "Creando..." : "Crear Ajuste"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
