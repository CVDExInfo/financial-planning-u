import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GitCommit, Plus, Eye, Paperclip } from "@phosphor-icons/react";
import { useProject } from "@/contexts/ProjectContext";
import {
  uploadDocument,
  type DocumentUploadMeta,
  type DocumentUploadStage,
} from "@/lib/documents/uploadService";
import { FinanzasApiError } from "@/api/finanzas";
import { toast } from "sonner";

type ChangeRequest = {
  id: string;
  title: string;
  description: string;
  impact: string;
  status: "approved" | "pending" | "implemented";
  requested_by: string;
  requested_date: string;
  approved_by?: string;
  approved_date?: string;
  implemented_date?: string;
};

const uploadStageText: Record<DocumentUploadStage, string> = {
  presigning: "Requesting secure upload slot…",
  uploading: "Uploading to S3…",
  complete: "Finalizing upload…",
};

export function ChangeManager() {
  const { selectedProjectId } = useProject();
  const [changeDocuments, setChangeDocuments] = useState<
    Record<string, DocumentUploadMeta[]>
  >({});
  const [attachmentDialogOpen, setAttachmentDialogOpen] = useState(false);
  const [attachmentTarget, setAttachmentTarget] =
    useState<ChangeRequest | null>(null);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [attachmentStage, setAttachmentStage] =
    useState<DocumentUploadStage | null>(null);

  const changes: ChangeRequest[] = [
    {
      id: "CHG-001",
      title: "Additional Senior Developer - Q2 Extension",
      description:
        "Add 1 Senior Developer for additional 3 months to handle integration complexity",
      impact: "+$25,500",
      status: "approved",
      requested_by: "john.doe@ikusi.com",
      requested_date: "2024-01-20",
      approved_by: "jane.smith@ikusi.com",
      approved_date: "2024-01-22",
    },
    {
      id: "CHG-002",
      title: "Cloud Infrastructure Upgrade",
      description: "Upgrade to enterprise tier for performance requirements",
      impact: "+$8,400",
      status: "pending",
      requested_by: "carlos.rivera@ikusi.com",
      requested_date: "2024-01-25",
    },
    {
      id: "CHG-003",
      title: "Software License Cost Reduction",
      description: "Negotiated volume discount on development tools",
      impact: "-$3,600",
      status: "implemented",
      requested_by: "maria.gonzalez@ikusi.com",
      requested_date: "2024-01-18",
      approved_by: "jane.smith@ikusi.com",
      approved_date: "2024-01-19",
      implemented_date: "2024-01-24",
    },
  ];

  const openAttachmentDialog = (change: ChangeRequest) => {
    setAttachmentTarget(change);
    setAttachmentFile(null);
    setAttachmentStage(null);
    setAttachmentDialogOpen(true);
  };

  const handleAttachmentUpload = async () => {
    if (!attachmentTarget || !attachmentFile) {
      toast.error("Select a change and file before uploading");
      return;
    }

    if (!selectedProjectId) {
      toast.error("Select a project before uploading attachments");
      return;
    }

    try {
      setIsUploadingAttachment(true);
      setAttachmentStage("presigning");
      const uploaded = await uploadDocument(
        {
          projectId: selectedProjectId,
          module: "changes",
          lineItemId: attachmentTarget.id,
          file: attachmentFile,
        },
        {
          onStageChange: (stage) => setAttachmentStage(stage),
        }
      );

      setChangeDocuments((prev) => {
        const existing = prev[attachmentTarget.id] ?? [];
        return {
          ...prev,
          [attachmentTarget.id]: [uploaded, ...existing],
        };
      });

      if (uploaded.warnings?.length) {
        console.warn("Change attachment upload returned warnings", {
          changeId: attachmentTarget.id,
          warnings: uploaded.warnings,
        });
      }

      if (!uploaded.status || uploaded.status === 201 || uploaded.status === 200) {
        toast.success("Change evidence uploaded");
      }
      setAttachmentDialogOpen(false);
      setAttachmentFile(null);
    } catch (error) {
      let message = "Failed to upload attachment";

      if (error instanceof FinanzasApiError) {
        if (error.status === 503) {
          message =
            "Document uploads are temporarily unavailable. Please try again later.";
        } else if (error.status && error.status >= 500) {
          message = "Error interno en Finanzas";
        } else {
          message = error.message || message;
        }
      } else if (error instanceof Error) {
        message = error.message;
      }

      toast.error(message);
      console.error("Change attachment upload failed", {
        changeId: attachmentTarget?.id,
        projectId: selectedProjectId,
        error,
      });
    } finally {
      setIsUploadingAttachment(false);
      setAttachmentStage(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <GitCommit size={32} className="text-sdmt" />
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Change Manager
              </h1>
              <p className="text-muted-foreground mt-1">
                Track and approve budget change requests with full audit trail
              </p>
            </div>
          </div>

          <Button className="flex items-center space-x-2">
            <Plus size={16} />
            <span>New Change Request</span>
          </Button>
        </div>
      </div>

      {/* Change Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="glass-card">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-accent">3</div>
            <p className="text-muted-foreground text-sm">Total Changes</p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">1</div>
            <p className="text-muted-foreground text-sm">Approved</p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-secondary">1</div>
            <p className="text-muted-foreground text-sm">Pending</p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">+$30.3K</div>
            <p className="text-muted-foreground text-sm">Net Impact</p>
          </CardContent>
        </Card>
      </div>

      {/* Change Requests */}
      <div className="space-y-6">
        {changes.map((change) => (
          <Card key={change.id} className="glass-card">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-3">
                    <span className="font-mono text-sm text-muted-foreground bg-muted px-2 py-1 rounded">
                      {change.id}
                    </span>
                    <Badge
                      variant={
                        change.status === "approved"
                          ? "default"
                          : change.status === "pending"
                          ? "secondary"
                          : change.status === "implemented"
                          ? "default"
                          : "outline"
                      }
                    >
                      {change.status.toUpperCase()}
                    </Badge>
                    <span
                      className={`font-semibold ${
                        change.impact.startsWith("+")
                          ? "text-destructive"
                          : "text-primary"
                      }`}
                    >
                      {change.impact}
                    </span>
                  </div>

                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {change.title}
                  </h3>

                  <p className="text-muted-foreground mb-4">
                    {change.description}
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">
                        Requested by:
                      </span>
                      <div className="font-medium">{change.requested_by}</div>
                      <div className="text-muted-foreground text-xs">
                        {change.requested_date}
                      </div>
                    </div>

                    {change.approved_by && (
                      <div>
                        <span className="text-muted-foreground">
                          Approved by:
                        </span>
                        <div className="font-medium">{change.approved_by}</div>
                        <div className="text-muted-foreground text-xs">
                          {change.approved_date}
                        </div>
                      </div>
                    )}

                    {change.implemented_date && (
                      <div>
                        <span className="text-muted-foreground">
                          Implemented:
                        </span>
                        <div className="font-medium">
                          {change.implemented_date}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex space-x-2 ml-4">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex items-center space-x-2"
                    onClick={() => openAttachmentDialog(change)}
                  >
                    <Paperclip size={14} />
                    <span>Attach Evidence</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex items-center space-x-2"
                  >
                    <Eye size={14} />
                    <span>Details</span>
                  </Button>
                  {change.status === "pending" && (
                    <>
                      <Button size="sm">Approve</Button>
                      <Button size="sm" variant="outline">
                        Reject
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {changeDocuments[change.id]?.length ? (
                <div className="mt-4 border-t border-dashed border-muted pt-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Evidence
                  </p>
                  <div className="space-y-1">
                    {changeDocuments[change.id].map((doc) => (
                      <div
                        key={`${doc.documentKey}-${doc.uploadedAt}`}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="truncate pr-2">
                          {doc.originalName}
                        </span>
                        <span className="text-muted-foreground whitespace-nowrap">
                          {new Date(doc.uploadedAt).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog
        open={attachmentDialogOpen}
        onOpenChange={(open) => {
          setAttachmentDialogOpen(open);
          if (!open) {
            setAttachmentFile(null);
            setAttachmentStage(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Attach Change Evidence</DialogTitle>
            <DialogDescription>
              Upload supporting documents for PMO change control. Files are
              stored in the shared docs bucket with the "changes" module tag.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              {attachmentTarget
                ? `${attachmentTarget.id} · ${attachmentTarget.title}`
                : "Select a change"}
            </div>
            <Input
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg"
              disabled={isUploadingAttachment}
              onChange={(event) =>
                setAttachmentFile(event.target.files?.[0] ?? null)
              }
            />
            <p className="text-xs text-muted-foreground">
              Evidence uploads reuse the `/uploads/docs` presign flow used
              elsewhere in PMO.
            </p>
            {isUploadingAttachment && attachmentStage && (
              <p className="text-xs text-primary">
                {uploadStageText[attachmentStage]}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAttachmentDialogOpen(false)}
              disabled={isUploadingAttachment}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleAttachmentUpload}
              disabled={!attachmentFile || isUploadingAttachment}
            >
              {isUploadingAttachment ? "Uploading..." : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Audit Trail */}
      <Card className="glass-card mt-8">
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              {
                action: "CHG-001 approved by Jane Smith",
                time: "2 days ago",
                type: "approval",
              },
              {
                action: "CHG-002 created by Carlos Rivera",
                time: "3 days ago",
                type: "creation",
              },
              {
                action: "CHG-003 implemented",
                time: "4 days ago",
                type: "implementation",
              },
            ].map((activity, index) => (
              <div key={index} className="flex items-center space-x-3 text-sm">
                <div
                  className={`w-2 h-2 rounded-full ${
                    activity.type === "approval"
                      ? "bg-primary"
                      : activity.type === "creation"
                      ? "bg-accent"
                      : "bg-secondary"
                  }`}
                ></div>
                <span className="flex-1">{activity.action}</span>
                <span className="text-muted-foreground">{activity.time}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
