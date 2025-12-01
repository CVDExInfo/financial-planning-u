import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { COST_CATEGORIES, getCategoryByCode } from "@/data/cost-categories";
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
import ApiService from "@/lib/api";
import { excelExporter, downloadExcelFile } from "@/lib/excel-export";
import { PDFExporter, formatReportCurrency } from "@/lib/pdf-export";
import { logger } from "@/utils/logger";
import { cn } from "@/lib/utils";
import { useProjectLineItems } from "@/hooks/useProjectLineItems";
import { addProjectRubro } from "@/api/finanzas";
import {
  uploadDocument,
  type DocumentUploadMeta,
  type DocumentUploadStage,
} from "@/lib/documents/uploadService";
import { ErrorBanner } from "@/components/ErrorBanner";
import { useAuth } from "@/hooks/useAuth";

// Pending change types
type PendingChangeType = "add" | "edit" | "delete";

interface PendingChange {
  type: PendingChangeType;
  item: LineItem;
  originalItem?: LineItem; // For edits, keep original for rollback
}

type CatalogDocumentMeta = DocumentUploadMeta;

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
  const [catalogError, setCatalogError] = useState<string | null>(null);

  // Form state for Add/Edit Line Item dialog
  const [formData, setFormData] = useState({
    category: "",
    categoryCode: "",
    subtype: "",
    lineItemCode: "",
    description: "",
    qty: 1,
    unit_cost: 0,
    currency: "USD",
    start_month: 1,
    end_month: 12,
    recurring: false,
  });

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
  const loading = isLineItemsLoading && queryLineItems.length === 0;
  const refreshing = isLineItemsFetching && !isLineItemsLoading;

  // Use the new permissions system
  const { isReadOnly, currentRole } = usePermissions();

  // Check if there are unsaved changes
  const hasUnsavedChanges = pendingChanges.size > 0;

  // Navigation blockers in react-router require a data router. The SDMT catalog
  // currently renders under a BrowserRouter, so using useBlocker would throw
  // "useBlocker must be used within a data router". We intentionally skip the
  // unsaved-changes blocker to keep this screen accessible from top navigation
  // until the app is migrated to a data router.

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
    const duration = item.end_month - item.start_month + 1;
    const baseCost = item.qty * item.unit_cost;
    return item.recurring ? baseCost * duration : baseCost;
  };

  const handleShare = async () => {
    try {
      toast.loading("Generating professional report...");

      const totalCost = filteredItems.reduce(
        (sum, item) => sum + calculateTotalCost(item),
        0
      );
      const laborCost = filteredItems
        .filter((item) => item.category === "Labor")
        .reduce((sum, item) => sum + calculateTotalCost(item), 0);
      const nonLaborCost = totalCost - laborCost;

      const reportData = {
        title: "Cost Catalog Summary",
        subtitle: "Project Cost Structure Analysis",
        generated: new Date().toLocaleDateString(),
        metrics: [
          {
            label: "Total Line Items",
            value: filteredItems.length.toString(),
            color: "#64748b",
          },
          {
            label: "Total Estimated Cost",
            value: formatReportCurrency(totalCost),
            color: "#2BB673",
          },
          {
            label: "Labor Costs",
            value: formatReportCurrency(laborCost),
            change: `${((laborCost / totalCost) * 100).toFixed(1)}% of total`,
            changeType: "neutral" as const,
            color: "#14B8A6",
          },
          {
            label: "Non-Labor Costs",
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
            filteredItems.filter((item) => item.capex_flag).length
          } items flagged as capital expenditure`,
        ],
        recommendations: [
          "Review recurring items for potential optimization opportunities",
          "Validate vendor quotes for significant non-labor items",
          "Consider bundling similar services for better pricing",
          "Establish clear cost center mappings for accurate tracking",
        ],
      };

      await PDFExporter.exportToPDF(reportData);
      toast.dismiss();
      toast.success("Professional catalog report generated!");
    } catch (error) {
      toast.dismiss();
      toast.error("Failed to generate professional report");
      console.error("Share error:", error);
    }
  };

  const resetForm = () => {
    setFormData({
      category: "",
      categoryCode: "",
      subtype: "",
      lineItemCode: "",
      description: "",
      qty: 1,
      unit_cost: 0,
      currency: "USD",
      start_month: 1,
      end_month: 12,
      recurring: false,
    });
  };

  const openDocumentDialog = (item: LineItem) => {
    setDocTarget(item);
    setDocFile(null);
    setDocDialogOpen(true);
  };

  const handleDocumentUpload = async () => {
    if (!docTarget || !docFile) {
      toast.error("Select a file to upload");
      return;
    }

    if (!selectedProjectId) {
      toast.error("Select a project before uploading documents");
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

      toast.success("Supporting document uploaded");
      setDocDialogOpen(false);
      setDocFile(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to upload document";
      toast.error(message);
    } finally {
      setIsUploadingDocument(false);
      setDocumentUploadStage(null);
    }
  };

  const handleSubmitLineItem = async () => {
    if (
      !formData.category ||
      !formData.description ||
      formData.unit_cost <= 0
    ) {
      toast.error(
        "Please fill in all required fields (category, description, unit cost)"
      );
      return;
    }

    if (!selectedProjectId) {
      toast.error("Please select a project before adding items");
      return;
    }

    const rubroId =
      formData.lineItemCode || formData.categoryCode || `custom-${Date.now()}`;

    try {
      setIsCreatingLineItem(true);
      await addProjectRubro(selectedProjectId, {
        rubroId,
        qty: formData.qty,
        unitCost: formData.unit_cost,
        type: formData.recurring ? "Recurring" : "One-time",
        duration: formData.recurring
          ? `M${formData.start_month}-M${formData.end_month}`
          : `M${formData.start_month}`,
      });

      toast.success("Line item created");
      setIsAddDialogOpen(false);
      resetForm();
      await invalidateLineItems();
      invalidateProjectData();
    } catch (error) {
      logger.error("Failed to create line item:", error);
      toast.error("Failed to create line item. Please try again.");
    } finally {
      setIsCreatingLineItem(false);
    }
  };

  const handleEditClick = (item: LineItem) => {
    setEditingItem(item);
    setFormData({
      category: item.category,
      categoryCode: "",
      subtype: item.subtype || "",
      lineItemCode: "",
      description: item.description,
      qty: item.qty,
      unit_cost: item.unit_cost,
      currency: item.currency,
      start_month: item.start_month ?? 1,
      end_month: item.end_month ?? 12,
      recurring: item.recurring ?? false,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateLineItem = async () => {
    if (!editingItem) return;

    if (
      !formData.category ||
      !formData.description ||
      formData.unit_cost <= 0
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Merge form data with existing item to preserve all properties
    const updatedItem: LineItem = {
      ...editingItem,
      category: formData.category,
      subtype: formData.subtype,
      description: formData.description,
      qty: formData.qty,
      unit_cost: formData.unit_cost,
      currency: formData.currency as Currency,
      start_month: formData.start_month,
      end_month: formData.end_month,
      recurring: formData.recurring,
      one_time: !formData.recurring,
      updated_at: new Date().toISOString(),
    };

    // Add to pending changes, preserving original for rollback
    setPendingChanges((prev) => {
      const updated = new Map(prev);
      const existing = updated.get(editingItem.id);
      updated.set(editingItem.id, {
        type: "edit",
        item: updatedItem,
        originalItem: existing?.originalItem || editingItem, // Preserve original if already pending
      });
      return updated;
    });

    // Update local state for immediate UI feedback
    setLineItems((prev) =>
      prev.map((item) => (item.id === editingItem.id ? updatedItem : item))
    );
    setSaveBarState("dirty");
    toast.success("Line item modified (unsaved)");
    setIsEditDialogOpen(false);
    setEditingItem(null);
    resetForm();
  };

  const handleDeleteClick = async (item: LineItem) => {
    if (
      !confirm(
        `Are you sure you want to delete "${item.description}"? This change will not be saved until you click Save.`
      )
    ) {
      return;
    }

    // Add to pending changes
    setPendingChanges((prev) => {
      const updated = new Map(prev);
      updated.set(item.id, { type: "delete", item });
      return updated;
    });

    // Remove from local state for immediate UI feedback
    setLineItems((prev) => prev.filter((i) => i.id !== item.id));
    setSaveBarState("dirty");
    toast.success("Line item marked for deletion (unsaved)");
  };

  // Save all pending changes to the backend
  const handleSaveChanges = async () => {
    if (pendingChanges.size === 0) {
      toast.info("No changes to save");
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
            // Create the item (API will assign real ID)
            const created = await ApiService.createLineItem(
              selectedProjectId,
              change.item
            );
            // Update local state with real ID
            setLineItems((prev) =>
              prev.map((item) => (item.id === id ? created : item))
            );
            successCount++;
          } else if (change.type === "edit") {
            // Update the item
            if (change.item.id.startsWith("temp-")) {
              logger.warn(`Skipping edit of temporary item ${change.item.id}`);
              continue;
            }
            await ApiService.updateLineItem(change.item.id, change.item);
            successCount++;
          } else if (change.type === "delete") {
            // Delete the item (skip if it was a temp item that was never saved)
            if (!change.item.id.startsWith("temp-")) {
              await ApiService.deleteLineItem(change.item.id);
              successCount++;
            } else {
              successCount++; // Count temp deletions as successful
            }
          }
        } catch (error) {
          logger.error(`Failed to save change for item ${id}:`, error);
          errorCount++;
        }
      }

      // Clear pending changes
      setPendingChanges(new Map());

      if (errorCount === 0) {
        setSaveBarState("success");
        toast.success(`Successfully saved ${successCount} change(s)`);
        // Reload from server to ensure consistency
        await invalidateLineItems();
      } else {
        setSaveBarState("error");
        toast.error(`Saved ${successCount} changes, but ${errorCount} failed`);
      }

      // Reset to idle after showing success
      setTimeout(() => {
        setSaveBarState("idle");
      }, 3000);
    } catch (error) {
      setSaveBarState("error");
      logger.error("Failed to save changes:", error);
      toast.error("Failed to save changes");
    }
  };

  // Cancel all pending changes and reload
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
    toast.info("Changes discarded");
    // Reload fresh data from server
    await invalidateLineItems();
  };

  const handleExport = async () => {
    if (exporting) return;

    try {
      setExporting("excel");
      toast.loading("Preparing Excel export...");

      // Create a baseline budget structure for export
      const totalAmount = filteredItems.reduce(
        (sum, item) => sum + calculateTotalCost(item),
        0
      );

      const mockBaseline: BaselineBudget = {
        baseline_id: `catalog-${Date.now()}`,
        project_id: "current-project",
        project_name: "Current Project Catalog",
        created_by: currentRole,
        accepted_by: currentRole,
        accepted_ts: new Date().toISOString(),
        signature_hash: "mock-hash",
        line_items: filteredItems,
        monthly_totals: [],
        assumptions: [
          "Cost estimates based on current market rates",
          "Currency rates as of " + new Date().toLocaleDateString(),
          "Includes all line items in current catalog view",
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
      toast.success("Excel file downloaded successfully");
    } catch (error) {
      toast.dismiss();
      toast.error("Failed to export catalog");
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
            <span>Loading catalog data…</span>
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
          Retry loading catalog
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Cost Catalog</h1>
          <p className="text-muted-foreground">
            Manage project line items and cost components
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
              Read Only
            </Badge>
          )}
        </div>
      </div>

      {showEmptyState && (
        <div className="rounded-md border border-dashed border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          No catalog data is available for this project yet. Add a line item to
          see totals and charts.
        </div>
      )}

      {/* Main Content */}
      <Tabs defaultValue="line-items" className="space-y-6">
        <TabsList>
          <TabsTrigger value="line-items" className="flex items-center gap-2">
            <Package size={16} />
            Line Items
          </TabsTrigger>
          <TabsTrigger
            value="service-tiers"
            className="flex items-center gap-2"
          >
            <Star size={16} />
            Ikusi Service Tiers
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
                    placeholder="Search by description or category..."
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
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
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
                  {exporting === "excel" ? "Exporting..." : "Export"}
                </Button>
                {refreshing && (
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    <LoadingSpinner size="sm" />
                    Refreshing…
                  </span>
                )}
                <Protected action="create">
                  <Dialog
                    open={isAddDialogOpen}
                    onOpenChange={setIsAddDialogOpen}
                  >
                    <DialogTrigger asChild>
                      <Button className="gap-2">
                        <Plus size={16} />
                        Add Line Item
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Add New Line Item</DialogTitle>
                        <DialogDescription>
                          Create a new cost line item for the project catalog
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label>Categoría *</label>
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
                              <SelectTrigger>
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
                            <label>Línea de Gasto *</label>
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
                              <SelectTrigger>
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
                          <label>Description *</label>
                          <Input
                            value={formData.description}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                description: e.target.value,
                              }))
                            }
                            placeholder="Detailed description of the line item"
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
                            <label>Quantity</label>
                            <Input
                              type="number"
                              value={formData.qty}
                              onChange={(e) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  qty: parseInt(e.target.value) || 1,
                                }))
                              }
                              min="1"
                              placeholder="1"
                            />
                          </div>
                          <div className="space-y-2">
                            <label>Unit Cost *</label>
                            <Input
                              type="number"
                              value={formData.unit_cost}
                              onChange={(e) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  unit_cost: parseFloat(e.target.value) || 0,
                                }))
                              }
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                            />
                          </div>
                          <div className="space-y-2">
                            <label>Currency</label>
                            <Select
                              value={formData.currency}
                              onValueChange={(value) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  currency: value,
                                }))
                              }
                            >
                              <SelectTrigger>
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
                          Cancel
                        </Button>
                        <Button
                          onClick={handleSubmitLineItem}
                          disabled={isCreatingLineItem}
                          className="min-w-[140px]"
                        >
                          {isCreatingLineItem ? (
                            <span className="flex items-center gap-2">
                              <LoadingSpinner size="sm" />
                              Saving...
                            </span>
                          ) : (
                            "Add Line Item"
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
                      <DialogTitle>Edit Line Item</DialogTitle>
                      <DialogDescription>
                        Update the cost line item details
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label>Categoría *</label>
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
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccione categoría" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px]">
                              {COST_CATEGORIES.map((cat) => (
                                <SelectItem key={cat.codigo} value={cat.codigo}>
                                  {cat.codigo} - {cat.nombre}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <label>Línea de Gasto *</label>
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
                            <SelectTrigger>
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
                        <label>Description *</label>
                        <Input
                          value={formData.description}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              description: e.target.value,
                            }))
                          }
                          placeholder="Detailed description of the line item"
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
                                <Badge variant="secondary" className="text-xs">
                                  {lineItem.fuente_referencia}
                                </Badge>
                              </div>
                            ) : null;
                          })()}
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <label>Quantity</label>
                          <Input
                            type="number"
                            value={formData.qty}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                qty: parseInt(e.target.value) || 1,
                              }))
                            }
                            min="1"
                            placeholder="1"
                          />
                        </div>
                        <div className="space-y-2">
                          <label>Unit Cost *</label>
                          <Input
                            type="number"
                            value={formData.unit_cost}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                unit_cost: parseFloat(e.target.value) || 0,
                              }))
                            }
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                          />
                        </div>
                        <div className="space-y-2">
                          <label>Currency</label>
                          <Select
                            value={formData.currency}
                            onValueChange={(value) =>
                              setFormData((prev) => ({
                                ...prev,
                                currency: value,
                              }))
                            }
                          >
                            <SelectTrigger>
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
                        Cancel
                      </Button>
                      <Button onClick={handleUpdateLineItem}>
                        Update Line Item
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
                <div className="text-2xl font-bold">{safeLineItems.length}</div>
                <p className="text-sm text-muted-foreground">
                  Total Line Items
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
                  Total Estimated Cost
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{categories.length}</div>
                <p className="text-sm text-muted-foreground">Categories</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">
                  {safeLineItems.filter((item) => item.recurring).length}
                </div>
                <p className="text-sm text-muted-foreground">Recurring Items</p>
              </CardContent>
            </Card>
          </div>

          {/* Line Items Table */}
          <Card>
            <CardHeader>
              <CardTitle>Line Items</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="text-center space-y-3">
                    <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center mx-auto mb-2 animate-pulse">
                      <span className="text-primary font-bold text-sm">📂</span>
                    </div>
                    <div className="text-muted-foreground">
                      Loading line items
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
                    No line items found
                  </p>
                  <Button
                    onClick={() => setIsAddDialogOpen(true)}
                    className="gap-2"
                  >
                    <Plus size={16} />
                    Add First Line Item
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Unit Cost</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Total Cost</TableHead>
                        <TableHead>Actions</TableHead>
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
                                  {item.subtype && (
                                    <div className="text-sm text-muted-foreground">
                                      {item.subtype}
                                    </div>
                                  )}
                                </div>
                                {isNew && (
                                  <Badge
                                    variant="default"
                                    className="text-[10px] bg-green-600"
                                  >
                                    NEW
                                  </Badge>
                                )}
                                {isEdited && (
                                  <Badge
                                    variant="default"
                                    className="text-[10px] bg-amber-600"
                                  >
                                    MODIFIED
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="max-w-[300px]">
                              <div className="truncate">{item.description}</div>
                              {item.vendor && (
                                <div className="text-sm text-muted-foreground">
                                  Vendor: {item.vendor}
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
                                    item.one_time ? "default" : "secondary"
                                  }
                                >
                                  {item.one_time ? "One-time" : "Recurring"}
                                </Badge>
                                {item.capex_flag && (
                                  <Badge variant="outline">CapEx</Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{item.qty}</TableCell>
                            <TableCell>
                              {formatCurrency(item.unit_cost, item.currency)}
                            </TableCell>
                            <TableCell>
                              M{item.start_month}-{item.end_month}
                            </TableCell>
                            <TableCell className="font-medium">
                              {formatCurrency(
                                calculateTotalCost(item),
                                item.currency
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Protected action="update">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openDocumentDialog(item)}
                                    title="Upload supporting document"
                                  >
                                    <Paperclip size={16} />
                                  </Button>
                                </Protected>
                                <Protected action="update">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditClick(item)}
                                    title="Edit line item"
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
                                    title="Delete line item"
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
              Documents are stored in the shared docs bucket with line item
              metadata so SDMT and PMO can reference the same evidence.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              {docTarget
                ? `${docTarget.category} - ${docTarget.description}`
                : "Select a line item"}
            </div>
            <Input
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg"
              onChange={(event) => setDocFile(event.target.files?.[0] ?? null)}
              disabled={isUploadingDocument}
            />
            <p className="text-xs text-muted-foreground">
              Accepted formats include PDF, Office documents, CSV, and common
              image types. Files are uploaded via the `/uploads/docs` flow.
            </p>
            {isUploadingDocument && documentUploadStage && (
              <p className="text-xs text-primary">
                {documentUploadStage === "presigning"
                  ? "Requesting secure upload slot…"
                  : documentUploadStage === "uploading"
                  ? "Uploading to S3…"
                  : "Finalizing upload…"}
              </p>
            )}
            {docTarget && lineItemDocuments[docTarget.id]?.length ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Recent uploads
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
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleDocumentUpload}
              disabled={!docFile || isUploadingDocument}
            >
              {isUploadingDocument ? "Uploading..." : "Upload Document"}
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
        successMessage={`Successfully saved ${pendingChanges.size} change(s)`}
      />
    </div>
  );
}

export default SDMTCatalog;
