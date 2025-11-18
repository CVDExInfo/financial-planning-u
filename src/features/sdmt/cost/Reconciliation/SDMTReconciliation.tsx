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
import {
  uploadInvoice,
  updateInvoiceStatus,
  type UploadInvoicePayload,
} from "@/api/finanzas";

/** --------- Types & helpers --------- */

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

const formatMatrixLabel = (
  item?: LineItem,
  month?: number,
  fallbackId?: string
) => {
  const category = item?.category?.trim() || "General";
  const description = item?.description?.trim() || fallbackId || "Line item";
  const base = `${category} — ${description}`;
  return typeof month === "number" && Number.isFinite(month)
    ? `${base} (Month ${month})`
    : base;
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

  const uiErrorMessage = (() => {
    if (allowMockData) return null;
    if (invoicesError)
      return "Unable to load invoice data. Please refresh or contact support.";
    if (lineItemsError)
      return "Unable to load catalog data. Please refresh or contact support.";
    return null;
  })();

  // Spinner until either list is loading and both lists are empty.
  const showInitialLoading =
    (invoicesLoading || lineItemsLoading) &&
    safeInvoices.length === 0 &&
    safeLineItems.length === 0;

  // Filters
  const filteredInvoices = useMemo(() => {
    return safeInvoices.filter((inv) => {
      if (filterLineItem && inv.line_item_id !== filterLineItem) return false;
      if (filterMonth && inv.month !== parseInt(filterMonth, 10)) return false;
      return true;
    });
  }, [safeInvoices, filterLineItem, filterMonth]);

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
      toast.success("Invoice uploaded successfully");
      setUploadFormData(createInitialUploadForm());
      await invalidateInvoices();
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error ? err.message : "Failed to upload invoice";
      toast.error(message);
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
        throw new Error("Select a project before updating invoice status");
      }
      return updateInvoiceStatus(projectId, invoiceId, { status, comment });
    },
    onSuccess: async (_data, vars) => {
      toast.success(`Invoice status updated to ${vars.status}`);
      await invalidateInvoices();
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error ? err.message : "Failed to update invoice status";
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
    if (
      !uploadFormData.file ||
      !uploadFormData.line_item_id ||
      !uploadFormData.amount
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (!projectId) {
      toast.error("Select a project before uploading invoices");
      return;
    }

    const amount = parseFloat(uploadFormData.amount);
    if (Number.isNaN(amount)) {
      toast.error("Enter a valid invoice amount");
      return;
    }

    await uploadMutation.mutateAsync({
      projectId,
      file: uploadFormData.file,
      line_item_id: uploadFormData.line_item_id,
      month: uploadFormData.month,
      amount,
      description: uploadFormData.description.trim() || undefined,
      vendor: uploadFormData.vendor.trim() || undefined,
      invoice_number: uploadFormData.invoice_number.trim() || undefined,
      invoice_date: uploadFormData.invoice_date || undefined,
    });
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
      toast.loading("Generating variance report…");
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
      toast.success("Variance report exported");
    } catch (e) {
      toast.dismiss();
      toast.error("Failed to export variance report");
      console.error(e);
    }
  };

  const handleShareReconciliationSummary = async () => {
    try {
      toast.loading("Generating reconciliation report…");
      const total = filteredInvoices.reduce((s, inv) => s + inv.amount, 0);
      const matchRate = filteredInvoices.length
        ? (matchedCount / filteredInvoices.length) * 100
        : 0;
      const avg = filteredInvoices.length ? total / filteredInvoices.length : 0;

      await PDFExporter.exportToPDF({
        title: "Invoice Reconciliation Report",
        subtitle: "Financial Control & Compliance Summary",
        generated: new Date().toLocaleDateString(),
        metrics: [
          { label: "Total Invoices", value: String(filteredInvoices.length) },
          { label: "Matched", value: String(matchedCount) },
          { label: "Pending", value: String(pendingCount) },
          { label: "Disputed", value: String(disputedCount) },
        ],
        summary: [
          `Processed ${filteredInvoices.length} invoices worth ${formatCurrency(
            total
          )}`,
          `Invoice match rate: ${matchRate.toFixed(1)}% (${matchedCount}/${
            filteredInvoices.length
          })`,
          `Average invoice amount: ${formatCurrency(avg)}`,
          `${disputedCount} disputes require immediate attention`,
        ],
        recommendations: [
          matchRate < 80
            ? "Improve invoice matching — current rate below target"
            : "Maintain current matching performance",
          pendingCount > 0
            ? `Process ${pendingCount} pending invoices to improve cycle time`
            : "No pending items",
          disputedCount > 0
            ? `Resolve ${disputedCount} disputed invoices to reduce risk`
            : "No disputes",
        ],
      });
      toast.dismiss();
      toast.success("Reconciliation report generated");
    } catch (e) {
      toast.dismiss();
      toast.error("Failed to generate report");
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
            <span>Loading reconciliation data…</span>
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
          Retry loading data
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Invoice Reconciliation</h1>
          <p className="text-muted-foreground">
            Upload and match invoices against forecasted amounts
            {currentProject && (
              <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                {currentProject.name} | Change #{projectChangeCount}
              </span>
            )}
          </p>
          {(filterLineItem || filterMonth) && (
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline">
                Filtered:{" "}
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
                <X size={14} className="mr-1" /> Clear Filter
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
            Share
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportVarianceReport}
            className="gap-2"
          >
            <Download size={16} />
            Export
          </Button>
          <ModuleBadge />
          <Button onClick={() => setShowUploadForm(true)} className="gap-2">
            <Plus size={16} />
            Upload Invoice
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
            <p className="text-sm text-muted-foreground">Matched Invoices</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <Upload className="mx-auto mb-2 text-blue-600" size={32} />
            <div className="text-2xl font-bold text-blue-600">
              {pendingCount}
            </div>
            <p className="text-sm text-muted-foreground">Pending Review</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <AlertTriangle className="mx-auto mb-2 text-red-600" size={32} />
            <div className="text-2xl font-bold text-red-600">
              {disputedCount}
            </div>
            <p className="text-sm text-muted-foreground">Disputed Items</p>
          </CardContent>
        </Card>
      </div>

      {/* Upload dialog */}
      <Dialog open={showUploadForm} onOpenChange={setShowUploadForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload Invoice</DialogTitle>
            <DialogDescription>
              Upload invoice documents and link them to specific cost line items
              and time periods.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor={lineItemSelectId}>Line Item *</Label>
                <Select
                  value={uploadFormData.line_item_id}
                  onValueChange={(value) =>
                    setUploadFormData((prev) => ({
                      ...prev,
                      line_item_id: value,
                    }))
                  }
                >
                  <SelectTrigger id={lineItemSelectId} aria-label="Line item">
                    <SelectValue placeholder="Select line item" />
                  </SelectTrigger>
                  <SelectContent>
                    {safeLineItems.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {formatMatrixLabel(item, uploadFormData.month)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor={monthSelectId}>Month *</Label>
                <Select
                  value={String(uploadFormData.month)}
                  onValueChange={(value) =>
                    setUploadFormData((prev) => ({
                      ...prev,
                      month: parseInt(value, 10),
                    }))
                  }
                >
                  <SelectTrigger id={monthSelectId} aria-label="Invoice month">
                    <SelectValue placeholder="Select month" />
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="amount">Invoice Amount *</Label>
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
              <div>
                <Label htmlFor="vendor">Vendor</Label>
                <Input
                  id="vendor"
                  name="vendor"
                  placeholder="Vendor name"
                  value={uploadFormData.vendor}
                  onChange={(e) =>
                    setUploadFormData((prev) => ({
                      ...prev,
                      vendor: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="invoice_number">Invoice Number</Label>
                <Input
                  id="invoice_number"
                  name="invoice_number"
                  placeholder="INV-001"
                  value={uploadFormData.invoice_number}
                  onChange={(e) =>
                    setUploadFormData((prev) => ({
                      ...prev,
                      invoice_number: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="invoice_date">Invoice Date</Label>
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

            <div>
              <Label htmlFor={fileInputId}>Upload File *</Label>
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
                  Supported formats: PDF, JPG, PNG, Excel, CSV
                </p>
                {uploadFormData.file && (
                  <p className="text-sm text-primary mt-2">
                    Selected: {uploadFormData.file.name}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowUploadForm(false)}>
              Cancel
            </Button>
            <Button onClick={handleInvoiceSubmit} disabled={uploadMutation.isPending}>
              {uploadMutation.isPending ? "Uploading..." : "Upload Invoice"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Invoices table */}
      <Card>
        <CardHeader>
          <CardTitle>Invoices & Documentation</CardTitle>
        </CardHeader>
        <CardContent>
          {invoicesError ? (
            <div className="text-center py-12 text-destructive">
              Failed to load invoices.{" "}
              {invoicesError instanceof Error
                ? invoicesError.message
                : "Unknown error"}
            </div>
          ) : invoicesLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-muted-foreground">Loading invoices...</div>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                {filterLineItem || filterMonth
                  ? "No invoices found matching filter"
                  : "No invoices uploaded yet"}
              </p>
              <p className="text-sm text-muted-foreground">
                Upload invoices to track and match against forecast amounts
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Line Item</TableHead>
                    <TableHead>Month</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>File</TableHead>
                    <TableHead>Uploaded</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="font-medium">
                            {formatMatrixLabel(
                              safeLineItems.find((li) => li.id === inv.line_item_id),
                              inv.month,
                              inv.line_item_id
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-4 w-4 p-0"
                            onClick={() => navigateToForecast(inv.line_item_id, inv.month)}
                            title="View in forecast"
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
                          <span
                            className="truncate"
                            title={inv.originalName || inv.file_name || inv.documentKey || ""}
                          >
                            {inv.originalName ||
                              inv.file_name ||
                              inv.documentKey ||
                              "Pending document"}
                          </span>
                          {inv.documentKey && (
                            <span
                              className="text-xs text-muted-foreground truncate"
                              title={inv.documentKey}
                            >
                              {inv.documentKey}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="text-sm">
                          <div>{new Date(inv.uploaded_at).toLocaleDateString()}</div>
                          <div className="text-muted-foreground">{inv.uploaded_by}</div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-1">
                          {inv.status === "Pending" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleStatusUpdate(inv.id, "Matched")}
                                disabled={statusMutation.isPending}
                              >
                                Match
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  handleStatusUpdate(inv.id, "Disputed", "Requires review")
                                }
                                disabled={statusMutation.isPending}
                              >
                                Dispute
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
                              Resolve
                            </Button>
                          )}
                        </div>
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
