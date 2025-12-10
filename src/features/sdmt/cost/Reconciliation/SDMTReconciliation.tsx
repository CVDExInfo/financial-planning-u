// src/features/sdmt/cost/Reconciliation/SDMTReconciliation.tsx
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
import {
  uploadInvoice,
  updateInvoiceStatus,
  type UploadInvoicePayload,
  FinanzasApiError,
} from "@/api/finanzas";

import {
  formatLineItemDisplay,
  extractFriendlyFilename,
} from "./lineItemFormatters";

/** --------- Types & helpers --------- */

// Constants
const VENDOR_OTHER_VALUE = "__other__";
const STORAGE_PATH_DISPLAY_LENGTH = 40;

type UploadFormState = {
  line_item_id: string;
  month: number;
  amount: string;
  description: string;
  file: File | null;
  vendor: string;
  invoice_number: string;
  invoice_date: string;
};

const createInitialUploadForm = (): UploadFormState => ({
  line_item_id: "",
  month: 1,
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

/** --------- Component --------- */

export default function SDMTReconciliation() {
  const allowMockData = import.meta.env.VITE_USE_MOCKS === "true";

  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadFormData, setUploadFormData] = useState<UploadFormState>(
    createInitialUploadForm
  );

  // Routing/context
  const location = useLocation();
  const navigate = useNavigate();
  const { currentProject, projectChangeCount } = useProject();
  const { canUploadInvoices, canApprove } = usePermissions();

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

  useEffect(() => {
    if (filterLineItem) {
      setUploadFormData((prev) => ({
        ...prev,
        line_item_id: filterLineItem,
        month: filterMonth ? parseInt(filterMonth, 10) || 1 : 1,
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

  // Filters
  const filteredInvoices = useMemo(() => {
    // Create a set of valid line item IDs from baseline-filtered rubros
    const validLineItemIds = new Set(safeLineItems.map((li) => li.id));
    
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
  }, [safeInvoices, safeLineItems, filterLineItem, filterMonth]);

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
    onSuccess: async () => {
      toast.success("Factura y documento subidos exitosamente");
      setShowUploadForm(false);
      setUploadFormData(createInitialUploadForm());
      await invalidateInvoices();
    },
    onError: (err: unknown) => {
      let message = "Error inesperado al subir factura. Por favor intenta nuevamente o contacta soporte.";
      if (err instanceof FinanzasApiError) {
        message = err.message;
      } else if (err instanceof Error) {
        message = err.message;
      }
      toast.error(message);
      if (import.meta.env.DEV) {
        console.error("[SDMTReconciliation] Invoice upload failed", { projectId, payload: uploadFormData, err });
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

    if (!uploadFormData.invoice_date) {
      toast.error("Fecha de factura requerida para conciliación");
      return;
    }

    const parsedInvoiceDate = Date.parse(uploadFormData.invoice_date);
    if (Number.isNaN(parsedInvoiceDate)) {
      toast.error("Ingresa una fecha de factura válida");
      return;
    }

    const vendorValue = uploadFormData.vendor.trim();
    if (!vendorValue) {
      toast.error("Proveedor requerido para conciliación");
      return;
    }

    if (
      !uploadFormData.file ||
      !uploadFormData.line_item_id ||
      !uploadFormData.amount
    ) {
      toast.error("Por favor completa todos los campos requeridos");
      return;
    }

    if (!projectId) {
      toast.error("Selecciona un proyecto antes de subir facturas");
      return;
    }

    const amount = parseFloat(uploadFormData.amount);
    if (Number.isNaN(amount)) {
      toast.error("Ingresa un monto de factura válido");
      return;
    }
    if (!(amount > 0)) {
      toast.error("El monto de la factura debe ser mayor a cero");
      return;
    }

    try {
      await uploadMutation.mutateAsync({
        projectId,
        file: uploadFormData.file,
        line_item_id: uploadFormData.line_item_id,
        month: uploadFormData.month,
        amount,
        description: uploadFormData.description.trim() || undefined,
        vendor: vendorValue,
        invoice_number: uploadFormData.invoice_number.trim() || undefined,
        invoice_date: uploadFormData.invoice_date.trim() || undefined,
      });
    } catch (err) {
      // onError handler already surfaces messaging; this catch prevents unhandled rejections
      console.error("Upload invoice mutation rejected", err);
    }
  };

  const handleStatusUpdate = async (
    invoiceId: string,
    status: InvoiceStatus,
    comment?: string
  ) => {
    await statusMutation.mutateAsync({ invoiceId, status, comment });
  };

  const navigateToForecast = (line_item_id: string, month?: number) => {
    const params = new URLSearchParams();
    if (month) params.set("month", String(month));
    params.set("line_item", line_item_id);
    navigate(`/sdmt/cost/forecast?${params.toString()}`);
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
          <h1 className="text-3xl font-bold">Conciliación de Facturas</h1>
          <p className="text-muted-foreground leading-relaxed">
            Sube y concilia facturas contra montos pronosticados
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Subir Factura</DialogTitle>
            <DialogDescription>
              Sube documentos de factura y vincúlalos a rubros específicos de costos y períodos de tiempo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="grid gap-4 md:grid-cols-[1.6fr,1fr] md:items-end">
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

              <div className="space-y-2">
                <Label htmlFor={monthSelectId}>Mes *</Label>
                <Select
                  value={String(uploadFormData.month)}
                  onValueChange={(value) =>
                    setUploadFormData((prev) => ({
                      ...prev,
                      month: parseInt(value, 10),
                    }))
                  }
                >
                  <SelectTrigger id={monthSelectId} aria-label="Mes de factura">
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
                <Label htmlFor="invoice_number">Número de Factura</Label>
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
                  Enter the invoice number from vendor's invoice document.
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
              <Label htmlFor={fileInputId}>Subir Archivo *</Label>
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
                  Formatos soportados: PDF, JPG, PNG, Excel, CSV
                </p>
                {uploadFormData.file && (
                  <p className="text-sm text-primary mt-2">
                    Seleccionado: {uploadFormData.file.name}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowUploadForm(false)}>
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
                              : "secondary"
                          }
                        >
                          {inv.status}
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
