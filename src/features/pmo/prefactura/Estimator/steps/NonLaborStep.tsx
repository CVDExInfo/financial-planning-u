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
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Server, CreditCard } from "lucide-react";
import type { NonLaborEstimate, Currency } from "@/types/domain";
import { useNonLaborCatalog } from "@/hooks/useRubrosCatalog";

interface NonLaborStepProps {
  data: NonLaborEstimate[];
  setData: (data: NonLaborEstimate[]) => void;
  onNext: () => void;
  onPrevious: () => void;
  isFirstStep: boolean;
  isLastStep: boolean;
}

export function NonLaborStep({ data, setData, onNext }: NonLaborStepProps) {
  // Fetch non-labor rubros from canonical taxonomy
  const { rubros: nonLaborRubros, loading: rubrosLoading } = useNonLaborCatalog();
  
  const [nonLaborEstimates, setNonLaborEstimates] = useState<
    NonLaborEstimate[]
  >(data.length > 0 ? data : []);

  // Group rubros by category for organized display
  // Use categoryName (full name) as primary, fall back to category (code), or use "Other"
  const rubrosByCategory = nonLaborRubros.reduce((acc, rubro) => {
    const category = rubro.categoryName || rubro.category || "Other";
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(rubro);
    return acc;
  }, {} as Record<string, typeof nonLaborRubros>);

  const addNonLaborItem = () => {
    const newItem: NonLaborEstimate = {
      rubroId: "",
      category: "",
      description: "",
      amount: 0,
      currency: "USD",
      one_time: true,
      start_month: 1,
      end_month: 1,
      vendor: "",
      capex_flag: false,
    };
    setNonLaborEstimates([...nonLaborEstimates, newItem]);
    console.log(
      "➕ Non-labor item added, total count:",
      nonLaborEstimates.length + 1
    );
  };

  const updateNonLaborItem = (
    index: number,
    field: keyof NonLaborEstimate,
    value: any
  ) => {
    const updated = [...nonLaborEstimates];
    updated[index] = { ...updated[index], [field]: value };
    
    // When rubroId changes, auto-populate category and description
    if (field === "rubroId" && typeof value === "string") {
      const selectedRubro = nonLaborRubros.find((r) => r.id === value);
      if (selectedRubro) {
        updated[index].category = selectedRubro.categoryName || selectedRubro.category || "";
        // Only set description if it's empty to allow user override
        if (!updated[index].description) {
          updated[index].description = selectedRubro.label;
        }
      }
    }
    
    setNonLaborEstimates(updated);
    console.log("✏️  Non-labor item updated:", {
      index,
      rubroId: updated[index].rubroId,
      category: updated[index].category,
      description: updated[index].description,
      amount: updated[index].amount,
      isOneTime: updated[index].one_time,
      isCapex: updated[index].capex_flag,
      fieldChanged: field,
    });
  };

  const removeNonLaborItem = (index: number) => {
    const removed = nonLaborEstimates[index];
    setNonLaborEstimates(nonLaborEstimates.filter((_, i) => i !== index));
    console.log("🗑️  Non-labor item removed:", {
      index,
      category: removed.category,
      description: removed.description,
      remainingCount: nonLaborEstimates.length - 1,
    });
  };

  const calculateItemTotal = (item: NonLaborEstimate) => {
    if (item.one_time) {
      return item.amount;
    }
    const duration = item.end_month! - item.start_month! + 1;
    return item.amount * duration;
  };

  const getTotalCost = () => {
    return nonLaborEstimates.reduce(
      (sum, item) => sum + calculateItemTotal(item),
      0
    );
  };

  const getCapexTotal = () => {
    return nonLaborEstimates
      .filter((item) => item.capex_flag)
      .reduce((sum, item) => sum + calculateItemTotal(item), 0);
  };

  const handleNext = () => {
    const totalCost = getTotalCost();
    const capexTotal = getCapexTotal();
    console.log("🏗️  Non-labor estimates submitted:", {
      itemCount: nonLaborEstimates.length,
      totalCost,
      capexTotal,
      opexTotal: totalCost - capexTotal,
      items: nonLaborEstimates.map((item) => ({
        category: item.category,
        description: item.description,
        amount: item.amount,
        isOneTime: item.one_time,
        isCapex: item.capex_flag,
      })),
      timestamp: new Date().toISOString(),
    });
    setData(nonLaborEstimates);
    onNext();
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-semibold mb-2">Costos No Laborales</h2>
        <p className="text-muted-foreground">
          Agrega infraestructura, licencias de software y otros gastos no laborales
        </p>
      </div>

      {/* Add Non-Labor Item */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Elementos de Costo</h3>
          <p className="text-sm text-muted-foreground">
            Incluye todos los gastos no laborales del proyecto
          </p>
        </div>
        <Button onClick={addNonLaborItem} className="gap-2">
          <Plus size={16} />
          Agregar Elemento de Costo
        </Button>
      </div>

      {/* Non-Labor Items Table */}
      {nonLaborEstimates.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rubro</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead>Una vez</TableHead>
                    <TableHead>Inicio</TableHead>
                    <TableHead>Fin</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>CapEx</TableHead>
                    <TableHead>Costo Total</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nonLaborEstimates.map((item, index) => {
                    const baseId = `nonlabor-${index}`;
                    const categoryId = `${baseId}-category`;
                    const descriptionId = `${baseId}-description`;
                    const amountId = `${baseId}-amount`;
                    const startId = `${baseId}-start`;
                    const endId = `${baseId}-end`;
                    const vendorId = `${baseId}-vendor`;

                    return (
                      <TableRow key={index}>
                        <TableCell>
                          <Label className="sr-only" htmlFor={categoryId}>
                            Rubro
                          </Label>
                          <Select
                            value={item.rubroId || ""}
                            onValueChange={(value) =>
                              updateNonLaborItem(index, "rubroId", value)
                            }
                            disabled={rubrosLoading}
                          >
                            <SelectTrigger
                              id={categoryId}
                              name={categoryId}
                              className="w-[200px]"
                            >
                              <SelectValue 
                                placeholder={
                                  rubrosLoading ? "Cargando rubros..." : "Seleccionar rubro"
                                } 
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(rubrosByCategory).map(([categoryName, rubros]) => (
                                <div key={categoryName}>
                                  <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                                    {categoryName}
                                  </div>
                                  {rubros.map((rubro) => (
                                    <SelectItem key={rubro.id} value={rubro.id}>
                                      {rubro.label}
                                    </SelectItem>
                                  ))}
                                </div>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Label className="sr-only" htmlFor={descriptionId}>
                            Descripción
                          </Label>
                          <Input
                            id={descriptionId}
                            name={descriptionId}
                            value={item.description}
                            onChange={(e) =>
                              updateNonLaborItem(
                                index,
                                "description",
                                e.target.value
                              )
                            }
                            placeholder="ej., Instancias AWS EC2"
                            className="w-[200px]"
                          />
                        </TableCell>
                        <TableCell>
                          <Label className="sr-only" htmlFor={amountId}>
                            Monto
                          </Label>
                          <Input
                            id={amountId}
                            name={amountId}
                            type="number"
                            value={item.amount}
                            onChange={(e) =>
                              updateNonLaborItem(
                                index,
                                "amount",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-24"
                          />
                        </TableCell>
                        <TableCell>
                          <Checkbox
                            id={`one-time-${index}`}
                            checked={item.one_time}
                            onCheckedChange={(checked) =>
                              updateNonLaborItem(index, "one_time", checked)
                            }
                            aria-label="Gasto único"
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
                            value={item.start_month || 1}
                            onChange={(e) =>
                              updateNonLaborItem(
                                index,
                                "start_month",
                                parseInt(e.target.value) || 1
                              )
                            }
                            className="w-16"
                            min="1"
                            disabled={item.one_time}
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
                            value={item.end_month || 1}
                            onChange={(e) =>
                              updateNonLaborItem(
                                index,
                                "end_month",
                                parseInt(e.target.value) || 1
                              )
                            }
                            className="w-16"
                            min="1"
                            disabled={item.one_time}
                          />
                        </TableCell>
                        <TableCell>
                          <Label className="sr-only" htmlFor={vendorId}>
                            Proveedor
                          </Label>
                          <Input
                            id={vendorId}
                            name={vendorId}
                            value={item.vendor || ""}
                            onChange={(e) =>
                              updateNonLaborItem(index, "vendor", e.target.value)
                            }
                            placeholder="Nombre del proveedor"
                            className="w-[120px]"
                          />
                        </TableCell>
                        <TableCell>
                          <Checkbox
                            id={`capex-${index}`}
                            checked={item.capex_flag}
                            onCheckedChange={(checked) =>
                              updateNonLaborItem(index, "capex_flag", checked)
                            }
                            aria-label="CapEx"
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
                            onClick={() => removeNonLaborItem(index)}
                            className="text-destructive hover:text-destructive"
                            aria-label={`Eliminar elemento no laboral ${index + 1}`}
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
            <Server size={48} className="text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No se han agregado elementos de costo</h3>
            <p className="text-muted-foreground text-center mb-4">
              Agrega infraestructura, licencias de software y otros costos no laborales
            </p>
            <Button onClick={addNonLaborItem} className="gap-2">
              <Plus size={16} />
              Agregar Primer Elemento de Costo
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Quick Add Common Items from Rubros Catalog */}
      {nonLaborEstimates.length === 0 && !rubrosLoading && (
        <Card>
          <CardHeader>
            <CardTitle>Agregar Rápidamente Elementos Comunes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(rubrosByCategory).slice(0, 6).map(([categoryName, rubros]) => (
                <div key={categoryName}>
                  <h4 className="font-medium mb-2">{categoryName}</h4>
                  <div className="space-y-1">
                    {rubros.slice(0, 5).map((rubro) => (
                      <Button
                        key={rubro.id}
                        variant="outline"
                        size="sm"
                        className="w-full justify-start text-xs"
                        onClick={() => {
                          const newItem: NonLaborEstimate = {
                            rubroId: rubro.id,
                            category: categoryName,
                            description: rubro.label,
                            amount: 1000,
                            currency: "USD",
                            one_time: rubro.executionType === "puntual/hito",
                            capex_flag: rubro.costType === "CAPEX",
                            start_month: 1,
                            end_month: 1,
                          };
                          setNonLaborEstimates([newItem]);
                        }}
                      >
                        <Plus size={12} className="mr-1" />
                        {rubro.label}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      {nonLaborEstimates.length > 0 && (
        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard size={20} />
              Resumen de Costos No Laborales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label className="text-muted-foreground">Elementos Totales</Label>
                <p className="text-2xl font-bold">{nonLaborEstimates.length}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Costos Únicos</Label>
                <p className="text-2xl font-bold">
                  $
                  {nonLaborEstimates
                    .filter((item) => item.one_time)
                    .reduce((sum, item) => sum + item.amount, 0)
                    .toLocaleString()}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">Total CapEx</Label>
                <p className="text-2xl font-bold text-amber-600">
                  ${getCapexTotal().toLocaleString()}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">Total No Laboral</Label>
                <p className="text-3xl font-bold text-primary">
                  ${getTotalCost().toLocaleString()}
                </p>
              </div>
            </div>

            {/* Category Breakdown */}
            <div className="mt-4">
              <Label className="text-muted-foreground">Por Categoría</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                {Object.keys(rubrosByCategory).map((categoryName) => {
                  const categoryTotal = nonLaborEstimates
                    .filter((item) => item.category === categoryName)
                    .reduce((sum, item) => sum + calculateItemTotal(item), 0);

                  if (categoryTotal === 0) return null;

                  return (
                    <Badge
                      key={categoryName}
                      variant="outline"
                      className="justify-between"
                    >
                      <span className="text-xs">{categoryName}:</span>
                      <span className="font-medium">
                        ${categoryTotal.toLocaleString()}
                      </span>
                    </Badge>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button onClick={handleNext} className="gap-2">
          Continuar a FX e Indexación
        </Button>
      </div>
    </div>
  );
}

export default NonLaborStep;
