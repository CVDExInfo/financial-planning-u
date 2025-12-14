import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
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
} from "lucide-react";
import { toast } from "sonner";
import { useProject } from "@/contexts/ProjectContext";
import { usePermissions } from "@/hooks/usePermissions";
import { acceptBaseline, rejectBaseline } from "@/api/finanzas";
import { handleFinanzasApiError } from "@/features/sdmt/cost/utils/errorHandling";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface BaselineStatusPanelProps {
  className?: string;
}

type BaselineStatus = "pending" | "handed_off" | "accepted" | "rejected";

export function BaselineStatusPanel({ className }: BaselineStatusPanelProps) {
  const { currentProject, refreshProject } = useProject();
  const { isSDMT, isPMO, isPM } = usePermissions();
  const { login } = useAuth();
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectComment, setRejectComment] = useState("");

  const acceptMutation = useMutation({
    mutationFn: async () => {
      if (!currentProject?.id || !currentProject?.baselineId) {
        throw new Error("Project or baseline ID missing");
      }
      return acceptBaseline(currentProject.id);
    },
    onSuccess: async () => {
      toast.success("Baseline accepted successfully");
      await refreshProject();
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
      return rejectBaseline(currentProject.id, {
        baseline_id: currentProject.baselineId,
        comment: rejectComment.trim(),
      });
    },
    onSuccess: async () => {
      toast.success("Baseline rejected");
      setRejectDialogOpen(false);
      setRejectComment("");
      await refreshProject();
    },
    onError: (error) => {
      const message = handleFinanzasApiError(error, {
        onAuthError: login,
        fallback: "Failed to reject baseline",
      });
      toast.error(message);
    },
  });

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
    isSDMT && (normalizedStatus === "pending" || normalizedStatus === "handed_off");
  const showReadOnlyBanner = !isSDMT && (isPMO || isPM);
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
    </>
  );
}

// Export only as named export for consistency and better tree-shaking
