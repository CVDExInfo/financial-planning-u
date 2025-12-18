import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { getProjects } from "@/lib/api";
import { toast } from "sonner";

type BaselineStatus = "pending" | "handed_off" | "accepted" | "rejected";

interface ProjectWithBaseline {
  id: string;
  name: string;
  client?: string | null;
  baseline_id?: string;
  baseline_status?: BaselineStatus | null;
  accepted_by?: string | null;
  baseline_accepted_at?: string;
  rejected_by?: string | null;
  baseline_rejected_at?: string;
  rejection_comment?: string;
}

export function PMOBaselinesQueuePage() {
  const navigate = useNavigate();
  const [selectedStatus, setSelectedStatus] = useState<"all" | BaselineStatus>("all");

  const { data: projects, isLoading, error } = useQuery({
    queryKey: ["projects", "with-baselines"],
    queryFn: async () => {
      const result = await getProjects();
      // Filter to only projects with baselines
      return result.filter((p) => p.baseline_id) as ProjectWithBaseline[];
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const getStatusBadge = (status?: BaselineStatus | null) => {
    if (!status) return null;
    
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
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const filteredProjects = projects?.filter((p) => {
    if (selectedStatus === "all") return true;
    return p.baseline_status === selectedStatus;
  });

  const statusCounts = {
    all: projects?.length || 0,
    pending: projects?.filter((p) => p.baseline_status === "pending" || p.baseline_status === "handed_off").length || 0,
    accepted: projects?.filter((p) => p.baseline_status === "accepted").length || 0,
    rejected: projects?.filter((p) => p.baseline_status === "rejected").length || 0,
  };

  if (error) {
    toast.error("Failed to load baselines");
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Baseline Visibility Queue</h1>
          <p className="text-muted-foreground mt-1">
            Track baseline submission and acceptance status
          </p>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <Button
              variant={selectedStatus === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedStatus("all")}
            >
              All ({statusCounts.all})
            </Button>
            <Button
              variant={selectedStatus === "pending" || selectedStatus === "handed_off" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedStatus("handed_off")}
            >
              <Clock className="mr-2 h-4 w-4" />
              Pending ({statusCounts.pending})
            </Button>
            <Button
              variant={selectedStatus === "accepted" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedStatus("accepted")}
              className={selectedStatus === "accepted" ? "bg-green-600 hover:bg-green-700" : ""}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Accepted ({statusCounts.accepted})
            </Button>
            <Button
              variant={selectedStatus === "rejected" ? "destructive" : "outline"}
              size="sm"
              onClick={() => setSelectedStatus("rejected")}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Rejected ({statusCounts.rejected})
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Baselines Table */}
      <Card>
        <CardHeader>
          <CardTitle>Project Baselines</CardTitle>
          <CardDescription>
            View baseline acceptance and rejection status for all projects
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredProjects && filteredProjects.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Baseline ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Accepted/Rejected By</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProjects.map((project) => (
                    <TableRow key={project.id}>
                      <TableCell className="font-medium">{project.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {project.client || "—"}
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {project.baseline_id}
                        </code>
                      </TableCell>
                      <TableCell>{getStatusBadge(project.baseline_status)}</TableCell>
                      <TableCell className="text-sm">
                        {project.baseline_status === "accepted" && project.accepted_by && (
                          <span className="text-green-700 dark:text-green-400">
                            {project.accepted_by}
                          </span>
                        )}
                        {project.baseline_status === "rejected" && project.rejected_by && (
                          <span className="text-red-700 dark:text-red-400">
                            {project.rejected_by}
                          </span>
                        )}
                        {(project.baseline_status === "pending" || project.baseline_status === "handed_off") && (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {project.baseline_status === "accepted"
                          ? formatDate(project.baseline_accepted_at)
                          : project.baseline_status === "rejected"
                            ? formatDate(project.baseline_rejected_at)
                            : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {project.baseline_status === "rejected" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/pmo/prefactura/estimator?project=${project.id}`)}
                            >
                              Revisar y reenviar
                              <ExternalLink className="ml-2 h-3 w-3" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/pmo/projects/${project.id}`)}
                          >
                            View Details
                            <ExternalLink className="ml-2 h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <AlertCircle className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>No baselines found with the selected filter</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rejection Comments Section - show if any rejected baselines */}
      {filteredProjects?.some((p) => p.baseline_status === "rejected" && p.rejection_comment) && (
        <Card>
          <CardHeader>
            <CardTitle>Rejection Comments</CardTitle>
            <CardDescription>
              Feedback from SDMT on rejected baselines
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {filteredProjects
              .filter((p) => p.baseline_status === "rejected" && p.rejection_comment)
              .map((project) => (
                <Card key={project.id} className="border-l-4 border-l-red-600">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{project.name}</CardTitle>
                      <Badge variant="destructive" className="gap-1.5">
                        <XCircle size={14} />
                        Rejected
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      <strong>Rejected by:</strong> {project.rejected_by || "Unknown"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <strong>Date:</strong> {formatDate(project.baseline_rejected_at)}
                    </p>
                    <div className="mt-3 p-3 bg-muted rounded-md">
                      <p className="text-sm font-medium mb-1">Reason:</p>
                      <p className="text-sm">{project.rejection_comment}</p>
                    </div>
                    <div className="pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/pmo/prefactura/estimator?project=${project.id}`)}
                      >
                        Revisar y reenviar
                        <ExternalLink className="ml-2 h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default PMOBaselinesQueuePage;
