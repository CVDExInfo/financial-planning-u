/**
 * PersonaTabs Component
 * 
 * Provides a UI toggle for switching between SDM and Gerente view modes.
 * Should be placed prominently in the header/toolbar of relevant pages.
 */

import { usePersona, type PersonaViewMode } from '@/contexts/PersonaContext';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User, Briefcase } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface PersonaTabsProps {
  /** Optional className for styling */
  className?: string;
}

export function PersonaTabs({ className }: PersonaTabsProps) {
  const { viewMode, setViewMode } = usePersona();

  const handleModeChange = (value: string) => {
    if (value === 'SDM' || value === 'Gerente') {
      setViewMode(value as PersonaViewMode);
    }
  };

  return (
    <TooltipProvider>
      <Tabs value={viewMode} onValueChange={handleModeChange} className={className}>
        <TabsList className="grid w-full grid-cols-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <TabsTrigger value="SDM" className="gap-2">
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">SDM</span>
              </TabsTrigger>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs max-w-xs">
                Vista SDM: Detallada, orientada a entrada de datos y gestión operativa
              </p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <TabsTrigger value="Gerente" className="gap-2">
                <Briefcase className="h-4 w-4" />
                <span className="hidden sm:inline">Gerente</span>
              </TabsTrigger>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs max-w-xs">
                Vista Gerente: Resumen ejecutivo, métricas clave y análisis de alto nivel
              </p>
            </TooltipContent>
          </Tooltip>
        </TabsList>
      </Tabs>
    </TooltipProvider>
  );
}
