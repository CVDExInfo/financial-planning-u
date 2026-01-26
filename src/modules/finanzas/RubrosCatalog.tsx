/*
 * Finanzas endpoints used here
 * - GET /catalog/rubros → obtener catálogo de rubros
 * - POST /projects/:projectId/rubros → asociar rubro a un proyecto
 */
import { useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import finanzasClient, { Rubro, type RubroCreate } from "@/api/finanzasClient";
import { API_BASE } from "@/config/env";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, RefreshCcw } from "lucide-react";
import DataContainer from "@/components/DataContainer";
import PageHeader from "@/components/PageHeader";
import { TAXONOMY_BY_ID as taxonomyById } from "@/lib/rubros/canonical-taxonomy";
import { canonicalizeRubroId } from "@/lib/rubros";
import RubroFormModal from "@/components/finanzas/RubroFormModal";
import { useRBACProjects } from "@/hooks/useRBACProjects";
import type { RubroFormData } from "@/types/rubros";

type RubroWithTaxonomy = Rubro & {
  categoria_codigo?: string | null;
  linea_codigo?: string | null;
  linea_gasto?: string | null;
  tipo_costo?: string | null;
  tipo_ejecucion?: string | null;
};

function Cell({ children }: { children: ReactNode }) {
  return (
    <td className="px-3 py-2 border-b border-border text-sm text-foreground">
      {children}
    </td>
  );
}

export default function RubrosCatalog() {
  const [rows, setRows] = useState<Rubro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedRubro, setSelectedRubro] = useState<Rubro | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const selectedRubroWithTaxonomy = selectedRubro as RubroWithTaxonomy | null;

  // Get RBAC-filtered projects
  const { projects: availableProjects } = useRBACProjects();

  const loadRubros = useCallback(async () => {
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

      const enrichedRows = normalizedRubros.map((rubro) => {
        const rubroWithTaxonomy = rubro as RubroWithTaxonomy;
        // Normalize to canonical ID if legacy
        const canonicalId = canonicalizeRubroId(rubroWithTaxonomy.rubro_id);
        const taxonomy = taxonomyById.get(canonicalId || rubroWithTaxonomy.rubro_id);
        
        // Prefer taxonomy data, fallback to API response
        const nombre =
          rubroWithTaxonomy.nombre ||
          taxonomy?.linea_gasto ||
          taxonomy?.descripcion ||
          rubroWithTaxonomy.rubro_id;

        return {
          ...rubroWithTaxonomy,
          rubro_id: canonicalId || rubroWithTaxonomy.rubro_id, // Use canonical ID
          nombre,
          categoria: rubroWithTaxonomy.categoria ?? taxonomy?.categoria ?? null,
          categoria_codigo: rubroWithTaxonomy.categoria_codigo ?? taxonomy?.categoria_codigo ?? null,
          linea_codigo: rubroWithTaxonomy.linea_codigo ?? taxonomy?.linea_codigo ?? (canonicalId || rubroWithTaxonomy.rubro_id),
          linea_gasto: rubroWithTaxonomy.linea_gasto ?? taxonomy?.linea_gasto ?? nombre,
          tipo_costo: rubroWithTaxonomy.tipo_costo ?? taxonomy?.tipo_costo ?? null,
          tipo_ejecucion: rubroWithTaxonomy.tipo_ejecucion ?? taxonomy?.tipo_ejecucion ?? null,
          descripcion: rubroWithTaxonomy.descripcion ?? taxonomy?.descripcion ?? null,
        } as Rubro;
      });

      setRows(enrichedRows);
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

  useEffect(() => {
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

  const handleSubmitAddToProject = async (formData: RubroFormData & { projectId: string }) => {
    if (!selectedRubro) {
      toast.error("No se ha seleccionado un rubro");
      return;
    }

    try {
      setIsSubmitting(true);

      // Calculate total cost
      const totalCost = formData.cantidad * formData.costo_unitario * formData.plazo_meses;

      // Map to backend payload
      const payload: RubroCreate = {
        rubro_id: formData.rubroId, // Use canonical ID
        monto_total: totalCost,
        tipo_ejecucion: formData.tipo === 'recurrente' ? 'mensual' : 'puntual',
        notas: formData.notas,
        // Include additional fields for better tracking
        meses_programados: Array.from(
          { length: formData.plazo_meses },
          (_, i) => {
            const month = ((formData.mes_inicio - 1 + i) % 12) + 1;
            const year = new Date().getFullYear() + Math.floor((formData.mes_inicio - 1 + i) / 12);
            return `${year}-${month.toString().padStart(2, '0')}`;
          }
        ),
      };

      await finanzasClient.createProjectRubro(formData.projectId, payload);
      
      toast.success(`Rubro "${selectedRubro.nombre}" agregado al proyecto exitosamente`);
      setIsAddDialogOpen(false);
      setSelectedRubro(null);
      
      // Reload catalog to show updated state
      loadRubros();
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
            emptyTitle="No hay rubros en el catálogo"
            emptyMessage="El catálogo de rubros se carga desde la taxonomía canónica. Si ves este mensaje, verifica la conexión con la API o contacta a soporte."
          >
            {(items) => {
              const safeItems = Array.isArray(items) ? (items as Rubro[]) : [];

              return (
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-muted text-muted-foreground text-xs uppercase tracking-wide">
                        <th className="text-left px-3 py-2">RUBRO_ID</th>
                        <th className="text-left px-3 py-2">NOMBRE</th>
                        <th className="text-left px-3 py-2">CATEGORÍA</th>
                        <th className="text-left px-3 py-2">LINEA_CODIGO</th>
                        <th className="text-left px-3 py-2">TIPO_COSTO</th>
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

      <RubroFormModal
        open={isAddDialogOpen}
        onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) setSelectedRubro(null);
        }}
        onSubmit={handleSubmitAddToProject}
        context="catalog"
        availableProjects={availableProjects}
        isSubmitting={isSubmitting}
        initialRubro={selectedRubro ? {
          categoria_codigo: (selectedRubro as RubroWithTaxonomy).categoria_codigo || '',
          rubroId: selectedRubro.rubro_id,
          tipo: 'recurrente', // Default
          mes_inicio: 1,
          plazo_meses: 12,
          cantidad: 1,
          costo_unitario: 0,
          moneda: 'USD',
        } : undefined}
      />
    </div>
  );
}
