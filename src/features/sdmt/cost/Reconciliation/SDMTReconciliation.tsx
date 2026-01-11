// src/features/sdmt/cost/Reconciliation/SDMTReconciliation.tsx
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  AlertTriangle,
  Download,
  ExternalLink,
  FileCheck,
  Plus,
  Share2,
  Upload,
  X,
  Trash2,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";

import ModuleBadge from "@/components/ModuleBadge";
import LoadingSpinner from "@/components/LoadingSpinner";
import { ErrorBanner } from "@/components/ErrorBanner";

import type { ForecastCell, InvoiceStatus, LineItem } from "@/types/domain";
import { excelExporter, downloadExcelFile } from "@/lib/excel-export";
import { PDFExporter } from "@/lib/pdf-export";

import { useProject } from "@/contexts/ProjectContext";
import { useProjectLineItems } from "@/hooks/useProjectLineItems";
import { useProjectInvoices } from "@/hooks/useProjectInvoices";
import { usePermissions } from "@/hooks/usePermissions";
import { useProviders } from "@/hooks/useProviders";
import { useCurrentUser } from "@/hooks/useAuth";
import {
  uploadInvoice,
  updateInvoiceStatus,
  type UploadInvoicePayload,
  FinanzasApiError,
} from "@/api/finanzas";
import {
  validateInvoicePayload,
  formatValidationErrors,
  extractServerError,
  logInvoicePayload,
} from "@/utils/invoiceValidation";

import {
  formatLineItemDisplay,
  extractFriendlyFilename,
} from "./lineItemFormatters";
import { ES_TEXTS } from "@/lib/i18n/es";
import { isMODCategory } from "@/lib/cost-utils";

/** --------- Types & helpers --------- */

// Constants
const VENDOR_OTHER_VALUE = "__other__";
const STORAGE_PATH_DISPLAY_LENGTH = 40;

type UploadFormState = {
  line_item_id: string;
  month: number; // Legacy: single month for backward compatibility
  start_month: number; // For multi-month range
  end_month: number; // For multi-month range
  amount: string;
  description: string; // User-provided notes (optional)
  file: File | null;
  vendor: string;
  invoice_number: string;
  invoice_date: string;
};

const createInitialUploadForm = (): UploadFormState => ({
  line_item_id: "",
  month: 1, // Legacy field
  start_month: 1,
  end_month: 1,
  amount: "",
  description: "",
  file: null,
  vendor: "",
  invoice_number: "",
  invoice_date: "",
});

// Note: Additional formatting functions (formatMatrixLabel, formatRubroLabel) are available
// from lineItemFormatters.ts for backward compatibility with other modules.
const formatMatrixLabel = (
  item?: LineItem,
  month?: number,
  fallbackId?: string
) => {
  const base = formatRubroLabel(item, fallbackId);
  return typeof month === "number" && Number.isFinite(month)
    ? `${base} (Month ${month})`
    : base;
};

