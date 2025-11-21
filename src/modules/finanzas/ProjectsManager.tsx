import React from "react";
import finanzasClient, { type ProjectCreate, type Project } from "@/api/finanzasClient";
import ApiService from "@/lib/api";
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

  const formatDate = (value?: string | null) =>
    value ? new Date(value).toLocaleDateString() : "—";

  const loadProjects = React.useCallback(async () => {
    try {
      setIsLoadingProjects(true);
      setLoadError(null);
      const data = await ApiService.getProjects();
      setProjects(data);
    } catch (e: any) {
      const message = e?.message || "No se pudieron cargar los proyectos";
      setLoadError(message);
      toast.error(message);
    } finally {
      setIsLoadingProjects(false);
    }
  }, []);

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
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Gestión de Proyectos</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Crear y administrar proyectos financieros
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={loadProjects}
            disabled={isLoadingProjects}
            className="gap-2"
          >
            {isLoadingProjects ? "Actualizando" : "Refrescar"}
          </Button>
          <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
            <Plus size={16} />
            Crear Proyecto
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border p-6 bg-card space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-muted-foreground">
              Proyectos disponibles en el backend (API Finanzas)
            </p>
            <p className="text-xs text-muted-foreground">
              Los proyectos se almacenan en DynamoDB y se sincronizan en tiempo real.
            </p>
          </div>
          <div className="text-sm text-muted-foreground">
            {isLoadingProjects
              ? "Cargando proyectos..."
              : `Proyectos activos: ${projects.length}`}
          </div>
        </div>

        {loadError && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-destructive text-sm">
            {loadError}
          </div>
        )}

        {isLoadingProjects ? (
          <div className="py-8 text-center text-muted-foreground">Cargando proyectos...</div>
        ) : projects.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No se encontraron proyectos. Usa "Crear Proyecto" para agregar uno nuevo.
          </div>
        ) : (
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
                {projects.map((project) => (
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
      </div>

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
