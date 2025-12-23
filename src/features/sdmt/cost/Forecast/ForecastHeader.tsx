import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Share2, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';

interface ForecastHeaderProps {
  baseline: any | null;
  projectName?: string;
  onExportExcel?: () => void;
  onExportPDF?: () => void;
  onRetryMaterialization?: () => void;
  materializationPending?: boolean;
  materializationTimeout?: boolean;
  materializationFailed?: boolean;
}

/**
 * ForecastHeader Component
 * 
 * Displays baseline information, materialization status with UI states, and action buttons.
 * Enhanced with:
 * - Pending materialization (waiting)
 * - Materializing (spinner)
 * - Materialized (green checkmark)
 * - Materialization failed (error with retry)
 */
export function ForecastHeader({
  baseline,
  projectName,
  onExportExcel,
  onExportPDF,
  onRetryMaterialization,
  materializationPending = false,
  materializationTimeout = false,
  materializationFailed = false,
}: ForecastHeaderProps) {
  // Determine materialization status
  const isMaterialized = baseline?.materializedAt || baseline?.materialization_status === 'completed';
  
  return (
    <div className="mb-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-foreground">
              {projectName || 'Project'} - Forecast
            </h1>
            {/* Materialization Status Badge */}
            {isMaterialized && !materializationPending && (
              <Badge variant="outline" className="text-green-600 border-green-600">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Materialized
              </Badge>
            )}
            {materializationPending && (
              <Badge variant="outline" className="text-blue-600 border-blue-600">
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                Materializing...
              </Badge>
            )}
            {materializationFailed && !materializationPending && (
              <Badge variant="outline" className="text-red-600 border-red-600">
                <AlertCircle className="mr-1 h-3 w-3" />
                Failed
              </Badge>
            )}
          </div>
          {baseline && (
            <p className="text-muted-foreground mt-1">
              Baseline: {baseline.baseline_id || baseline.baselineId}
              {baseline.materializedAt && (
                <span className="ml-2 text-xs">
                  • Materialized: {new Date(baseline.materializedAt).toLocaleString()}
                </span>
              )}
            </p>
          )}
        </div>
        
        <div className="flex gap-2">
          {onExportExcel && (
            <Button variant="outline" onClick={onExportExcel} size="sm">
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Export Excel
            </Button>
          )}
          
          {onExportPDF && (
            <Button variant="outline" onClick={onExportPDF} size="sm">
              <Share2 className="mr-2 h-4 w-4" />
              Export PDF
            </Button>
          )}
        </div>
      </div>
      
      {/* Materialization Status Alerts */}
      {!isMaterialized && !materializationPending && !materializationFailed && (
        <Alert variant="default" className="bg-yellow-50 border-yellow-200">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertTitle className="text-yellow-800">Pending Materialization</AlertTitle>
          <AlertDescription className="text-yellow-700">
            Baseline data is queued for materialization. Data will load once materialization completes.
          </AlertDescription>
        </Alert>
      )}
      
      {materializationPending && (
        <Alert variant="default" className="bg-blue-50 border-blue-200">
          <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
          <AlertTitle className="text-blue-800">Materializing Baseline</AlertTitle>
          <AlertDescription className="text-blue-700">
            Processing baseline data... This may take up to 60 seconds. Please wait.
          </AlertDescription>
        </Alert>
      )}
      
      {materializationTimeout && !materializationPending && (
        <Alert variant="destructive" className="bg-red-50 border-red-200">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertTitle className="text-red-800">Materialization Timeout</AlertTitle>
          <AlertDescription className="text-red-700">
            Baseline materialization is taking longer than expected.
            {onRetryMaterialization && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRetryMaterialization}
                className="mt-2 text-red-700 border-red-300 hover:bg-red-100"
              >
                <RefreshCw className="mr-2 h-3 w-3" />
                Retry Materialization
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}
      
      {materializationFailed && !materializationPending && !materializationTimeout && (
        <Alert variant="destructive" className="bg-red-50 border-red-200">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertTitle className="text-red-800">Materialization Failed</AlertTitle>
          <AlertDescription className="text-red-700">
            Failed to materialize baseline data. Please try again or contact support.
            {onRetryMaterialization && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRetryMaterialization}
                className="mt-2 text-red-700 border-red-300 hover:bg-red-100"
              >
                <RefreshCw className="mr-2 h-3 w-3" />
                Retry
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
