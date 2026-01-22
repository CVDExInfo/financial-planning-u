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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TrendingUp, AlertCircle, DollarSign } from "lucide-react";

interface FXData {
  usd_cop_rate: number;
  rate_source: string;
  hedging_strategy: "none" | "forward_80" | "forward_100" | "options";
}

interface IndexationData {
  cpi_annual_rate: number;
  min_wage_annual_rate: number;
  adjustment_frequency: "monthly" | "quarterly" | "annually";
  labor_indexation: "CPI" | "min_wage" | "none";
  non_labor_indexation: "CPI" | "none";
}

interface FXIndexationStepProps {
  data: { fx: FXData; indexation: IndexationData } | null;
  setData: (data: { fx: FXData; indexation: IndexationData }) => void;
  onNext: () => void;
  onPrevious: () => void;
  isFirstStep: boolean;
  isLastStep: boolean;
}

export function FXIndexationStep({
  data,
  setData,
  onNext,
}: FXIndexationStepProps) {
  const [fxData, setFxData] = useState<FXData>(
    data?.fx || {
      usd_cop_rate: 4000,
      rate_source: "Banco de la República",
      hedging_strategy: "forward_80",
    }
  );

  const [indexationData, setIndexationData] = useState<IndexationData>(
    data?.indexation || {
      cpi_annual_rate: 3.0,
      min_wage_annual_rate: 12.0,
      adjustment_frequency: "quarterly",
      labor_indexation: "CPI",
      non_labor_indexation: "CPI",
    }
  );

  const updateFxData = (field: keyof FXData, value: any) => {
    setFxData((prev) => ({ ...prev, [field]: value }));
    console.log("💱 FX Data updated:", field, "=", value);
  };

  const updateIndexationData = (field: keyof IndexationData, value: any) => {
    setIndexationData((prev) => ({ ...prev, [field]: value }));
    console.log("📈 Indexation Data updated:", field, "=", value);
  };

  const getHedgingDescription = (strategy: string) => {
    switch (strategy) {
      case "none":
        return "Sin cobertura - exposición FX completa";
      case "forward_80":
        return "80% cubierto con contratos forward";
      case "forward_100":
        return "100% cubierto con contratos forward";
      case "options":
        return "Estrategia de opciones para protección a la baja";
      default:
        return "";
    }
  };

  const handleNext = () => {
    console.log("💱📈 FX & Indexation configuration submitted:", {
      fx: {
        usdCopRate: fxData.usd_cop_rate,
        rateSource: fxData.rate_source,
        hedgingStrategy: fxData.hedging_strategy,
        strategyDescription: getHedgingDescription(fxData.hedging_strategy),
      },
      indexation: {
        cpiAnnualRate: indexationData.cpi_annual_rate,
        minWageAnnualRate: indexationData.min_wage_annual_rate,
        adjustmentFrequency: indexationData.adjustment_frequency,
        laborIndexation: indexationData.labor_indexation,
        nonLaborIndexation: indexationData.non_labor_indexation,
      },
      timestamp: new Date().toISOString(),
    });
    setData({ fx: fxData, indexation: indexationData });
    onNext();
  };

  const calculateIndexationImpact = () => {
    const laborRate =
      indexationData.labor_indexation === "CPI"
        ? indexationData.cpi_annual_rate
        : indexationData.labor_indexation === "min_wage"
        ? indexationData.min_wage_annual_rate
        : 0;

    const nonLaborRate =
      indexationData.non_labor_indexation === "CPI"
        ? indexationData.cpi_annual_rate
        : 0;

    return { laborRate, nonLaborRate };
  };

  const indexationImpact = calculateIndexationImpact();

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-semibold mb-2">
          Parámetros de FX e Indexación
        </h2>
        <p className="text-muted-foreground">
          Define las tasas de cambio de moneda y ajustes por inflación para proyecciones precisas de costos
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* FX Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign size={20} />
              Tipo de Cambio (FX)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Tasa de Cambio USD/COP</Label>
              <Input
                type="number"
                value={fxData.usd_cop_rate}
                onChange={(e) =>
                  updateFxData("usd_cop_rate", parseFloat(e.target.value) || 0)
                }
                placeholder="ej., 4000"
              />
              <p className="text-xs text-muted-foreground">
                Tasa spot actual para cálculos del proyecto
              </p>
            </div>

            <div className="space-y-2">
              <Label>Fuente de la Tasa</Label>
              <Select
                value={fxData.rate_source}
                onValueChange={(value) => updateFxData("rate_source", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Banco de la República">
                    Banco de la República
                  </SelectItem>
                  <SelectItem value="Bloomberg">Bloomberg</SelectItem>
                  <SelectItem value="Reuters">Reuters</SelectItem>
                  <SelectItem value="Internal Treasury">
                    Tesorería Interna
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Estrategia de Cobertura</Label>
              <Select
                value={fxData.hedging_strategy}
                onValueChange={(value) =>
                  updateFxData("hedging_strategy", value as any)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin Cobertura</SelectItem>
                  <SelectItem value="forward_80">Cobertura Forward 80%</SelectItem>
                  <SelectItem value="forward_100">
                    Cobertura Forward 100%
                  </SelectItem>
                  <SelectItem value="options">Estrategia de Opciones</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {getHedgingDescription(fxData.hedging_strategy)}
              </p>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Las tasas FX se aplicarán a todos los costos denominados en USD al convertir a moneda local de reporte.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Indexation Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp size={20} />
              Política de Indexación
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tasa Anual de IPC (%)</Label>
                <Input
                  type="number"
                  value={indexationData.cpi_annual_rate}
                  onChange={(e) =>
                    updateIndexationData(
                      "cpi_annual_rate",
                      parseFloat(e.target.value) || 0
                    )
                  }
                  placeholder="ej., 3.0"
                  step="0.1"
                />
              </div>
              <div className="space-y-2">
                <Label>Tasa Anual de Salario Mínimo (%)</Label>
                <Input
                  type="number"
                  value={indexationData.min_wage_annual_rate}
                  onChange={(e) =>
                    updateIndexationData(
                      "min_wage_annual_rate",
                      parseFloat(e.target.value) || 0
                    )
                  }
                  placeholder="ej., 12.0"
                  step="0.1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Frecuencia de Ajuste</Label>
              <Select
                value={indexationData.adjustment_frequency}
                onValueChange={(value) =>
                  updateIndexationData("adjustment_frequency", value as any)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Mensual</SelectItem>
                  <SelectItem value="quarterly">Trimestral</SelectItem>
                  <SelectItem value="annually">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Indexación de Costos Laborales</Label>
                <Select
                  value={indexationData.labor_indexation}
                  onValueChange={(value) =>
                    updateIndexationData("labor_indexation", value as any)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin Indexación</SelectItem>
                    <SelectItem value="CPI">
                      Índice de Precios al Consumidor (IPC)
                    </SelectItem>
                    <SelectItem value="min_wage">
                      Incrementos del Salario Mínimo
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Indexación de Costos No Laborales</Label>
                <Select
                  value={indexationData.non_labor_indexation}
                  onValueChange={(value) =>
                    updateIndexationData("non_labor_indexation", value as any)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin Indexación</SelectItem>
                    <SelectItem value="CPI">
                      Índice de Precios al Consumidor (IPC)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Alert>
              <TrendingUp className="h-4 w-4" />
              <AlertDescription>
                La indexación se aplicará {indexationData.adjustment_frequency === "monthly" ? "mensualmente" : indexationData.adjustment_frequency === "quarterly" ? "trimestralmente" : "anualmente"}{" "}
                a partir del mes 4 del proyecto.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>

      {/* Impact Summary */}
      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle>Resumen del Impacto de FX e Indexación</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center">
              <Label className="text-muted-foreground">Tasa FX</Label>
              <p className="text-2xl font-bold">
                {fxData.usd_cop_rate.toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground">USD/COP</p>
            </div>

            <div className="text-center">
              <Label className="text-muted-foreground">Cobertura de Hedge</Label>
              <p className="text-2xl font-bold">
                {fxData.hedging_strategy === "forward_80"
                  ? "80%"
                  : fxData.hedging_strategy === "forward_100"
                  ? "100%"
                  : fxData.hedging_strategy === "options"
                  ? "Protegido"
                  : "0%"}
              </p>
              <p className="text-sm text-muted-foreground">Cobertura de Riesgo FX</p>
            </div>

            <div className="text-center">
              <Label className="text-muted-foreground">Indexación Laboral</Label>
              <p className="text-2xl font-bold text-amber-600">
                {indexationImpact.laborRate.toFixed(1)}%
              </p>
              <p className="text-sm text-muted-foreground">Tasa Anual</p>
            </div>

            <div className="text-center">
              <Label className="text-muted-foreground">
                Indexación No Laboral
              </Label>
              <p className="text-2xl font-bold text-amber-600">
                {indexationImpact.nonLaborRate.toFixed(1)}%
              </p>
              <p className="text-sm text-muted-foreground">Tasa Anual</p>
            </div>
          </div>

          <div className="mt-6 p-4 bg-card rounded-lg">
            <h4 className="font-medium mb-2">Supuestos Clave</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Tasa FX obtenida de {fxData.rate_source}</li>
              <li>• {getHedgingDescription(fxData.hedging_strategy)}</li>
              <li>
                • Ajustes de indexación aplicados{" "}
                {indexationData.adjustment_frequency === "monthly" ? "mensualmente" : indexationData.adjustment_frequency === "quarterly" ? "trimestralmente" : "anualmente"}
              </li>
              <li>
                • Costos laborales indexados a{" "}
                {indexationData.labor_indexation === "none"
                  ? "sin indexación"
                  : indexationData.labor_indexation === "CPI" ? "IPC" : "salario mínimo"}
              </li>
              <li>
                • Costos no laborales indexados a{" "}
                {indexationData.non_labor_indexation === "none"
                  ? "sin indexación"
                  : "IPC"}
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleNext} className="gap-2">
          Continuar a Revisar y Firmar
        </Button>
      </div>
    </div>
  );
}

export default FXIndexationStep;
