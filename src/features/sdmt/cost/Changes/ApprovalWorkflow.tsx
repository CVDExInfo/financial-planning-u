import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2,
  XCircle,
  Clock,
  User,
  MessageSquare,
  ArrowRight,
  FileText,
  Eye,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface ChangeRequest {
  id: string;
  title: string;
  description: string;
  impact: number;
  status: "pending" | "approved" | "rejected";
  requestedBy: string;
  requestedAt: string;
  approvalSteps: ApprovalStep[];
  currentStep: number;
  businessJustification: string;
  affectedLineItems: string[];
  // Time distribution fields - using snake_case to match domain type
  start_month_index?: number;
  duration_months?: number;
  allocation_mode?: "one_time" | "spread_evenly";
  // New line item request
  new_line_item_request?: {
    name: string;
    type: string;
    description: string;
  };
}

interface ApprovalStep {
  id: string;
  role: string;
  approverName?: string;
  status: "pending" | "approved" | "rejected";
  comments?: string;
  decidedAt?: string;
  required: boolean;
}

interface ApprovalWorkflowProps {
  changeRequest: ChangeRequest;
  onApprovalAction: (
    requestId: string,
    action: "approve" | "reject",
    comments: string
  ) => Promise<void>;
  canApprove?: boolean;
  isSubmitting?: boolean;
  prefillAction?: "approve" | "reject" | null;
  onCloseActionDialog?: () => void;
}

