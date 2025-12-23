import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Loader2,
  ExternalLink,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { useProject } from "@/contexts/ProjectContext";
import { usePermissions } from "@/hooks/usePermissions";
import { acceptBaseline, rejectBaseline, getBaselineById, type BaselineDetail } from "@/api/finanzas";
import { handleFinanzasApiError } from "@/features/sdmt/cost/utils/errorHandling";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { runBackfill } from "@/api/finanzas.baseline";

interface BaselineStatusPanelProps {
  className?: string;
}

type BaselineStatus = "pending" | "handed_off" | "accepted" | "rejected";

export function BaselineStatusPanel({ className }: BaselineStatusPanelProps) {
  const { currentProject, refreshProject, invalidateProjectData } = useProject();
  const { isSDMT, isPMO, isPM, isExecRO, isVendor } = usePermissions();
  const { login } = useAuth();
  const queryClient = useQueryClient();
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectComment, setRejectComment] = useState("");
  const [baselineDetail, setBaselineDetail] = useState<BaselineDetail | null>(null);
  const [loadingBaseline, setLoadingBaseline] = useState(false);
  const [materializing, setMaterializing] = useState(false);
  const [confirmMaterializeOpen, setConfirmMaterializeOpen] = useState(false);

  // Role-based visibility control
  const canViewStatus = isSDMT || isPMO || isPM || isExecRO || isVendor;
  const canActOnBaseline = isSDMT; // Only SDMT can accept/reject

  // Fetch baseline details when baseline exists and rubros_count is 0 or null/undefined
  useEffect(() => {
    const shouldFetchBaseline = 
      currentProject?.baselineId && 
      (currentProject.rubros_count == null || currentProject.rubros_count === 0);
    
    if (shouldFetchBaseline) {
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
  }, [currentProject?.baselineId, currentProject?.rubros_count]);

  // Shared function to invalidate all project-dependent queries
  const invalidateProjectQueries = async () => {
    if (!currentProject?.id) return;
    
    // Run all invalidations concurrently for better performance
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["lineItems", currentProject.id] }),
      queryClient.invalidateQueries({ queryKey: ["forecast", currentProject.id] }),
    ]);
    
    // Force UI components to re-render with new data
    invalidateProjectData();
  };

  // Hooks must be called unconditionally before any early returns
  const acceptMutation = useMutation({
    mutationFn: async () => {
      if (!currentProject?.id || !currentProject?.baselineId) {
        throw new Error("Project or baseline ID missing");
      }
      if (!canActOnBaseline) {
        throw new Error("User is not allowed to accept baselines");
      }
      return acceptBaseline(currentProject.id, {
        baseline_id: currentProject.baselineId,
      });
    },
    onSuccess: async () => {
      toast.success("Baseline accepted successfully");
      
      // Refresh project metadata first
      await refreshProject();
      
      // Invalidate all project-dependent queries
      await invalidateProjectQueries();
    },
    onError: (error) => {
      const message = handleFinanzasApiError(error, {
        onAuthError: login,
        fallback: "Failed to accept baseline",
      });
      toast.error(message);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!currentProject?.id || !currentProject?.baselineId) {
        throw new Error("Project or baseline ID missing");
      }
      if (!canActOnBaseline) {
        throw new Error("User is not allowed to reject baselines");
      }
      return rejectBaseline(currentProject.id, {
        baseline_id: currentProject.baselineId,
        comment: rejectComment.trim(),
      });
    },
    onSuccess: async () => {
      toast.success("Baseline rejected");
      setRejectDialogOpen(false);
      setRejectComment("");
      
      // Refresh project metadata
      await refreshProject();
      
      // Invalidate all project-dependent queries
      await invalidateProjectQueries();
    },
    onError: (error) => {
      const message = handleFinanzasApiError(error, {
        onAuthError: login,
        fallback: "Failed to reject baseline",
      });
      toast.error(message);
    },
  });

  // If user cannot view status at all, render nothing
  if (!canViewStatus) {
    return null;
  }

  // Safety check: If no current project context, render nothing (prevents crash)
  if (!currentProject) {
    return null;
  }

  const handleAccept = () => {
    if (!currentProject?.baselineId) {
      toast.error("No baseline found to accept");
      return;
    }
    acceptMutation.mutate();
  };

  const handleRejectClick = () => {
    if (!currentProject?.baselineId) {
      toast.error("No baseline found to reject");
      return;
    }
    setRejectDialogOpen(true);
  };

  const handleRejectConfirm = () => {
    rejectMutation.mutate();
  };

  // Helper function to calculate labor estimate total cost
  const calculateLaborCost = (estimate: BaselineDetail['labor_estimates'][0]) => {
    const monthlyRate = (estimate.hourly_rate || 0) * (estimate.hours_per_month || 160) * (estimate.fte_count || 1);
    const months = (estimate.end_month || 12) - (estimate.start_month || 1) + 1;
    const onCostMultiplier = 1 + ((estimate.on_cost_percentage || 0) / 100);
    return monthlyRate * months * onCostMultiplier;
  };

  // Helper function to calculate monthly cost for labor estimate (for table display)
  const calculateMonthlyLaborCost = (estimate: BaselineDetail['labor_estimates'][0]) => {
    const monthlyRate = (estimate.hourly_rate || 0) * (estimate.hours_per_month || 160) * (estimate.fte_count || 1);
    const onCostMultiplier = 1 + ((estimate.on_cost_percentage || 0) / 100);
    return monthlyRate * onCostMultiplier;
  };

  const handleMaterializeClick = () => {
    if (!currentProject?.id || !currentProject?.baselineId) {
      toast.error("No se puede materializar: falta información del proyecto o baseline");
      return;
    }
    setConfirmMaterializeOpen(true);
  };

  const handleMaterializeConfirm = async () => {
    if (!currentProject?.id || !currentProject?.baselineId) {
      return;
    }

    setConfirmMaterializeOpen(false);

    try {
      setMaterializing(true);
      const result = await runBackfill(currentProject.id, false);
      
      if (result.success) {
        const rubrosWritten = result.result.rubrosWritten || 0;
        toast.success(
          `Materialización exitosa: ${rubrosWritten} rubro(s) creados`,
          {
            description: "Los rubros ahora aparecerán en el catálogo",
            duration: 5000,
          }
        );
        
        // Refresh project data
        await refreshProject();
        await invalidateProjectQueries();
      } else {
        toast.error("Error en materialización", {
          description: result.message || "Revisa la consola para más detalles",
        });
      }
    } catch (err) {
      console.error(err);
      toast.error("Error materializando rubros", {
        description: err instanceof Error ? err.message : "Error desconocido",
      });
    } finally {
      setMaterializing(false);
    }
  };

  const renderBaselineDetails = () => {
    if (!baselineDetail || loadingBaseline) return null;

    const { labor_estimates = [], non_labor_estimates = [], supporting_documents = [] } = baselineDetail;
    
    // Calculate totals using helper function
    const laborTotal = labor_estimates.reduce((sum, est) => sum + calculateLaborCost(est), 0);
    const nonLaborTotal = non_labor_estimates.reduce((sum, est) => sum + (est.amount || 0), 0);
    
    const hasItems = labor_estimates.length > 0 || non_labor_estimates.length > 0;
    const documentLink = supporting_documents?.[0]?.documentKey;

    return (
      <div className="mt-4 space-y-4 pt-4 border-t">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-sm">Valores Originales del Baseline</h4>
          {documentLink && (
            <a
              href={`/api/documents/${documentLink}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <ExternalLink size={12} />
              Ver documento original
            </a>
          )}
        </div>

        {loadingBaseline ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            <span className="text-sm text-muted-foreground">Cargando detalles del baseline...</span>
          </div>
        ) : hasItems ? (
          <>
            {/* Labor Estimates */}
            {labor_estimates.length > 0 && (
              <div>
                <h5 className="text-xs font-medium text-muted-foreground mb-2">Recursos Humanos (MOD)</h5>
                <div className="rounded-md border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-2 font-medium">Rol</th>
                        <th className="text-left p-2 font-medium">Nivel</th>
                        <th className="text-right p-2 font-medium">FTEs</th>
                        <th className="text-right p-2 font-medium">Tarifa/hora</th>
                        <th className="text-right p-2 font-medium">Hrs/mes</th>
                        <th className="text-right p-2 font-medium">Total Mensual</th>
                      </tr>
                    </thead>
                    <tbody>
                      {labor_estimates.map((est, idx) => {
                        const totalMonthly = calculateMonthlyLaborCost(est);
                        
                        return (
                          <tr key={idx} className="border-t">
                            <td className="p-2">{est.role || est.rubroId || "N/A"}</td>
                            <td className="p-2">{est.level || "N/A"}</td>
                            <td className="p-2 text-right">{est.fte_count || 0}</td>
                            <td className="p-2 text-right">${(est.hourly_rate || 0).toLocaleString()}</td>
                            <td className="p-2 text-right">{est.hours_per_month || 160}</td>
                            <td className="p-2 text-right font-medium">${totalMonthly.toLocaleString()}</td>
                          </tr>
                        );
                      })}
                      <tr className="border-t bg-muted/30">
                        <td colSpan={5} className="p-2 font-semibold">Subtotal MOD</td>
                        <td className="p-2 text-right font-semibold">${laborTotal.toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Non-Labor Estimates */}
            {non_labor_estimates.length > 0 && (
              <div>
                <h5 className="text-xs font-medium text-muted-foreground mb-2">Gastos y Servicios</h5>
                <div className="rounded-md border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-2 font-medium">Descripción</th>
                        <th className="text-left p-2 font-medium">Categoría</th>
                        <th className="text-left p-2 font-medium">Proveedor</th>
                        <th className="text-right p-2 font-medium">Tipo</th>
                        <th className="text-right p-2 font-medium">Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {non_labor_estimates.map((est, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="p-2">{est.description || est.rubroId || "N/A"}</td>
                          <td className="p-2">{est.category || "N/A"}</td>
                          <td className="p-2">{est.vendor || "N/A"}</td>
                          <td className="p-2 text-right">
                            <Badge variant="outline" className="text-xs">
                              {est.one_time ? "Único" : "Recurrente"}
                            </Badge>
                          </td>
                          <td className="p-2 text-right font-medium">${(est.amount || 0).toLocaleString()}</td>
                        </tr>
                      ))}
                      <tr className="border-t bg-muted/30">
                        <td colSpan={4} className="p-2 font-semibold">Subtotal Gastos</td>
                        <td className="p-2 text-right font-semibold">${nonLaborTotal.toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Grand Total */}
            <div className="flex justify-between items-center pt-2 border-t">
              <span className="font-semibold">Total Proyecto</span>
              <span className="text-lg font-bold">${(laborTotal + nonLaborTotal).toLocaleString()}</span>
            </div>

            {/* Materialize Button */}
            {canActOnBaseline && normalizedStatus === "accepted" && (
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  onClick={handleMaterializeClick}
                  disabled={materializing}
                  variant="default"
                  size="sm"
                  className="gap-2"
                >
                  {materializing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Materializando...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4" />
                      Materializar Ahora
                    </>
                  )}
                </Button>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No hay detalles del baseline disponibles
          </p>
        )}
      </div>
    );
  };

  if (!currentProject?.baselineId) {
    return null;
  }

  const status = (currentProject.baseline_status || "pending") as BaselineStatus;
  const normalizedStatus = status.toLowerCase() as BaselineStatus;

  const getStatusBadge = (status: BaselineStatus) => {
    const normalized = status.toLowerCase();
    switch (normalized) {
      case "accepted":
        return (
          <Badge variant="default" className="bg-green-600 gap-1.5">
            <CheckCircle2 size={14} />
            Accepted
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive" className="gap-1.5">
            <XCircle size={14} />
            Rejected
          </Badge>
        );
      case "pending":
      case "handed_off":
        return (
          <Badge variant="secondary" className="gap-1.5">
            <Clock size={14} />
            Pending Review
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1.5">
            <AlertCircle size={14} />
            {status}
          </Badge>
        );
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const showActions =
    canActOnBaseline && (normalizedStatus === "pending" || normalizedStatus === "handed_off");
  const showReadOnlyBanner = !canActOnBaseline && (isPMO || isPM);
  const contactEmail =
    currentProject?.sdm_manager_email || currentProject?.accepted_by || undefined;

  return (
    <>
      <Card className={cn("border-l-4", className, {
        "border-l-amber-500": normalizedStatus === "pending" || normalizedStatus === "handed_off",
        "border-l-green-600": normalizedStatus === "accepted",
        "border-l-red-600": normalizedStatus === "rejected",
      })}>
        <CardContent className="pt-4 pb-4">
          {showReadOnlyBanner && (
            <Alert
              variant={normalizedStatus === "rejected" ? "destructive" : "default"}
              className="mb-3"
            >
              {normalizedStatus === "accepted" && (
                <AlertDescription className="text-xs">
                  La SDMT aceptó la baseline. {contactEmail ? (
                    <a className="underline" href={`mailto:${contactEmail}`}>
                      Contactar SDM
                    </a>
                  ) : null}
                </AlertDescription>
              )}
              {normalizedStatus === "rejected" && (
                <AlertDescription className="text-xs">
                  Baseline rechazada por SDMT.
                  {currentProject?.rejection_comment
                    ? ` Motivo: ${currentProject.rejection_comment}`
                    : ""}
                  {contactEmail ? (
                    <>
                      {" "}
                      <a className="underline" href={`mailto:${contactEmail}`}>
                        Contactar SDM
                      </a>
                    </>
                  ) : null}
                </AlertDescription>
              )}
              {normalizedStatus === "handed_off" && (
                <AlertDescription className="text-xs">
                  La baseline fue entregada a SDMT. En espera de aprobación.
                </AlertDescription>
              )}
            </Alert>
          )}
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold">Baseline Status</h3>
                {getStatusBadge(status)}
              </div>
              
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="font-mono">ID: {currentProject.baselineId}</span>
                
                {normalizedStatus === "accepted" && currentProject.accepted_by && (
                  <span>
                    Accepted by <strong>{currentProject.accepted_by}</strong>
                    {currentProject.baselineAcceptedAt && (
                      <> on {formatDate(currentProject.baselineAcceptedAt)}</>
                    )}
                  </span>
                )}
                
                {normalizedStatus === "rejected" && currentProject.rejected_by && (
                  <span>
                    Rejected by <strong>{currentProject.rejected_by}</strong>
                    {currentProject.baseline_rejected_at && (
                      <> on {formatDate(currentProject.baseline_rejected_at)}</>
                    )}
                  </span>
                )}
              </div>

              {normalizedStatus === "rejected" && currentProject.rejection_comment && (
                <Alert className="mt-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    <strong>Rejection reason:</strong> {currentProject.rejection_comment}
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {showActions && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRejectClick}
                  disabled={acceptMutation.isPending || rejectMutation.isPending}
                >
                  {rejectMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Rejecting...
                    </>
                  ) : (
                    <>
                      <XCircle className="mr-2 h-4 w-4" />
                      Reject
                    </>
                  )}
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleAccept}
                  disabled={acceptMutation.isPending || rejectMutation.isPending}
                >
                  {acceptMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Accepting...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Accept Baseline
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* Render baseline details table when rubros_count is 0 or null/undefined */}
          {(currentProject.rubros_count == null || currentProject.rubros_count === 0) && renderBaselineDetails()}
        </CardContent>
      </Card>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Baseline</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this baseline. This will be
              sent to the PM for review.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reject-comment">
                Rejection Reason <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="reject-comment"
                placeholder="e.g., Budget exceeds approved limits, missing required documentation..."
                value={rejectComment}
                onChange={(e) => setRejectComment(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectDialogOpen(false);
                setRejectComment("");
              }}
              disabled={rejectMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectConfirm}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Rejecting...
                </>
              ) : (
                "Reject Baseline"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Materialize Confirmation Dialog */}
      <Dialog open={confirmMaterializeOpen} onOpenChange={setConfirmMaterializeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Materializar Baseline</DialogTitle>
            <DialogDescription>
              ¿Confirmar materialización de rubros en la base de datos? Esta acción creará los rubros basados en el baseline aceptado.
            </DialogDescription>
          </DialogHeader>
          
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Esta acción convertirá las estimaciones del baseline en rubros editables del catálogo.
            </AlertDescription>
          </Alert>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmMaterializeOpen(false)}
              disabled={materializing}
            >
              Cancelar
            </Button>
            <Button
              variant="default"
              onClick={handleMaterializeConfirm}
              disabled={materializing}
            >
              {materializing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Materializando...
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-4 w-4" />
                  Confirmar Materialización
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Export only as named export for consistency and better tree-shaking
