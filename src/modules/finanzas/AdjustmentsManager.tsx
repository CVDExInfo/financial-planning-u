import React from "react";
import finanzasClient, { type AdjustmentCreate } from "@/api/finanzasClient";
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
import PageHeader from "@/components/PageHeader";
import { ShieldCheck, Plus } from "lucide-react";

export default function AdjustmentsManager() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

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
        origen_rubro_id: origenRubroId || undefined,
        destino_rubro_id: destinoRubroId || undefined,
        metodo_distribucion: metodoDistribucion || undefined,
        justificacion: justificacion || undefined,
      };

      await finanzasClient.createAdjustment(payload);

      toast.success("Ajuste presupuestario creado exitosamente");
      setIsCreateDialogOpen(false);

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

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <PageHeader
        title="Ajustes Presupuestarios"
        description="Gestiona excesos, reducciones o reasignaciones de presupuesto. El encabezado y el estado vacío siguen el estilo de acta-ui."
        badge="Finanzas"
        icon={<ShieldCheck className="h-5 w-5 text-white" />}
        actions={
          <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
            <Plus size={16} />
            Crear Ajuste
          </Button>
        }
      />

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Ajustes</CardTitle>
          <CardDescription>
            Los ajustes pueden ser excesos, reducciones o reasignaciones entre rubros.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-3">
          <p className="text-muted-foreground">
            Haz clic en "Crear Ajuste" para registrar un ajuste presupuestario.
          </p>
          <p className="text-xs text-muted-foreground">
            Incluye IDs de proyecto y rubro para mantener un flujo claro de distribución.
          </p>
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
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="projectId">ID del Proyecto *</Label>
                  <Input
                    id="projectId"
                    placeholder="proj_abc123..."
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    required
                  />
                </div>
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
              </div>

              <div className="grid grid-cols-2 gap-4">
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
