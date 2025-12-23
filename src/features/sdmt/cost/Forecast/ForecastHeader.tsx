import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Share2, FileSpreadsheet, Calculator } from 'lucide-react';

interface ForecastHeaderProps {
  baseline: any | null;
  projectName?: string;
  onExportExcel?: () => void;
  onExportPDF?: () => void;
  onMaterializeNow?: () => void;
  materializationPending?: boolean;
  materializationTimeout?: boolean;
}

/**
 * ForecastHeader Component
 * 
 * Displays baseline information, materialization status, and action buttons.
 * Extracted from SDMTForecast to improve modularity.
 */
export function ForecastHeader({
  baseline,
  projectName,
  onExportExcel,
  onExportPDF,
  onMaterializeNow,
  materializationPending = false,
  materializationTimeout = false,
}: ForecastHeaderProps) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {projectName || 'Project'} - Forecast
          </h1>
          {baseline && (
            <p className="text-muted-foreground mt-1">
              Baseline: {baseline.baseline_id || baseline.baselineId}
            </p>
          )}
        </div>
        
        <div className="flex gap-2">
          {onExportExcel && (
            <Button variant="outline" onClick={onExportExcel}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Export Excel
            </Button>
          )}
          
          {onExportPDF && (
            <Button variant="outline" onClick={onExportPDF}>
              <Share2 className="mr-2 h-4 w-4" />
              Export PDF
            </Button>
          )}
          
          {materializationTimeout && onMaterializeNow && (
            <Button variant="default" onClick={onMaterializeNow}>
              <Calculator className="mr-2 h-4 w-4" />
              Materialize Now
            </Button>
          )}
        </div>
      </div>
      
      {/* Materialization Status */}
      {materializationPending && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-3"></div>
            <p className="text-sm text-blue-800">
              Materialization in progress... Polling for completion.
            </p>
          </div>
        </div>
      )}
      
      {materializationTimeout && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-yellow-800">
            Materialization is taking longer than expected. Click "Materialize Now" to trigger manual materialization.
          </p>
        </div>
      )}
    </div>
  );
}
