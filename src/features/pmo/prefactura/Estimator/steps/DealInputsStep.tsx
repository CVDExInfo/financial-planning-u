import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Plus, X } from "lucide-react";
import type { DealInputs, Currency } from "@/types/domain";

const dealInputsSchema: z.ZodType<DealInputs> = z.object({
  project_name: z.string().min(1, "El nombre del proyecto es requerido"),
  project_description: z.string().optional(),
  currency: z.enum(["USD", "COP"]),
  start_date: z.string().min(1, "La fecha de inicio es requerida"),
  duration_months: z
    .number()
    .min(1, "La duración debe ser de al menos 1 mes")
    .max(60, "La duración no puede exceder 60 meses"),
  contract_value: z.number().optional(),
  client_name: z.string().optional(),
  sdm_manager_name: z
    .string()
    .trim()
    .min(1, "El nombre del Service Delivery Manager es requerido")
    .max(200, "El nombre no puede exceder 200 caracteres"),
  assumptions: z.array(z.string()).default([]),
}) as z.ZodType<DealInputs>;

interface DealInputsStepProps {
  data: DealInputs | null;
  setData: (data: DealInputs) => void;
  onNext: () => void;
  onPrevious: () => void;
  isFirstStep: boolean;
  isLastStep: boolean;
}

export function DealInputsStep({ data, setData, onNext }: DealInputsStepProps) {
  const form = useForm<DealInputs>({
    resolver: zodResolver(dealInputsSchema),
    defaultValues: data
      ? { ...data, sdm_manager_name: data.sdm_manager_name ?? "" }
      : {
          project_name: "",
          project_description: "",
          currency: "USD",
          start_date: "",
          duration_months: 12,
          contract_value: undefined,
          client_name: "",
          sdm_manager_name: "",
          assumptions: [],
        },
  });

  const assumptions = form.watch("assumptions") || [];

  const onSubmit = (formData: DealInputs) => {
    console.log("📋 Deal Inputs submitted:", {
      projectName: formData.project_name,
      client: formData.client_name,
      currency: formData.currency,
      startDate: formData.start_date,
      durationMonths: formData.duration_months,
      contractValue: formData.contract_value,
      assumptionsCount: formData.assumptions?.length || 0,
      timestamp: new Date().toISOString(),
    });

    setData(formData);
    onNext();
  };

  const addAssumption = () => {
    const currentAssumptions = form.getValues("assumptions") || [];
    form.setValue("assumptions", [...currentAssumptions, ""]);
    console.log(
      "➕ Assumption added, total count:",
      currentAssumptions.length + 1
    );
  };

  const updateAssumption = (index: number, value: string) => {
    const currentAssumptions = form.getValues("assumptions") || [];
    const newAssumptions = [...currentAssumptions];
    newAssumptions[index] = value;
    form.setValue("assumptions", newAssumptions);
    console.log("✏️  Assumption updated at index", index, ":", value);
  };

  const removeAssumption = (index: number) => {
    const currentAssumptions = form.getValues("assumptions") || [];
    const newAssumptions = currentAssumptions.filter((_, i) => i !== index);
    form.setValue("assumptions", newAssumptions);
    console.log(
      "🗑️  Assumption removed at index",
      index,
      ", remaining:",
      newAssumptions.length
    );
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-semibold mb-2">Información del Proyecto</h2>
        <p className="text-muted-foreground">
          Ingrese los detalles básicos del proyecto para establecer la base de su estimación
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="project_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre del Proyecto *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="ej., Modernización de Plataforma Digital"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="client_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre del Cliente</FormLabel>
                  <FormControl>
                    <Input placeholder="ej., Acme Corporation" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="sdm_manager_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Service Delivery Manager (Nombre) *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Laura Gómez"
                      {...field}
                      onChange={(event) => field.onChange(event.target.value)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="currency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Moneda del Proyecto *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar moneda" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="USD">USD - Dólar Estadounidense</SelectItem>
                      <SelectItem value="COP">COP - Peso Colombiano</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contract_value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor del Contrato</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="ej., 500000"
                      {...field}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value
                            ? parseFloat(e.target.value)
                            : undefined
                        )
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="start_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha de Inicio *</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="duration_months"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Duración (Meses) *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      max="60"
                      {...field}
                      onChange={(e) =>
                        field.onChange(parseInt(e.target.value) || 1)
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="project_description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Descripción del Proyecto</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Describa el alcance del proyecto, objetivos y entregables clave..."
                    rows={4}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Assumptions Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">
                Supuestos del Proyecto
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addAssumption}
                className="gap-2"
              >
                <Plus size={16} />
                Agregar Supuesto
              </Button>
            </div>

            <div className="space-y-2">
              {assumptions.map((assumption, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    placeholder="ej., Tasa de cambio fija durante la duración"
                    value={assumption}
                    onChange={(e) => updateAssumption(index, e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeAssumption(index)}
                  >
                    <X size={16} />
                  </Button>
                </div>
              ))}

              {assumptions.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No se han agregado supuestos aún</p>
                  <p className="text-sm">
                    Haga clic en "Agregar Supuesto" para incluir supuestos del proyecto
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Summary */}
          <div className="bg-muted/50 rounded-lg p-6">
            <h3 className="font-medium mb-4">Resumen</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Moneda:</span>
                <Badge className="ml-2">{form.watch("currency")}</Badge>
              </div>
              <div>
                <span className="text-muted-foreground">Duración:</span>
                <Badge variant="outline" className="ml-2">
                  {form.watch("duration_months")} meses
                </Badge>
              </div>
              {form.watch("contract_value") && (
                <div>
                  <span className="text-muted-foreground">Valor:</span>
                  <Badge variant="outline" className="ml-2">
                    {new Intl.NumberFormat("es-CO", {
                      style: "currency",
                      currency: form.watch("currency"),
                      minimumFractionDigits: 0,
                    }).format(form.watch("contract_value") || 0)}
                  </Badge>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Supuestos:</span>
                <Badge variant="outline" className="ml-2">
                  {assumptions.filter((a) => a.trim()).length}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" className="gap-2">
              Continuar a Costos Laborales
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

export default DealInputsStep;
