import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
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
import {
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Eye,
  Loader2,
  ChevronsUpDown,
  Check,
} from "lucide-react";
import ModuleBadge from "@/components/ModuleBadge";
import { useProject } from "@/contexts/ProjectContext";
import ApiService from "@/lib/api";
import { handleFinanzasApiError } from "@/features/sdmt/cost/utils/errorHandling";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import type { ChangeRequest as DomainChangeRequest } from "@/types/domain";
import { toast } from "sonner";
import { ES_TEXTS } from "@/lib/i18n/es";
import ApprovalWorkflow from "./ApprovalWorkflow";
import { useProjectLineItems } from "@/hooks/useProjectLineItems";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { FinanzasApiError } from "@/api/finanzas";
import { BaselineStatusPanel } from "@/components/baseline/BaselineStatusPanel";

const defaultForm = {
  title: "",
  description: "",
  impact_amount: "",
  currency: "USD",
  baseline_id: "",
  justification: "",
  affected_line_items: [] as string[],
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

const formatRubroLabel = (item?: { category?: string; subtype?: string; description?: string }, fallbackId?: string) => {
  if (!item) return fallbackId || "Rubro";
  const category = item.category?.trim();
  const subtype = item.subtype?.trim();
  const description = item.description?.trim() || fallbackId || "Rubro";
  const categoryLabel = subtype
    ? `${category ?? "General"} / ${subtype}`
    : category ?? "General";
  return `Rubro — ${categoryLabel} — ${description}`;
};

export function SDMTChanges() {
  const { selectedProjectId, currentProject } = useProject();
  const { login } = useAuth();
  const { canApprove } = usePermissions();
  const [changeRequests, setChangeRequests] = useState<DomainChangeRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedChange, setSelectedChange] = useState<DomainChangeRequest | null>(null);
  const [workflowChange, setWorkflowChange] = useState<DomainChangeRequest | null>(null);
  const [isWorkflowDialogOpen, setIsWorkflowDialogOpen] = useState(false);
  const [form, setForm] = useState<ChangeRequestForm>(defaultForm);
  const [selectedLineItemIds, setSelectedLineItemIds] = useState<string[]>([]);
  const [lineItemSelectorOpen, setLineItemSelectorOpen] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [pendingWorkflowAction, setPendingWorkflowAction] = useState<
    "approve" | "reject" | null
  >(null);

  const resolveChangeError = useCallback(
    (err: unknown, fallback: string) => {
      if (err instanceof FinanzasApiError) {
        if (err.status && err.status >= 400 && err.status < 500) {
          return err.message || fallback;
        }
        if (err.status === 503) {
          return "Servicio de cambios temporalmente no disponible. Por favor intenta más tarde.";
        }
        if (err.status && err.status >= 500) {
          return "Error interno en Finanzas.";
        }
      }

      return handleFinanzasApiError(err, {
        onAuthError: () => login(),
        fallback,
      });
    },
    [login],
  );

  const {
    lineItems,
    isLoading: lineItemsLoading,
    error: lineItemsError,
  } = useProjectLineItems();

  const safeLineItems = useMemo(() => (Array.isArray(lineItems) ? lineItems : []), [lineItems]);
  const lineItemOptions = useMemo(
    () =>
      safeLineItems.map((item) => ({
        value: item.id,
        label: formatRubroLabel(item, item.id),
      })),
    [safeLineItems],
  );

  useEffect(() => {
    if (
      import.meta.env.DEV &&
      Array.isArray(lineItems) &&
      lineItemOptions.length < lineItems.length
    ) {
      console.warn(
        "[SDMT] Changes line items appear truncated compared to catalog",
        {
          projectId: selectedProjectId,
          received: lineItems.length,
          visible: lineItemOptions.length,
        },
      );
    }
  }, [lineItemOptions.length, lineItems, selectedProjectId]);

  const lineItemLabelMap = useMemo(
    () => new Map(lineItemOptions.map((option) => [option.value, option.label])),
    [lineItemOptions],
  );

  useEffect(() => {
    setSelectedLineItemIds([]);
    setForm({
      ...defaultForm,
      currency: currentProject?.currency ?? defaultForm.currency,
      baseline_id: currentProject?.baseline_id ?? "",
    });
  }, [selectedProjectId]);

  useEffect(() => {
    if (!currentProject?.baseline_id) return;

    setForm((prev) => {
      if (prev.baseline_id.trim()) return prev;
      return { ...prev, baseline_id: currentProject.baseline_id };
    });
  }, [currentProject?.baseline_id]);

  useEffect(() => {
    if (!currentProject?.currency) return;

    setForm((prev) => {
      if (prev.currency === currentProject.currency) return prev;
      if (prev.currency !== defaultForm.currency) return prev;
      return { ...prev, currency: currentProject.currency };
    });
  }, [currentProject?.currency]);

  const selectedLineItemLabels = useMemo(
    () => selectedLineItemIds.map((id) => lineItemLabelMap.get(id) || id),
    [lineItemLabelMap, selectedLineItemIds],
  );

  const computedFormErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    const impact = Number(form.impact_amount);

    if (!form.title.trim()) errors.title = "El título es obligatorio.";
    if (!form.description.trim()) errors.description = "La descripción es obligatoria.";
    if (!form.justification.trim()) errors.justification = "La justificación es obligatoria.";
    if (Number.isNaN(impact) || impact <= 0)
      errors.impact_amount = "El impacto debe ser un número mayor a 0.";
    if (!form.currency) errors.currency = "Selecciona una moneda.";
    if (selectedLineItemIds.length === 0)
      errors.affected_line_items = "Selecciona al menos un rubro afectado.";

    return errors;
  }, [form.currency, form.description, form.impact_amount, form.justification, form.title, selectedLineItemIds.length]);

  const isFormValid = useMemo(
    () => Object.keys(computedFormErrors).length === 0,
    [computedFormErrors],
  );

  const validateForm = useCallback(() => {
    setFormErrors(computedFormErrors);
    return Object.keys(computedFormErrors).length === 0;
  }, [computedFormErrors]);

  const lineItemSelectorMessage = useMemo(() => {
    if (lineItemsLoading) return "Cargando rubros...";
    if (lineItemsError instanceof Error) return lineItemsError.message;
    if (!lineItemsLoading && safeLineItems.length === 0)
      return "Este proyecto aún no tiene rubros configurados.";
    return null;
  }, [lineItemsError, lineItemsLoading, safeLineItems.length]);

  const createChangeMutation = useMutation({
    mutationFn: async (
      payload: Pick<
        DomainChangeRequest,
        "baseline_id" | "title" | "description" | "impact_amount" | "currency" | "justification" | "affected_line_items"
      >,
    ) => {
      if (!selectedProjectId) {
        throw new FinanzasApiError(
          "Selecciona un proyecto antes de crear un cambio.",
        );
      }

      return ApiService.createChangeRequest(selectedProjectId, payload);
    },
  });

  const approvalMutation = useMutation({
    mutationFn: async ({
      changeId,
      action,
      comment,
    }: {
      changeId: string;
      action: "approve" | "reject";
      comment?: string;
    }) => {
      if (!selectedProjectId) {
        throw new FinanzasApiError(
          "Selecciona un proyecto antes de aprobar o rechazar.",
        );
      }

      return ApiService.updateChangeApproval(selectedProjectId, changeId, {
        action,
        comment,
      });
    },
  });

  const loadChangeRequests = useCallback(async (projectId: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await ApiService.getChangeRequests(projectId);
      setChangeRequests(data);
    } catch (err) {
      const message = resolveChangeError(err, "No pudimos cargar los cambios.");
      setError(message);
      setChangeRequests([]);
    } finally {
      setLoading(false);
    }
  }, [resolveChangeError]);

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
    setSelectedLineItemIds([]);
  }, [selectedProjectId]);

  useEffect(() => {
    if (currentProject?.currency) {
      setForm((prev) => ({ ...prev, currency: currentProject.currency }));
    }
  }, [currentProject?.currency]);

  const toggleLineItemSelection = (id: string) => {
    setSelectedLineItemIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const onSubmit = async () => {
    if (!selectedProjectId) {
      toast.error("Selecciona un proyecto antes de crear un cambio.");
      return;
    }

    if (!validateForm()) return;

    const payload = {
      baseline_id: form.baseline_id.trim(),
      title: form.title.trim(),
      description: form.description.trim(),
      impact_amount: Number(form.impact_amount),
      currency: form.currency || currentProject?.currency || "USD",
      justification: form.justification.trim(),
      affected_line_items: selectedLineItemIds,
    };

    try {
      setError(null);
      setApprovalError(null);
      await createChangeMutation.mutateAsync(payload);

      setForm(defaultForm);
      setFormErrors({});
      setSelectedLineItemIds([]);
      setCreateOpen(false);
      toast.success("Cambio creado y enviado a aprobación");
      await loadChangeRequests(selectedProjectId);
    } catch (err) {
      const message = resolveChangeError(
        err,
        "Error interno en Finanzas. Intenta nuevamente más tarde.",
      );
      setError(message);
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

  const handleApprovalAction = async (
    requestId: string,
    action: "approve" | "reject",
    comments: string,
  ) => {
    const trimmedComment = comments.trim();
    try {
      setApprovalError(null);
      const updated = await approvalMutation.mutateAsync({
        changeId: requestId,
        action,
        comment: trimmedComment,
      });

      setChangeRequests((prev) =>
        prev.map((change) => {
          if (change.id !== requestId) return change;

          const fallbackStatus = action === "approve" ? "approved" : "rejected";
          const safeUpdated = updated ?? change;

          return {
            ...change,
            ...safeUpdated,
            status: safeUpdated.status ?? fallbackStatus,
            approvals: safeUpdated.approvals ?? change.approvals ?? [],
          };
        }),
      );

      toast.success(action === "approve" ? "Cambio aprobado" : "Cambio rechazado");
      setIsWorkflowDialogOpen(false);
      setWorkflowChange(null);
    } catch (err) {
      const message = resolveChangeError(
        err,
        "No pudimos actualizar la aprobación. Intenta nuevamente.",
      );
      setApprovalError(message);
      throw new Error(message);
    } finally {
      setPendingWorkflowAction(null);
    }
  };

  const handleWorkflowDialogChange = (open: boolean) => {
    setIsWorkflowDialogOpen(open);
    if (!open) {
      setWorkflowChange(null);
      setPendingWorkflowAction(null);
      setApprovalError(null);
    }
  };

  const mapChangeToWorkflow = (change: DomainChangeRequest) => {
    const approvalSteps = (change.approvals || []).map((approval, index) => ({
      id: approval.id || `${change.id}-approval-${index}`,
      role: approval.approver_role || "Approver",
      approverName: approval.approver_id || undefined,
      status: (approval.decision as ChangeStatus) || "pending",
      comments: approval.comment,
      decidedAt: approval.approved_at,
      required: true,
    }));

    const pendingIndex = approvalSteps.findIndex((step) => step.status === "pending");

    return {
      id: change.id,
      title: change.title,
      description: change.description,
      impact: Number(change.impact_amount || 0),
      status: change.status,
      requestedBy: change.requested_by || "",
      requestedAt: change.requested_at,
      approvalSteps,
      currentStep: pendingIndex === -1 ? approvalSteps.length : pendingIndex,
      businessJustification: change.justification,
      affectedLineItems: change.affected_line_items || [],
    };
  };

  if (!selectedProjectId) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{ES_TEXTS.changes.title}</h1>
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
          <h1 className="text-3xl font-bold">{ES_TEXTS.changes.title}</h1>
          <p className="text-muted-foreground">
            {ES_TEXTS.changes.description}
            {currentProject && (
              <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                {currentProject.name}
              </span>
            )}
            {selectedProjectId && (
              <span className="ml-2 text-xs text-muted-foreground">
                ID: {selectedProjectId}
              </span>
            )}
          </p>
        </div>
        <ModuleBadge />
      </div>

      {/* Baseline Status Panel */}
      <BaselineStatusPanel />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Clock className="mx-auto mb-2 text-amber-500" size={32} />
            <div className="text-2xl font-bold text-amber-600">{pendingCount}</div>
            <p className="text-sm text-muted-foreground">Aprobación Pendiente</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <CheckCircle2 className="mx-auto mb-2 text-green-500" size={32} />
            <div className="text-2xl font-bold text-green-600">{approvedCount}</div>
            <p className="text-sm text-muted-foreground">Aprobado</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <XCircle className="mx-auto mb-2 text-red-500" size={32} />
            <div className="text-2xl font-bold text-red-600">{rejectedCount}</div>
            <p className="text-sm text-muted-foreground">Rechazado</p>
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
            <p className="text-sm text-muted-foreground">Impacto Neto en Presupuesto</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Solicitudes de Cambio</h2>
        <Button className="gap-2" onClick={() => setCreateOpen(true)}>
          <Plus size={16} />
          Nueva Solicitud de Cambio
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
                <TableHead>ID de Solicitud</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Impacto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Solicitado Por</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Cargando solicitudes de cambio...
                    </div>
                  </TableCell>
                </TableRow>
              ) : changeRequests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                    Aún no hay solicitudes de cambio.
                  </TableCell>
                </TableRow>
              ) : (
                changeRequests.map((change) => {
                  const impactValue = Number(change.impact_amount || 0);

                  return (
                    <TableRow key={change.id}>
                      <TableCell className="font-mono">{change.id}</TableCell>
                      <TableCell className="font-medium">{change.title}</TableCell>
                      <TableCell>
                        <span
                          className={impactValue > 0 ? "text-red-600" : "text-green-600"}
                        >
                          {impactValue > 0 ? "+" : ""}${impactValue.toLocaleString()}
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
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedChange(change)}
                          >
                            <Eye size={14} className="mr-1" />
                            Ver
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setWorkflowChange(change);
                              setPendingWorkflowAction(null);
                              setIsWorkflowDialogOpen(true);
                            }}
                          >
                            <Clock size={14} className="mr-1" />
                            Ver Flujo
                          </Button>
                          {canApprove && change.status === "pending" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setWorkflowChange(change);
                                  setPendingWorkflowAction("approve");
                                  setIsWorkflowDialogOpen(true);
                                }}
                              >
                                <CheckCircle2 size={14} className="mr-1 text-green-600" />
                                Aprobar
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  setWorkflowChange(change);
                                  setPendingWorkflowAction("reject");
                                  setIsWorkflowDialogOpen(true);
                                }}
                              >
                                <XCircle size={14} className="mr-1" />
                                Rechazar
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Crear solicitud de cambio</DialogTitle>
            <DialogDescription>Proporciona los detalles para este cambio.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="title">Título</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                />
                {formErrors.title && (
                  <p className="text-sm text-destructive mt-1">{formErrors.title}</p>
                )}
              </div>
              <div>
                <Label htmlFor="baseline">ID de Línea Base (opcional)</Label>
                <Input
                  id="baseline"
                  value={form.baseline_id}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, baseline_id: e.target.value }))
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {currentProject?.baseline_id
                    ? `Auto-relleno desde la línea base del proyecto (${currentProject.baseline_id}).`
                    : "Se vinculará automáticamente cuando el proyecto tenga una línea base."}
                </p>
              </div>
            </div>
            <div>
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, description: e.target.value }))
                }
              />
              {formErrors.description && (
                <p className="text-sm text-destructive mt-1">{formErrors.description}</p>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="impact">Monto del impacto</Label>
                <Input
                  id="impact"
                  type="number"
                  value={form.impact_amount}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, impact_amount: e.target.value }))
                  }
                />
                {formErrors.impact_amount && (
                  <p className="text-sm text-destructive mt-1">
                    {formErrors.impact_amount}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="currency">Moneda</Label>
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
                <p className="text-xs text-muted-foreground mt-1">
                  {currentProject?.currency
                    ? `Moneda predeterminada del proyecto (${currentProject.currency}).`
                    : "Se usa la moneda definida en el proyecto o USD por defecto."}
                </p>
                {formErrors.currency && (
                  <p className="text-sm text-destructive mt-1">{formErrors.currency}</p>
                )}
              </div>
              <div>
                <Label htmlFor="justification">Justificación</Label>
                <Input
                  id="justification"
                  value={form.justification}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, justification: e.target.value }))
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Describe el fundamento del cambio para que el flujo de aprobación lo vincule
                  con la línea base y el presupuesto del proyecto.
                </p>
                {formErrors.justification && (
                  <p className="text-sm text-destructive mt-1">
                    {formErrors.justification}
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="line-items">Rubros afectados</Label>
                {selectedLineItemIds.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {selectedLineItemIds.length} selected
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Catálogo conectado al proyecto ({selectedProjectId}) y su taxonomía de rubros.
              </p>
              <Popover open={lineItemSelectorOpen} onOpenChange={setLineItemSelectorOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={lineItemSelectorOpen}
                    className="w-full justify-between"
                    id="line-items"
                  >
                    <span className="truncate text-left">
                      {lineItemsLoading
                        ? "Cargando rubros..."
                        : selectedLineItemLabels[0] || "Selecciona rubros afectados"}
                      {selectedLineItemIds.length > 1 && (
                        <span className="text-muted-foreground ml-1">
                          +{selectedLineItemIds.length - 1} more
                        </span>
                      )}
                    </span>
                    <ChevronsUpDown className="h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[520px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar rubros" />
                    <CommandList>
                      <CommandEmpty>No se encontraron rubros.</CommandEmpty>
                      <CommandGroup>
                        {lineItemOptions.map((option) => {
                          const isSelected = selectedLineItemIds.includes(option.value);
                          return (
                            <CommandItem
                              key={option.value}
                              value={option.label}
                              onSelect={() => toggleLineItemSelection(option.value)}
                              className="flex items-center gap-2"
                            >
                              <span
                                className={`flex h-4 w-4 items-center justify-center rounded border ${
                                  isSelected ? "bg-primary/10 border-primary" : "border-muted"
                                }`}
                              >
                                {isSelected && <Check className="h-3 w-3 text-primary" />}
                              </span>
                              <span className="truncate text-sm">{option.label}</span>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {lineItemSelectorMessage && (
                <p className="text-sm text-muted-foreground">{lineItemSelectorMessage}</p>
              )}
              {formErrors.affected_line_items && (
                <p className="text-sm text-destructive">{formErrors.affected_line_items}</p>
              )}
              {selectedLineItemLabels.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {selectedLineItemLabels.map((label, index) => (
                    <Badge key={`${label}-${index}`} variant="outline">
                      {label}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={createChangeMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                onClick={onSubmit}
                disabled={!isFormValid || createChangeMutation.isPending}
              >
                {createChangeMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Crear solicitud de cambio
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedChange} onOpenChange={(open) => !open && setSelectedChange(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalles de solicitud de cambio</DialogTitle>
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
                  <p className="text-muted-foreground">Impacto</p>
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
                  <p className="text-muted-foreground">Estado</p>
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
                  <p className="text-muted-foreground">Solicitado por</p>
                  <p className="font-semibold">{selectedChange.requested_by || "N/A"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Solicitado el</p>
                  <p className="font-semibold">
                    {selectedChange.requested_at
                      ? new Date(selectedChange.requested_at).toLocaleString()
                      : "N/A"}
                  </p>
                </div>
              </div>
              {selectedChange.justification && (
                <div>
                  <p className="text-muted-foreground text-sm">Justificación</p>
                  <p className="text-sm">{selectedChange.justification}</p>
                </div>
              )}
              {selectedChange.affected_line_items?.length > 0 && (
                <div>
                  <p className="text-muted-foreground text-sm">Rubros afectados</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {selectedChange.affected_line_items.map((item) => (
                      <Badge key={item} variant="outline">
                        {lineItemLabelMap.get(item) || item}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isWorkflowDialogOpen} onOpenChange={handleWorkflowDialogChange}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Flujo de Aprobación</DialogTitle>
            <DialogDescription>
              {workflowChange?.id || "Revisa el flujo de aprobación de este cambio."}
            </DialogDescription>
          </DialogHeader>
          {approvalError && (
            <Alert variant="destructive">
              <AlertDescription>{approvalError}</AlertDescription>
            </Alert>
          )}
          {workflowChange && (
            <ApprovalWorkflow
              changeRequest={mapChangeToWorkflow(workflowChange)}
              onApprovalAction={handleApprovalAction}
              canApprove={canApprove && workflowChange.status === "pending"}
              isSubmitting={approvalMutation.isPending}
              prefillAction={pendingWorkflowAction}
              onCloseActionDialog={() => setPendingWorkflowAction(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SDMTChanges;
