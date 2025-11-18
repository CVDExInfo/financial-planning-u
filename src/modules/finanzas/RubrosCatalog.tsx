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
import { Plus } from "lucide-react";

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

  React.useEffect(() => {
    let cancelled = false;
    
    // Debug logging for dev mode only
    if (import.meta.env.DEV) {
      console.log("[Finz] RubrosCatalog - API_BASE:", API_BASE || "(missing)");
    }
    
    (async () => {
      try {
        setLoading(true);
        const data = await finanzasClient.getRubros();
        if (!cancelled) setRows(data);
      } catch (e: any) {
        console.error(e);
        if (!cancelled) setError(e?.message || "No se pudo cargar el catálogo");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

    try {
      setIsSubmitting(true);
      
      const payload: RubroCreate = {
        rubro_id: selectedRubro.rubro_id,
        monto_total: parseFloat(montoTotal),
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
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">
          Gestión presupuesto — Catálogo de Rubros
        </h2>
        <p className="text-xs text-muted-foreground">
          Haz clic en "Agregar a Proyecto" para asociar un rubro a un proyecto específico
        </p>
      </div>
      
      {loading && (
        <div className="text-sm text-muted-foreground mb-3">Cargando…</div>
      )}
      {error && (
        <div className="text-sm text-red-600 mb-3">{error}</div>
      )}
      <div className="rounded-lg border border-border overflow-hidden bg-card">
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
            {rows.map((r) => (
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
            {rows.length === 0 && !loading && !error && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  No hay rubros disponibles.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {!loading && (
        <p className="text-xs text-muted-foreground mt-3">
          Mostrando {rows.length} rubros.
        </p>
      )}

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
