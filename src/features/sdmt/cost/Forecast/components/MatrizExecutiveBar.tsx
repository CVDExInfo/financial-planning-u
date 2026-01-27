import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Eye,
  TrendingUp,
  Download,
  Save,
  BarChart3,
  Settings,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

/**
 * Props for MatrizExecutiveBar component
 */
interface MatrizExecutiveBarProps {
  totals: {
    presupuesto: number;
    pronostico: number;
    real: number;
    consumo: number; // percentage
    varianza: number;
  };
  isCollapsedDefault?: boolean;
  onToggle?: (isOpen: boolean) => void;
  onAction?: (action: string) => void;
}

/**
 * MatrizExecutiveBar - Top bar with KPI summary and action buttons
 * 
 * @component
 * @param {MatrizExecutiveBarProps} props - Component props
 * @returns {JSX.Element} Executive bar with KPIs and action buttons
 */
export function MatrizExecutiveBar({
  totals,
  isCollapsedDefault = true,
  onToggle,
  onAction,
}: MatrizExecutiveBarProps) {
  const [isOpen, setIsOpen] = useState(!isCollapsedDefault);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const handleToggle = (open: boolean) => {
    setIsOpen(open);
    onToggle?.(open);
  };

  const handleAction = (action: string) => {
    if (action === 'resumen') {
      handleToggle(!isOpen);
    } else {
      onAction?.(action);
    }
  };

  const kpis = [
    { label: 'Presupuesto', value: formatCurrency(totals.presupuesto), color: 'text-blue-600' },
    { label: 'Pronóstico', value: formatCurrency(totals.pronostico), color: 'text-purple-600' },
    { label: 'Real', value: formatCurrency(totals.real), color: 'text-green-600' },
    { label: 'Consumo', value: formatPercentage(totals.consumo), color: 'text-orange-600' },
    {
      label: 'Varianza',
      value: formatCurrency(totals.varianza),
      color: totals.varianza >= 0 ? 'text-green-600' : 'text-red-600',
    },
  ];

  const actions = [
    { id: 'ver-real', label: 'Ver Real', icon: Eye },
    { id: 'ver-pronostico', label: 'Ver Pronóstico', icon: TrendingUp },
    { id: 'exportar', label: 'Exportar', icon: Download },
    { id: 'guardar', label: 'Guardar', icon: Save },
    { id: 'resumen', label: 'Resumen', icon: BarChart3 },
    { id: 'configurar', label: 'Configurar', icon: Settings },
  ];

  return (
    <Card className="mb-4">
      <CardContent className="p-4">
        {/* KPI Summary Tiles - Always Visible */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
          {kpis.map((kpi, index) => (
            <div
              key={index}
              className="text-center p-3 rounded-lg bg-muted/50"
              role="region"
              aria-label={`${kpi.label}: ${kpi.value}`}
            >
              <p className="text-xs font-medium text-muted-foreground mb-1">{kpi.label}</p>
              <p className={`text-lg font-bold ${kpi.color}`}>{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <Collapsible open={isOpen} onOpenChange={handleToggle}>
          <div className="flex items-center justify-center mb-3">
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                aria-label={isOpen ? 'Ocultar acciones' : 'Mostrar acciones'}
              >
                {isOpen ? (
                  <>
                    <ChevronUp className="h-4 w-4 mr-2" />
                    Ocultar Acciones
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4 mr-2" />
                    Mostrar Acciones
                  </>
                )}
              </Button>
            </CollapsibleTrigger>
          </div>

          <CollapsibleContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {actions.map((action) => {
                const Icon = action.icon;
                return (
                  <Button
                    key={action.id}
                    variant={action.id === 'resumen' && isOpen ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleAction(action.id)}
                    className="w-full"
                    aria-label={action.label}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {action.label}
                  </Button>
                );
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
