import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Calculator, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { LaborEstimate } from "@/types/domain";
import { useModRoles } from "@/hooks/useModRoles";
import { mapModRoleToRubroId, type MODRole } from "@/api/helpers/rubros";
import { canonicalizeRubroId, rubroDescriptionFor, findRubroByLineaCodigo } from "@/lib/rubros";
import { normalizeNonLaborEstimates } from "../utils/normalizeEstimates";


// Labor rate presets by country and role
const LABOR_PRESETS = {
  Colombia: {
    junior: { rate: 2500, on_cost: 25 },
    mid: { rate: 4000, on_cost: 25 },
    senior: { rate: 6000, on_cost: 25 },
    lead: { rate: 8500, on_cost: 30 },
  },
  USA: {
    junior: { rate: 6000, on_cost: 35 },
    mid: { rate: 9000, on_cost: 35 },
    senior: { rate: 12000, on_cost: 35 },
    lead: { rate: 15000, on_cost: 40 },
  },
  Mexico: {
    junior: { rate: 3000, on_cost: 30 },
    mid: { rate: 5000, on_cost: 30 },
    senior: { rate: 7500, on_cost: 30 },
    lead: { rate: 10000, on_cost: 35 },
  },
};

/**
 * Labor roles are now sourced from MOD (Mano de Obra Directa) taxonomy
 * defined in src/modules/modRoles.ts and aligned with Rubros catalog.
 * 
 * This ensures consistency between:
 * - PMO Estimator (this component)
 * - SDMT Cost Management (catalog, forecast, changes)
 * - Backend payroll and cost tracking
 * 
 * The MOD roles are:
 * - Ingeniero Delivery (Lead Engineer)
 * - Ingeniero Soporte N1/N2/N3 (Support Engineers)
 * - Service Delivery Manager
 * - Project Manager
 */

/**
 * Format currency value with no decimals
 * Currently hardcoded to USD as it's the default currency for the application
 * TODO: Make currency and locale configurable when i18n is implemented
 */
const formatCurrencyNoDecimals = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

interface LaborStepProps {
  data: LaborEstimate[];
  setData: (data: LaborEstimate[]) => void;
  onNext: () => void;
  onPrevious: () => void;
  isFirstStep: boolean;
  isLastStep: boolean;
}

