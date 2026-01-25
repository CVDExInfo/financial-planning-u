/**
 * ForecastActionsMenu Component
 * 
 * Unified action menu for forecast page with primary CTA and overflow menu for secondary actions.
 * Implements Tier 1 UX improvement: Single primary action with secondary actions in dropdown.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MoreVertical, Save, FileSpreadsheet, Share2 } from 'lucide-react';
import LoadingSpinner from '@/components/LoadingSpinner';

interface ForecastActionsMenuProps {
  // Primary action (Guardar Pronóstico)
  onSaveForecast: () => void;
  savingForecast: boolean;
  dirtyForecastCount: number;
  canEditForecast: boolean;

  // Secondary action 1 (Guardar Actuals)
  onSaveActuals: () => void;
  savingActuals: boolean;
  dirtyActualCount: number;

  // Secondary action 2 (Export)
  onExcelExport: () => void;
  onPDFExport: () => void;
  exporting: 'excel' | 'pdf' | null;
}

export function ForecastActionsMenu({
  onSaveForecast,
  savingForecast,
  dirtyForecastCount,
  canEditForecast,
  onSaveActuals,
  savingActuals,
  dirtyActualCount,
  onExcelExport,
  onPDFExport,
  exporting,
}: ForecastActionsMenuProps) {
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Primary CTA: Guardar Pronóstico */}
        <Button
          onClick={onSaveForecast}
          disabled={savingForecast || dirtyForecastCount === 0 || !canEditForecast}
          className="gap-2 h-9"
          size="sm"
        >
          {savingForecast ? <LoadingSpinner size="sm" /> : null}
          Guardar Pronóstico
          {dirtyForecastCount > 0 && (
            <Badge variant="secondary" className="ml-1 text-xs px-2 py-0.5">
              {dirtyForecastCount}
            </Badge>
          )}
        </Button>

        {/* Overflow Menu: Secondary Actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 w-9 p-0">
              <MoreVertical size={16} />
              <span className="sr-only">Más acciones</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
            <DropdownMenuSeparator />
            
            {/* Guardar Actuals */}
            <DropdownMenuItem
              onClick={onSaveActuals}
              disabled={savingActuals || dirtyActualCount === 0}
              className="gap-2"
            >
              {savingActuals ? (
                <LoadingSpinner size="sm" />
              ) : (
                <Save size={16} />
              )}
              <span>Guardar Valores Reales</span>
              {dirtyActualCount > 0 && (
                <Badge variant="secondary" className="ml-auto text-xs px-2 py-0.5">
                  {dirtyActualCount}
                </Badge>
              )}
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* Export - Opens separate dialog */}
            <DropdownMenuItem
              onSelect={() => setExportDialogOpen(true)}
              className="gap-2"
            >
              <Share2 size={16} />
              <span>Exportar Datos</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Export Dialog - Separate from dropdown to avoid nesting issues */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Compartir Datos de Pronóstico</DialogTitle>
            <DialogDescription>
              Exportar y compartir datos de pronóstico en múltiples formatos para interesados y reportes.
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Button
                variant="outline"
                className="h-20 flex flex-col gap-2"
                onClick={onExcelExport}
                disabled={exporting !== null}
              >
                {exporting === 'excel' ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <FileSpreadsheet size={24} />
                )}
                <span>Reporte Excel</span>
                <span className="text-xs text-muted-foreground">
                  {exporting === 'excel'
                    ? 'Generando...'
                    : 'Pronóstico detallado con fórmulas'}
                </span>
              </Button>
              <Button
                variant="outline"
                className="h-20 flex flex-col gap-2"
                onClick={onPDFExport}
                disabled={exporting !== null}
              >
                {exporting === 'pdf' ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <Share2 size={24} />
                )}
                <span>Resumen PDF</span>
                <span className="text-xs text-muted-foreground">
                  {exporting === 'pdf'
                    ? 'Generando...'
                    : 'Formato de resumen ejecutivo'}
                </span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
