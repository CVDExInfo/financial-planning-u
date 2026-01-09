import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
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
import { useProject, ALL_PROJECTS_ID } from "@/contexts/ProjectContext";
import ApiService from "@/lib/api";
import { handleFinanzasApiError } from "@/features/sdmt/cost/utils/errorHandling";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import type { ChangeRequest as DomainChangeRequest, Currency } from "@/types/domain";
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
  // Time distribution fields
  start_month_index: 1,
  duration_months: 1,
  allocation_mode: "one_time" as "one_time" | "spread_evenly",
  // New line item request
  requires_new_rubro: false,
  new_rubro_name: "",
  new_rubro_type: "OPEX",
  new_rubro_description: "",
};

type ChangeRequestForm = typeof defaultForm;

type ChangeStatus = DomainChangeRequest["status"];

const currencyOptions = ["USD", "EUR", "MXN", "COP"] as const;
const expenseTypeOptions = ["OPEX", "CAPEX", "OTHER"] as const;

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
  const { selectedProjectId, currentProject, selectedPeriod } = useProject();
  const { login } = useAuth();
  const { canApprove } = usePermissions();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
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
      baseline_id: currentProject?.baselineId ?? "",
    });
  }, [selectedProjectId]);

  useEffect(() => {
    if (!currentProject?.baselineId) return;

    setForm((prev) => {
      if (prev.baseline_id.trim()) return prev;
      return { ...prev, baseline_id: currentProject.baselineId };
    });
  }, [currentProject?.baselineId]);

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
    const projectPeriod = parseInt(selectedPeriod) || 60; // Default to 60 months

    if (!form.title.trim()) errors.title = "El título es obligatorio.";
    if (!form.description.trim()) errors.description = "La descripción es obligatoria.";
    if (!form.justification.trim()) errors.justification = "La justificación es obligatoria.";
    if (Number.isNaN(impact) || impact <= 0)
      errors.impact_amount = "El impacto debe ser un número mayor a 0.";
    if (!form.currency) errors.currency = "Selecciona una moneda.";
    
    // Validate time distribution
    if (form.duration_months < 1) 
      errors.duration_months = "La duración debe ser al menos 1 mes.";
    if (form.start_month_index < 1) 
      errors.start_month_index = "El mes de inicio debe ser al menos 1.";
    if (form.start_month_index + form.duration_months - 1 > projectPeriod)
      errors.duration_months = `La duración excede el período del proyecto (${projectPeriod} meses).`;
    
    // Validate line items or new rubro request
    if (form.requires_new_rubro) {
      if (!form.new_rubro_name.trim()) 
        errors.new_rubro_name = "El nombre del nuevo rubro es obligatorio.";
      if (!form.new_rubro_description.trim())
        errors.new_rubro_description = "La descripción del nuevo rubro es obligatoria.";
    } else {
      if (selectedLineItemIds.length === 0)
        errors.affected_line_items = "Selecciona al menos un rubro afectado.";
    }

    return errors;
  }, [form, selectedLineItemIds.length, selectedPeriod]);

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
      payload: Omit<DomainChangeRequest, "id" | "requested_at" | "requested_by" | "status" | "approvals">,
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
    onSuccess: async (data, variables) => {
      // TODO: Backend should update forecast entries based on:
      // - start_month_index, duration_months, allocation_mode
      // - impact_amount and affected_line_items
      // - For new_line_item_request, create the new rubro first
      // Expected: Forecast API should return cells with change metadata
      
      // Invalidate forecast cache so SDMTForecast refreshes with new data
      if (selectedProjectId && variables.action === "approve") {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["forecast", selectedProjectId] }),
          queryClient.invalidateQueries({ queryKey: ["lineItems", selectedProjectId] }),
        ]);
      }
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
      currency: (form.currency || currentProject?.currency || "USD") as Currency,
      justification: form.justification.trim(),
      affected_line_items: selectedLineItemIds,
      // Time distribution fields
      start_month_index: form.start_month_index,
      duration_months: form.duration_months,
      allocation_mode: form.allocation_mode,
      // New line item request (if applicable)
      new_line_item_request: form.requires_new_rubro ? {
        name: form.new_rubro_name.trim(),
        type: form.new_rubro_type,
        description: form.new_rubro_description.trim(),
      } : undefined,
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
    const changeBeingApproved = changeRequests.find((c) => c.id === requestId);
    
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

      if (action === "approve") {
        const affectedRubrosCount = changeBeingApproved?.affected_line_items?.length || 0;
        const newRubroRequested = changeBeingApproved?.new_line_item_request ? 1 : 0;
        const totalRubros = affectedRubrosCount + newRubroRequested;
        
        toast.success(
          `Cambio aprobado. Pronóstico actualizado para ${totalRubros} rubro${totalRubros !== 1 ? 's' : ''}`,
          {
            action: {
              label: "Ver Pronóstico",
              onClick: () => navigate("/sdmt/cost/forecast"),
            },
            duration: 5000,
          }
        );
      } else {
        toast.success("Cambio rechazado");
      }
      
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
      // Time distribution fields - keep snake_case to match domain and ApprovalWorkflow
      start_month_index: change.start_month_index,
      duration_months: change.duration_months,
      allocation_mode: change.allocation_mode,
      // New line item request
      new_line_item_request: change.new_line_item_request,
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

  // Check if ALL_PROJECTS context is selected
  if (selectedProjectId === ALL_PROJECTS_ID) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{ES_TEXTS.changes.title}</h1>
            <p className="text-muted-foreground">
              Las solicitudes de cambio requieren un proyecto específico.
            </p>
          </div>
          <ModuleBadge />
        </div>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Las solicitudes de cambio solo están disponibles cuando seleccionas un proyecto específico.
            Por favor, selecciona un proyecto individual desde la barra superior para gestionar cambios.
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
            <span className="ml-2 text-xs text-muted-foreground">
              ID: {selectedProjectId}
            </span>
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
        <Button 
          className="gap-2" 
          onClick={() => setCreateOpen(true)}
          disabled={!currentProject?.baselineId}
          title={!currentProject?.baselineId ? "Debes aceptar una línea base antes de crear cambios" : ""}
        >
          <Plus size={16} />
          Nueva Solicitud de Cambio
        </Button>
      </div>

      {!currentProject?.baselineId && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Este proyecto no tiene una línea base aceptada. Debes aceptar una línea base antes de registrar cambios.
          </AlertDescription>
        </Alert>
      )}

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
                <Label htmlFor="baseline">Línea Base</Label>
                <Input
                  id="baseline"
                  value={form.baseline_id || "Sin línea base"}
                  readOnly
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {currentProject?.baselineId
                    ? `Vinculado automáticamente a la línea base aceptada del proyecto.`
                    : "⚠️ Este proyecto no tiene una línea base aceptada."}
                </p>
                {!currentProject?.baselineId && (
                  <p className="text-xs text-destructive mt-1">
                    Debes aceptar una línea base antes de crear cambios.
                  </p>
                )}
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
            
            {/* Time Distribution Section */}
            <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
              <h3 className="font-semibold text-sm">Distribución Temporal del Impacto</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="start_month">Aplicar desde (Mes)</Label>
                  <Input
                    id="start_month"
                    type="number"
                    min="1"
                    max={parseInt(currentProject?.period || "60")}
                    value={form.start_month_index}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, start_month_index: parseInt(e.target.value) || 1 }))
                    }
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Mes inicial (1-{parseInt(currentProject?.period || "60")})
                  </p>
                  {formErrors.start_month_index && (
                    <p className="text-sm text-destructive mt-1">{formErrors.start_month_index}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="duration">Duración (meses)</Label>
                  <Input
                    id="duration"
                    type="number"
                    min="1"
                    value={form.duration_months}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, duration_months: parseInt(e.target.value) || 1 }))
                    }
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Número de meses para aplicar el impacto
                  </p>
                  {formErrors.duration_months && (
                    <p className="text-sm text-destructive mt-1">{formErrors.duration_months}</p>
                  )}
                </div>
                <div>
                  <Label>Modo de Aplicación</Label>
                  <RadioGroup
                    value={form.allocation_mode}
                    onValueChange={(value: "one_time" | "spread_evenly") =>
                      setForm((prev) => ({ ...prev, allocation_mode: value }))
                    }
                    className="mt-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="one_time" id="one_time" />
                      <Label htmlFor="one_time" className="font-normal cursor-pointer">
                        Aplicar todo en el mes inicial
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="spread_evenly" id="spread_evenly" />
                      <Label htmlFor="spread_evenly" className="font-normal cursor-pointer">
                        Distribuir en partes iguales
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>
            </div>
            
            {/* New Rubro Section */}
            <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
              <div className="flex items-center justify-between">
                <Label htmlFor="requires_new_rubro">Este cambio requiere un rubro nuevo</Label>
                <Switch
                  id="requires_new_rubro"
                  checked={form.requires_new_rubro}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({ ...prev, requires_new_rubro: checked }))
                  }
                />
              </div>
              
              {form.requires_new_rubro && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Especifica los detalles del nuevo rubro que se creará al aprobar este cambio.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="new_rubro_name">Nombre del Nuevo Rubro</Label>
                      <Input
                        id="new_rubro_name"
                        value={form.new_rubro_name}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, new_rubro_name: e.target.value }))
                        }
                        placeholder="Ej: Consultoría de seguridad"
                      />
                      {formErrors.new_rubro_name && (
                        <p className="text-sm text-destructive mt-1">{formErrors.new_rubro_name}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="new_rubro_type">Tipo de Gasto</Label>
                      <Select
                        value={form.new_rubro_type}
                        onValueChange={(value) =>
                          setForm((prev) => ({ ...prev, new_rubro_type: value }))
                        }
                      >
                        <SelectTrigger id="new_rubro_type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {expenseTypeOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="new_rubro_description">Descripción Operativa</Label>
                    <Textarea
                      id="new_rubro_description"
                      value={form.new_rubro_description}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, new_rubro_description: e.target.value }))
                      }
                      placeholder="Describe el propósito y alcance del nuevo rubro..."
                      rows={3}
                    />
                    {formErrors.new_rubro_description && (
                      <p className="text-sm text-destructive mt-1">{formErrors.new_rubro_description}</p>
                    )}
                  </div>
                </div>
              )}
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
                    disabled={form.requires_new_rubro}
                  >
                    <span className="truncate text-left">
                      {form.requires_new_rubro
                        ? "Deshabilitado: usando nuevo rubro"
                        : lineItemsLoading
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
            
            {/* Impact Summary */}
            {isFormValid && (
              <div className="space-y-2 p-4 border rounded-lg bg-primary/5">
                <h3 className="font-semibold text-sm">Resumen de Impacto</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Línea Base:</span>
                    <span className="font-mono">{form.baseline_id || "N/A"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Rubros Afectados:</span>
                    <span>
                      {form.requires_new_rubro
                        ? `Nuevo: ${form.new_rubro_name || "Sin nombre"}`
                        : `${selectedLineItemIds.length} rubro${selectedLineItemIds.length !== 1 ? 's' : ''}`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Distribución:</span>
                    <span>
                      {form.allocation_mode === "one_time"
                        ? `${form.impact_amount ? `+${Number(form.impact_amount).toLocaleString()}` : "0"} ${form.currency} en el mes ${form.start_month_index}`
                        : `${form.impact_amount ? `+${Number(form.impact_amount).toLocaleString()}` : "0"} ${form.currency} distribuidos en ${form.duration_months} mes${form.duration_months !== 1 ? 'es' : ''} desde el mes ${form.start_month_index}`}
                    </span>
                  </div>
                </div>
              </div>
            )}
            
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
                disabled={!isFormValid || createChangeMutation.isPending || !currentProject?.baselineId}
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
