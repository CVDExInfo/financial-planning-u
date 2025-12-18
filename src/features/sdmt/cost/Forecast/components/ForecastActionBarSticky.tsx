/**
 * ForecastActionBarSticky Component
 * Sticky action bar with save buttons and export functionality
 */

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Share2, FileSpreadsheet } from 'lucide-react';
import LoadingSpinner from '@/components/LoadingSpinner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface ForecastActionBarStickyProps {
  dirtyActualCount: number;
  dirtyForecastCount: number;
  savingActuals: boolean;
  savingForecasts: boolean;
  canEditForecast: boolean;
  exporting: 'excel' | 'pdf' | null;
  onSaveActuals: () => void;
  onSaveForecasts: () => void;
  onExportExcel: () => void;
  onExportPDF: () => void;
}

export function ForecastActionBarSticky({
  dirtyActualCount,
  dirtyForecastCount,
  savingActuals,
  savingForecasts,
  canEditForecast,
  exporting,
  onSaveActuals,
  onSaveForecasts,
  onExportExcel,
  onExportPDF,
}: ForecastActionBarStickyProps) {
  return (
    <div className="sticky top-[120px] z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-t py-3">
      <div className="flex items-center justify-between gap-3">
        {/* Left cluster: Save buttons */}
        <div className="flex items-center gap-2">
          <Button
            onClick={onSaveActuals}
            disabled={savingActuals || dirtyActualCount === 0}
            className="gap-2"
            size="sm"
          >
            {savingActuals ? <LoadingSpinner size="sm" /> : null}
            Guardar
            {dirtyActualCount > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {dirtyActualCount}
              </Badge>
            )}
          </Button>
          <Button
            onClick={onSaveForecasts}
            disabled={savingForecasts || dirtyForecastCount === 0 || !canEditForecast}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            {savingForecasts ? <LoadingSpinner size="sm" /> : null}
            Guardar Pronóstico
            {dirtyForecastCount > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {dirtyForecastCount}
              </Badge>
            )}
          </Button>
        </div>

        {/* Right cluster: Share and Export */}
        <div className="flex items-center gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-2">
                <Share2 size={16} />
                Share & Export
              </Button>
            </DialogTrigger>
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
                    onClick={onExportExcel}
                    disabled={exporting !== null}
                  >
                    {exporting === 'excel' ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                      <FileSpreadsheet size={24} />
                    )}
                    <span>Reporte Excel</span>
                    <span className="text-xs text-muted-foreground">
                      {exporting === 'excel' ? 'Generando...' : 'Pronóstico detallado con fórmulas'}
                    </span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-20 flex flex-col gap-2"
                    onClick={onExportPDF}
                    disabled={exporting !== null}
                  >
                    {exporting === 'pdf' ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                      <Share2 size={24} />
                    )}
                    <span>Resumen PDF</span>
                    <span className="text-xs text-muted-foreground">
                      {exporting === 'pdf' ? 'Generando...' : 'Formato de resumen ejecutivo'}
                    </span>
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
