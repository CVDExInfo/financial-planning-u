// src/components/RubrosBaselineSummary.tsx
import React, { useEffect, useState } from 'react';
import { getBaselineSummary, runBackfill, type BaselineSummary } from '@/api/finanzas.baseline';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Play, Zap, Plus } from 'lucide-react';
import log from '@/utils/diagnostic-logging';
import { toast } from 'sonner';

interface RubrosBaselineSummaryProps {
  projectId: string;
  onMaterializeComplete?: () => void;
}

export default function RubrosBaselineSummary({
  projectId,
  onMaterializeComplete,
}: RubrosBaselineSummaryProps) {
  const [summary, setSummary] = useState<BaselineSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const s = await getBaselineSummary(projectId);
        if (mounted) setSummary(s);
      } catch (err) {
        console.error('baseline summary load error', err);
        if (mounted) {
          toast.error('No se pudo cargar el resumen del baseline');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [projectId]);

  const onDryRun = async () => {
    try {
      setRunning(true);
      const result = await runBackfill(projectId, true);
      
      if (result.success) {
        const rubrosPlanned = result.result.rubrosPlanned || 0;
        toast.success(
          `Dry-run exitoso: se materializarían ${rubrosPlanned} rubro(s)`,
          {
            description: 'Revisa los detalles en la consola del navegador',
            duration: 5000,
          }
        );
        console.log('Dry-run result:', result);
      } else {
        toast.error('Error en dry-run', {
          description: result.message || 'Revisa la consola para más detalles',
        });
      }
      
      log.logDataHealth('ui', 'healthy', {
        action: 'dryRun',
        projectId,
        result,
      });
    } catch (err) {
      console.error(err);
      toast.error('Error ejecutando dry-run', {
        description: err instanceof Error ? err.message : 'Error desconocido',
      });
    } finally {
      setRunning(false);
    }
  };

  const onMaterialize = async () => {
    if (
      !confirm(
        '¿Confirmar materialización de rubros en la base de datos? Esta acción creará los rubros basados en el baseline aceptado.'
      )
    ) {
      return;
    }
    
    try {
      setRunning(true);
      const result = await runBackfill(projectId, false);
      
      if (result.success) {
        const rubrosWritten = result.result.rubrosWritten || 0;
        toast.success(
          `Materialización exitosa: ${rubrosWritten} rubro(s) creados`,
          {
            description: 'Los rubros ahora aparecerán en el catálogo',
            duration: 5000,
          }
        );
        
        // Call the callback to refresh the parent component
        if (onMaterializeComplete) {
          setTimeout(() => onMaterializeComplete(), 1000);
        }
      } else {
        toast.error('Error en materialización', {
          description: result.message || 'Revisa la consola para más detalles',
        });
      }
    } catch (err) {
      console.error(err);
      toast.error('Error materializando rubros', {
        description: err instanceof Error ? err.message : 'Error desconocido',
      });
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center p-8">
            <div className="text-muted-foreground">Cargando información del baseline...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!summary) return null;

  if (summary.error) {
    // Show a small note about baseline status
    return (
      <Card className="mb-6 border-muted">
        <CardHeader>
          <CardTitle className="text-base">Información del Baseline</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {summary.message || `Estado del baseline: ${summary.error}`}
          </p>
        </CardContent>
      </Card>
    );
  }

  const {
    baselineId,
    total,
    totalLabor,
    totalNonLabor,
    ftes,
    rolesCount,
    signedBy,
    signedAt,
    contractValue,
    currency,
    doc,
  } = summary;

  // Calculate percentages
  const laborPct = total > 0 ? ((totalLabor / total) * 100).toFixed(1) : '0.0';
  const nonLaborPct = total > 0 ? ((totalNonLabor / total) * 100).toFixed(1) : '0.0';

  return (
    <Card className="mb-6 border-primary/20 bg-primary/5">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <CardTitle className="text-lg">Proyecto con baseline pero sin rubros</CardTitle>
            <CardDescription>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm">Baseline ID:</span>
                <Badge variant="secondary" className="font-mono text-xs">
                  {baselineId}
                </Badge>
                <Badge variant="default" className="ml-2">
                  Accepted
                </Badge>
              </div>
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Original Baseline Values */}
        <div>
          <h4 className="font-semibold text-sm mb-3">Valores originales del Baseline</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground uppercase">Total Proyecto</div>
              <div className="font-semibold text-lg">
                ${Number(total || 0).toLocaleString()}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground uppercase">Contract Value</div>
              <div className="font-semibold">
                {currency} ${Number(contractValue || 0).toLocaleString()}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground uppercase">Labor</div>
              <div className="font-semibold">
                ${Number(totalLabor || 0).toLocaleString()}{' '}
                <span className="text-xs text-muted-foreground">({laborPct}%)</span>
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground uppercase">Non-Labor</div>
              <div className="font-semibold">
                ${Number(totalNonLabor || 0).toLocaleString()}{' '}
                <span className="text-xs text-muted-foreground">({nonLaborPct}%)</span>
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground uppercase">FTE</div>
              <div className="font-semibold text-lg">{ftes}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground uppercase">Roles</div>
              <div className="font-semibold text-lg">{rolesCount}</div>
            </div>
            <div className="space-y-1 col-span-2">
              <div className="text-xs text-muted-foreground uppercase">Firmado</div>
              <div className="text-sm">
                {signedBy && <div className="font-medium">{signedBy}</div>}
                {signedAt && (
                  <div className="text-xs text-muted-foreground">
                    {new Date(signedAt).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Help Text */}
        <div className="bg-muted/50 rounded-lg p-4 text-sm">
          <p className="text-muted-foreground leading-relaxed">
            <strong>Siguiente paso:</strong> Los rubros normalmente se materializan cuando un
            baseline es aceptado. Aquí puedes revisar los valores originales del baseline{' '}
            {doc?.s3Url && '(PDF disponible)'}, ejecutar una verificación en seco (dry-run) para
            ver qué rubros se materializarían, o forzar la materialización si todo luce correcto.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3 pt-2">
          <Button
            onClick={onDryRun}
            disabled={running}
            variant="outline"
            className="gap-2"
          >
            <Play className="h-4 w-4" />
            Dry-run (Verificar)
          </Button>
          <Button
            onClick={onMaterialize}
            disabled={running}
            variant="default"
            className="gap-2"
          >
            <Zap className="h-4 w-4" />
            Materializar Baseline
          </Button>
          {doc?.s3Url && (
            <Button
              variant="outline"
              className="gap-2"
              asChild
            >
              <a href={doc.s3Url} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
                Ver PDF
              </a>
            </Button>
          )}
          <Button
            variant="ghost"
            className="gap-2"
            onClick={() => toast.info('Usa el botón "Agregar a Proyecto" del catálogo para agregar rubros manualmente')}
          >
            <Plus className="h-4 w-4" />
            Agregar Rubro Manualmente
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