export function LaborStep({ data, setData, onNext }: LaborStepProps) {
  // Fetch MOD roles from Rubros taxonomy
  const { roles: modRoles, loading: rolesLoading } = useModRoles();
  
  const [laborEstimates, setLaborEstimates] = useState<LaborEstimate[]>(
    data.length > 0 ? data : []
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  const addLaborItem = () => {
    const newItem: LaborEstimate = {
      rubroId: "",
      role: "",
      country: "Colombia",
      level: "mid",
      fte_count: 1,
      hourly_rate: 0,
      hours_per_month: 160,
      on_cost_percentage: 25,
      start_month: 1,
      end_month: 12,
    };
    setLaborEstimates([...laborEstimates, newItem]);
    console.log("➕ Labor item added, total count:", laborEstimates.length + 1);
  };

  const updateLaborItem = (
    index: number,
    field: keyof LaborEstimate,
    value: string | number
  ) => {
    const updated = [...laborEstimates];
    updated[index] = { ...updated[index], [field]: value };

    // When role changes, update rubroId to canonical linea_codigo and auto-populate fields
    if (field === "role" && typeof value === "string") {
      // Map role to known rubro alias
      const alias = mapModRoleToRubroId(value as MODRole);
      // Ensure canonical linea_codigo
      const canonical = canonicalizeRubroId(alias || value) || alias || null;
      
      if (canonical) {
        updated[index].rubroId = canonical;
        
        // Auto-populate description from taxonomy using unified helper
        const description = rubroDescriptionFor(canonical);
        if (description) {
          // ALWAYS update description from taxonomy - do NOT preserve user input
          (updated[index] as any).description = description;
        }
        
        // Auto-populate category from taxonomy
        const tax = findRubroByLineaCodigo(canonical);
        if (tax) {
          // Always update category from taxonomy
          (updated[index] as any).category = tax.categoria || "";
          
          // Optional: Auto-populate suggested hourly rate if taxonomy provides it
          // Note: The taxonomy doesn't currently have suggested_hourly_rate, but we keep this for future
        }
      } else {
        // fallback: keep alias or value
        updated[index].rubroId = alias || value;
      }
    }

    // Auto-update hourly rate if country/level changes
    if (field === "country" || field === "level") {
      const country = field === "country" ? value : updated[index].country;
      const level = field === "level" ? value : updated[index].level;
      const preset =
        LABOR_PRESETS[country as keyof typeof LABOR_PRESETS]?.[
          level as keyof (typeof LABOR_PRESETS)["Colombia"]
        ];
      if (preset) {
        updated[index].hourly_rate = preset.rate;
        updated[index].on_cost_percentage = preset.on_cost;
      }
    }

    setLaborEstimates(updated);
    console.log("✏️  Labor item updated:", {
      index,
      rubroId: updated[index].rubroId,
      role: updated[index].role,
      country: updated[index].country,
      level: updated[index].level,
      fteCount: updated[index].fte_count,
      hourlyRate: updated[index].hourly_rate,
      fieldChanged: field,
    });
  };

  const removeLaborItem = (index: number) => {
    const removed = laborEstimates[index];
    setLaborEstimates(laborEstimates.filter((_, i) => i !== index));
    console.log("🗑️  Labor item removed:", {
      index,
      role: removed.role,
      remainingCount: laborEstimates.length - 1,
    });
  };

  const calculateItemTotal = (item: LaborEstimate) => {
    const baseHours = item.hours_per_month * item.fte_count;
    const baseCost = baseHours * item.hourly_rate;
    const onCost = baseCost * (item.on_cost_percentage / 100);
    const monthlyTotal = baseCost + onCost;
    const duration = item.end_month - item.start_month + 1;
    return monthlyTotal * duration;
  };

  const getTotalCost = () => {
    return laborEstimates.reduce(
      (sum, item) => sum + calculateItemTotal(item),
      0
    );
  };

  const handleNext = () => {
    // Clear any previous validation errors
    setValidationError(null);
    
    // Validate canonical rubro IDs before proceeding
    const invalid = laborEstimates.some((item) => {
      const canonical = canonicalizeRubroId(item.rubroId || "");
      return !canonical;
    });
    
    if (invalid) {
      // Show user-friendly validation and stop early
      setValidationError("Por favor seleccione un rol válido para cada item laboral. Algunos elementos no tienen rubro canónico.");
      return;
    }

    // Normalize payload to canonical DB shape before saving
    const normalized = normalizeLaborEstimates(laborEstimates);
    
    const totalCost = getTotalCost();
    console.log("💼 Labor estimates submitted (canonical IDs enforced):", {
      itemCount: normalized.length,
      totalCost,
      averageCostPerRole: totalCost / (normalized.length || 1),
      roles: normalized.map((l) => ({
        role: l.role,
        rubroId: l.rubroId,
        line_item_id: l.line_item_id, // Now canonical
        descripcion: l.descripcion,
        categoria: l.categoria,
        fteCount: l.fte_count,
        monthlyRate: l.hourly_rate * l.hours_per_month,
      })),
      timestamp: new Date().toISOString(),
    });
    
    setData(normalized as any); // Cast needed due to extended fields
    onNext();
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-semibold mb-2">Estimación de Costos Laborales</h2>
        <p className="text-muted-foreground">
          Define la composición de tu equipo, tarifas y duración para proyecciones precisas de costos laborales
        </p>
      </div>

      {/* Validation Error Alert */}
      {validationError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{validationError}</AlertDescription>
        </Alert>
      )}

      {/* Add Labor Item */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Miembros del Equipo</h3>
          <p className="text-sm text-muted-foreground">
            Agrega roles con sus costos asociados y duración
          </p>
        </div>
        <Button onClick={addLaborItem} className="gap-2">
          <Plus size={16} />
          Agregar Miembro del Equipo
        </Button>
      </div>

      {/* Labor Items Table */}
      {laborEstimates.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rol</TableHead>
                    <TableHead>País</TableHead>
                    <TableHead>Nivel</TableHead>
                    <TableHead>FTE</TableHead>
                    <TableHead>Tarifa/Hora</TableHead>
                    <TableHead>Horas/Mes</TableHead>
                    <TableHead>Costo Adicional %</TableHead>
                    <TableHead>Inicio</TableHead>
                    <TableHead>Fin</TableHead>
                    <TableHead>Costo Total</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {laborEstimates.map((item, index) => {
                    const baseId = `labor-${index}`;
                    const roleId = `${baseId}-role`;
                    const countryId = `${baseId}-country`;
                    const levelId = `${baseId}-level`;
                    const fteId = `${baseId}-fte`;
                    const rateId = `${baseId}-rate`;
                    const hoursId = `${baseId}-hours`;
                    const onCostId = `${baseId}-oncost`;
                    const startId = `${baseId}-start`;
                    const endId = `${baseId}-end`;

                    return (
                      <TableRow key={index}>
                        <TableCell>
                          <Label className="sr-only" htmlFor={roleId}>
                            Rol
                          </Label>
                          <Select
                            value={item.role}
                            onValueChange={(value) =>
                              updateLaborItem(index, "role", value)
                            }
                            disabled={rolesLoading}
                          >
                            <SelectTrigger id={roleId} className="w-40" name={roleId}>
                              <SelectValue 
                                placeholder={
                                  rolesLoading ? "Cargando roles..." : "Seleccionar rol"
                                } 
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {modRoles.map((role) => (
                                <SelectItem key={role} value={role}>
                                  {role}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Label className="sr-only" htmlFor={countryId}>
                            País
                          </Label>
                          <Select
                            value={item.country}
                            onValueChange={(value) =>
                              updateLaborItem(index, "country", value)
                            }
                          >
                            <SelectTrigger
                              id={countryId}
                              name={countryId}
                              className="w-[120px]"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.keys(LABOR_PRESETS).map((country) => (
                                <SelectItem key={country} value={country}>
                                  {country}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Label className="sr-only" htmlFor={levelId}>
                            Nivel
                          </Label>
                          <Select
                            value={item.level}
                            onValueChange={(value) =>
                              updateLaborItem(index, "level", value)
                            }
                          >
                            <SelectTrigger
                              id={levelId}
                              name={levelId}
                              className="w-[100px]"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="junior">Junior</SelectItem>
                              <SelectItem value="mid">Mid</SelectItem>
                              <SelectItem value="senior">Senior</SelectItem>
                              <SelectItem value="lead">Lead</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Label className="sr-only" htmlFor={fteId}>
                            Cantidad FTE
                          </Label>
                          <Input
                            id={fteId}
                            name={fteId}
                            type="number"
                            value={item.fte_count}
                            onChange={(e) =>
                              updateLaborItem(
                                index,
                                "fte_count",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-16"
                            min="0.1"
                            step="0.1"
                          />
                        </TableCell>
                        <TableCell>
                          <Label className="sr-only" htmlFor={rateId}>
                            Tarifa por hora
                          </Label>
                          <div className="flex items-center gap-1">
                            <span className="text-sm text-muted-foreground">$</span>
                            <Input
                              id={rateId}
                              name={rateId}
                              type="number"
                              value={item.hourly_rate}
                              onChange={(e) =>
                                updateLaborItem(
                                  index,
                                  "hourly_rate",
                                  Math.round(parseFloat(e.target.value) || 0)
                                )
                              }
                              className="w-20"
                              step="1"
                              min="0"
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Label className="sr-only" htmlFor={hoursId}>
                            Horas por mes
                          </Label>
                          <Input
                            id={hoursId}
                            name={hoursId}
                            type="number"
                            value={item.hours_per_month}
                            onChange={(e) =>
                              updateLaborItem(
                                index,
                                "hours_per_month",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-20"
                          />
                        </TableCell>
                        <TableCell>
                          <Label className="sr-only" htmlFor={onCostId}>
                            Porcentaje de costo adicional
                          </Label>
                          <Input
                            id={onCostId}
                            name={onCostId}
                            type="number"
                            value={item.on_cost_percentage}
                            onChange={(e) =>
                              updateLaborItem(
                                index,
                                "on_cost_percentage",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-20"
                          />
                        </TableCell>
                        <TableCell>
                          <Label className="sr-only" htmlFor={startId}>
                            Mes de inicio
                          </Label>
                          <Input
                            id={startId}
                            name={startId}
                            type="number"
                            value={item.start_month}
                            onChange={(e) =>
                              updateLaborItem(
                                index,
                                "start_month",
                                parseInt(e.target.value) || 1
                              )
                            }
                            className="w-16"
                            min="1"
                          />
                        </TableCell>
                        <TableCell>
                          <Label className="sr-only" htmlFor={endId}>
                            Mes de fin
                          </Label>
                          <Input
                            id={endId}
                            name={endId}
                            type="number"
                            value={item.end_month}
                            onChange={(e) =>
                              updateLaborItem(
                                index,
                                "end_month",
                                parseInt(e.target.value) || 1
                              )
                            }
                            className="w-16"
                            min="1"
                          />
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            ${calculateItemTotal(item).toLocaleString()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeLaborItem(index)}
                            className="text-destructive hover:text-destructive"
                            aria-label={`Eliminar rol laboral ${item.role || index + 1}`}
                          >
                            <Trash2 size={16} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Calculator size={48} className="text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No se han agregado miembros del equipo</h3>
            <p className="text-muted-foreground text-center mb-4">
              Comienza agregando miembros del equipo para estimar los costos laborales de tu proyecto
            </p>
            <Button onClick={addLaborItem} className="gap-2">
              <Plus size={16} />
              Agregar Primer Miembro del Equipo
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      {laborEstimates.length > 0 && (
        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator size={20} />
              Resumen de Costos Laborales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label className="text-muted-foreground">Tamaño Total del Equipo</Label>
                <p className="text-2xl font-bold">
                  {laborEstimates.reduce(
                    (sum, item) => sum + item.fte_count,
                    0
                  )}{" "}
                  FTE
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">
                  Tarifa Mensual Promedio
                </Label>
                <p className="text-2xl font-bold">
                  {formatCurrencyNoDecimals(
                    laborEstimates.reduce(
                      (sum, item) => sum + item.hourly_rate,
                      0
                    ) / laborEstimates.length
                  )}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">
                  Costo Laboral Total
                </Label>
                <p className="text-3xl font-bold text-primary">
                  ${getTotalCost().toLocaleString()}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">Roles Únicos</Label>
                <p className="text-2xl font-bold">
                  {new Set(laborEstimates.map((item) => item.role)).size}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button
          onClick={handleNext}
          disabled={laborEstimates.length === 0}
          className="gap-2"
        >
          Continuar a Costos No Laborales
        </Button>
      </div>
    </div>
  );
}

export default LaborStep;
