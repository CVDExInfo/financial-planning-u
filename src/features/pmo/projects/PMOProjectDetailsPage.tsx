import { useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BaselineStatusPanel } from "@/components/baseline/BaselineStatusPanel";
import { useProject } from "@/contexts/ProjectContext";
import { usePermissions } from "@/hooks/usePermissions";
import { ArrowLeft, Loader2, Building2, Calendar, DollarSign, User } from "lucide-react";

/**
 * PMO Project Details Page
 * 
 * This page allows PMO and PM users to view project details and baseline status
 * in read-only mode, without requiring access to SDMT cost management routes.
 * 
 * Features:
 * - Displays high-level project information (name, client, code)
 * - Shows baseline status and acceptance/rejection details via BaselineStatusPanel
 * - Read-only view - no accept/reject actions for PMO/PM
 * - SDMT users can still access this page, but typically use SDMT cost screens
 */
export default function PMOProjectDetailsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { projects, loading, selectedProjectId, setSelectedProjectId, currentProject } = useProject();
  const { isPMO, isSDMT } = usePermissions();

  // Find the project from the loaded projects
  const project = useMemo(() => {
    if (!projectId) return null;
    return projects.find(p => p.id === projectId);
  }, [projects, projectId]);

  // Auto-select the project in context if it's different from current selection
  useEffect(() => {
    if (projectId && projectId !== selectedProjectId && project) {
      setSelectedProjectId(projectId);
    }
  }, [projectId, selectedProjectId, project, setSelectedProjectId]);

  const handleBack = () => {
    navigate("/pmo/prefactura/estimator");
  };

  // Loading state
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Loading project details...</p>
          </div>
        </div>
      </div>
    );
  }

  // Project not found
  if (!project) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Button
          variant="outline"
          onClick={handleBack}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Estimator
        </Button>
        
        <Alert variant="destructive">
          <AlertTitle>Project Not Found</AlertTitle>
          <AlertDescription>
            The project with ID "{projectId}" could not be found. It may have been deleted or you may not have permission to view it.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Back Button */}
      <Button
        variant="outline"
        onClick={handleBack}
        className="mb-6"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Estimator
      </Button>

      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Project Details</h1>
        <p className="text-muted-foreground">
          View project information and baseline status
        </p>
      </div>

      {/* Project Information Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Project Information</CardTitle>
          <CardDescription>
            Basic details about this project
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Project Name */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building2 className="h-4 w-4" />
                <span>Project Name</span>
              </div>
              <p className="text-base font-medium">{project.name}</p>
            </div>

            {/* Project Code */}
            {project.code && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <DollarSign className="h-4 w-4" />
                  <span>Project Code</span>
                </div>
                <p className="text-base font-medium font-mono">{project.code}</p>
              </div>
            )}

            {/* Client */}
            {project.client && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>Client</span>
                </div>
                <p className="text-base font-medium">{project.client}</p>
              </div>
            )}

            {/* Status */}
            {project.status && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Status</span>
                </div>
                <p className="text-base font-medium capitalize">{project.status}</p>
              </div>
            )}
          </div>

          {/* Description */}
          {project.description && (
            <div className="space-y-1 pt-2">
              <div className="text-sm text-muted-foreground">Description</div>
              <p className="text-base">{project.description}</p>
            </div>
          )}

          {/* SDM Manager */}
          {project.sdm_manager_name && (
            <div className="space-y-1 pt-2">
              <div className="text-sm text-muted-foreground">SDM Manager</div>
              <p className="text-base">
                {project.sdm_manager_name}
                {project.sdm_manager_email && (
                  <a
                    href={`mailto:${project.sdm_manager_email}`}
                    className="ml-2 text-sm text-primary hover:underline"
                  >
                    {project.sdm_manager_email}
                  </a>
                )}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Baseline Status Panel */}
      {currentProject?.baselineId && currentProject?.baseline_status && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4">Baseline Status</h2>
          <BaselineStatusPanel />
        </div>
      )}

      {/* No Baseline Message */}
      {(!currentProject?.baselineId || !currentProject?.baseline_status) && (
        <Alert>
          <AlertTitle>No Baseline</AlertTitle>
          <AlertDescription>
            This project does not have a baseline yet. Create a baseline through the PMO Estimator.
          </AlertDescription>
        </Alert>
      )}

      {/* Info for SDMT users */}
      {isSDMT && (
        <Alert className="mt-6">
          <AlertDescription>
            As an SDMT user, you can also manage this project from the SDMT Cost Management screens where you have full accept/reject capabilities.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
