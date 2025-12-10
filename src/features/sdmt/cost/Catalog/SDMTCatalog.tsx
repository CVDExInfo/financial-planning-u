import { useEffect, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DialogFooter,
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
  Plus,
  Search,
  Edit,
  Trash2,
  Share,
  Download,
  Package,
  Star,
  Paperclip,
} from "lucide-react";

import { usePermissions } from "@/hooks/usePermissions";
import { useProject } from "@/contexts/ProjectContext";
import { handleFinanzasApiError } from "@/features/sdmt/cost/utils/errorHandling";
import Protected from "@/components/Protected";
import ModuleBadge from "@/components/ModuleBadge";
import { ServiceTierSelector } from "@/components/ServiceTierSelector";
import LoadingSpinner from "@/components/LoadingSpinner";
import { SaveBar, type SaveBarState } from "@/components/SaveBar";
import { toast } from "sonner";
import type { LineItem, BaselineBudget, Currency } from "@/types/domain";
import { excelExporter, downloadExcelFile } from "@/lib/excel-export";
import { PDFExporter, formatReportCurrency } from "@/lib/pdf-export";
import { logger } from "@/utils/logger";
import { cn } from "@/lib/utils";
import { useProjectLineItems } from "@/hooks/useProjectLineItems";
import {
  addProjectRubro,
  deleteProjectRubro,
  FinanzasApiError,
} from "@/api/finanzas";
import {
  uploadDocument,
  type DocumentUploadMeta,
  type DocumentUploadStage,
} from "@/lib/documents/uploadService";
import { ErrorBanner } from "@/components/ErrorBanner";
import { useAuth } from "@/hooks/useAuth";
import {
  COST_CATEGORIES,
  getCategoryByCode,
} from "@/data/cost-categories";
import { ES_TEXTS } from "@/lib/i18n/es";

type PendingChangeType = "add" | "edit" | "delete";

interface PendingChange {
  type: PendingChangeType;
  item: LineItem;
  originalItem?: LineItem;
}

type CatalogDocumentMeta = DocumentUploadMeta;

interface CatalogFormState {
  category: string;
  categoryCode: string;
  subtype: string;
  lineItemCode: string;
  description: string;
  qty: number;
  unit_cost: number;
  currency: string;
  start_month: number;
  end_month: number;
  recurring: boolean;
}

const createEmptyFormState = (): CatalogFormState => ({
  category: "",
  categoryCode: "",
  subtype: "",
  lineItemCode: "",
  description: "",
  qty: 1,
  unit_cost: 0,
  currency: "USD",
  start_month: 1,
  end_month: 1,
  recurring: false,
});

