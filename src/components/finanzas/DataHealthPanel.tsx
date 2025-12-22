/**
 * Data Health Debug Panel
 * 
 * Dev-only panel that displays data health metrics for debugging
 * dashboard loading issues. Shows per-project baseline status,
 * rubros count, line items count, and API endpoint statuses.
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  ChevronDown, 
  ChevronUp,
  RefreshCw
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useProject, type ProjectSummary } from '@/contexts/ProjectContext';
import { getProjectRubros } from '@/api/finanzas';
import finanzasClient from '@/api/finanzasClient';
import { logger } from '@/utils/logger';

interface ProjectHealthMetrics {
  projectId: string;
  projectName: string;
  baselineId: string | null;
  baselineStatus: string | null;
  rubrosCount: number;
  lineItemsCount: number;
  hasError: boolean;
  errorMessage?: string;
}

interface EndpointHealthStatus {
  endpoint: string;
  status: 'ok' | 'error' | 'not-tested';
  statusCode?: number;
  message?: string;
}

export function DataHealthPanel() {
  const { projects, selectedProjectId } = useProject();
  const [isOpen, setIsOpen] = useState(false);
  const [projectMetrics, setProjectMetrics] = useState<Map<string, ProjectHealthMetrics>>(new Map());
  const [endpointStatuses, setEndpointStatuses] = useState<EndpointHealthStatus[]>([]);
  const [loading, setLoading] = useState(false);

  // Only show in dev mode
  if (!import.meta.env.DEV) {
    return null;
  }

  const checkProjectHealth = async (project: ProjectSummary): Promise<ProjectHealthMetrics> => {
    try {
      // Get rubros/line items
      const lineItems = await getProjectRubros(project.id);
      
      return {
        projectId: project.id,
        projectName: project.name,
        baselineId: project.baselineId || null,
        baselineStatus: project.baseline_status || null,
        rubrosCount: lineItems.length,
        lineItemsCount: lineItems.length, // Same data source
        hasError: false,
      };
    } catch (error: any) {
      return {
        projectId: project.id,
        projectName: project.name,
        baselineId: project.baselineId || null,
        baselineStatus: project.baseline_status || null,
        rubrosCount: 0,
        lineItemsCount: 0,
        hasError: true,
        errorMessage: error?.message || 'Unknown error',
      };
    }
  };

  const checkEndpointHealth = async () => {
    const statuses: EndpointHealthStatus[] = [];
    const currentYear = new Date().getFullYear();

    // Test budget overview endpoint
    try {
      await finanzasClient.getAllInBudgetOverview(currentYear);
      statuses.push({
        endpoint: `/budgets/all-in/overview?year=${currentYear}`,
        status: 'ok',
        statusCode: 200,
      });
    } catch (error: any) {
      statuses.push({
        endpoint: `/budgets/all-in/overview?year=${currentYear}`,
        status: 'error',
        statusCode: error?.status || error?.statusCode,
        message: error?.message || 'Failed to fetch',
      });
    }

    // Test monthly budget endpoint
    try {
      await finanzasClient.getAllInBudgetMonthly(currentYear);
      statuses.push({
        endpoint: `/budgets/all-in/monthly?year=${currentYear}`,
        status: 'ok',
        statusCode: 200,
      });
    } catch (error: any) {
      statuses.push({
        endpoint: `/budgets/all-in/monthly?year=${currentYear}`,
        status: 'error',
        statusCode: error?.status || error?.statusCode,
        message: error?.message || 'Failed to fetch',
      });
    }

    setEndpointStatuses(statuses);
  };

  const runHealthCheck = async () => {
    setLoading(true);
    try {
      // Check all projects
      const metrics = new Map<string, ProjectHealthMetrics>();
      for (const project of projects) {
        if (project.id === 'ALL_PROJECTS') continue; // Skip aggregate project
        const health = await checkProjectHealth(project);
        metrics.set(project.id, health);
        
        // Log diagnostic info (dev only, no sensitive data exposed)
        if (import.meta.env.DEV) {
          logger.info('[DataHealth] Project metrics:', {
            projectId: health.projectId.length > 8 ? health.projectId.substring(0, 8) + '...' : health.projectId,
            baselineId: health.baselineId && health.baselineId.length > 12 ? health.baselineId.substring(0, 12) + '...' : health.baselineId,
            baselineStatus: health.baselineStatus,
            rubrosCount: health.rubrosCount,
            lineItemsCount: health.lineItemsCount,
            hasError: health.hasError,
          });
        }
      }
      setProjectMetrics(metrics);

      // Check endpoint statuses
      await checkEndpointHealth();
    } catch (error) {
      logger.error('[DataHealth] Health check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const getHealthBadge = (metrics: ProjectHealthMetrics) => {
    if (metrics.hasError) {
      return <Badge variant="destructive">Error</Badge>;
    }
    if (metrics.baselineId && metrics.lineItemsCount === 0) {
      return <Badge variant="destructive">Missing Line Items</Badge>;
    }
    if (!metrics.baselineId) {
      return <Badge variant="secondary">No Baseline</Badge>;
    }
    if (metrics.baselineStatus !== 'accepted') {
      return <Badge variant="outline">Baseline {metrics.baselineStatus || 'Unknown'}</Badge>;
    }
    return <Badge variant="default">Healthy</Badge>;
  };

  const getEndpointStatusIcon = (status: EndpointHealthStatus) => {
    if (status.status === 'ok') {
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    }
    if (status.status === 'error') {
      return <XCircle className="h-4 w-4 text-red-600" />;
    }
    return <AlertCircle className="h-4 w-4 text-gray-400" />;
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border-b border-orange-500/20">
      <Card className="border-orange-500/50 bg-orange-50/50 dark:bg-orange-950/20">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-orange-100/50 dark:hover:bg-orange-900/30 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-600" />
                <CardTitle className="text-sm font-medium">
                  🔬 Data Health Panel (Dev Only)
                </CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    runHealthCheck();
                  }}
                  disabled={loading}
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  Run Check
                </Button>
                {isOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-4 space-y-4">
            {/* Project Health Metrics */}
            <div>
              <h3 className="text-sm font-semibold mb-2">Project Health</h3>
              {projectMetrics.size === 0 ? (
                <p className="text-sm text-muted-foreground">Click "Run Check" to see project health metrics</p>
              ) : (
                <div className="space-y-2">
                  {Array.from(projectMetrics.values()).map((metrics) => (
                    <div 
                      key={metrics.projectId}
                      className={`p-3 rounded-lg border ${
                        metrics.projectId === selectedProjectId
                          ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20'
                          : 'border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium">{metrics.projectName}</span>
                            {getHealthBadge(metrics)}
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <div>
                              Baseline ID: {metrics.baselineId 
                                ? (metrics.baselineId.length > 20 
                                  ? metrics.baselineId.substring(0, 20) + '...' 
                                  : metrics.baselineId)
                                : 'None'}
                            </div>
                            <div>Status: {metrics.baselineStatus || 'N/A'}</div>
                            <div>Rubros: {metrics.rubrosCount}</div>
                            <div>Line Items: {metrics.lineItemsCount}</div>
                          </div>
                          {metrics.hasError && (
                            <div className="mt-2 text-xs text-red-600">
                              Error: {metrics.errorMessage}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Endpoint Status */}
            <div>
              <h3 className="text-sm font-semibold mb-2">API Endpoint Status</h3>
              {endpointStatuses.length === 0 ? (
                <p className="text-sm text-muted-foreground">Click "Run Check" to test endpoints</p>
              ) : (
                <div className="space-y-2">
                  {endpointStatuses.map((status, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 rounded border border-gray-200 dark:border-gray-700">
                      {getEndpointStatusIcon(status)}
                      <div className="flex-1">
                        <div className="text-xs font-mono">{status.endpoint}</div>
                        {status.status === 'error' && (
                          <div className="text-xs text-red-600 mt-1">
                            {status.statusCode ? `HTTP ${status.statusCode}: ` : ''}
                            {status.message}
                          </div>
                        )}
                      </div>
                      {status.statusCode && (
                        <Badge 
                          variant={status.statusCode === 200 ? 'default' : 'destructive'}
                          className="text-xs"
                        >
                          {status.statusCode}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Instructions */}
            <div className="text-xs text-muted-foreground border-t pt-3">
              <p className="font-semibold mb-1">About this panel:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Shows data health for each project</li>
                <li>Tests critical API endpoints</li>
                <li>Helps diagnose dashboard loading issues</li>
                <li>Only visible in development mode</li>
              </ul>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