const formatRubroLabel = (item?: LineItem, fallbackId?: string) => {
  if (!item) return fallbackId || "Rubro";
  const category = (item as any).categoria?.trim() || item.category?.trim();
  const description = item.description?.trim() || fallbackId || "Rubro";
  const lineaCodigo = (item as any).linea_codigo?.trim();
  const tipoCosto = (item as any).tipo_costo?.trim();
  const categoryLabel = category || "General";
  const codePart = lineaCodigo || item.id || fallbackId || "";
  const tipoCostoSuffix = tipoCosto ? ` • ${tipoCosto}` : "";
  return `${categoryLabel} — ${description}${codePart ? ` [${codePart}]` : ""}${tipoCostoSuffix}`;
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(amount);

/**
 * Helper to determine if the selected line item belongs to a MOD category
 */
const isSelectedLineItemMOD = (lineItemId: string, lineItems: LineItem[]): boolean => {
  if (!lineItemId) return false;
  const lineItem = lineItems.find((li) => li.id === lineItemId);
  if (!lineItem) return false;
  
  // Check both category and categoria fields (some data uses Spanish field names)
  const categoryCode = lineItem.category || (lineItem as any).categoria || "";
  return isMODCategory(categoryCode);
};

/**
 * Helper to format upload error messages consistently
 */
const formatUploadError = (err: unknown): string => {
  if (err instanceof FinanzasApiError) {
    return err.message;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "Error inesperado al subir factura. Por favor intenta nuevamente o contacta soporte.";
};

/** --------- Component --------- */

export default function SDMTReconciliation() {
  const allowMockData = import.meta.env.VITE_USE_MOCKS === "true";

  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadFormData, setUploadFormData] = useState<UploadFormState>(
    createInitialUploadForm
  );
  
  // Correction/deletion dialog state
  const [showCorrectionDialog, setShowCorrectionDialog] = useState(false);
  const [selectedInvoiceForCorrection, setSelectedInvoiceForCorrection] = useState<any>(null);
  const [correctionComment, setCorrectionComment] = useState("");

  // Routing/context
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // If caller navigated with ?projectId=..., prefer that over global context
  const routeProjectId = searchParams.get('projectId') || undefined;
  
  const { currentProject, projectChangeCount, setSelectedProjectId } = useProject();
  const { canUploadInvoices, canApprove } = usePermissions();
  const currentUser = useCurrentUser();
  
  // Effect: Update project context when route projectId is provided
  useEffect(() => {
    if (routeProjectId && routeProjectId !== currentProject?.id) {
      setSelectedProjectId(routeProjectId);
    }
  }, [routeProjectId, currentProject?.id, setSelectedProjectId]);

  // Server data
  const {
    invoices,
    projectId,
    isLoading: invoicesLoading,
    error: invoicesError,
    invalidate: invalidateInvoices,
  } = useProjectInvoices();

  const {
    lineItems,
    isLoading: lineItemsLoading,
    error: lineItemsError,
    invalidate: invalidateLineItems,
  } = useProjectLineItems();

  // Fetch providers for vendor dropdown
  const {
    providers,
    isLoading: providersLoading,
  } = useProviders({ estado: "active" });

  const normalizeApiError = (error: unknown) => {
    if (!error) return null;
    if (error instanceof FinanzasApiError) {
      return { status: error.status, message: error.message };
    }
    if (error instanceof Error) {
      return { status: (error as any).status as number | undefined, message: error.message };
    }
    return { status: undefined, message: String(error) };
  };

  const invoicesErrorInfo = normalizeApiError(invoicesError);
  const lineItemsErrorInfo = normalizeApiError(lineItemsError);

  // URL filters (when navigated from Forecast)
  const urlParams = new URLSearchParams(location.search);
  const filterLineItem = urlParams.get("line_item");
  const filterMonth = urlParams.get("month");
  const returnUrl = urlParams.get("returnUrl");

  useEffect(() => {
    if (filterLineItem) {
      const parsedMonth = filterMonth ? parseInt(filterMonth, 10) || 1 : 1;
      setUploadFormData((prev) => ({
        ...prev,
        line_item_id: filterLineItem,
        month: parsedMonth,
        start_month: parsedMonth,
        end_month: parsedMonth,
      }));
      setShowUploadForm(true);
    }
  }, [filterLineItem, filterMonth]);

  // Guards & derived
  const safeInvoices = Array.isArray(invoices) ? invoices : [];
  const safeLineItems = Array.isArray(lineItems) ? lineItems : [];

  const lineItemOptions = useMemo(
    () =>
      safeLineItems.map((item) => ({
        value: item.id,
        label: formatRubroLabel(item, item.id),
      })),
    [safeLineItems]
  );

  useEffect(() => {
    if (
      import.meta.env.DEV &&
      Array.isArray(lineItems) &&
      lineItemOptions.length < lineItems.length
    ) {
      console.warn(
        "[SDMT] Reconciliation line items appear truncated compared to catalog",
        {
          projectId,
          received: lineItems.length,
          visible: lineItemOptions.length,
        }
      );
    }
  }, [lineItemOptions.length, lineItems, projectId]);

  const lineItemDropdownMessage = (() => {
    if (lineItemsErrorInfo?.status === 401)
      return "Sesión expirada, por favor vuelve a iniciar sesión.";
    if (lineItemsErrorInfo?.status === 403)
      return "No tienes permiso para ver rubros de este proyecto.";
    if (!lineItemsLoading && safeLineItems.length === 0)
      return "Este proyecto aún no tiene rubros configurados.";
    return null;
  })();
  const canUpdateStatus = canApprove;

  // Check if the currently selected line item is MOD (for conditional validation/UI)
  const selectedLineItemIsMOD = useMemo(
    () => isSelectedLineItemMOD(uploadFormData.line_item_id, safeLineItems),
    [uploadFormData.line_item_id, safeLineItems]
  );

  const uiErrorMessage = (() => {
    if (allowMockData) return null;
    if (invoicesErrorInfo?.status === 401 || lineItemsErrorInfo?.status === 401)
      return "Sesión expirada, por favor vuelve a iniciar sesión.";
    if (invoicesErrorInfo?.status === 403)
      return "Acceso a datos de conciliación restringido para este proyecto.";
    if (lineItemsErrorInfo?.status === 403)
      return "Acceso a datos del catálogo restringido para este proyecto.";
    if (invoicesErrorInfo?.status && invoicesErrorInfo.status >= 500)
      return "Servicio de conciliación no disponible. Por favor intenta nuevamente.";
    if (lineItemsErrorInfo?.status && lineItemsErrorInfo.status >= 500)
      return "Servicio de catálogo no disponible. Por favor intenta nuevamente.";
    if (invoicesErrorInfo?.message) return invoicesErrorInfo.message;
    if (lineItemsErrorInfo?.message) return lineItemsErrorInfo.message;
    return null;
  })();

  // Spinner until either list is loading and both lists are empty.
  const showInitialLoading =
    (invoicesLoading || lineItemsLoading) &&
    safeInvoices.length === 0 &&
    safeLineItems.length === 0;

  // Create a set of valid line item IDs from baseline-filtered rubros
  // Memoized to avoid re-creating Set on every render
  const validLineItemIds = useMemo(
    () => new Set(safeLineItems.map((li) => li.id)),
    [safeLineItems]
  );

  // Filters
  const filteredInvoices = useMemo(() => {
    return safeInvoices.filter((inv) => {
      // SDMT ALIGNMENT FIX: Exclude invoices with line_item_id that don't match any baseline rubro
      // This prevents showing phantom "$0 / PendingSDMT" entries from old baselines
      if (!validLineItemIds.has(inv.line_item_id)) {
        if (import.meta.env.DEV) {
          console.debug('[Reconciliation] Filtered out invoice with invalid line_item_id:', {
            invoice_id: inv.id,
            line_item_id: inv.line_item_id,
            amount: inv.amount,
            status: inv.status,
          });
        }
        return false;
      }
      
      if (filterLineItem && inv.line_item_id !== filterLineItem) return false;
      if (filterMonth && inv.month !== parseInt(filterMonth, 10)) return false;
      return true;
    });
  }, [safeInvoices, validLineItemIds, filterLineItem, filterMonth]);

  const matchedCount = filteredInvoices.filter((x) => x.status === "Matched")
    .length;
  const pendingCount = filteredInvoices.filter((x) => x.status === "Pending")
    .length;
  const disputedCount = filteredInvoices.filter((x) => x.status === "Disputed")
    .length;

  // Mutations
  const uploadMutation = useMutation({
    mutationFn: (payload: UploadInvoicePayload & { projectId: string }) =>
      uploadInvoice(payload.projectId, payload),
    // Note: Success handling is done in handleInvoiceSubmit for multi-month support
    onError: (err: unknown) => {
      // Only log here; handleInvoiceSubmit handles user-facing error messages
      if (import.meta.env.DEV) {
        console.error("[SDMTReconciliation] Invoice upload mutation error", err);
      }
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({
      invoiceId,
      status,
      comment,
    }: {
      invoiceId: string;
      status: InvoiceStatus;
      comment?: string;
    }) => {
      if (!projectId) {
        throw new Error("Selecciona un proyecto antes de actualizar el estado de la factura");
      }
      return updateInvoiceStatus(projectId, invoiceId, { status, comment });
    },
    onSuccess: async (_data, vars) => {
      toast.success(`Estado de factura actualizado a ${vars.status}`);
      await invalidateInvoices();
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error ? err.message : "Error al actualizar estado de factura";
      toast.error(message);
    },
  });

  // Control ids for a11y
  const lineItemSelectId = "reconciliation-line-item";
  const monthSelectId = "reconciliation-month";
  const fileInputId = "reconciliation-invoice-file";
  const fileHelpId = `${fileInputId}-help`;

  // Handlers
  const handleRetryLoad = async () => {
    await Promise.all([
      invalidateInvoices(),
      invalidateLineItems ? invalidateLineItems() : Promise.resolve(),
    ]);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setUploadFormData((prev) => ({ ...prev, file }));
  };

  const handleInvoiceSubmit = async () => {
    if (!canUploadInvoices) {
      toast.error("No tienes permiso para cargar facturas.");
      return;
    }

    if (!projectId) {
      toast.error("Selecciona un proyecto antes de subir facturas");
      return;
    }

    // Parse amount early for validation
    const amount = parseFloat(uploadFormData.amount);

    // Validate payload using utility
    const validationErrors = validateInvoicePayload({
      line_item_id: uploadFormData.line_item_id,
      month_start: uploadFormData.start_month,
      month_end: uploadFormData.end_month,
      amount: uploadFormData.amount,
      vendor: uploadFormData.vendor,
      invoice_date: uploadFormData.invoice_date,
      file: uploadFormData.file,
    });

    if (validationErrors.length > 0) {
      const errorMessage = formatValidationErrors(validationErrors);
      toast.error(errorMessage);
      if (import.meta.env.DEV) {
        console.warn("[Factura] Validation failed:", validationErrors);
      }
      return;
    }

    // Multi-month upload: loop through each month in the range
    const monthsToUpload = [];
    for (let m = uploadFormData.start_month; m <= uploadFormData.end_month; m++) {
      monthsToUpload.push(m);
    }

    try {
      toast.loading(
        monthsToUpload.length === 1
          ? "Subiendo factura..."
          : `Subiendo factura para ${monthsToUpload.length} meses...`
      );

      // Upload invoice for each month in the range
      const uploadPromises = monthsToUpload.map((month) => {
        const payload = {
          projectId,
          file: uploadFormData.file!,
          line_item_id: uploadFormData.line_item_id,
          month,
          amount,
          description: uploadFormData.description.trim() || undefined,
          vendor: uploadFormData.vendor.trim(),
          invoice_number: uploadFormData.invoice_number.trim() || undefined,
          invoice_date: uploadFormData.invoice_date.trim() || undefined,
        };

        // Log payload for debugging (development only, no sensitive data)
        if (import.meta.env.DEV) {
          logInvoicePayload(payload, uploadFormData.file!);
        }

        return uploadMutation.mutateAsync(payload);
      });

      await Promise.all(uploadPromises);

      toast.dismiss();
      toast.success(
        monthsToUpload.length === 1
          ? "Factura y documento subidos exitosamente"
          : `${monthsToUpload.length} facturas subidas exitosamente`
      );

      setShowUploadForm(false);
      setUploadFormData(createInitialUploadForm());
      await invalidateInvoices();
      
      // Navigate back to Forecast if returnUrl was provided, with a timestamp to force refresh
      if (returnUrl) {
        const url = new URL(returnUrl, window.location.origin);
        url.searchParams.set('_refresh', Date.now().toString());
        navigate(`${url.pathname}${url.search}`);
      }
    } catch (err) {
      toast.dismiss();
      
      // Extract server error message
      const serverMessage = extractServerError(err);
      toast.error(serverMessage);
      
      if (import.meta.env.DEV) {
        console.error("[Finanzas] ❌ Invoice upload error:", {
          projectId,
          line_item_id: uploadFormData.line_item_id,
          amount,
          vendor: uploadFormData.vendor ? "***" : undefined,
          invoice_date: uploadFormData.invoice_date,
          file: uploadFormData.file ? {
            name: uploadFormData.file.name,
            size: uploadFormData.file.size,
            type: uploadFormData.file.type
          } : undefined,
          error: err,
          errorMessage: serverMessage,
        });
      }
    }
  };

  const handleStatusUpdate = async (
    invoiceId: string,
    status: InvoiceStatus,
    comment?: string
  ) => {
    await statusMutation.mutateAsync({ invoiceId, status, comment });
  };

  const handleRequestCorrection = (invoice: any) => {
    setSelectedInvoiceForCorrection(invoice);
    setCorrectionComment("");
    setShowCorrectionDialog(true);
  };

  const handleSubmitCorrectionRequest = async () => {
    if (!selectedInvoiceForCorrection) return;
    
    const comment = correctionComment.trim() || "Solicitud de corrección/eliminación";
    
    try {
      await statusMutation.mutateAsync({
        invoiceId: selectedInvoiceForCorrection.id,
        status: "PendingDeletionApproval",
        comment,
      });
      
      if (import.meta.env.DEV) {
        console.log("[SDMTReconciliation] Deletion request submitted", {
          projectId,
          invoiceId: selectedInvoiceForCorrection.id,
          requestedBy: currentUser?.login || currentUser?.email,
          comment,
        });
      }
      
      setShowCorrectionDialog(false);
      setSelectedInvoiceForCorrection(null);
      setCorrectionComment("");
    } catch (err) {
      // Error is already handled by statusMutation.onError
      console.error("[SDMTReconciliation] Failed to request correction", err);
    }
  };

  const handleApproveDeletion = async (invoiceId: string) => {
    // Note: Backend should mark as deleted or remove the record
    // For now, we'll update status to indicate approval
    await statusMutation.mutateAsync({
      invoiceId,
      status: "Disputed", // Use Disputed as a temporary "deleted" state
      comment: "Eliminación aprobada",
    });
  };

  const handleRejectDeletion = async (invoiceId: string) => {
    // Revert back to Matched status
    await statusMutation.mutateAsync({
      invoiceId,
      status: "Matched",
      comment: "Solicitud de eliminación rechazada",
    });
  };

  const canApproveDeletion = (invoice: any): boolean => {
    // User can approve deletion if:
    // 1. They have approval permissions (canApprove)
    // 2. They are NOT the user who reconciled the invoice
    if (!canApprove) return false;
    
    const reconciledBy = invoice.reconciled_by || invoice.matched_by || invoice.uploaded_by;
    const currentUserId = currentUser?.login || currentUser?.email;
    
    if (!reconciledBy || !currentUserId) {
      // If we can't determine the reconciler or current user, allow by default
      // Backend should enforce this rule
      return true;
    }
    
    // Different user can approve
    return reconciledBy !== currentUserId;
  };

  const navigateToForecast = (line_item_id: string, month?: number) => {
    const params = new URLSearchParams();
    if (month) params.set("month", String(month));
    params.set("line_item", line_item_id);
    navigate(`/sdmt/cost/forecast?${params.toString()}`);
  };

  const handleCancelUpload = () => {
    setShowUploadForm(false);
    // If returnUrl is present, navigate back to Forecast
    if (returnUrl) {
      navigate(returnUrl);
    }
  };

  const handleExportVarianceReport = async () => {
    try {
      toast.loading("Generando reporte de variación…");
      const mockForecast: ForecastCell[] = filteredInvoices.map((inv) => {
        const li = safeLineItems.find((x) => x.id === inv.line_item_id);
        const planned = li ? li.qty * li.unit_cost : inv.amount;
        return {
          line_item_id: inv.line_item_id,
          month: inv.month,
          planned,
          forecast: planned,
          actual: inv.amount,
          variance: inv.amount - planned,
          notes: inv.comments?.[0],
          last_updated: inv.uploaded_at,
          updated_by: inv.uploaded_by,
        } as ForecastCell;
      });

      const buf = await excelExporter.exportVarianceReport(
        mockForecast,
        safeLineItems
      );
      const fname = `invoice-variance-${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx`;
      downloadExcelFile(buf, fname);
      toast.dismiss();
      toast.success("Reporte de variación exportado");
    } catch (e) {
      toast.dismiss();
      toast.error("Error al exportar reporte de variación");
      console.error(e);
    }
  };

  const handleShareReconciliationSummary = async () => {
    try {
      toast.loading("Generando reporte de conciliación…");
      const total = filteredInvoices.reduce((s, inv) => s + inv.amount, 0);
      const matchRate = filteredInvoices.length
        ? (matchedCount / filteredInvoices.length) * 100
        : 0;
      const avg = filteredInvoices.length ? total / filteredInvoices.length : 0;

      await PDFExporter.exportToPDF({
        title: "Reporte de Conciliación de Facturas",
        subtitle: "Resumen de Control Financiero y Cumplimiento",
        generated: new Date().toLocaleDateString(),
        metrics: [
          { label: "Total Facturas", value: String(filteredInvoices.length) },
          { label: "Conciliadas", value: String(matchedCount) },
          { label: "Pendientes", value: String(pendingCount) },
          { label: "Disputadas", value: String(disputedCount) },
        ],
        summary: [
          `Procesadas ${filteredInvoices.length} facturas por un valor de ${formatCurrency(
            total
          )}`,
          `Tasa de conciliación: ${matchRate.toFixed(1)}% (${matchedCount}/${
            filteredInvoices.length
          })`,
          `Monto promedio por factura: ${formatCurrency(avg)}`,
          `${disputedCount} disputas requieren atención inmediata`,
        ],
        recommendations: [
          matchRate < 80
            ? "Mejorar conciliación de facturas — tasa actual debajo del objetivo"
            : "Mantener el desempeño actual de conciliación",
          pendingCount > 0
            ? `Procesar ${pendingCount} facturas pendientes para mejorar tiempo de ciclo`
            : "No hay elementos pendientes",
          disputedCount > 0
            ? `Resolver ${disputedCount} facturas disputadas para reducir riesgo`
            : "No hay disputas",
        ],
      });
      toast.dismiss();
      toast.success("Reporte de conciliación generado");
    } catch (e) {
      toast.dismiss();
      toast.error("Error al generar reporte");
      console.error(e);
    }
  };

  /** --------- Rendering --------- */

  if (showInitialLoading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <Card className="p-6">
          <div className="flex items-center gap-3 text-muted-foreground">
            <LoadingSpinner />
            <span>Cargando datos de conciliación…</span>
          </div>
        </Card>
      </div>
    );
  }

  const showError = Boolean(uiErrorMessage);
  if (showError) {
    return (
      <div className="max-w-7xl mx-auto p-6 space-y-4">
        <ErrorBanner message={uiErrorMessage} />
        <Button variant="outline" className="w-fit" onClick={handleRetryLoad}>
          Reintentar carga de datos
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">{ES_TEXTS.reconciliation.title}</h1>
          <p className="text-muted-foreground leading-relaxed">
            {ES_TEXTS.reconciliation.description}
            {currentProject && (
              <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                {currentProject.name} | Change #{projectChangeCount}
              </span>
            )}
          </p>
          {(filterLineItem || filterMonth) && (
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline">
                Filtrado:{" "}
                {filterLineItem
                  ? formatMatrixLabel(
                      safeLineItems.find((li) => li.id === filterLineItem),
                      filterMonth ? parseInt(filterMonth, 10) : undefined,
                      filterLineItem ?? undefined
                    )
                  : filterMonth
                  ? `Month ${filterMonth}`
                  : null}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/sdmt/cost/reconciliation")}
              >
                <X size={14} className="mr-1" /> Limpiar Filtro
              </Button>
              {returnUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(returnUrl)}
                  className="gap-1"
                >
                  <ArrowLeft size={14} /> Volver a Pronóstico
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleShareReconciliationSummary}
            className="gap-2"
          >
            <Share2 size={16} />
            Compartir
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportVarianceReport}
            className="gap-2"
          >
            <Download size={16} />
            Exportar
          </Button>
          <ModuleBadge />
          <Button
            onClick={() => canUploadInvoices && setShowUploadForm(true)}
            className="gap-2"
            disabled={!canUploadInvoices}
            title={
              canUploadInvoices
                ? undefined
                : "Este rol no puede cargar facturas"
            }
          >
            <Plus size={16} />
            Subir Factura
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <FileCheck className="mx-auto mb-2 text-green-600" size={32} />
            <div className="text-2xl font-bold text-green-600">
              {matchedCount}
            </div>
            <p className="text-sm text-muted-foreground">Facturas Conciliadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <Upload className="mx-auto mb-2 text-blue-600" size={32} />
            <div className="text-2xl font-bold text-blue-600">
              {pendingCount}
            </div>
            <p className="text-sm text-muted-foreground">Revisión Pendiente</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <AlertTriangle className="mx-auto mb-2 text-red-600" size={32} />
            <div className="text-2xl font-bold text-red-600">
              {disputedCount}
            </div>
            <p className="text-sm text-muted-foreground">Elementos Disputados</p>
          </CardContent>
        </Card>
      </div>

      {/* Upload dialog */}
      <Dialog
        open={showUploadForm}
        onOpenChange={(open) =>
          setShowUploadForm(canUploadInvoices ? open : false)
        }
      >
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Subir Factura</DialogTitle>
            <DialogDescription>
              Sube documentos de factura y vincúlalos a rubros específicos de costos y períodos de tiempo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4 overflow-y-auto flex-1">
            {/* Rubro and Description */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor={lineItemSelectId}>Rubro *</Label>
                {lineItemOptions.length ? (
                  <Select
                    value={uploadFormData.line_item_id}
                    onValueChange={(value) =>
                      setUploadFormData((prev) => ({
                        ...prev,
                        line_item_id: value,
                      }))
                    }
                  >
                    <SelectTrigger id={lineItemSelectId} aria-label="Rubro">
                      <SelectValue placeholder="Selecciona rubro" />
                    </SelectTrigger>
                    <SelectContent>
                      {lineItemOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id={lineItemSelectId}
                    placeholder="Ingresa ID de rubro"
                    value={uploadFormData.line_item_id}
                    onChange={(e) =>
                      setUploadFormData((prev) => ({
                        ...prev,
                        line_item_id: e.target.value,
                      }))
                    }
                    aria-describedby={`${lineItemSelectId}-help`}
                  />
                )}
                {lineItemDropdownMessage && (
                  <p
                    id={`${lineItemSelectId}-help`}
                    className="text-sm text-muted-foreground mt-2"
                  >
                    {lineItemDropdownMessage}
                  </p>
                )}
              </div>

              {/* Description tied to Rubro */}
              <div className="space-y-2">
                <Label htmlFor="taxonomy-description">Descripción del Rubro (Taxonomía)</Label>
                <Textarea
                  id="taxonomy-description"
                  name="taxonomy-description"
                  value={(() => {
                    // Get taxonomy description from selected line item
                    const selectedItem = safeLineItems.find(
                      (item) => item.id === uploadFormData.line_item_id
                    );
                    if (!selectedItem) return "";
                    
                    // Build taxonomy description from line item properties
                    const category = (selectedItem as any).categoria?.trim() || selectedItem.category?.trim();
                    const description = selectedItem.description?.trim();
                    const tipoCosto = (selectedItem as any).tipo_costo?.trim();
                    
                    const parts: string[] = [];
                    if (category) parts.push(category);
                    if (description) parts.push(description);
                    if (tipoCosto) parts.push(`Tipo: ${tipoCosto}`);
                    
                    return parts.length > 0
                      ? parts.join(" — ")
                      : "Sin descripción configurada para este rubro";
                  })()}
                  rows={2}
                  readOnly
                  disabled
                  className="bg-muted cursor-not-allowed"
                  aria-describedby="taxonomy-description-help"
                />
                <p id="taxonomy-description-help" className="text-xs text-muted-foreground">
                  Esta descripción proviene del catálogo de rubros y no se puede editar.
                </p>
              </div>

              {/* Optional user notes */}
              <div className="space-y-2">
                <Label htmlFor="description">Notas de Conciliación (Opcional)</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Agrega notas adicionales sobre esta factura (opcional)"
                  value={uploadFormData.description}
                  onChange={(e) =>
                    setUploadFormData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  rows={2}
                  aria-describedby="description-help"
                />
                <p id="description-help" className="text-xs text-muted-foreground">
                  Campo opcional para agregar contexto o notas específicas de esta factura.
                </p>
              </div>
            </div>

            {/* Month Range Selection */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="start-month">Mes Inicio *</Label>
                <Select
                  value={String(uploadFormData.start_month)}
                  onValueChange={(value) =>
                    setUploadFormData((prev) => ({
                      ...prev,
                      start_month: parseInt(value, 10),
                      // Sync legacy month field for backward compatibility with existing invoice API
                      // The API still uses single 'month' field, but UI now supports ranges
                      month: parseInt(value, 10),
                    }))
                  }
                >
                  <SelectTrigger id="start-month" aria-label="Mes de inicio">
                    <SelectValue placeholder="Selecciona mes" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>
                        Month {i + 1}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="end-month">Mes Fin *</Label>
                <Select
                  value={String(uploadFormData.end_month)}
                  onValueChange={(value) =>
                    setUploadFormData((prev) => ({
                      ...prev,
                      end_month: parseInt(value, 10),
                    }))
                  }
                >
                  <SelectTrigger id="end-month" aria-label="Mes de fin">
                    <SelectValue placeholder="Selecciona mes" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>
                        Month {i + 1}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Selecciona un rango para aplicar la misma factura a múltiples meses
                </p>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="amount">Monto de Factura *</Label>
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  placeholder="0.00"
                  value={uploadFormData.amount}
                  onChange={(e) =>
                    setUploadFormData((prev) => ({
                      ...prev,
                      amount: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendor">Vendor *</Label>
                {providers.length > 0 ? (
                  <Select
                    value={uploadFormData.vendor}
                    onValueChange={(value) =>
                      setUploadFormData((prev) => ({
                        ...prev,
                        vendor: value,
                      }))
                    }
                  >
                    <SelectTrigger id="vendor" aria-label="Vendor">
                      <SelectValue placeholder="Select vendor" />
                    </SelectTrigger>
                    <SelectContent>
                      {providers.map((provider) => (
                        <SelectItem key={provider.id} value={provider.nombre}>
                          {provider.nombre}
                        </SelectItem>
                      ))}
                      <SelectItem value={VENDOR_OTHER_VALUE}>Other (enter manually)</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="vendor"
                    name="vendor"
                    placeholder="Vendor name (as on invoice)"
                    value={uploadFormData.vendor}
                    onChange={(e) =>
                      setUploadFormData((prev) => ({
                        ...prev,
                        vendor: e.target.value,
                      }))
                    }
                    aria-describedby="vendor-help"
                  />
                )}
                {providersLoading && (
                  <p className="text-xs text-muted-foreground">
                    Loading vendors...
                  </p>
                )}
                {!providersLoading && providers.length === 0 && (
                  <p id="vendor-help" className="text-xs text-muted-foreground">
                    Enter vendor name exactly as shown on the invoice.
                  </p>
                )}
                {uploadFormData.vendor === VENDOR_OTHER_VALUE && (
                  <Input
                    id="vendor-custom"
                    name="vendor-custom"
                    placeholder="Enter vendor name"
                    className="mt-2"
                    onChange={(e) =>
                      setUploadFormData((prev) => ({
                        ...prev,
                        vendor: e.target.value,
                      }))
                    }
                    autoFocus
                  />
                )}
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="invoice_number">
                  Número de Factura{selectedLineItemIsMOD ? "" : " *"}
                </Label>
                <Input
                  id="invoice_number"
                  name="invoice_number"
                  placeholder="FAC-001"
                  value={uploadFormData.invoice_number}
                  onChange={(e) =>
                    setUploadFormData((prev) => ({
                      ...prev,
                      invoice_number: e.target.value,
                    }))
                  }
                  onBlur={(e) =>
                    setUploadFormData((prev) => ({
                      ...prev,
                      invoice_number: e.target.value.trim(),
                    }))
                  }
                  aria-describedby="invoice-number-help"
                />
                <p id="invoice-number-help" className="text-xs text-muted-foreground">
                  {selectedLineItemIsMOD
                    ? "Opcional para rubros de MOD; si se deja en blanco, se generará un número interno."
                    : "Ingresa el número de factura del documento del proveedor."}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoice_date">Fecha de Factura *</Label>
                <Input
                  id="invoice_date"
                  name="invoice_date"
                  type="date"
                  value={uploadFormData.invoice_date}
                  onChange={(e) =>
                    setUploadFormData((prev) => ({
                      ...prev,
                      invoice_date: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor={fileInputId}>
                {selectedLineItemIsMOD ? "Subir Archivo (Opcional para MOD)" : "Subir Archivo *"}
              </Label>
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4">
                <Input
                  id={fileInputId}
                  name="invoice_file"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.xlsx,.csv"
                  onChange={handleFileUpload}
                  className="mb-2"
                  aria-describedby={fileHelpId}
                />
                <p
                  id={fileHelpId}
                  className="text-xs text-muted-foreground text-center"
                >
                  {selectedLineItemIsMOD
                    ? "Formatos soportados: PDF, JPG, PNG, Excel, CSV. Documento opcional para rubros MOD."
                    : "Formatos soportados: PDF, JPG, PNG, Excel, CSV"}
                </p>
                {uploadFormData.file && (
                  <p className="text-sm text-primary mt-2">
                    Seleccionado: {uploadFormData.file.name}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 flex-shrink-0 pt-4 border-t">
            <Button variant="outline" onClick={handleCancelUpload}>
              Cancelar
            </Button>
            <Button
              onClick={handleInvoiceSubmit}
              disabled={uploadMutation.isPending || !canUploadInvoices}
            >
              {uploadMutation.isPending ? "Subiendo..." : "Subir Factura"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Correction/Deletion Request Dialog */}
      <Dialog
        open={showCorrectionDialog}
        onOpenChange={setShowCorrectionDialog}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Solicitar Corrección o Eliminación</DialogTitle>
            <DialogDescription>
              Esta factura fue conciliada. Para corregirla o eliminarla, debe ser aprobado por un usuario diferente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {selectedInvoiceForCorrection && (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Factura:</span>
                  <span className="font-medium">{selectedInvoiceForCorrection.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Monto:</span>
                  <span className="font-medium">{formatCurrency(selectedInvoiceForCorrection.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Mes:</span>
                  <span className="font-medium">Month {selectedInvoiceForCorrection.month}</span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="correction-comment">
                Razón de la solicitud (opcional)
              </Label>
              <Textarea
                id="correction-comment"
                placeholder="Describe por qué se necesita corregir o eliminar esta factura..."
                value={correctionComment}
                onChange={(e) => setCorrectionComment(e.target.value)}
                rows={3}
              />
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-900">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                <p>
                  Esta solicitud quedará pendiente hasta que sea aprobada por un usuario diferente al que concilió la factura.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowCorrectionDialog(false);
                setSelectedInvoiceForCorrection(null);
                setCorrectionComment("");
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmitCorrectionRequest}
              disabled={statusMutation.isPending}
              variant="destructive"
            >
              {statusMutation.isPending ? "Enviando..." : "Solicitar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Invoices table */}
      <Card>
        <CardHeader>
          <CardTitle>Facturas y Documentación</CardTitle>
        </CardHeader>
        <CardContent>
          {invoicesErrorInfo ? (
            <div className="text-center py-12 text-destructive">
              {invoicesErrorInfo.message || "Error al cargar facturas."}
            </div>
          ) : invoicesLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-muted-foreground">Cargando facturas...</div>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                {filterLineItem || filterMonth
                  ? "No se encontraron facturas con ese filtro"
                  : "Aún no se han subido facturas"}
              </p>
              <p className="text-sm text-muted-foreground">
                Sube facturas para rastrear y conciliar contra montos pronosticados
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rubro</TableHead>
                    <TableHead>Mes</TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Archivo</TableHead>
                    <TableHead>Subido</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="max-w-md">
                            {(() => {
                              const lineItem = safeLineItems.find((li) => li.id === inv.line_item_id);
                              const formatted = formatLineItemDisplay(lineItem, inv.month);
                              return (
                                <div title={formatted.tooltip}>
                                  <div className="font-medium truncate">
                                    {formatted.primary}
                                  </div>
                                  {formatted.secondary && (
                                    <div className="text-xs text-muted-foreground truncate">
                                      {formatted.secondary}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-4 w-4 p-0 flex-shrink-0"
                            onClick={() => navigateToForecast(inv.line_item_id, inv.month)}
                            title="Ver en pronóstico"
                          >
                            <ExternalLink size={12} />
                          </Button>
                        </div>
                      </TableCell>

                      <TableCell>Month {inv.month}</TableCell>
                      <TableCell>{formatCurrency(inv.amount)}</TableCell>

                      <TableCell>
                        <Badge
                          variant={
                            inv.status === "Matched"
                              ? "default"
                              : inv.status === "Disputed"
                              ? "destructive"
                              : inv.status === "PendingDeletionApproval" || inv.status === "PendingCorrectionApproval"
                              ? "secondary"
                              : "secondary"
                          }
                        >
                          {inv.status === "PendingDeletionApproval"
                            ? "Pendiente Eliminación"
                            : inv.status === "PendingCorrectionApproval"
                            ? "Pendiente Corrección"
                            : inv.status}
                        </Badge>
                      </TableCell>

                      <TableCell className="max-w-[260px]">
                        <div className="flex flex-col text-sm">
                          {/* Prefer friendly filename, else fallback to original, file_name, documentKey, or default text */}
                          <span
                            className="truncate font-medium"
                            title={
                              extractFriendlyFilename(inv.documentKey, inv.originalName) ||
                              inv.originalName ||
                              inv.file_name ||
                              inv.documentKey ||
                              "Documento pendiente"
                            }
                          >
                            {extractFriendlyFilename(inv.documentKey, inv.originalName) ||
                              inv.originalName ||
                              inv.file_name ||
                              inv.documentKey ||
                              "Documento pendiente"}
                          </span>
                          {inv.documentKey && (
                            <span
                              className="text-xs text-muted-foreground truncate"
                              title={`Storage path: ${inv.documentKey}`}
                            >
                              {inv.documentKey.length > STORAGE_PATH_DISPLAY_LENGTH
                                ? `${inv.documentKey.substring(0, STORAGE_PATH_DISPLAY_LENGTH)}...`
                                : inv.documentKey}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="text-sm">
                          <div>{new Date(inv.uploaded_at).toLocaleDateString()}</div>
                          {inv.uploaded_by && (
                            <div className="text-xs text-muted-foreground">
                              Submitted by {inv.uploaded_by}
                            </div>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        {canUpdateStatus ? (
                          <div className="flex items-center gap-1">
                            {inv.status === "Pending" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    handleStatusUpdate(inv.id, "Matched")
                                  }
                                  disabled={statusMutation.isPending}
                                >
                                  Conciliar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    handleStatusUpdate(
                                      inv.id,
                                      "Disputed",
                                      "Requiere revisión",
                                    )
                                  }
                                  disabled={statusMutation.isPending}
                                >
                                  Disputar
                                </Button>
                              </>
                            )}
                            {inv.status === "Matched" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRequestCorrection(inv)}
                                disabled={statusMutation.isPending}
                                className="gap-1"
                                title="Solicitar corrección o eliminación"
                              >
                                <AlertCircle size={14} />
                                Solicitar Corrección
                              </Button>
                            )}
                            {inv.status === "Disputed" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleStatusUpdate(inv.id, "Matched")}
                                disabled={statusMutation.isPending}
                              >
                                Resolver
                              </Button>
                            )}
                            {inv.status === "PendingDeletionApproval" && (
                              <>
                                {canApproveDeletion(inv) ? (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => handleApproveDeletion(inv.id)}
                                      disabled={statusMutation.isPending}
                                      className="gap-1"
                                      title="Aprobar eliminación"
                                    >
                                      <Trash2 size={14} />
                                      Aprobar
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleRejectDeletion(inv.id)}
                                      disabled={statusMutation.isPending}
                                      title="Rechazar eliminación"
                                    >
                                      Rechazar
                                    </Button>
                                  </>
                                ) : (
                                  <div className="text-xs text-muted-foreground max-w-[180px]" title="La eliminación debe ser aprobada por un usuario diferente al que concilió esta factura">
                                    Pendiente aprobación (requiere otro usuario)
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground">
                            Solo lectura
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