export function SDMTCatalog() {
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [pendingChanges, setPendingChanges] = useState<
    Map<string, PendingChange>
  >(new Map());
  const [saveBarState, setSaveBarState] = useState<SaveBarState>("idle");
  const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const [docDialogOpen, setDocDialogOpen] = useState(false);
  const [docTarget, setDocTarget] = useState<LineItem | null>(null);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [lineItemDocuments, setLineItemDocuments] = useState<
    Record<string, CatalogDocumentMeta[]>
  >({});
  const [documentUploadStage, setDocumentUploadStage] =
    useState<DocumentUploadStage | null>(null);
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);

  const [editingItem, setEditingItem] = useState<LineItem | null>(null);
  const [isCreatingLineItem, setIsCreatingLineItem] = useState(false);
  const [isUpdatingLineItem, setIsUpdatingLineItem] = useState(false);

  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [formData, setFormData] = useState<CatalogFormState>(
    createEmptyFormState()
  );

  const {
    selectedProjectId,
    currentProject,
    projectChangeCount,
    invalidateProjectData,
  } = useProject();

  const {
    lineItems: queryLineItems,
    isLoading: isLineItemsLoading,
    isFetching: isLineItemsFetching,
    error: lineItemsError,
    invalidate: invalidateLineItems,
  } = useProjectLineItems();

  const { login } = useAuth();
  const { isReadOnly, currentRole } = usePermissions();

  const loading = isLineItemsLoading && queryLineItems.length === 0;
  const refreshing = isLineItemsFetching && !isLineItemsLoading;
  const hasUnsavedChanges = pendingChanges.size > 0;

  useEffect(() => {
    if (lineItemsError) {
      return;
    }

    setCatalogError(null);
    setLineItems(Array.isArray(queryLineItems) ? queryLineItems : []);
    setPendingChanges(new Map());
    setSaveBarState("idle");

    if (selectedProjectId) {
      logger.debug(
        "Catalog: received",
        queryLineItems.length,
        "items for",
        selectedProjectId
      );
    }
  }, [lineItemsError, queryLineItems, selectedProjectId]);

  useEffect(() => {
    if (!lineItemsError) {
      return;
    }

    const message = handleFinanzasApiError(lineItemsError, {
      onAuthError: () => login(),
      fallback: "No pudimos cargar el catálogo de rubros.",
    });

    setCatalogError(message);
    setLineItems([]);
    setPendingChanges(new Map());
    setSaveBarState("idle");
    toast.error(message);
    logger.error("Failed to load line items:", message, lineItemsError);
  }, [lineItemsError, login]);

  const uiErrorMessage = catalogError;

  const safeLineItems = Array.isArray(lineItems) ? lineItems : [];
  const filteredItems = safeLineItems.filter((item) => {
    const description = (item.description || "").toString().toLowerCase();
    const category = (item.category || "").toString().toLowerCase();
    const term = searchTerm.toLowerCase();

    const matchesSearch =
      description.includes(term) || category.includes(term);
    const matchesCategory =
      categoryFilter === "all" || item.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  const categories = Array.from(
    new Set(safeLineItems.map((item) => item.category))
  );

  const summaryCurrency =
    currentProject?.currency || safeLineItems[0]?.currency || "USD";

  const showInitialLoading = loading;
  const showErrorState = Boolean(uiErrorMessage);
  const showEmptyState =
    !showInitialLoading && !showErrorState && safeLineItems.length === 0;

  const formatCurrency = (amount: number, currency: string) => {
    const safeCurrency = currency || "USD";

    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: safeCurrency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const calculateTotalCost = (item: LineItem) => {
    const totalFromApi = Number(
      (item as any).total_cost ?? (item as any).total
    );
    if (Number.isFinite(totalFromApi) && totalFromApi > 0) {
      return totalFromApi;
    }

    const qty = Number(item.qty ?? 0);
    const unitCost = Number(item.unit_cost ?? 0);
    const duration =
      Number(item.end_month ?? 0) - Number(item.start_month ?? 0) + 1;
    const baseCost = qty * unitCost;

    return item.recurring
      ? baseCost * (duration > 0 ? duration : 1)
      : baseCost;
  };

  const clampMonth = (value: number) => {
    if (!Number.isFinite(value)) return 1;
    return Math.min(Math.max(Math.round(value), 1), 60);
  };

  const getTermMonths = (data: CatalogFormState) =>
    Math.max(data.end_month - data.start_month + 1, 1);

  const currentTermMonths = getTermMonths(formData);

  const setRecurringFlag = (recurring: boolean) => {
    setFormData((prev) => {
      const start = clampMonth(prev.start_month);
      const prevTerm = getTermMonths(prev);
      const term = recurring ? Math.max(prevTerm, 12) : 1;
      const end = recurring ? clampMonth(start + term - 1) : start;

      return {
        ...prev,
        recurring,
        start_month: start,
        end_month: end,
      };
    });
  };

  const updateStartMonth = (value: number) => {
    const start = clampMonth(value);
    setFormData((prev) => {
      const term = prev.recurring ? getTermMonths(prev) : 1;
      const end = prev.recurring ? clampMonth(start + term - 1) : start;

      return {
        ...prev,
        start_month: start,
        end_month: end,
      };
    });
  };

  const updateTermMonths = (months: number) => {
    const term = Math.max(months, 1);
    setFormData((prev) => {
      const start = clampMonth(prev.start_month);
      const end = prev.recurring ? clampMonth(start + term - 1) : start;

      return {
        ...prev,
        start_month: start,
        end_month: end,
      };
    });
  };

  const resetForm = () => {
    setFormData(createEmptyFormState());
  };

  const handleShare = async () => {
    try {
      toast.loading("Generando reporte profesional...");

      const totalCost = filteredItems.reduce(
        (sum, item) => sum + calculateTotalCost(item),
        0
      );
      const laborCost = filteredItems
        .filter((item) => item.category === "Labor") // Keep "Labor" as category key
        .reduce((sum, item) => sum + calculateTotalCost(item), 0);
      const nonLaborCost = totalCost - laborCost;

      const reportData = {
        title: "Resumen de Catálogo de Costos",
        subtitle: "Análisis de Estructura de Costos del Proyecto",
        generated: new Date().toLocaleDateString(),
        metrics: [
          {
            label: "Total de Rubros",
            value: filteredItems.length.toString(),
            color: "#64748b",
          },
          {
            label: "Costo Estimado Total",
            value: formatReportCurrency(totalCost),
            color: "#2BB673",
          },
          {
            label: "Costos de Mano de Obra",
            value: formatReportCurrency(laborCost),
            change: `${((laborCost / totalCost) * 100).toFixed(
              1
            )}% of total`,
            changeType: "neutral" as const,
            color: "#14B8A6",
          },
          {
            label: "Costos No Laborales",
            value: formatReportCurrency(nonLaborCost),
            change: `${((nonLaborCost / totalCost) * 100).toFixed(
              1
            )}% of total`,
            changeType: "neutral" as const,
            color: "#f59e0b",
          },
        ],
        summary: [
          `Cost catalog contains ${filteredItems.length} line items across ${categories.length} categories`,
          `Labor costs represent ${((laborCost / totalCost) * 100).toFixed(
            1
          )}% of total budget`,
          `${
            filteredItems.filter((item) => item.recurring).length
          } recurring cost items identified`,
          `${
            filteredItems.filter((item) => (item as any).capex_flag).length
          } items flagged as capital expenditure`,
        ],
        recommendations: [
          "Revisar rubros recurrentes para oportunidades de optimización",
          "Validar cotizaciones de proveedores para rubros no laborales significativos",
          "Considerar agrupar servicios similares para mejor precio",
          "Establecer mapeos claros de centros de costo para seguimiento preciso",
        ],
      };

      await PDFExporter.exportToPDF(reportData);
      toast.dismiss();
      toast.success("Reporte profesional de catálogo generado");
    } catch (error) {
      toast.dismiss();
      toast.error("Error al generar reporte profesional");
      console.error("Share error:", error);
    }
  };

  const openDocumentDialog = (item: LineItem) => {
    setDocTarget(item);
    setDocFile(null);
    setDocDialogOpen(true);
  };

  const handleDocumentUpload = async () => {
    if (!docTarget || !docFile) {
      toast.error("Selecciona un archivo para cargar");
      return;
    }

    if (!selectedProjectId) {
      toast.error("Selecciona un proyecto antes de cargar documentos");
      return;
    }

    try {
      setIsUploadingDocument(true);
      setDocumentUploadStage("presigning");

      const uploaded = await uploadDocument(
        {
          projectId: selectedProjectId,
          module: "catalog",
          lineItemId: docTarget.id,
          file: docFile,
        },
        {
          onStageChange: (stage) => setDocumentUploadStage(stage),
        }
      );

      setLineItemDocuments((prev) => {
        const existing = prev[docTarget.id] ?? [];
        return {
          ...prev,
          [docTarget.id]: [uploaded, ...existing],
        };
      });

      if (uploaded.warnings?.length) {
        console.warn("Catalog document upload returned warnings", {
          lineItemId: docTarget.id,
          warnings: uploaded.warnings,
        });
      }

      if (!uploaded.status || uploaded.status === 201 || uploaded.status === 200) {
        toast.success("Documento de soporte cargado");
      }

      setDocDialogOpen(false);
      setDocFile(null);
    } catch (error) {
      let message = "Error al cargar documento";

      if (error instanceof FinanzasApiError) {
        if (error.status === 503) {
          message =
            "La carga de documentos no está disponible temporalmente. Intenta más tarde.";
        } else if (error.status && error.status >= 500) {
          message = "Error interno en Finanzas";
        } else {
          message = error.message || message;
        }
      } else if (error instanceof Error) {
        message = error.message;
      }

      toast.error(message);
      console.error("Document upload failed", {
        lineItemId: docTarget?.id,
        projectId: selectedProjectId,
        error,
      });
    } finally {
      setIsUploadingDocument(false);
      setDocumentUploadStage(null);
    }
  };

  const handleSubmitLineItem = async () => {
    if (!formData.category || !formData.description || formData.unit_cost <= 0) {
      toast.error(
        "Completa todos los campos requeridos (categoría, descripción, costo unitario)"
      );
      return;
    }

    if (!selectedProjectId) {
      toast.error("Selecciona un proyecto antes de agregar rubros");
      return;
    }

    const rubroId =
      formData.lineItemCode || formData.categoryCode || `custom-${Date.now()}`;

    const endMonth = formData.recurring
      ? formData.end_month
      : formData.start_month;

    const durationMonths = formData.recurring
      ? Math.max(endMonth - formData.start_month + 1, 1)
      : 1;

    const selectedCategory = getCategoryByCode(formData.categoryCode);
    const selectedLineItem = selectedCategory?.lineas.find(
      (line) => line.codigo === formData.lineItemCode
    );

    try {
      setIsCreatingLineItem(true);

      await addProjectRubro(selectedProjectId, {
        rubroId,
        qty: formData.qty,
        unitCost: formData.unit_cost,
        type: formData.recurring ? "recurring" : "one-time",
        duration: formData.recurring
          ? `M${formData.start_month}-M${endMonth}`
          : `M${formData.start_month}`,
        currency: formData.currency,
        description: formData.description,
        start_month: formData.start_month,
        end_month: endMonth,
        term: durationMonths,
        category: selectedCategory?.nombre || formData.category,
        linea_codigo: formData.lineItemCode || formData.categoryCode,
        tipo_costo: selectedLineItem?.tipo_costo,
      });

      toast.success("Rubro creado");
      setIsAddDialogOpen(false);
      resetForm();
      await invalidateLineItems();
      invalidateProjectData();
    } catch (error) {
      logger.error("Failed to create line item:", error);
      toast.error("Error al crear rubro. Intenta nuevamente.");
    } finally {
      setIsCreatingLineItem(false);
    }
  };

  const handleEditClick = (item: LineItem) => {
    setEditingItem(item);

    setFormData({
      category: item.category || "",
      categoryCode: "",
      subtype: (item as any).subtype || "",
      lineItemCode: "",
      description: item.description || "",
      qty: item.qty ?? 1,
      unit_cost: item.unit_cost ?? 0,
      currency: (item.currency as Currency) || "USD",
      start_month: item.start_month ?? 1,
      end_month: item.recurring ? item.end_month ?? 12 : item.start_month ?? 1,
      recurring: item.recurring ?? false,
    });

    setIsEditDialogOpen(true);
  };

  const handleUpdateLineItem = async () => {
    if (!editingItem) return;

    if (!formData.category || !formData.description || formData.unit_cost <= 0) {
      toast.error("Completa todos los campos requeridos");
      return;
    }

    if (!selectedProjectId) {
      toast.error("Selecciona un proyecto antes de guardar");
      return;
    }

    const endMonth = formData.recurring
      ? formData.end_month
      : formData.start_month;

    const durationMonths = formData.recurring
      ? Math.max(endMonth - formData.start_month + 1, 1)
      : 1;

    const selectedCategory = getCategoryByCode(formData.categoryCode);
    const selectedLineItem = selectedCategory?.lineas.find(
      (line) => line.codigo === formData.lineItemCode
    );

    const existingLineaCodigo = (editingItem as any).linea_codigo;
    const existingTipoCosto = (editingItem as any).tipo_costo;

    const lineaCodigoPayload =
      formData.lineItemCode ||
      formData.categoryCode ||
      existingLineaCodigo;

    const tipoCostoPayload =
      selectedLineItem?.tipo_costo ?? existingTipoCosto;

    const categoryPayload =
      selectedCategory?.nombre || formData.category || editingItem.category;

    const updatedItem: LineItem = {
      ...editingItem,
      category: categoryPayload,
      subtype: formData.subtype,
      description: formData.description,
      qty: formData.qty,
      unit_cost: formData.unit_cost,
      currency: formData.currency as Currency,
      start_month: formData.start_month,
      end_month: endMonth,
      recurring: formData.recurring,
      one_time: !formData.recurring,
      updated_at: new Date().toISOString(),
    };

    const duration = updatedItem.recurring
      ? `M${updatedItem.start_month}-M${updatedItem.end_month}`
      : `M${updatedItem.start_month}`;

    try {
      setIsUpdatingLineItem(true);

      const response = await addProjectRubro(selectedProjectId, {
        rubroId: updatedItem.id,
        qty: updatedItem.qty,
        unitCost: updatedItem.unit_cost,
        type: updatedItem.recurring ? "recurring" : "one-time",
        duration,
        currency: updatedItem.currency,
        description: updatedItem.description,
        start_month: updatedItem.start_month,
        end_month: updatedItem.end_month,
        term: durationMonths,
        category: categoryPayload,
        linea_codigo: lineaCodigoPayload,
        tipo_costo: tipoCostoPayload,
      });

      const warnings = (response as any)?.warnings;
      if (Array.isArray(warnings) && warnings.length) {
        console.warn("Rubros edit returned warnings", warnings);
      }

      setLineItems((prev) =>
        prev.map((item) => (item.id === editingItem.id ? updatedItem : item))
      );

      setPendingChanges((prev) => {
        const updated = new Map(prev);
        updated.delete(editingItem.id);
        return updated;
      });

      setSaveBarState("idle");
      toast.success("Rubro actualizado");
      setIsEditDialogOpen(false);
      setEditingItem(null);
      resetForm();
      await invalidateLineItems();
      invalidateProjectData();
    } catch (error) {
      logger.error("Failed to update line item:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Error al actualizar rubro. Intenta nuevamente.";
      toast.error(message);
    } finally {
      setIsUpdatingLineItem(false);
    }
  };

  const handleDeleteClick = async (item: LineItem) => {
    if (
      !confirm(
        `Are you sure you want to delete "${item.description}"? This change will not be saved until you click Save.`
      )
    ) {
      return;
    }

    setPendingChanges((prev) => {
      const updated = new Map(prev);
      updated.set(item.id, { type: "delete", item });
      return updated;
    });

    setLineItems((prev) => prev.filter((i) => i.id !== item.id));
    setSaveBarState("dirty");
    toast.success("Rubro marcado para eliminar (no guardado)");
  };

  const handleSaveChanges = async () => {
    if (pendingChanges.size === 0) {
      toast.info("No hay cambios para guardar");
      return;
    }

    if (!selectedProjectId) {
      toast.error("Selecciona un proyecto antes de guardar cambios");
      return;
    }

    try {
      setSaveBarState("saving");
      logger.info(`Saving ${pendingChanges.size} pending changes...`);

      let successCount = 0;
      let errorCount = 0;

      for (const [id, change] of pendingChanges.entries()) {
        try {
          if (change.type === "add") {
            await addProjectRubro(selectedProjectId, {
              rubroId: change.item.id,
              qty: change.item.qty,
              unitCost: change.item.unit_cost,
              type: change.item.recurring ? "recurring" : "one-time",
              duration: change.item.recurring
                ? `M${change.item.start_month}-M${change.item.end_month}`
                : `M${change.item.start_month}`,
              currency: change.item.currency,
              description: change.item.description,
              start_month: change.item.start_month,
              end_month: change.item.end_month,
            });
            successCount++;
          } else if (change.type === "edit") {
            if (change.item.id.startsWith("temp-")) {
              logger.warn(`Skipping edit of temporary item ${change.item.id}`);
              continue;
            }
            await addProjectRubro(selectedProjectId, {
              rubroId: change.item.id,
              qty: change.item.qty,
              unitCost: change.item.unit_cost,
              type: change.item.recurring ? "recurring" : "one-time",
              duration: change.item.recurring
                ? `M${change.item.start_month}-M${change.item.end_month}`
                : `M${change.item.start_month}`,
              currency: change.item.currency,
              description: change.item.description,
              start_month: change.item.start_month,
              end_month: change.item.end_month,
            });
            successCount++;
          } else if (change.type === "delete") {
            if (!change.item.id.startsWith("temp-")) {
              await deleteProjectRubro(selectedProjectId, change.item.id);
              successCount++;
            } else {
              successCount++;
            }
          }
        } catch (error) {
          logger.error(`Failed to save change for item ${id}:`, error);
          errorCount++;
        }
      }

      setPendingChanges(new Map());

      if (errorCount === 0) {
        setSaveBarState("success");
        toast.success(`Successfully saved ${successCount} change(s)`);
        await invalidateLineItems();
      } else {
        setSaveBarState("error");
        toast.error(`Saved ${successCount} changes, but ${errorCount} failed`);
      }

      setTimeout(() => {
        setSaveBarState("idle");
      }, 3000);
    } catch (error) {
      setSaveBarState("error");
      logger.error("Failed to save changes:", error);
      toast.error("Error al guardar cambios");
    }
  };

  const handleCancelChanges = async () => {
    if (
      !confirm(
        `Are you sure you want to discard ${pendingChanges.size} unsaved change(s)?`
      )
    ) {
      return;
    }

    setPendingChanges(new Map());
    setSaveBarState("idle");
    toast.info("Cambios descartados");
    await invalidateLineItems();
  };

  const handleExport = async () => {
    if (exporting) return;

    try {
      setExporting("excel");
      toast.loading("Preparando exportación Excel...");

      const totalAmount = filteredItems.reduce(
        (sum, item) => sum + calculateTotalCost(item),
        0
      );

      const mockBaseline: BaselineBudget = {
        baseline_id: `catalog-${Date.now()}`,
        project_id: "current-project",
        project_name: "Catálogo del Proyecto Actual",
        created_by: currentRole,
        accepted_by: currentRole,
        accepted_ts: new Date().toISOString(),
        signature_hash: "mock-hash",
        line_items: filteredItems,
        monthly_totals: [],
        assumptions: [
          "Estimaciones de costo basadas en tarifas actuales del mercado",
          "Tasas de cambio al " + new Date().toLocaleDateString(),
          "Incluye todos los rubros en la vista actual del catálogo",
        ],
        total_amount: totalAmount,
        currency: "USD",
        created_at: new Date().toISOString(),
        status: "draft",
      };

      const buffer = await excelExporter.exportBaselineBudget(mockBaseline);
      const filename = `cost-catalog-${
        new Date().toISOString().split("T")[0]
      }.xlsx`;

      downloadExcelFile(buffer, filename);

      toast.dismiss();
      toast.success("Archivo Excel descargado exitosamente");
    } catch (error) {
      toast.dismiss();
      toast.error("Error al exportar catálogo");
      console.error("Export error:", error);
    } finally {
      setExporting(null);
    }
  };

  const handleRetryLoad = async () => {
    await invalidateLineItems();
    invalidateProjectData();
  };

  if (showInitialLoading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <Card className="p-6">
          <div className="flex items-center gap-3 text-muted-foreground">
            <LoadingSpinner />
            <span>Cargando datos del catálogo…</span>
          </div>
        </Card>
      </div>
    );
  }

  if (showErrorState) {
    return (
      <div className="max-w-7xl mx-auto p-6 space-y-4">
        <ErrorBanner message={uiErrorMessage} />
        <Button variant="outline" className="w-fit" onClick={handleRetryLoad}>
          Reintentar cargar catálogo
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{ES_TEXTS.costStructure.title}</h1>
          <p className="text-muted-foreground">
            {ES_TEXTS.costStructure.description}
            {currentProject && (
              <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                {currentProject.name} | Change #{projectChangeCount}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ModuleBadge />
          {isReadOnly() && (
            <Badge variant="outline" className="text-xs">
              {ES_TEXTS.roles.pmReadOnly}
            </Badge>
          )}
        </div>
      </div>

      {showEmptyState && (
        <div className="rounded-md border border-dashed border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          No hay datos de catálogo disponibles para este proyecto aún. Agrega un rubro para
          ver totales y gráficos.
        </div>
      )}

      {/* Main Content */}
      <Tabs defaultValue="line-items" className="space-y-6">
        <TabsList>
          <TabsTrigger value="line-items" className="flex items-center gap-2">
            <Package size={16} />
            Rubros
          </TabsTrigger>
          <TabsTrigger
            value="service-tiers"
            className="flex items-center gap-2"
          >
            <Star size={16} />
            Niveles de Servicio Ikusi
          </TabsTrigger>
        </TabsList>

        <TabsContent value="line-items" className="space-y-6">
          {/* Actions Bar */}
          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center space-x-4 flex-1">
                <div className="relative">
                  <Search
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"
                    size={16}
                  />
                  <Input
                    placeholder="Buscar por descripción o categoría..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-[300px]"
                  />
                </div>
                <Select
                  value={categoryFilter}
                  onValueChange={setCategoryFilter}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Filtrar por categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las Categorías</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={handleShare}
                >
                  <Share size={16} />
                  Share
                </Button>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={handleExport}
                  disabled={exporting !== null}
                >
                  {exporting === "excel" ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <Download size={16} />
                  )}
                  {exporting === "excel" ? "Exportando..." : "Exportar"}
                </Button>
                {refreshing && (
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    <LoadingSpinner size="sm" />
                    Actualizando…
                  </span>
                )}
                <Protected action="create">
                  <Dialog
                    open={isAddDialogOpen}
                    onOpenChange={(open) => {
                      setIsAddDialogOpen(open);
                      if (!open) resetForm();
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button className="gap-2">
                        <Plus size={16} />
                        Agregar Rubro
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Agregar Nuevo Rubro</DialogTitle>
                        <DialogDescription>
                          Crear un nuevo rubro de costo para el catálogo del proyecto
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="add-category-select">
                              Categoría *
                            </Label>
                            <Select
                              value={formData.categoryCode}
                              onValueChange={(value) => {
                                const category = getCategoryByCode(value);
                                setFormData((prev) => ({
                                  ...prev,
                                  categoryCode: value,
                                  category: category?.nombre || "",
                                  lineItemCode: "",
                                  subtype: "",
                                  description: "",
                                }));
                              }}
                            >
                              <SelectTrigger id="add-category-select">
                                <SelectValue placeholder="Seleccione categoría" />
                              </SelectTrigger>
                              <SelectContent className="max-h-[300px]">
                                {COST_CATEGORIES.map((cat) => (
                                  <SelectItem
                                    key={cat.codigo}
                                    value={cat.codigo}
                                  >
                                    {cat.codigo} - {cat.nombre}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="add-linea-gasto-select">
                              Línea de Gasto *
                            </Label>
                            <Select
                              value={formData.lineItemCode}
                              onValueChange={(value) => {
                                const category = getCategoryByCode(
                                  formData.categoryCode
                                );
                                const lineItem = category?.lineas.find(
                                  (l) => l.codigo === value
                                );
                                setFormData((prev) => ({
                                  ...prev,
                                  lineItemCode: value,
                                  subtype: lineItem?.nombre || "",
                                  description: lineItem?.descripcion || "",
                                }));
                              }}
                              disabled={!formData.categoryCode}
                            >
                              <SelectTrigger id="add-linea-gasto-select">
                                <SelectValue
                                  placeholder={
                                    formData.categoryCode
                                      ? "Seleccione línea"
                                      : "Primero seleccione categoría"
                                  }
                                />
                              </SelectTrigger>
                              <SelectContent className="max-h-[300px]">
                                {formData.categoryCode &&
                                  getCategoryByCode(
                                    formData.categoryCode
                                  )?.lineas.map((linea) => (
                                    <SelectItem
                                      key={linea.codigo}
                                      value={linea.codigo}
                                    >
                                      {linea.codigo} - {linea.nombre}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="add-description-input">
                            Descripción *
                          </Label>
                          <Input
                            id="add-description-input"
                            value={formData.description}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                description: e.target.value,
                              }))
                            }
                            placeholder="Descripción detallada del rubro"
                          />
                          {formData.lineItemCode &&
                            (() => {
                              const category = getCategoryByCode(
                                formData.categoryCode
                              );
                              const lineItem = category?.lineas.find(
                                (l) => l.codigo === formData.lineItemCode
                              );
                              return lineItem ? (
                                <div className="flex gap-2 mt-2">
                                  <Badge variant="outline" className="text-xs">
                                    {lineItem.tipo_ejecucion}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    {lineItem.tipo_costo}
                                  </Badge>
                                  <Badge
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {lineItem.fuente_referencia}
                                  </Badge>
                                </div>
                              ) : null;
                            })()}
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label>Tipo</Label>
                            <div
                              className="grid grid-cols-2 gap-2"
                              role="group"
                              aria-label="Selector de tipo"
                            >
                              <Button
                                className="w-full"
                                variant={
                                  formData.recurring ? "outline" : "default"
                                }
                                onClick={() => setRecurringFlag(false)}
                                type="button"
                              >
                                Una vez
                              </Button>
                              <Button
                                className="w-full"
                                variant={
                                  formData.recurring ? "default" : "outline"
                                }
                                onClick={() => setRecurringFlag(true)}
                                type="button"
                              >
                                Recurrente
                              </Button>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="add-start-month-input">
                              Mes de Inicio
                            </Label>
                            <Input
                              id="add-start-month-input"
                              type="number"
                              value={formData.start_month}
                              min={1}
                              max={60}
                              onChange={(e) =>
                                updateStartMonth(
                                  parseInt(e.target.value, 10) || 1
                                )
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="add-term-select">
                              Plazo (meses)
                            </Label>
                            {formData.recurring ? (
                              <Select
                                value={String(currentTermMonths)}
                                onValueChange={(value) =>
                                  updateTermMonths(
                                    parseInt(value, 10) || 12
                                  )
                                }
                              >
                                <SelectTrigger id="add-term-select">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {[12, 24, 36, 48, 60].map((term) => (
                                    <SelectItem
                                      key={term}
                                      value={String(term)}
                                    >
                                      {term} meses
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Input value={1} disabled />
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="add-qty">Cantidad</Label>
                            <Input
                              id="add-qty"
                              name="qty"
                              type="number"
                              value={formData.qty}
                              onChange={(e) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  qty: parseInt(e.target.value, 10) || 1,
                                }))
                              }
                              min={1}
                              placeholder="1"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="add-unit-cost">Costo Unitario *</Label>
                            <Input
                              id="add-unit-cost"
                              name="unit_cost"
                              type="number"
                              value={formData.unit_cost}
                              onChange={(e) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  unit_cost:
                                    parseFloat(e.target.value) || 0,
                                }))
                              }
                              min={0}
                              step="0.01"
                              placeholder="0.00"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="add-currency">Moneda</Label>
                            <Select
                              value={formData.currency}
                              onValueChange={(value) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  currency: value,
                                }))
                              }
                            >
                              <SelectTrigger id="add-currency" name="currency">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="USD">USD</SelectItem>
                                <SelectItem value="EUR">EUR</SelectItem>
                                <SelectItem value="MXN">MXN</SelectItem>
                                <SelectItem value="COP">COP</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setIsAddDialogOpen(false);
                            resetForm();
                          }}
                        >
                          Cancelar
                        </Button>
                        <Button
                          onClick={handleSubmitLineItem}
                          disabled={isCreatingLineItem}
                          className="min-w-[140px]"
                        >
                          {isCreatingLineItem ? (
                            <span className="flex items-center gap-2">
                              <LoadingSpinner size="sm" />
                              Guardando...
                            </span>
                          ) : (
                            "Agregar Rubro"
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </Protected>

                {/* Edit Line Item Dialog */}
                <Dialog
                  open={isEditDialogOpen}
                  onOpenChange={(open) => {
                    setIsEditDialogOpen(open);
                    if (!open) {
                      setEditingItem(null);
                      resetForm();
                    }
                  }}
                >
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Editar Rubro</DialogTitle>
                      <DialogDescription>
                        Actualizar los detalles del rubro de costo
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="edit-category-select">
                            Categoría *
                          </Label>
                          <Select
                            value={formData.categoryCode}
                            onValueChange={(value) => {
                              const category = getCategoryByCode(value);
                              setFormData((prev) => ({
                                ...prev,
                                categoryCode: value,
                                category: category?.nombre || "",
                                lineItemCode: "",
                                subtype: "",
                                description: "",
                              }));
                            }}
                          >
                            <SelectTrigger id="edit-category-select">
                              <SelectValue placeholder="Seleccione categoría" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px]">
                              {COST_CATEGORIES.map((cat) => (
                                <SelectItem
                                  key={cat.codigo}
                                  value={cat.codigo}
                                >
                                  {cat.codigo} - {cat.nombre}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-linea-gasto-select">
                            Línea de Gasto *
                          </Label>
                          <Select
                            value={formData.lineItemCode}
                            onValueChange={(value) => {
                              const category = getCategoryByCode(
                                formData.categoryCode
                              );
                              const lineItem = category?.lineas.find(
                                (l) => l.codigo === value
                              );
                              setFormData((prev) => ({
                                ...prev,
                                lineItemCode: value,
                                subtype: lineItem?.nombre || "",
                                description: lineItem?.descripcion || "",
                              }));
                            }}
                            disabled={!formData.categoryCode}
                          >
                            <SelectTrigger id="edit-linea-gasto-select">
                              <SelectValue
                                placeholder={
                                  formData.categoryCode
                                    ? "Seleccione línea"
                                    : "Primero seleccione categoría"
                                }
                              />
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px]">
                              {formData.categoryCode &&
                                getCategoryByCode(
                                  formData.categoryCode
                                )?.lineas.map((linea) => (
                                  <SelectItem
                                    key={linea.codigo}
                                    value={linea.codigo}
                                  >
                                    {linea.codigo} - {linea.nombre}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="edit-description">
                          Description *
                        </Label>
                        <Input
                          id="edit-description"
                          value={formData.description}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              description: e.target.value,
                            }))
                          }
                          placeholder="Descripción detallada del rubro"
                        />
                        {formData.lineItemCode &&
                          (() => {
                            const category = getCategoryByCode(
                              formData.categoryCode
                            );
                            const lineItem = category?.lineas.find(
                              (l) => l.codigo === formData.lineItemCode
                            );
                            return lineItem ? (
                              <div className="flex gap-2 mt-2">
                                <Badge variant="outline" className="text-xs">
                                  {lineItem.tipo_ejecucion}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {lineItem.tipo_costo}
                                </Badge>
                                <Badge
                                  variant="secondary"
                                  className="text-xs"
                                >
                                  {lineItem.fuente_referencia}
                                </Badge>
                              </div>
                            ) : null;
                          })()}
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>Tipo</Label>
                          <div
                            className="grid grid-cols-2 gap-2"
                            role="group"
                            aria-label="Selector de tipo"
                          >
                            <Button
                              className="w-full"
                              variant={
                                formData.recurring ? "outline" : "default"
                              }
                              onClick={() => setRecurringFlag(false)}
                              type="button"
                            >
                              Una vez
                            </Button>
                            <Button
                              className="w-full"
                              variant={
                                formData.recurring ? "default" : "outline"
                              }
                              onClick={() => setRecurringFlag(true)}
                              type="button"
                            >
                              Recurrente
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-start-month">
                            Mes de Inicio
                          </Label>
                          <Input
                            id="edit-start-month"
                            type="number"
                            value={formData.start_month}
                            min={1}
                            max={60}
                            onChange={(e) =>
                              updateStartMonth(
                                parseInt(e.target.value, 10) || 1
                              )
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-term-select">
                            Plazo (meses)
                          </Label>
                          {formData.recurring ? (
                            <Select
                              value={String(currentTermMonths)}
                              onValueChange={(value) =>
                                updateTermMonths(parseInt(value, 10) || 12)
                              }
                            >
                              <SelectTrigger id="edit-term-select">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {[12, 24, 36, 48, 60].map((term) => (
                                  <SelectItem
                                    key={term}
                                    value={String(term)}
                                  >
                                    {term} meses
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input value={1} disabled />
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="edit-qty">Cantidad</Label>
                          <Input
                            id="edit-qty"
                            name="qty"
                            type="number"
                            value={formData.qty}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                qty: parseInt(e.target.value, 10) || 1,
                              }))
                            }
                            min={1}
                            placeholder="1"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-unit-cost">Costo Unitario *</Label>
                          <Input
                            id="edit-unit-cost"
                            name="unit_cost"
                            type="number"
                            value={formData.unit_cost}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                unit_cost:
                                  parseFloat(e.target.value) || 0,
                              }))
                            }
                            min={0}
                            step="0.01"
                            placeholder="0.00"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-currency">Moneda</Label>
                          <Select
                            value={formData.currency}
                            onValueChange={(value) =>
                              setFormData((prev) => ({
                                ...prev,
                                currency: value,
                              }))
                            }
                          >
                            <SelectTrigger id="edit-currency" name="currency">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="USD">USD</SelectItem>
                              <SelectItem value="EUR">EUR</SelectItem>
                              <SelectItem value="MXN">MXN</SelectItem>
                              <SelectItem value="COP">COP</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsEditDialogOpen(false);
                          setEditingItem(null);
                          resetForm();
                        }}
                      >
                        Cancelar
                      </Button>
                      <Button
                        onClick={handleUpdateLineItem}
                        disabled={isUpdatingLineItem}
                      >
                        {isUpdatingLineItem ? "Guardando..." : "Actualizar Rubro"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">
                  {safeLineItems.length}
                </div>
                <p className="text-sm text-muted-foreground">
                  Total de Rubros
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">
                  {formatCurrency(
                    safeLineItems.reduce(
                      (sum, item) => sum + calculateTotalCost(item),
                      0
                    ),
                    summaryCurrency
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Costo Estimado Total
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{categories.length}</div>
                <p className="text-sm text-muted-foreground">Categorías</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">
                  {safeLineItems.filter((item) => item.recurring).length}
                </div>
                <p className="text-sm text-muted-foreground">
                  Rubros Recurrentes
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Line Items Table */}
          <Card>
            <CardHeader>
              <CardTitle>Rubros</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="text-center space-y-3">
                    <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center mx-auto mb-2 animate-pulse">
                      <span className="text-primary font-bold text-sm">
                        📂
                      </span>
                    </div>
                    <div className="text-muted-foreground">
                      Cargando rubros
                      {currentProject ? ` for ${currentProject.name}` : ""}...
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Project Change #{projectChangeCount}
                    </div>
                  </div>
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground mb-4">
                    No se encontraron rubros
                  </p>
                  <Button
                    onClick={() => setIsAddDialogOpen(true)}
                    className="gap-2"
                  >
                    <Plus size={16} />
                    Agregar Primer Rubro
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Categoría</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Cant.</TableHead>
                        <TableHead>Costo Unitario</TableHead>
                        <TableHead>Duración</TableHead>
                        <TableHead>Costo Total</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredItems.map((item) => {
                        const pendingChange = pendingChanges.get(item.id);
                        const isNew = pendingChange?.type === "add";
                        const isEdited = pendingChange?.type === "edit";

                        return (
                          <TableRow
                            key={item.id}
                            className={cn(
                              isNew && "bg-green-50 dark:bg-green-950/20",
                              isEdited && "bg-amber-50 dark:bg-amber-950/20"
                            )}
                          >
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div>
                                  <div className="font-medium">
                                    {item.category}
                                  </div>
                                  {(item as any).subtype && (
                                    <div className="text-sm text-muted-foreground">
                                      {(item as any).subtype}
                                    </div>
                                  )}
                                </div>
                                {isNew && (
                                  <Badge
                                    variant="default"
                                    className="text-[10px] bg-green-600"
                                  >
                                    NUEVO
                                  </Badge>
                                )}
                                {isEdited && (
                                  <Badge
                                    variant="default"
                                    className="text-[10px] bg-amber-600"
                                  >
                                    MODIFICADO
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="max-w-[300px]">
                              <div className="truncate">
                                {item.description}
                              </div>
                              {(item as any).vendor && (
                                <div className="text-sm text-muted-foreground">
                                  Proveedor: {(item as any).vendor}
                                </div>
                              )}
                              {lineItemDocuments[item.id]?.length ? (
                                <div className="mt-2 space-y-1">
                                  {lineItemDocuments[item.id].map((doc) => (
                                    <div
                                      key={`${doc.documentKey}-${doc.uploadedAt}`}
                                      className="text-xs text-muted-foreground"
                                    >
                                      <div
                                        className="truncate"
                                        title={doc.originalName}
                                      >
                                        {doc.originalName}
                                      </div>
                                      <div
                                        className="font-mono truncate"
                                        title={doc.documentKey}
                                      >
                                        {doc.documentKey}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Badge
                                  variant={
                                    (item as any).one_time
                                      ? "default"
                                      : "secondary"
                                  }
                                >
                                  {(item as any).one_time
                                    ? "Una vez"
                                    : "Recurrente"}
                                </Badge>
                                {(item as any).capex_flag && (
                                  <Badge variant="outline">CapEx</Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{item.qty}</TableCell>
                            <TableCell>
                              {formatCurrency(
                                item.unit_cost,
                                item.currency as string
                              )}
                            </TableCell>
                            <TableCell>
                              M{item.start_month}-{item.end_month}
                            </TableCell>
                            <TableCell className="font-medium">
                              {formatCurrency(
                                calculateTotalCost(item),
                                item.currency as string
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Protected action="update">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openDocumentDialog(item)}
                                    title="Cargar documento de soporte"
                                  >
                                    <Paperclip size={16} />
                                  </Button>
                                </Protected>
                                <Protected action="update">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditClick(item)}
                                    title="Editar rubro"
                                  >
                                    <Edit size={16} />
                                  </Button>
                                </Protected>
                                <Protected action="delete">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive"
                                    onClick={() => handleDeleteClick(item)}
                                    title="Eliminar rubro"
                                  >
                                    <Trash2 size={16} />
                                  </Button>
                                </Protected>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="service-tiers" className="space-y-6">
          <ServiceTierSelector
            onTierSelected={async () => {
              await invalidateLineItems();
            }}
          />
        </TabsContent>
      </Tabs>

      {/* Document upload dialog */}
      <Dialog
        open={docDialogOpen}
        onOpenChange={(open) => {
          setDocDialogOpen(open);
          if (!open) {
            setDocFile(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload Supporting Document</DialogTitle>
            <DialogDescription>
              Los documentos se almacenan en el bucket compartido con metadatos del rubro
              para que SDMT y PMO puedan referenciar la misma evidencia.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              {docTarget
                ? `${docTarget.category} - ${docTarget.description}`
                : "Selecciona un rubro"}
            </div>
            <Input
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg"
              onChange={(event) =>
                setDocFile(event.target.files?.[0] ?? null)
              }
              disabled={isUploadingDocument}
            />
            <p className="text-xs text-muted-foreground">
              Los formatos aceptados incluyen PDF, documentos Office, CSV y tipos de
              imagen comunes. Los archivos se cargan mediante el flujo `/uploads/docs`.
            </p>
            {isUploadingDocument && documentUploadStage && (
              <p className="text-xs text-primary">
                {documentUploadStage === "presigning"
                  ? "Solicitando espacio de carga seguro…"
                  : documentUploadStage === "uploading"
                  ? "Cargando a S3…"
                  : "Finalizando carga…"}
              </p>
            )}
            {docTarget && lineItemDocuments[docTarget.id]?.length ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Cargas recientes
                </p>
                <div className="space-y-1">
                  {lineItemDocuments[docTarget.id].map((doc) => (
                    <div key={`${doc.documentKey}-dialog`}>
                      <div className="text-sm font-medium truncate">
                        {doc.originalName}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono truncate">
                        {doc.documentKey}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDocDialogOpen(false)}
              disabled={isUploadingDocument}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleDocumentUpload}
              disabled={!docFile || isUploadingDocument}
            >
              {isUploadingDocument ? "Cargando..." : "Cargar Documento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SaveBar for unsaved changes */}
      <SaveBar
        state={saveBarState}
        isDirty={hasUnsavedChanges}
        onSave={handleSaveChanges}
        onCancel={handleCancelChanges}
        showSaveAndClose={false}
        successMessage="Cambios guardados exitosamente"
      />
    </div>
  );
}

export default SDMTCatalog;
