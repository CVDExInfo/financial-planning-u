import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Eye,
} from "lucide-react";
import ModuleBadge from "@/components/ModuleBadge";
import ApprovalWorkflow from "./ApprovalWorkflow";
import { useProject } from "@/contexts/ProjectContext";
import ApiService from "@/lib/api";
import type { ChangeRequest as DomainChangeRequest } from "@/types/domain";

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

export function SDMTChanges() {
  const { selectedProjectId, currentProject, projectChangeCount } =
    useProject();
  const [changeRequests, setChangeRequests] = useState<DomainChangeRequest[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [selectedChange, setSelectedChange] = useState<ChangeRequest | null>(
    null
  );
  const [isWorkflowDialogOpen, setIsWorkflowDialogOpen] = useState(false);

  // Load data when project changes
  useEffect(() => {
    if (selectedProjectId) {
      console.log(
        "📋 Changes: Loading data for project:",
        selectedProjectId,
        "change count:",
        projectChangeCount
      );
      loadChangeRequests();
    }
  }, [selectedProjectId, projectChangeCount]);

  const loadChangeRequests = async () => {
    try {
      setLoading(true);
      const data = await ApiService.getChangeRequests(selectedProjectId);
      setChangeRequests(data);
      console.log("✅ Change requests loaded for project:", selectedProjectId);
    } catch (error) {
      console.error("Failed to load change requests:", error);
      // Fallback to mock data - convert to domain type
      const mockData: DomainChangeRequest[] = mockChanges.map((change) => ({
        id: change.id,
        baseline_id: "BL-2024-001",
        title: change.title,
        description: change.description,
        impact_amount: change.impact,
        currency: "USD",
        affected_line_items: change.affectedLineItems,
        justification: change.businessJustification,
        requested_by: change.requestedBy,
        requested_at: change.requestedAt,
        status: change.status,
        approvals: [],
      }));
      setChangeRequests(mockData);
    } finally {
      setLoading(false);
    }
  };

  const mockChanges: ChangeRequest[] = [
    {
      id: "CHG-2024-001",
      title: "Additional Senior Developer",
      description:
        "Add one additional senior developer for Q2 to meet accelerated delivery timeline",
      businessJustification:
        "Client has requested delivery 2 months ahead of schedule. Current team capacity analysis shows we need one additional senior developer to meet the new deadline without compromising quality.",
      impact: 25500,
      status: "pending",
      requestedBy: "project-manager@ikusi.com",
      requestedAt: "2024-02-15T11:00:00Z",
      currentStep: 0,
      affectedLineItems: ["Labor - Senior Developer", "Q2 Delivery Milestone"],
      approvalSteps: [
        {
          id: "step-1",
          role: "Project Manager",
          approverName: "Maria Rodriguez",
          status: "approved",
          comments:
            "Approved based on client requirements and timeline analysis. Budget impact is justified by accelerated delivery premium.",
          decidedAt: "2024-02-15T14:30:00Z",
          required: true,
        },
        {
          id: "step-2",
          role: "Financial Controller",
          status: "pending",
          required: true,
        },
        {
          id: "step-3",
          role: "Executive Sponsor",
          status: "pending",
          required: false,
        },
      ],
    },
    {
      id: "CHG-2024-002",
      title: "AWS Infrastructure Upgrade",
      description:
        "Upgrade to higher-tier instances for performance optimization",
      businessJustification:
        "Current infrastructure is hitting CPU and memory limits during peak usage. Upgrade will prevent performance degradation and ensure SLA compliance.",
      impact: 8000,
      status: "approved",
      requestedBy: "tech-lead@ikusi.com",
      requestedAt: "2024-02-10T14:30:00Z",
      currentStep: 2,
      affectedLineItems: ["AWS EC2 Instances", "Infrastructure Costs"],
      approvalSteps: [
        {
          id: "step-1",
          role: "Technical Lead",
          approverName: "Carlos Silva",
          status: "approved",
          comments:
            "Performance metrics support the need for upgrade. Cost is within acceptable range.",
          decidedAt: "2024-02-10T16:15:00Z",
          required: true,
        },
        {
          id: "step-2",
          role: "Financial Controller",
          approverName: "Ana Martinez",
          status: "approved",
          comments:
            "Approved. Infrastructure costs are within operational budget variance.",
          decidedAt: "2024-02-11T09:22:00Z",
          required: true,
        },
      ],
    },
    {
      id: "CHG-2024-003",
      title: "Third-party License Renewal",
      description:
        "Early renewal of analytics platform license to secure better pricing",
      businessJustification:
        "Vendor offered 15% discount for early renewal. Current license expires in 6 months, early renewal saves $3,000 annually.",
      impact: -3000,
      status: "approved",
      requestedBy: "procurement@ikusi.com",
      requestedAt: "2024-02-08T10:00:00Z",
      currentStep: 1,
      affectedLineItems: ["Software Licenses", "Analytics Platform"],
      approvalSteps: [
        {
          id: "step-1",
          role: "Procurement Manager",
          approverName: "Luis Herrera",
          status: "approved",
          comments:
            "Excellent opportunity for cost savings. Vendor pricing verified and within market rates.",
          decidedAt: "2024-02-08T11:45:00Z",
          required: true,
        },
      ],
    },
  ];

  const handleApprovalAction = (
    requestId: string,
    action: "approve" | "reject",
    comments: string
  ) => {
    // In a real app, this would make an API call
    console.log(
      `✅ Change Management: ${action} request ${requestId} with comments: ${comments}`
    );

    // Update local state to reflect the change (in real app, refetch data)
    setSelectedChange((prevChange) => {
      if (!prevChange || prevChange.id !== requestId) return prevChange;

      const updatedSteps = [...prevChange.approvalSteps];
      const currentStep = updatedSteps[prevChange.currentStep];

      if (currentStep) {
        currentStep.status = action === "approve" ? "approved" : "rejected";
        currentStep.comments = comments;
        currentStep.decidedAt = new Date().toISOString();
        currentStep.approverName = "Current User"; // In real app, use actual user
      }

      return {
        ...prevChange,
        approvalSteps: updatedSteps,
        currentStep:
          action === "approve"
            ? prevChange.currentStep + 1
            : prevChange.currentStep,
        status:
          action === "reject"
            ? "rejected"
            : prevChange.currentStep >= prevChange.approvalSteps.length - 1
            ? "approved"
            : "pending",
      };
    });

    // Force dialog refresh by toggling
    setIsWorkflowDialogOpen(false);
    setTimeout(() => setIsWorkflowDialogOpen(true), 100);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="text-amber-500" size={16} />;
      case "approved":
        return <CheckCircle2 className="text-green-500" size={16} />;
      case "rejected":
        return <XCircle className="text-red-500" size={16} />;
      default:
        return <AlertCircle className="text-muted-foreground" size={16} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "text-amber-600 bg-amber-50 dark:bg-amber-950";
      case "approved":
        return "text-green-600 bg-green-50 dark:bg-green-950";
      case "rejected":
        return "text-red-600 bg-red-50 dark:bg-red-950";
      default:
        return "text-muted-foreground bg-muted";
    }
  };

  const pendingCount = changeRequests.filter(
    (c) => c.status === "pending"
  ).length;
  const approvedCount = changeRequests.filter(
    (c) => c.status === "approved"
  ).length;
  const rejectedCount = changeRequests.filter(
    (c) => c.status === "rejected"
  ).length;
  const totalImpact = changeRequests
    .filter((c) => c.status === "approved")
    .reduce((sum, c) => sum + c.impact_amount, 0);

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Change Management</h1>
          <p className="text-muted-foreground">
            Track budget change requests and approval workflows
            {currentProject && (
              <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                {currentProject.name}
              </span>
            )}
          </p>
        </div>
        <ModuleBadge />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Clock className="mx-auto mb-2 text-amber-500" size={32} />
            <div className="text-2xl font-bold text-amber-600">
              {pendingCount}
            </div>
            <p className="text-sm text-muted-foreground">Pending Approval</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <CheckCircle2 className="mx-auto mb-2 text-green-500" size={32} />
            <div className="text-2xl font-bold text-green-600">
              {approvedCount}
            </div>
            <p className="text-sm text-muted-foreground">Approved</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <XCircle className="mx-auto mb-2 text-red-500" size={32} />
            <div className="text-2xl font-bold text-red-600">
              {rejectedCount}
            </div>
            <p className="text-sm text-muted-foreground">Rejected</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div
              className={`text-2xl font-bold ${
                totalImpact >= 0 ? "text-red-600" : "text-green-600"
              }`}
            >
              {totalImpact >= 0 ? "+" : ""}${totalImpact.toLocaleString()}
            </div>
            <p className="text-sm text-muted-foreground">Net Budget Impact</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Change Requests</h2>
        <Button className="gap-2">
          <Plus size={16} />
          New Change Request
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Request ID</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Impact</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Requested By</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockChanges.map((change) => (
                <TableRow key={change.id}>
                  <TableCell className="font-mono">{change.id}</TableCell>
                  <TableCell className="font-medium">{change.title}</TableCell>
                  <TableCell className="max-w-[300px]">
                    <div className="truncate">{change.description}</div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={
                        change.impact > 0 ? "text-red-600" : "text-green-600"
                      }
                    >
                      {change.impact > 0 ? "+" : ""}$
                      {change.impact.toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div
                      className={`inline-flex items-center gap-2 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                        change.status
                      )}`}
                    >
                      {getStatusIcon(change.status)}
                      {change.status.charAt(0).toUpperCase() +
                        change.status.slice(1)}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {change.requestedBy.split("@")[0]}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(change.requestedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        console.log(
                          "👁️ Viewing workflow for change:",
                          change.id
                        );
                        setSelectedChange(change as ChangeRequest);
                        setIsWorkflowDialogOpen(true);
                      }}
                    >
                      <Eye size={14} className="mr-1" />
                      View Workflow
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Workflow Dialog - Moved outside map loop */}
      <Dialog
        open={isWorkflowDialogOpen}
        onOpenChange={setIsWorkflowDialogOpen}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Change Request Approval Workflow</DialogTitle>
            <DialogDescription>
              Review the approval steps, comments, and status history for the
              selected change before taking action.
            </DialogDescription>
          </DialogHeader>
          {selectedChange && (
            <ApprovalWorkflow
              changeRequest={selectedChange}
              onApprovalAction={handleApprovalAction}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SDMTChanges;
