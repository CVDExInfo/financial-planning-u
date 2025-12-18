/**
 * Budget Simulator Card Component
 * Provides UI controls for budget simulation in SDMTForecast
 * Only displayed when viewing "TODOS LOS PROYECTOS" (ALL_PROJECTS_ID)
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calculator, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { BudgetSimulationState } from './budgetSimulation';
import { sanitizeNumericInput, isValidSimulationState } from './budgetSimulation';

interface BudgetSimulatorCardProps {
  simulationState: BudgetSimulationState;
  onSimulationChange: (state: BudgetSimulationState) => void;
}

export function BudgetSimulatorCard({
  simulationState,
  onSimulationChange,
}: BudgetSimulatorCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [displayBudget, setDisplayBudget] = useState<string>(
    typeof simulationState.budgetTotal === 'number' 
      ? simulationState.budgetTotal.toString() 
      : ''
  );
  const [displayEstimated, setDisplayEstimated] = useState<string>(
    typeof simulationState.estimatedOverride === 'number'
      ? simulationState.estimatedOverride.toString()
      : ''
  );

  const handleBudgetChange = (value: string) => {
    setDisplayBudget(value);
    const sanitized = sanitizeNumericInput(value);
    onSimulationChange({
      ...simulationState,
      budgetTotal: value === '' ? '' : sanitized,
    });
  };

  const handleEstimatedChange = (value: string) => {
    setDisplayEstimated(value);
    const sanitized = value === '' ? undefined : sanitizeNumericInput(value);
    onSimulationChange({
      ...simulationState,
      estimatedOverride: value === '' ? '' : sanitized,
    });
  };

  const handleFactorChange = (value: number[]) => {
    const factor = value[0];
    onSimulationChange({
      ...simulationState,
      factor,
    });
  };

  const handleEnabledToggle = (enabled: boolean) => {
    onSimulationChange({
      ...simulationState,
      enabled,
    });
  };

  const formatCurrency = (value: string) => {
    const num = sanitizeNumericInput(value);
    if (num === 0) return '';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  const isValid = isValidSimulationState(simulationState);

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <Card className="border-2 border-primary/20 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Simulador de Presupuesto</CardTitle>
              <Badge variant={simulationState.enabled && isValid ? 'default' : 'outline'}>
                {simulationState.enabled && isValid ? 'Activo' : 'Inactivo'}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              {/* Show current budget when collapsed */}
              {!isExpanded && displayBudget && (
                <span className="text-sm font-medium text-muted-foreground">
                  {formatCurrency(displayBudget)}
                </span>
              )}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-sm">
                      Simula el impacto de un presupuesto anual en los pronósticos.
                      Aplica una capa de visualización sin modificar datos reales.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  aria-label={isExpanded ? "Colapsar simulador" : "Expandir simulador"}
                >
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-3 pt-0">
            {/* Enable/Disable Toggle - Full Width */}
            <div className="flex items-center justify-between pb-2 border-b">
              <Label htmlFor="simulation-enabled" className="text-sm font-medium">
                Habilitar Simulación
              </Label>
              <Switch
                id="simulation-enabled"
                checked={simulationState.enabled}
                onCheckedChange={handleEnabledToggle}
              />
            </div>

            {/* 2-Column Responsive Grid for Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left Column: Budget Input & Toggle */}
              <div className="space-y-3">
                {/* Budget Total Input */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="budget-total" className="text-sm font-medium">
                      Presupuesto Anual ($)
                    </Label>
                    {displayBudget && (
                      <span className="text-xs text-muted-foreground">
                        {formatCurrency(displayBudget)}
                      </span>
                    )}
                  </div>
                  <Input
                    id="budget-total"
                    type="text"
                    placeholder="Ej: 1000000"
                    value={displayBudget}
                    onChange={(e) => handleBudgetChange(e.target.value)}
                    disabled={!simulationState.enabled}
                    className={!isValid && simulationState.enabled ? 'border-destructive' : ''}
                    aria-label="Presupuesto anual total"
                  />
                  {!isValid && simulationState.enabled && (
                    <p className="text-xs text-destructive">
                      Ingrese un presupuesto válido mayor a 0
                    </p>
                  )}
                </div>
              </div>

              {/* Right Column: Factor Slider & Override */}
              <div className="space-y-3">
                {/* Projection Factor Slider */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="projection-factor" className="text-sm font-medium">
                      Factor de Proyección
                    </Label>
                    <span className="text-xs font-mono bg-muted px-2 py-1 rounded">
                      {(simulationState.factor * 100).toFixed(0)}%
                    </span>
                  </div>
                  <Slider
                    id="projection-factor"
                    min={50}
                    max={200}
                    step={5}
                    value={[simulationState.factor * 100]}
                    onValueChange={(value) => handleFactorChange([value[0] / 100])}
                    disabled={!simulationState.enabled || !!displayEstimated}
                    className="py-3"
                    aria-label="Factor de proyección de costos"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>50%</span>
                    <span>100%</span>
                    <span>200%</span>
                  </div>
                </div>

                {/* Estimated Projection Override */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="estimated-override" className="text-sm font-medium">
                      Estimación (opcional)
                    </Label>
                    {displayEstimated && (
                      <span className="text-xs text-muted-foreground">
                        {formatCurrency(displayEstimated)}
                      </span>
                    )}
                  </div>
                  <Input
                    id="estimated-override"
                    type="text"
                    placeholder="Auto-calculado"
                    value={displayEstimated}
                    onChange={(e) => handleEstimatedChange(e.target.value)}
                    disabled={!simulationState.enabled}
                    aria-label="Estimación proyectada opcional"
                  />
                  <p className="text-xs text-muted-foreground">
                    Anula el cálculo basado en factor
                  </p>
                </div>
              </div>
            </div>

            {/* Helper Text */}
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground">
                💡 <strong>Nota:</strong> Esta simulación es solo visual y no modifica datos
                persistentes ni realiza llamadas al API.
              </p>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
