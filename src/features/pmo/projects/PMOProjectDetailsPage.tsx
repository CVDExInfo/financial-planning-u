import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BaselineStatusPanel } from "@/components/baseline/BaselineStatusPanel";
import { useProject } from "@/contexts/ProjectContext";
import { usePermissions } from "@/hooks/usePermissions";
import { ArrowLeft, Loader2, Building2, Calendar, DollarSign, User, Zap } from "lucide-react";
import { getBaselineById, type BaselineDetail } from "@/api/finanzas";
import { runBackfill } from "@/api/finanzas.baseline";
import { toast } from "sonner";
import { ES_TEXTS } from "@/lib/i18n/es";

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

  // Baseline details state
  const [baselineDetail, setBaselineDetail] = useState<BaselineDetail | null>(null);
  const [loadingBaseline, setLoadingBaseline] = useState(false);
  const [materializing, setMaterializing] = useState(false);

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

  // Fetch baseline details when baselineId is available
  useEffect(() => {
    if (currentProject?.baselineId && currentProject?.baseline_status === 'accepted') {
      setLoadingBaseline(true);
      getBaselineById(currentProject.baselineId)
        .then(setBaselineDetail)
        .catch((err) => {
          console.error("Failed to fetch baseline details:", err);
          toast.error("No se pudo cargar los detalles del baseline");
        })
        .finally(() => setLoadingBaseline(false));
    } else {
      setBaselineDetail(null);
    }
  }, [currentProject?.baselineId, currentProject?.baseline_status]);

  // Handle materialization
  const handleMaterializeBaseline = async () => {
    if (!currentProject?.baselineId || !projectId) return;
    
    setMaterializing(true);
    try {
      await runBackfill(projectId, currentProject.baselineId);
      toast.success(ES_TEXTS.baseline.materializarSuccess);
      // Optionally reload the page or navigate to rubros
    } catch (err) {
      console.error("Failed to materialize baseline:", err);
      toast.error(ES_TEXTS.baseline.materializarError);
    } finally {
      setMaterializing(false);
    }
  };

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
          Volver al Planificador
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
        Volver al Planificador
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

      {/* Baseline Details Panel - Valores Originales del Baseline */}
      {baselineDetail && currentProject?.baseline_status === 'accepted' && (
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{ES_TEXTS.baseline.valoresOriginales}</CardTitle>
                <CardDescription>
                  Detalles de recursos humanos y gastos del baseline aceptado
                </CardDescription>
              </div>
              <Button
                onClick={handleMaterializeBaseline}
                disabled={materializing}
                variant="default"
                className="gap-2"
              >
                {materializing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                {ES_TEXTS.baseline.materializarAhora}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Acceptance/Rejection Metadata */}
            {(baselineDetail.signed_by || baselineDetail.signed_at) && (
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                {baselineDetail.signed_by && (
                  <div>
                    <div className="text-sm text-muted-foreground">{ES_TEXTS.baseline.acceptedBy}</div>
                    <div className="font-medium">{baselineDetail.signed_by}</div>
                  </div>
                )}
                {baselineDetail.signed_at && (
                  <div>
                    <div className="text-sm text-muted-foreground">{ES_TEXTS.baseline.acceptedAt}</div>
                    <div className="font-medium">
                      {new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(baselineDetail.signed_at))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Recursos Humanos (MOD) */}
            <Accordion type="single" collapsible defaultValue="labor">
              <AccordionItem value="labor">
                <AccordionTrigger className="text-lg font-semibold">
                  {ES_TEXTS.baseline.recursosHumanos}
                </AccordionTrigger>
                <AccordionContent>
                  {loadingBaseline ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : (
                    <>
                      {(() => {
                        const laborEstimates = baselineDetail.labor_estimates || baselineDetail.payload?.labor_estimates || [];
                        if (laborEstimates.length === 0) {
                          return <p className="text-muted-foreground py-4">No hay recursos humanos en este baseline</p>;
                        }

                        const laborSubtotal = laborEstimates.reduce((sum, item) => {
                          const fte = Number(item.fte_count || 0);
                          const rate = Number(item.hourly_rate || item.rate || 0);
                          const hours = Number(item.hours_per_month || 160);
                          return sum + (fte * rate * hours);
                        }, 0);

                        return (
                          <>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>{ES_TEXTS.baseline.role}</TableHead>
                                  <TableHead>{ES_TEXTS.baseline.level}</TableHead>
                                  <TableHead className="text-right">{ES_TEXTS.baseline.fte}</TableHead>
                                  <TableHead className="text-right">{ES_TEXTS.baseline.tarifaHora}</TableHead>
                                  <TableHead className="text-right">{ES_TEXTS.baseline.hrsMes}</TableHead>
                                  <TableHead className="text-right">{ES_TEXTS.baseline.totalMensual}</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {laborEstimates.map((item, idx) => {
                                  const fte = Number(item.fte_count || 0);
                                  const rate = Number(item.hourly_rate || item.rate || 0);
                                  const hours = Number(item.hours_per_month || 160);
                                  const monthlyTotal = fte * rate * hours;
                                  
                                  return (
                                    <TableRow key={idx}>
                                      <TableCell className="font-medium">{item.role || '—'}</TableCell>
                                      <TableCell>{item.level || '—'}</TableCell>
                                      <TableCell className="text-right">{fte.toFixed(2)}</TableCell>
                                      <TableCell className="text-right">${rate.toLocaleString()}</TableCell>
                                      <TableCell className="text-right">{hours.toLocaleString()}</TableCell>
                                      <TableCell className="text-right font-medium">${monthlyTotal.toLocaleString()}</TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                            <div className="flex justify-end pt-4 border-t">
                              <div className="text-right">
                                <div className="text-sm text-muted-foreground">{ES_TEXTS.baseline.subtotal} {ES_TEXTS.baseline.recursosHumanos}</div>
                                <div className="text-xl font-bold">${laborSubtotal.toLocaleString()}</div>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </>
                  )}
                </AccordionContent>
              </AccordionItem>

              {/* Gastos y Servicios */}
              <AccordionItem value="non-labor">
                <AccordionTrigger className="text-lg font-semibold">
                  {ES_TEXTS.baseline.gastosServicios}
                </AccordionTrigger>
                <AccordionContent>
                  {(() => {
                    const nonLaborEstimates = baselineDetail.non_labor_estimates || baselineDetail.payload?.non_labor_estimates || [];
                    if (nonLaborEstimates.length === 0) {
                      return <p className="text-muted-foreground py-4">No hay gastos y servicios en este baseline</p>;
                    }

                    const nonLaborSubtotal = nonLaborEstimates.reduce((sum, item) => sum + Number(item.amount || 0), 0);

                    return (
                      <>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{ES_TEXTS.baseline.description}</TableHead>
                              <TableHead>{ES_TEXTS.baseline.categoria}</TableHead>
                              <TableHead>{ES_TEXTS.baseline.provider}</TableHead>
                              <TableHead>{ES_TEXTS.baseline.type}</TableHead>
                              <TableHead className="text-right">{ES_TEXTS.baseline.amount}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {nonLaborEstimates.map((item, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="font-medium">{item.description || '—'}</TableCell>
                                <TableCell>{item.category || '—'}</TableCell>
                                <TableCell>{item.vendor || '—'}</TableCell>
                                <TableCell>
                                  {item.one_time ? ES_TEXTS.baseline.oneTimeAmount : ES_TEXTS.baseline.monthlyAmount}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  ${Number(item.amount || 0).toLocaleString()}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        <div className="flex justify-end pt-4 border-t">
                          <div className="text-right">
                            <div className="text-sm text-muted-foreground">{ES_TEXTS.baseline.subtotal} {ES_TEXTS.baseline.gastosServicios}</div>
                            <div className="text-xl font-bold">${nonLaborSubtotal.toLocaleString()}</div>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {/* Total Project */}
            <div className="flex justify-end pt-4 border-t-2">
              <div className="text-right">
                <div className="text-sm text-muted-foreground">{ES_TEXTS.baseline.total} Proyecto</div>
                <div className="text-2xl font-bold text-primary">
                  ${(() => {
                    const laborEstimates = baselineDetail.labor_estimates || baselineDetail.payload?.labor_estimates || [];
                    const nonLaborEstimates = baselineDetail.non_labor_estimates || baselineDetail.payload?.non_labor_estimates || [];
                    const laborTotal = laborEstimates.reduce((sum, item) => {
                      const fte = Number(item.fte_count || 0);
                      const rate = Number(item.hourly_rate || item.rate || 0);
                      const hours = Number(item.hours_per_month || 160);
                      return sum + (fte * rate * hours);
                    }, 0);
                    const nonLaborTotal = nonLaborEstimates.reduce((sum, item) => sum + Number(item.amount || 0), 0);
                    return (laborTotal + nonLaborTotal).toLocaleString();
                  })()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Baseline Message */}
      {(!currentProject?.baselineId || !currentProject?.baseline_status) && (
        <Alert>
          <AlertTitle>No Baseline</AlertTitle>
          <AlertDescription>
            {!currentProject 
              ? "No se ha seleccionado un proyecto. Por favor, seleccione un proyecto desde el Planificador."
              : "Este proyecto aún no tiene una línea base. Cree una línea base a través del Planificador PMO."
            }
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
