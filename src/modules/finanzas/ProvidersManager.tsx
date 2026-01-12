/*
 * Finanzas endpoints used here
 * - POST /providers → registrar proveedores
 */
import { useState } from "react";
import type { FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import finanzasClient, {
  ProviderCreateSchema,
  type Provider,
  type ProviderCreate,
} from "@/api/finanzasClient";
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
import { Building2, Plus, RefreshCcw } from "lucide-react";
import DataContainer from "@/components/DataContainer";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/hooks/useAuth";
import { handleFinanzasApiError } from "@/features/sdmt/cost/utils/errorHandling";
import { loadProvidersWithHandler } from "./providers.helpers";

export default function ProvidersManager() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { hasGroup, canEdit, isExecRO } = usePermissions();
  const { login } = useAuth();
  const isFinReadOnly = hasGroup("FIN") && !canEdit;
  const canCreateProvider = canEdit && !isFinReadOnly && !isExecRO;

  // Form state
  const [nombre, setNombre] = useState("");
  const [taxId, setTaxId] = useState("");
  const [tipo, setTipo] = useState<"servicios" | "materiales" | "software" | "infraestructura">("servicios");
  const [contactoNombre, setContactoNombre] = useState("");
  const [contactoEmail, setContactoEmail] = useState("");
  const [contactoTelefono, setContactoTelefono] = useState("");
  const [pais, setPais] = useState("");
  const [notas, setNotas] = useState("");

  const providersQuery = useQuery({
    queryKey: ["providers"],
    queryFn: async () => {
      const result = await loadProvidersWithHandler(
        () => finanzasClient.getProviders({ limit: 50 }),
        login,
      );

      if (result.error) {
        throw new Error(result.error);
      }

      return result.providers;
    },
    refetchOnWindowFocus: true,
  });

  const createProviderMutation = useMutation({
    mutationFn: (payload: ProviderCreate) => finanzasClient.createProvider(payload),
    onSuccess: async (createdProvider) => {
      toast.success(`Proveedor "${createdProvider.nombre}" creado exitosamente`);
      setIsCreateDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["providers"] });

      // Reset form
      setNombre("");
      setTaxId("");
      setTipo("servicios");
      setContactoNombre("");
      setContactoEmail("");
      setContactoTelefono("");
      setPais("");
      setNotas("");
    },
    onError: (error) => {
      const message = handleFinanzasApiError(error, {
        onAuthError: login,
        fallback: "Error al crear el proveedor",
      });
      toast.error(message);
    },
  });

  const isSubmitting = createProviderMutation.isPending;

  const handleSubmitCreate = async (e: FormEvent) => {
    e.preventDefault();

    if (!nombre || !taxId) {
      toast.error("Por favor completa todos los campos requeridos");
      return;
    }

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

    const validated = ProviderCreateSchema.safeParse(payload);

    if (!validated.success) {
      const errorMessage = validated.error.issues
        .map((issue) => issue.message || issue.path.join("."))
        .join("; ");
      toast.error(errorMessage || "Datos inválidos. Verifica el formulario.");
      return;
    }

    try {
      await createProviderMutation.mutateAsync(validated.data);
    } catch (error) {
      console.error("Error creating provider:", error);
    }
  };

  const providersError =
    providersQuery.error instanceof Error
      ? providersQuery.error
      : providersQuery.error
      ? new Error(String(providersQuery.error))
      : null;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <PageHeader
        title="Gestión de Proveedores"
        description="Registra y administra proveedores con un layout consistente. Los mensajes de ayuda evitan pantallas en blanco."
        badge="Finanzas"
        icon={<Building2 className="h-5 w-5 text-white" />}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => providersQuery.refetch()}
              className="gap-2"
              disabled={providersQuery.isFetching}
            >
              <RefreshCcw className="h-4 w-4" />
              {providersQuery.isFetching ? "Actualizando" : "Refrescar"}
            </Button>
            {canCreateProvider && (
              <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
                <Plus size={16} />
                Agregar Proveedor
              </Button>
            )}
          </div>
        }
      />

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Proveedores</CardTitle>
          <CardDescription>
            Los proveedores registrados estarán disponibles para asociar con movimientos financieros. Crear requiere rol con permiso de escritura (SDT/PM).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataContainer
            data={providersQuery.data}
            isLoading={providersQuery.isLoading || providersQuery.isFetching}
            error={providersError}
            onRetry={() => providersQuery.refetch()}
            loadingType="table"
            emptyTitle="No hay proveedores"
            emptyMessage="Crea un proveedor o revisa que tu rol tenga permisos de escritura. FIN solo consulta."
          >
            {(items) => (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b">
                      <th className="py-2 pr-4 font-medium">Nombre</th>
                      <th className="py-2 pr-4 font-medium">Tipo</th>
                      <th className="py-2 pr-4 font-medium">RFC / Tax ID</th>
                      <th className="py-2 pr-4 font-medium">País</th>
                      <th className="py-2 pr-4 font-medium">Estado</th>
                      <th className="py-2 pr-4 font-medium">Contacto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(items as Provider[]).map((provider) => (
                      <tr key={provider.id} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-medium">{provider.nombre}</td>
                        <td className="py-2 pr-4 capitalize">{provider.tipo}</td>
                        <td className="py-2 pr-4">{provider.tax_id}</td>
                        <td className="py-2 pr-4">{provider.pais || "—"}</td>
                        <td className="py-2 pr-4 capitalize text-muted-foreground">{provider.estado || "activo"}</td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {provider.contacto_nombre || provider.contacto_email || "—"}
                        </td>
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
