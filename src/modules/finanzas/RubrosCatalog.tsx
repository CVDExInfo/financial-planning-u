/*
 * Finanzas endpoints used here
 * - GET /catalog/rubros → obtener catálogo de rubros
 * - POST /projects/:projectId/rubros → asociar rubro a un proyecto
 */
import React from "react";
import finanzasClient, { Rubro, type RubroCreate } from "@/api/finanzasClient";
import { API_BASE } from "@/config/env";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, RefreshCcw } from "lucide-react";
import DataContainer from "@/components/DataContainer";
import PageHeader from "@/components/PageHeader";

function Cell({ children }: { children: React.ReactNode }) {
  return (
    <td className="px-3 py-2 border-b border-border text-sm text-foreground">
      {children}
    </td>
  );
}

export default function RubrosCatalog() {
  const [rows, setRows] = React.useState<Rubro[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const [selectedRubro, setSelectedRubro] = React.useState<Rubro | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Form state for adding rubro to project
  const [projectId, setProjectId] = React.useState("");
  const [montoTotal, setMontoTotal] = React.useState("");
  const [tipoEjecucion, setTipoEjecucion] = React.useState<"mensual" | "puntual" | "por_hito">("mensual");
  const [notas, setNotas] = React.useState("");

  const loadRubros = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const rubrosResponse = (await finanzasClient.getRubros()) as
        | Rubro[]
        | { data?: Rubro[] };

      const normalizedRubros = Array.isArray(rubrosResponse)
        ? rubrosResponse
        : Array.isArray(rubrosResponse?.data)
          ? rubrosResponse.data
          : null;

      if (!normalizedRubros) {
        const message =
          "Formato inesperado de respuesta del catálogo de rubros. Verifica la API de Finanzas.";
        setError(message);
        toast.error(message);
        return;
      }

      setRows(normalizedRubros);
    } catch (e: any) {
      console.error(e);
      const message =
        e?.message ||
        "No se pudo cargar el catálogo de rubros. Verifica la conexión con la API de Finanzas.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    // Debug logging for dev mode only
    if (import.meta.env.DEV) {
      console.log("[Finz] RubrosCatalog - API_BASE:", API_BASE || "(missing)");
    }

    loadRubros();
  }, [loadRubros]);

  const handleAddToProject = (rubro: Rubro) => {
    setSelectedRubro(rubro);
    setIsAddDialogOpen(true);
  };

  const handleSubmitAddToProject = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedRubro || !projectId || !montoTotal) {
      toast.error("Por favor completa todos los campos requeridos");
      return;
    }

    const parsedMonto = Number.parseFloat(montoTotal);

    if (!Number.isFinite(parsedMonto) || parsedMonto < 0) {
      toast.error("El monto debe ser un número válido y mayor o igual a 0");
      return;
    }

    try {
      setIsSubmitting(true);

      const payload: RubroCreate = {
        rubro_id: selectedRubro.rubro_id,
        monto_total: parsedMonto,
        tipo_ejecucion: tipoEjecucion,
        notas: notas || undefined,
      };

      await finanzasClient.createProjectRubro(projectId, payload);
      
      toast.success(`Rubro "${selectedRubro.nombre}" agregado al proyecto exitosamente`);
      setIsAddDialogOpen(false);
      
      // Reset form
      setProjectId("");
      setMontoTotal("");
      setTipoEjecucion("mensual");
      setNotas("");
      setSelectedRubro(null);
    } catch (e: any) {
      console.error("Error adding rubro to project:", e);
      
      // Enhanced error message handling based on error type
      const errorMessage = e?.message || "Error al agregar el rubro al proyecto";
      
      if (errorMessage.includes("501")) {
        toast.error("Esta función aún no está implementada en el servidor (501). El backend necesita completar este handler.");
      } else if (errorMessage.includes("signed in") || errorMessage.includes("401") || errorMessage.includes("403")) {
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
        title="Catálogo de Rubros"
        description="Taxonomía, línea contable y tipo de costo alineados al branding Ikusi/CVDEx. Usa este catálogo para asociar rubros a proyectos."
        badge="Finanzas"
        actions={
          <Button
            variant="outline"
            className="gap-2"
            onClick={loadRubros}
            disabled={loading}
          >
            <RefreshCcw className="h-4 w-4" />
            {loading ? "Cargando" : "Refrescar"}
          </Button>
        }
      />

      <Card className="border-border/80 shadow-sm">
        <CardHeader className="space-y-2">
          <CardTitle className="text-base font-semibold">Rubros disponibles</CardTitle>
          <CardDescription>
            Haz clic en "Agregar a Proyecto" para asociar un rubro a un proyecto específico. Los estados de carga, error y vacío usan el mismo diseño que acta-ui.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataContainer
            data={rows}
            isLoading={loading}
            error={error}
            onRetry={loadRubros}
            loadingType="table"
            emptyTitle="No hay rubros disponibles"
            emptyMessage="Aún no hay rubros listos. Intenta refrescar o sincroniza el catálogo desde Finanzas."
          >
            {(items) => {
              const safeItems = Array.isArray(items) ? (items as Rubro[]) : [];

              return (
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-muted text-muted-foreground text-xs uppercase tracking-wide">
                        <th className="text-left px-3 py-2">rubro_id</th>
                        <th className="text-left px-3 py-2">nombre</th>
                        <th className="text-left px-3 py-2">categoria</th>
                        <th className="text-left px-3 py-2">linea_codigo</th>
                        <th className="text-left px-3 py-2">tipo_costo</th>
                        <th className="text-left px-3 py-2">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {safeItems.map((r) => (
                        <tr key={r.rubro_id || r.nombre} className="hover:bg-muted/50">
                          <Cell>{r.rubro_id || "—"}</Cell>
                          <Cell>{r.nombre}</Cell>
                          <Cell>{r.categoria || ""}</Cell>
                          <Cell>{r.linea_codigo || ""}</Cell>
                          <Cell>{r.tipo_costo || ""}</Cell>
                          <Cell>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAddToProject(r)}
                              className="gap-1"
                            >
                              <Plus size={14} />
                              Agregar a Proyecto
                            </Button>
                          </Cell>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            }}
          </DataContainer>
        </CardContent>
      </Card>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar Rubro a Proyecto</DialogTitle>
            <DialogDescription>
              Agrega "{selectedRubro?.nombre}" a un proyecto específico
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitAddToProject}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="projectId">ID del Proyecto *</Label>
                <Input
                  id="projectId"
                  placeholder="proj_abc123..."
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Formato: proj_xxxxxxxxxx (10 caracteres alfanuméricos)
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="montoTotal">Monto Total *</Label>
                <Input
                  id="montoTotal"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={montoTotal}
                  onChange={(e) => setMontoTotal(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tipoEjecucion">Tipo de Ejecución *</Label>
                <Select value={tipoEjecucion} onValueChange={(v) => setTipoEjecucion(v as any)}>
                  <SelectTrigger id="tipoEjecucion">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mensual">Mensual</SelectItem>
                    <SelectItem value="puntual">Puntual</SelectItem>
                    <SelectItem value="por_hito">Por Hito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="notas">Notas (opcional)</Label>
                <Input
                  id="notas"
                  placeholder="Notas adicionales..."
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  maxLength={1000}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Agregando..." : "Agregar Rubro"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