export function ApprovalWorkflow({
  changeRequest,
  onApprovalAction,
  canApprove = false,
  isSubmitting = false,
  prefillAction,
  onCloseActionDialog,
}: ApprovalWorkflowProps) {
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(
    null
  );
  const [comments, setComments] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const isPending = changeRequest.status === "pending";

  const getStepStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle2 className="text-green-500" size={20} />;
      case "rejected":
        return <XCircle className="text-red-500" size={20} />;
      case "pending":
        return <Clock className="text-amber-500" size={20} />;
      default:
        return <Clock className="text-muted-foreground" size={20} />;
    }
  };

  const handleApprovalSubmit = async () => {
    if (!actionType) {
      toast.error("Selecciona una acción para continuar");
      return;
    }

    if (actionType === "reject" && !comments.trim()) {
      toast.error("Agrega un comentario para rechazar la solicitud");
      return;
    }

    try {
      await onApprovalAction(changeRequest.id, actionType, comments);
      setIsDialogOpen(false);
      setComments("");
      setActionType(null);
      if (onCloseActionDialog) onCloseActionDialog();
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo actualizar";
      toast.error(message);
    }
  };

  const canCurrentUserApprove = useCallback(
    () => canApprove && isPending,
    [canApprove, isPending],
  );

  const openActionDialog = useCallback((action: "approve" | "reject") => {
    setActionType(action);
    setIsDialogOpen(true);
  }, []);

  useEffect(() => {
    if (prefillAction && canCurrentUserApprove()) {
      openActionDialog(prefillAction);
    }
  }, [canCurrentUserApprove, openActionDialog, prefillAction]);

  const handleDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setComments("");
      setActionType(null);
      if (onCloseActionDialog) onCloseActionDialog();
    }
  };

  return (
    <div className="space-y-6">
      {/* Change Request Details */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText size={20} />
                {changeRequest.title}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {changeRequest.id}
              </p>
            </div>
            <Badge
              variant={
                changeRequest.status === "approved"
                  ? "default"
                  : changeRequest.status === "rejected"
                  ? "destructive"
                  : "secondary"
              }
            >
              {changeRequest.status.toUpperCase()}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Description</Label>
            <p className="text-sm text-muted-foreground mt-1">
              {changeRequest.description}
            </p>
          </div>

          <div>
            <Label className="text-sm font-medium">
              Business Justification
            </Label>
            <p className="text-sm text-muted-foreground mt-1">
              {changeRequest.businessJustification}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">Financial Impact</Label>
              <p
                className={`text-lg font-semibold mt-1 ${
                  changeRequest.impact > 0 ? "text-red-600" : "text-green-600"
                }`}
              >
                {changeRequest.impact > 0 ? "+" : ""}$
                {changeRequest.impact.toLocaleString()}
              </p>
            </div>
            <div>
              <Label className="text-sm font-medium">Requested By</Label>
              <p className="text-sm text-muted-foreground mt-1">
                {changeRequest.requestedBy}
              </p>
            </div>
          </div>

          {/* Time Distribution Info */}
          {(changeRequest.start_month_index !== undefined || 
            changeRequest.duration_months !== undefined) && (
            <div className="p-3 bg-muted/50 rounded-md">
              <Label className="text-sm font-medium">Time Distribution</Label>
              <div className="grid grid-cols-3 gap-4 mt-2 text-sm">
                {changeRequest.start_month_index !== undefined && (
                  <div>
                    <span className="text-muted-foreground">Start Month:</span>
                    <span className="ml-2 font-medium">{changeRequest.start_month_index}</span>
                  </div>
                )}
                {changeRequest.duration_months !== undefined && (
                  <div>
                    <span className="text-muted-foreground">Duration:</span>
                    <span className="ml-2 font-medium">
                      {changeRequest.duration_months} month{changeRequest.duration_months !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
                {changeRequest.allocation_mode && (
                  <div>
                    <span className="text-muted-foreground">Mode:</span>
                    <span className="ml-2 font-medium">
                      {changeRequest.allocation_mode === "one_time" ? "One-time" : "Spread evenly"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* New Line Item Request */}
          {changeRequest.new_line_item_request && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md">
              <Label className="text-sm font-medium text-amber-900 dark:text-amber-100">
                New Line Item Request
              </Label>
              <div className="space-y-2 mt-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Name:</span>
                  <span className="ml-2 font-medium">{changeRequest.new_line_item_request.name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Type:</span>
                  <span className="ml-2 font-medium">{changeRequest.new_line_item_request.type}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Description:</span>
                  <p className="mt-1 text-muted-foreground">{changeRequest.new_line_item_request.description}</p>
                </div>
              </div>
            </div>
          )}

          <div>
            <Label className="text-sm font-medium">Affected Line Items</Label>
            <div className="flex flex-wrap gap-1 mt-1">
              {changeRequest.affectedLineItems.map((item, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {item}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Approval Steps */}
      <Card>
        <CardHeader>
          <CardTitle>Approval Workflow</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {changeRequest.approvalSteps.map((step, index) => (
              <div key={step.id} className="flex items-start space-x-4">
                <div className="flex-shrink-0 mt-1">
                  {getStepStatusIcon(step.status)}
                </div>

                <div className="flex-grow min-w-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{step.role}</p>
                      {step.approverName && (
                        <p className="text-xs text-muted-foreground">
                          {step.approverName}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      {step.required && (
                        <Badge variant="outline" className="text-xs">
                          Required
                        </Badge>
                      )}
                      {step.status === "pending" &&
                        index === changeRequest.currentStep && (
                          <Badge variant="secondary" className="text-xs">
                            Current Step
                          </Badge>
                        )}
                    </div>
                  </div>

                  {step.comments && (
                    <div className="mt-2 p-3 bg-muted/50 rounded-md">
                      <div className="flex items-center gap-2 mb-1">
                        <MessageSquare size={14} />
                        <span className="text-xs font-medium">Comments</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {step.comments}
                      </p>
                      {step.decidedAt && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(step.decidedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {index < changeRequest.approvalSteps.length - 1 && (
                  <div className="flex-shrink-0 mt-6">
                    <ArrowRight className="text-muted-foreground" size={16} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          {canCurrentUserApprove() && (
            <div className="mt-6 pt-6 border-t">
              <div className="flex gap-3 flex-wrap">
                <Button
                  onClick={() => openActionDialog("approve")}
                  className="bg-green-600 hover:bg-green-700"
                  disabled={isSubmitting}
                >
                  <CheckCircle2 size={16} className="mr-2" />
                  Approve
                </Button>

                <Button
                  variant="destructive"
                  onClick={() => openActionDialog("reject")}
                  disabled={isSubmitting}
                >
                  <XCircle size={16} className="mr-2" />
                  Reject
                </Button>
              </div>
            </div>
          )}

          {/* Confirmation Dialog - Used by both Approve and Reject */}
          <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {actionType === "approve" ? "Approve" : "Reject"} Change
                  Request
                </DialogTitle>
                <DialogDescription>
                  {actionType === "approve"
                    ? "Confirm your approval and outline any conditions or follow-up actions."
                    : "Provide a clear rationale for the rejection so requestors can adjust the plan."}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="comments" className="text-sm font-medium">
                    Comments
                    {actionType === "reject" && <span className="text-red-500"> *</span>}
                  </Label>
                  <Textarea
                    id="comments"
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    placeholder={
                      actionType === "approve"
                        ? "Provide any additional notes or conditions for approval..."
                        : "Please explain the reason for rejection..."
                    }
                    className="mt-1"
                    rows={4}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleDialogOpenChange(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleApprovalSubmit}
                    variant={
                      actionType === "approve" ? "default" : "destructive"
                    }
                    disabled={isSubmitting}
                  >
                    {isSubmitting && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    Confirm {actionType === "approve" ? "Approval" : "Rejection"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}

export default ApprovalWorkflow;
