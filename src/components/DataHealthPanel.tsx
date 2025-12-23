/**
 * Data Health Panel
 * 
 * Dev-only diagnostic panel for monitoring data quality and API health
 * Displays:
 * - Project rubros count and baseline status
 * - Line items count
 * - API endpoint health (budgets monthly, budgets overview)
 * - Diagnostic badges (Healthy, Missing Line Items, No Baseline, Error)
 * 
 * Only visible in DEV mode (import.meta.env.DEV === true)
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  AlertCircle, 
  CheckCircle, 
  XCircle, 
  Activity,
  Database,
  FileText,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useProject } from '@/contexts/ProjectContext';
import { getProjectRubros } from '@/api/finanzas';
import finanzasClient from '@/api/finanzasClient';
import { logDataHealth, logEndpointHealth, logQueryDiagnostic } from '@/utils/diagnostic-logging';

interface HealthCheck {
  status: 'healthy' | 'warning' | 'error';
  message: string;
  details?: Record<string, unknown>;
}

interface EndpointCheck {
  endpoint: string;
  status: number | null;
  responseTime: number | null;
  error: string | null;
}

export function DataHealthPanel() {
  const { selectedProjectId, currentProject } = useProject();
  const [isOpen, setIsOpen] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [healthStatus, setHealthStatus] = useState<HealthCheck | null>(null);
  const [rubrosCount, setRubrosCount] = useState<number | null>(null);
  const [lineItemsCount, setLineItemsCount] = useState<number | null>(null);
  const [endpointChecks, setEndpointChecks] = useState<EndpointCheck[]>([]);

  // Only render in DEV mode
  if (!import.meta.env.DEV) {
    return null;
  }

  /**
   * Run comprehensive health check
   */
  const runHealthCheck = async () => {
    if (!selectedProjectId) {
      setHealthStatus({
        status: 'warning',
        message: 'No project selected',
      });
      return;
    }

    setIsChecking(true);
    setHealthStatus(null);
    setRubrosCount(null);
    setLineItemsCount(null);
    setEndpointChecks([]);

    try {
      const startTime = Date.now();

      // Check 1: Project rubros
      const rubrosStartTime = Date.now();
      const rubros = await getProjectRubros(selectedProjectId);
      const rubrosDuration = Date.now() - rubrosStartTime;
      
      const rubrosArray = Array.isArray(rubros) ? rubros : [];
      setRubrosCount(rubrosArray.length);
      
      logQueryDiagnostic(
        'getProjectRubros',
        { projectId: selectedProjectId, baselineId: currentProject?.baselineId },
        rubrosArray.length,
        rubrosDuration
      );

      // Check 2: Line items count (from rubros)
      setLineItemsCount(rubrosArray.length);

      // Check 3: Budget endpoints
      const currentYear = new Date().getFullYear();
      const budgetChecks: EndpointCheck[] = [];

      // Check budgets/all-in/overview
      try {
        const overviewStart = Date.now();
        await finanzasClient.getAllInBudgetOverview(currentYear);
        const overviewDuration = Date.now() - overviewStart;
        
        budgetChecks.push({
          endpoint: `/budgets/all-in/overview?year=${currentYear}`,
          status: 200,
          responseTime: overviewDuration,
          error: null,
        });
        
        logEndpointHealth(`/budgets/all-in/overview?year=${currentYear}`, 200, overviewDuration);
      } catch (error) {
        budgetChecks.push({
          endpoint: `/budgets/all-in/overview?year=${currentYear}`,
          status: null,
          responseTime: null,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        
        logEndpointHealth(`/budgets/all-in/overview?year=${currentYear}`, 500, undefined, error);
      }

      // Check budgets/all-in/monthly
      try {
        const monthlyStart = Date.now();
        await finanzasClient.getAllInBudgetMonthly(currentYear);
        const monthlyDuration = Date.now() - monthlyStart;
        
        budgetChecks.push({
          endpoint: `/budgets/all-in/monthly?year=${currentYear}`,
          status: 200,
          responseTime: monthlyDuration,
          error: null,
        });
        
        logEndpointHealth(`/budgets/all-in/monthly?year=${currentYear}`, 200, monthlyDuration);
      } catch (error) {
        budgetChecks.push({
          endpoint: `/budgets/all-in/monthly?year=${currentYear}`,
          status: null,
          responseTime: null,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        
        logEndpointHealth(`/budgets/all-in/monthly?year=${currentYear}`, 500, undefined, error);
      }

      setEndpointChecks(budgetChecks);

      // Determine overall health status
      const hasBaseline = !!currentProject?.baselineId;
      const hasRubros = rubrosArray.length > 0;
      const endpointsHealthy = budgetChecks.every((check) => check.status === 200);

      let status: HealthCheck;

      if (!hasBaseline) {
        status = {
          status: 'warning',
          message: 'No Baseline',
          details: {
            projectId: selectedProjectId,
            projectName: currentProject?.name,
          },
        };
        logDataHealth('baseline', 'warning', { projectId: selectedProjectId, hasBaseline: false });
      } else if (!hasRubros) {
        status = {
          status: 'error',
          message: 'Missing Line Items',
          details: {
            projectId: selectedProjectId,
            baselineId: currentProject.baselineId,
            rubrosCount: 0,
          },
        };
        logDataHealth('rubros', 'error', { 
          projectId: selectedProjectId, 
          baselineId: currentProject.baselineId,
          rubrosCount: 0,
        });
      } else if (!endpointsHealthy) {
        status = {
          status: 'warning',
          message: 'Endpoint Errors',
          details: {
            failedEndpoints: budgetChecks.filter((c) => c.status !== 200).map((c) => c.endpoint),
          },
        };
        logDataHealth('endpoints', 'warning', { 
          failedEndpoints: budgetChecks.filter((c) => c.status !== 200).length,
        });
      } else {
        status = {
          status: 'healthy',
          message: 'Healthy',
          details: {
            rubrosCount: rubrosArray.length,
            lineItemsCount: rubrosArray.length,
            endpointsChecked: budgetChecks.length,
            totalDuration: Date.now() - startTime,
          },
        };
        logDataHealth('overall', 'healthy', { 
          rubrosCount: rubrosArray.length,
          endpointsHealthy: true,
        });
      }

      setHealthStatus(status);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setHealthStatus({
        status: 'error',
        message: 'Error',
        details: {
          error: errorMessage,
        },
      });
      
      logDataHealth('overall', 'error', { error: errorMessage });
    } finally {
      setIsChecking(false);
    }
  };

  /**
   * Get badge variant based on status
   */
  const getBadgeVariant = (status: 'healthy' | 'warning' | 'error'): 'default' | 'secondary' | 'destructive' => {
    switch (status) {
      case 'healthy':
        return 'default';
      case 'warning':
        return 'secondary';
      case 'error':
        return 'destructive';
    }
  };

  /**
   * Get icon based on status
   */
  const getStatusIcon = (status: 'healthy' | 'warning' | 'error') => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
    }
  };

  return (
    <Card className="border-2 border-blue-500 bg-blue-50/50">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-lg">Data Health Panel</CardTitle>
              <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">
                DEV ONLY
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={runHealthCheck}
                disabled={isChecking || !selectedProjectId}
              >
                {isChecking ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Run Check
                  </>
                )}
              </Button>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm">
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
          <CardDescription>
            Monitor data quality, baseline status, and API endpoint health
          </CardDescription>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-4">
            {/* Health Status */}
            {healthStatus && (
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-white">
                {getStatusIcon(healthStatus.status)}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Status:</span>
                    <Badge variant={getBadgeVariant(healthStatus.status)}>
                      {healthStatus.message}
                    </Badge>
                  </div>
                  {healthStatus.details && (
                    <pre className="mt-2 text-xs text-muted-foreground overflow-auto">
                      {JSON.stringify(healthStatus.details, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            )}

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg border bg-white">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Database className="h-4 w-4" />
                  Rubros Count
                </div>
                <div className="text-2xl font-bold">
                  {rubrosCount !== null ? rubrosCount : '-'}
                </div>
              </div>
              
              <div className="p-3 rounded-lg border bg-white">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <FileText className="h-4 w-4" />
                  Line Items Count
                </div>
                <div className="text-2xl font-bold">
                  {lineItemsCount !== null ? lineItemsCount : '-'}
                </div>
              </div>
            </div>

            {/* Endpoint Checks */}
            {endpointChecks.length > 0 && (
              <div className="space-y-2">
                <div className="font-semibold text-sm">Endpoint Health:</div>
                {endpointChecks.map((check, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 rounded border bg-white text-sm"
                  >
                    <span className="font-mono text-xs">{check.endpoint}</span>
                    <div className="flex items-center gap-2">
                      {check.status === 200 ? (
                        <>
                          <Badge variant="default" className="bg-green-100 text-green-700 border-green-300">
                            {check.status}
                          </Badge>
                          {check.responseTime !== null && (
                            <span className="text-xs text-muted-foreground">
                              {check.responseTime}ms
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <Badge variant="destructive">
                            {check.status || 'Error'}
                          </Badge>
                          {check.error && (
                            <span className="text-xs text-red-600 max-w-xs truncate">
                              {check.error}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!selectedProjectId && (
              <div className="text-center text-sm text-muted-foreground py-4">
                Select a project to run health checks
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
