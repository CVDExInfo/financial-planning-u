import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Clock, CheckCircle2, XCircle, AlertCircle, Eye, Loader2 } from "lucide-react";
import ModuleBadge from "@/components/ModuleBadge";
import { useProject } from "@/contexts/ProjectContext";
import ApiService from "@/lib/api";
import { handleFinanzasApiError } from "@/features/sdmt/cost/utils/errorHandling";
import { useAuth } from "@/hooks/useAuth";
import type { ChangeRequest as DomainChangeRequest } from "@/types/domain";
import { toast } from "sonner";

const defaultForm = {
  title: "",
  description: "",
  impact_amount: "",
  currency: "USD",
  baseline_id: "",
  justification: "",
  affected_line_items: "",
};

type ChangeRequestForm = typeof defaultForm;

type ChangeStatus = DomainChangeRequest["status"];

const currencyOptions = ["USD", "EUR", "MXN", "COP"] as const;

const statusIcon = (status: ChangeStatus) => {
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

const statusTone = (status: ChangeStatus) => {
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

export function SDMTChanges() {
  const { selectedProjectId, currentProject } = useProject();
  const { login } = useAuth();
  const [changeRequests, setChangeRequests] = useState<DomainChangeRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedChange, setSelectedChange] = useState<DomainChangeRequest | null>(null);
  const [form, setForm] = useState<ChangeRequestForm>(defaultForm);
  const [submitting, setSubmitting] = useState(false);

  const loadChangeRequests = useCallback(async (projectId: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await ApiService.getChangeRequests(projectId);
      setChangeRequests(data);
    } catch (err) {
      const message = handleFinanzasApiError(err, {
        onAuthError: () => login(),
        fallback: "No pudimos cargar los cambios.",
      });
      setError(message);
      setChangeRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedProjectId) {
      setChangeRequests([]);
      setError(null);
      setLoading(false);
      return;
    }
    void loadChangeRequests(selectedProjectId);
  }, [selectedProjectId, loadChangeRequests]);

  useEffect(() => {
    if (currentProject?.currency) {
      setForm((prev) => ({ ...prev, currency: currentProject.currency }));
    }
  }, [currentProject?.currency]);

  const onSubmit = async () => {
    if (!selectedProjectId) {
      toast.error("Selecciona un proyecto antes de crear un cambio.");
      return;
    }

    const impact = Number(form.impact_amount);
    if (!form.title.trim() || !form.description.trim() || Number.isNaN(impact)) {
      setError("Título, descripción e impacto son obligatorios.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await ApiService.createChangeRequest(selectedProjectId, {
        baseline_id: form.baseline_id,
        title: form.title.trim(),
        description: form.description.trim(),
        impact_amount: impact,
        currency: form.currency || "USD",
        justification: form.justification.trim(),
        affected_line_items: form.affected_line_items
          .split(/[,\n]/)
          .map((entry) => entry.trim())
          .filter(Boolean),
        requested_by: "",
        requested_at: "",
        status: "pending",
        approvals: [],
      });

      setForm(defaultForm);
      setCreateOpen(false);
      toast.success("Cambio creado correctamente");
      await loadChangeRequests(selectedProjectId);
    } catch (err) {
      const message = handleFinanzasApiError(err, {
        onAuthError: () => login(),
        fallback: "Error interno en Finanzas. Intenta nuevamente más tarde.",
      });
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const pendingCount = useMemo(
    () => changeRequests.filter((c) => c.status === "pending").length,
    [changeRequests],
  );
  const approvedCount = useMemo(
    () => changeRequests.filter((c) => c.status === "approved").length,
    [changeRequests],
  );
  const rejectedCount = useMemo(
    () => changeRequests.filter((c) => c.status === "rejected").length,
    [changeRequests],
  );
  const totalImpact = useMemo(
    () =>
      changeRequests
        .filter((c) => c.status === "approved")
        .reduce((sum, c) => sum + Number(c.impact_amount || 0), 0),
    [changeRequests],
  );

  if (!selectedProjectId) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Change Management</h1>
            <p className="text-muted-foreground">
              Selecciona un proyecto para ver y crear solicitudes de cambio.
            </p>
          </div>
          <ModuleBadge />
        </div>
        <Alert>
          <AlertDescription>
            No hay proyecto seleccionado. Usa la barra superior para elegir uno.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

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
            <div className="text-2xl font-bold text-amber-600">{pendingCount}</div>
            <p className="text-sm text-muted-foreground">Pending Approval</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <CheckCircle2 className="mx-auto mb-2 text-green-500" size={32} />
            <div className="text-2xl font-bold text-green-600">{approvedCount}</div>
            <p className="text-sm text-muted-foreground">Approved</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <XCircle className="mx-auto mb-2 text-red-500" size={32} />
            <div className="text-2xl font-bold text-red-600">{rejectedCount}</div>
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
        <Button className="gap-2" onClick={() => setCreateOpen(true)}>
          <Plus size={16} />
          New Change Request
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Request ID</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Impact</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Requested By</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading change requests...
                    </div>
                  </TableCell>
                </TableRow>
              ) : changeRequests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                    No change requests yet.
                  </TableCell>
                </TableRow>
              ) : (
                changeRequests.map((change) => (
                  <TableRow key={change.id}>
                    <TableCell className="font-mono">{change.id}</TableCell>
                    <TableCell className="font-medium">{change.title}</TableCell>
                    <TableCell>
                      <span
                        className={
                          Number(change.impact_amount) > 0 ? "text-red-600" : "text-green-600"
                        }
                      >
                        {Number(change.impact_amount) > 0 ? "+" : ""}$
                        {Number(change.impact_amount || 0).toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div
                        className={`inline-flex items-center gap-2 px-2 py-1 rounded-full text-xs font-medium ${statusTone(
                          change.status,
                        )}`}
                      >
                        {statusIcon(change.status)}
                        {change.status.charAt(0).toUpperCase() + change.status.slice(1)}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {change.requested_by || "-"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {change.requested_at
                        ? new Date(change.requested_at).toLocaleDateString()
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedChange(change)}
                      >
                        <Eye size={14} className="mr-1" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create change request</DialogTitle>
            <DialogDescription>Provide the details for this change.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="baseline">Baseline ID (optional)</Label>
                <Input
                  id="baseline"
                  value={form.baseline_id}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, baseline_id: e.target.value }))
                  }
                />
              </div>
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, description: e.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="impact">Impact amount</Label>
                <Input
                  id="impact"
                  type="number"
                  value={form.impact_amount}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, impact_amount: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="currency">Currency</Label>
                <Select
                  value={form.currency}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, currency: value }))
                  }
                >
                  <SelectTrigger id="currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currencyOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="justification">Justification</Label>
                <Input
                  id="justification"
                  value={form.justification}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, justification: e.target.value }))
                  }
                />
              </div>
            </div>
            <div>
              <Label htmlFor="line-items">Affected line items (comma separated)</Label>
              <Input
                id="line-items"
                value={form.affected_line_items}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, affected_line_items: e.target.value }))
                }
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button onClick={onSubmit} disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedChange} onOpenChange={(open) => !open && setSelectedChange(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Change request details</DialogTitle>
            <DialogDescription>{selectedChange?.id}</DialogDescription>
          </DialogHeader>
          {selectedChange && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold">{selectedChange.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedChange.description}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Impact</p>
                  <p
                    className={`font-semibold ${
                      Number(selectedChange.impact_amount) > 0
                        ? "text-red-600"
                        : "text-green-600"
                    }`}
                  >
                    {Number(selectedChange.impact_amount) > 0 ? "+" : ""}$
                    {Number(selectedChange.impact_amount || 0).toLocaleString()} {selectedChange.currency}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <div
                    className={`inline-flex items-center gap-2 px-2 py-1 rounded-full text-xs font-medium ${statusTone(
                      selectedChange.status,
                    )}`}
                  >
                    {statusIcon(selectedChange.status)}
                    {selectedChange.status}
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground">Requested by</p>
                  <p className="font-semibold">{selectedChange.requested_by || "N/A"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Requested at</p>
                  <p className="font-semibold">
                    {selectedChange.requested_at
                      ? new Date(selectedChange.requested_at).toLocaleString()
                      : "N/A"}
                  </p>
                </div>
              </div>
              {selectedChange.justification && (
                <div>
                  <p className="text-muted-foreground text-sm">Justification</p>
                  <p className="text-sm">{selectedChange.justification}</p>
                </div>
              )}
              {selectedChange.affected_line_items?.length > 0 && (
                <div>
                  <p className="text-muted-foreground text-sm">Affected line items</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {selectedChange.affected_line_items.map((item) => (
                      <Badge key={item} variant="outline">
                        {item}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SDMTChanges;
