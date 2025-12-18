/**
 * ForecastPageHeader Component
 * Sticky header with title, project selector, period selector, and data source indicator
 */

import { Badge } from '@/components/ui/badge';
import ModuleBadge from '@/components/ModuleBadge';
import { ES_TEXTS } from '@/lib/i18n/es';

interface ForecastPageHeaderProps {
  projectName?: string;
  projectChangeCount: number;
  startDate?: string;
  isPortfolioView: boolean;
  dataSource: 'api' | 'mock';
  lastUpdated?: string | null;
}

export function ForecastPageHeader({
  projectName,
  projectChangeCount,
  startDate,
  isPortfolioView,
  dataSource,
  lastUpdated,
}: ForecastPageHeaderProps) {
  return (
    <div className="sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b pb-4">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{ES_TEXTS.forecast.title}</h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <p className="text-muted-foreground">{ES_TEXTS.forecast.description}</p>
            {projectName && (
              <Badge variant="outline" className="text-xs">
                {projectName} | Change #{projectChangeCount}
              </Badge>
            )}
            {!isPortfolioView && startDate && (
              <Badge variant="secondary" className="text-xs">
                📅 Inicio: {new Date(startDate).toLocaleDateString('es-ES', {
                  month: 'long',
                  year: 'numeric',
                })}
              </Badge>
            )}
            <Badge variant={dataSource === 'mock' ? 'outline' : 'default'} className="text-xs">
              {dataSource === 'mock' ? 'Datos de prueba' : 'Datos de API'}
            </Badge>
            {lastUpdated && (
              <span className="text-xs text-muted-foreground">
                Actualizado: {new Date(lastUpdated).toLocaleString('es-ES', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
          </div>
        </div>
        <ModuleBadge />
      </div>
    </div>
  );
}
