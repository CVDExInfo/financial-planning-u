import React from "react";
import finanzasClient, { type ProviderCreate } from "@/api/finanzasClient";
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
import { Building2, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function ProvidersManager() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Form state
  const [nombre, setNombre] = React.useState("");
  const [taxId, setTaxId] = React.useState("");
  const [tipo, setTipo] = React.useState<"servicios" | "materiales" | "software" | "infraestructura">("servicios");
  const [contactoNombre, setContactoNombre] = React.useState("");
  const [contactoEmail, setContactoEmail] = React.useState("");
  const [contactoTelefono, setContactoTelefono] = React.useState("");
  const [pais, setPais] = React.useState("");
  const [notas, setNotas] = React.useState("");

  const {
    data: providers,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["finz", "providers"],
    queryFn: () => finanzasClient.getProviders(),
    retry: 1,
  });

  const handleSubmitCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nombre || !taxId) {
      toast.error("Por favor completa todos los campos requeridos");
      return;
    }

    try {
      setIsSubmitting(true);

      const payload: ProviderCreate = {
        nombre,
        tax_id: taxId,
        tipo,
        contacto_nombre: contactoNombre || undefined,
        contacto_email: contactoEmail || undefined,
        contacto_telefono: contactoTelefono || undefined,
        pais: pais || undefined,
        notas: notas || undefined,
      };

      await finanzasClient.createProvider(payload);

      toast.success(`Proveedor "${nombre}" creado exitosamente`);
      setIsCreateDialogOpen(false);

      // Refresh list after creating a provider
      refetch();

      // Reset form
      setNombre("");
      setTaxId("");
      setTipo("servicios");
      setContactoNombre("");
      setContactoEmail("");
      setContactoTelefono("");
      setPais("");
      setNotas("");
    } catch (e: any) {
      console.error("Error creating provider:", e);

      const errorMessage = e?.message || "Error al crear el proveedor";

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
        title="Gestión de Proveedores"
        description="Registra y administra proveedores con un layout consistente. Los mensajes de ayuda evitan pantallas en blanco."
        badge="Finanzas"
        icon={<Building2 className="h-5 w-5 text-white" />}
        actions={
          <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
            <Plus size={16} />
            Agregar Proveedor
          </Button>
        }
      />

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Proveedores</CardTitle>
          <CardDescription>
            Los proveedores registrados estarán disponibles para asociar con movimientos financieros.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando proveedores...
            </div>
          ) : isError ? (
            <Alert variant="destructive">
              <AlertTitle>Error al cargar proveedores</AlertTitle>
              <AlertDescription>
                {(error as Error)?.message || "No se pudo obtener la lista de proveedores"}
              </AlertDescription>
            </Alert>
          ) : providers && providers.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>RFC / Tax ID</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>País</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {providers.map((provider) => (
                    <TableRow key={provider.id}>
                      <TableCell className="font-medium">{provider.nombre}</TableCell>
                      <TableCell>{provider.tax_id || "—"}</TableCell>
                      <TableCell>{provider.tipo || "—"}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{provider.contacto_nombre || "—"}</span>
                          <span className="text-xs text-muted-foreground">
                            {provider.contacto_email || provider.contacto_telefono || ""}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{provider.pais || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center space-y-3">
              <p className="text-muted-foreground">
                Haz clic en "Agregar Proveedor" para registrar un nuevo proveedor en el sistema.
              </p>
              <p className="text-xs text-muted-foreground">
                Incluye RFC/Tax ID, tipo de proveedor y datos de contacto opcionales.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Agregar Nuevo Proveedor</DialogTitle>
            <DialogDescription>
              Registra un proveedor o vendor en el sistema Finanzas
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitCreate}>
            <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="nombre">Nombre del Proveedor *</Label>
                  <Input
                    id="nombre"
                    placeholder="Ej: TechConsulting Solutions LLC"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    required
                    minLength={3}
                    maxLength={200}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="taxId">RFC / Tax ID *</Label>
                  <Input
                    id="taxId"
                    placeholder="RFC-987654321"
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                    required
                    minLength={5}
                    maxLength={50}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="tipo">Tipo de Proveedor *</Label>
                <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
                  <SelectTrigger id="tipo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="servicios">Servicios</SelectItem>
                    <SelectItem value="materiales">Materiales</SelectItem>
                    <SelectItem value="software">Software</SelectItem>
                    <SelectItem value="infraestructura">Infraestructura</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label className="text-sm font-semibold">Información de Contacto (Opcional)</Label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="contactoNombre">Nombre de Contacto</Label>
                  <Input
                    id="contactoNombre"
                    placeholder="María García"
                    value={contactoNombre}
                    onChange={(e) => setContactoNombre(e.target.value)}
                    maxLength={200}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="contactoEmail">Email de Contacto</Label>
                  <Input
                    id="contactoEmail"
                    type="email"
                    placeholder="maria@empresa.com"
                    value={contactoEmail}
                    onChange={(e) => setContactoEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="contactoTelefono">Teléfono</Label>
                  <Input
                    id="contactoTelefono"
                    placeholder="+1-555-0123"
                    value={contactoTelefono}
                    onChange={(e) => setContactoTelefono(e.target.value)}
                    maxLength={50}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pais">País</Label>
                  <Input
                    id="pais"
                    placeholder="USA"
                    value={pais}
                    onChange={(e) => setPais(e.target.value)}
                    minLength={2}
                    maxLength={100}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="notas">Notas</Label>
                <Input
                  id="notas"
                  placeholder="Notas adicionales sobre el proveedor..."
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
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
                {isSubmitting ? "Agregando..." : "Agregar Proveedor"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
