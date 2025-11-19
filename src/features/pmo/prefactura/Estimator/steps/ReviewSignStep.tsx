import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { useProject } from "@/contexts/ProjectContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import {
  FileText,
  CheckCircle2,
  Clock,
  DollarSign,
  Users,
  Server,
  PenTool,
  FileSpreadsheet,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { ChartInsightsPanel } from "@/components/ChartInsightsPanel";
import { DonutChart } from "@/components/charts/DonutChart";
import { StackedColumnsChart } from "@/components/charts/StackedColumnsChart";
import type {
  DealInputs,
  LaborEstimate,
  NonLaborEstimate,
  BaselineCreateRequest,
  BaselineCreateResponse,
} from "@/types/domain";
import ApiService from "@/lib/api";
import { excelExporter, downloadExcelFile } from "@/lib/excel-export";
import { PDFExporter, formatReportCurrency } from "@/lib/pdf-export";
import {
  uploadDocumentsBatch,
  type DocumentUploadMeta,
  type DocumentUploadStage,
} from "@/lib/documents/uploadService";

// Helper function to extract email from JWT token
function extractEmailFromJWT(token: string): string {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return "unknown@user.com";

    const payload = JSON.parse(atob(parts[1]));
    return payload.email || payload["cognito:username"] || "unknown@user.com";
  } catch (error) {
    console.warn("Failed to extract email from JWT:", error);
    return "unknown@user.com";
  }
}

type ReviewSignFormData = {
  dealInputs: DealInputs | null;
  laborEstimates: LaborEstimate[];
  nonLaborEstimates: NonLaborEstimate[];
  fxIndexationData: Record<string, unknown> | null;
};

interface ReviewSignStepProps {
  data: ReviewSignFormData;
  setData: (data: ReviewSignFormData) => void;
  onNext: () => void;
  onPrevious: () => void;
  isFirstStep: boolean;
  isLastStep: boolean;
}

type SupportingDocumentMeta = DocumentUploadMeta;

const uploadStageText: Record<DocumentUploadStage, string> = {
  presigning: "Requesting secure upload slot…",
  uploading: "Uploading to S3…",
  complete: "Verifying upload…",
};

export function ReviewSignStep({ data }: ReviewSignStepProps) {
  const navigate = useNavigate();
  const { refreshProject, setSelectedProjectId } = useProject();
  const [isReviewed, setIsReviewed] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [signatureComplete, setSignatureComplete] = useState(false);
  const [baselineId, setBaselineId] = useState<string>("");
  const [baselineMeta, setBaselineMeta] =
    useState<BaselineCreateResponse | null>(null);
  const [isHandingOff, setIsHandingOff] = useState(false);
  const [showHandoffConfirm, setShowHandoffConfirm] = useState(false);
  const [supportingDocs, setSupportingDocs] = useState<
    SupportingDocumentMeta[]
  >([]);
  const [uploadProgress, setUploadProgress] = useState<
    Record<string, DocumentUploadStage>
  >({});
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const fallbackProjectIdRef = useRef(`PRJ-${Date.now().toString(36)}`);
  const supportingDocsInputId = "prefactura-supporting-docs";
  const supportingDocsHelpId = `${supportingDocsInputId}-help`;

  const { dealInputs, laborEstimates, nonLaborEstimates, fxIndexationData } =
    data;

  const derivedProjectId = useMemo(() => {
    if (dealInputs?.project_name) {
      return `PRJ-${dealInputs.project_name
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "-")
        .substring(0, 20)}`;
    }
    return fallbackProjectIdRef.current;
  }, [dealInputs?.project_name]);

  // Calculate totals
  const laborTotal = laborEstimates.reduce((sum, item) => {
    const baseHours = item.hours_per_month * item.fte_count;
    const baseCost = baseHours * item.hourly_rate;
    const onCost = baseCost * (item.on_cost_percentage / 100);
    const monthlyTotal = baseCost + onCost;
    const duration = item.end_month - item.start_month + 1;
    return sum + monthlyTotal * duration;
  }, 0);

  const nonLaborTotal = nonLaborEstimates.reduce((sum, item) => {
    if (item.one_time) {
      return sum + item.amount;
    }
    const duration = (item.end_month || 1) - (item.start_month || 1) + 1;
    return sum + item.amount * duration;
  }, 0);

  const grandTotal = laborTotal + nonLaborTotal;

  // Generate chart data
  const costMixData = [
    { name: "Labor", value: laborTotal },
    { name: "Non-Labor", value: nonLaborTotal },
  ];

  const monthlyBreakdown = Array.from(
    { length: dealInputs?.duration_months || 12 },
    (_, i) => {
      const month = i + 1;
      const laborCost = laborEstimates.reduce((sum, item) => {
        if (month >= item.start_month && month <= item.end_month) {
          const baseHours = item.hours_per_month * item.fte_count;
          const baseCost = baseHours * item.hourly_rate;
          const onCost = baseCost * (item.on_cost_percentage / 100);
          return sum + baseCost + onCost;
        }
        return sum;
      }, 0);

      const nonLaborCost = nonLaborEstimates.reduce((sum, item) => {
        if (item.one_time && month === 1) {
          return sum + item.amount;
        }
        if (
          !item.one_time &&
          month >= (item.start_month || 1) &&
          month <= (item.end_month || 1)
        ) {
          return sum + item.amount;
        }
        return sum;
      }, 0);

      return {
        month,
        Labor: laborCost,
        "Non-Labor": nonLaborCost,
      };
    }
  );

  const handleDigitalSign = async () => {
    if (!isReviewed) return;
    if (!dealInputs || !dealInputs.project_name) {
      toast.error(
        "Missing project information. Please review the estimator inputs."
      );
      return;
    }

    setIsSigning(true);
    try {
      // Extract user email from localStorage (set during authentication)
      const authData =
        localStorage.getItem("cv.jwt") || localStorage.getItem("finz_jwt");
      const userEmail = authData
        ? extractEmailFromJWT(authData)
        : "unknown@user.com";

      console.log("✍️  Submitting baseline for server-side signing:", {
        projectName: dealInputs?.project_name,
        client: dealInputs?.client_name,
        currency: dealInputs?.currency,
        startDate: dealInputs?.start_date,
        duration: dealInputs?.duration_months,
        createdBy: userEmail,
      });

      // Create baseline with ALL required fields
      const baselineRequest = {
        project_name: dealInputs.project_name,
        project_description: dealInputs.project_description,
        client_name: dealInputs.client_name,
        currency: dealInputs.currency,
        start_date: dealInputs.start_date,
        duration_months: dealInputs.duration_months,
        contract_value: dealInputs.contract_value,
        assumptions: dealInputs.assumptions || [],
        created_by: userEmail,
        labor_estimates: laborEstimates,
        non_labor_estimates: nonLaborEstimates,
        fx_indexation: fxIndexationData ?? undefined,
      } satisfies BaselineCreateRequest;

      const baseline = await ApiService.createBaseline(baselineRequest);

      setBaselineId(baseline.baseline_id);
      setBaselineMeta(baseline);
      setSignatureComplete(true);
      toast.success("✓ Baseline successfully signed and created");
    } catch (error) {
      console.error("❌ Failed to create baseline:", error);
      toast.error(
        `Failed to create baseline: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsSigning(false);
    }
  };

  const handleComplete = async () => {
    if (!baselineId) {
      toast.error("Baseline ID not found. Please sign first.");
      return;
    }

    setShowHandoffConfirm(true);
  };

  const confirmHandoff = async () => {
    setShowHandoffConfirm(false);
    setIsHandingOff(true);

    try {
      // Get project ID from deal inputs or generate one
      const projectId = derivedProjectId;

      // Calculate labor percentage
      const laborTotal = laborEstimates.reduce((sum, item) => {
        const baseHours = item.hours_per_month * item.fte_count;
        const baseCost = baseHours * item.hourly_rate;
        const onCost = baseCost * (item.on_cost_percentage / 100);
        const duration = item.end_month - item.start_month + 1;
        return sum + (baseCost + onCost) * duration;
      }, 0);

      const nonLaborTotal = nonLaborEstimates.reduce((sum, item) => {
        if (item.one_time) return sum + item.amount;
        const duration = (item.end_month || 1) - (item.start_month || 1) + 1;
        return sum + item.amount * duration;
      }, 0);

      const grandTotal = laborTotal + nonLaborTotal;
      const laborPercentage =
        grandTotal > 0 ? (laborTotal / grandTotal) * 100 : 0;

      // Get user email
      const authData =
        localStorage.getItem("cv.jwt") || localStorage.getItem("finz_jwt");
      const userEmail = authData
        ? extractEmailFromJWT(authData)
        : "unknown@user.com";

      console.log("🚀 Initiating handoff to SDMT:", {
        projectId,
        baselineId,
        modTotal: grandTotal,
        laborPercentage,
        aceptadoPor: userEmail,
      });

      // Call handoff API
      await ApiService.handoffBaseline(projectId, {
        baseline_id: baselineId,
        mod_total: grandTotal,
        pct_ingenieros: laborPercentage,
        pct_sdm: 100 - laborPercentage,
        aceptado_por: userEmail,
      });

      toast.success("✓ Project successfully handed off to SDMT team!");

      // Refresh projects to get the newly created project
      await refreshProject();

      // Set the newly created project as selected
      setSelectedProjectId(projectId);

      // Navigate to SDMT cost catalog after data refresh
      setTimeout(() => {
        navigate("/sdmt/cost/catalog");
      }, 500);
    } catch (error) {
      console.error("❌ Handoff failed:", error);
      toast.error(
        `Handoff failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsHandingOff(false);
    }
  };

  const handleExportBaseline = async () => {
    if (!signatureComplete || !baselineId) {
      toast.error("Please complete the digital signature first");
      return;
    }

    try {
      // Calculate total amount
      const totalLaborCost = laborEstimates.reduce((sum, labor) => {
        const baseHours = labor.hours_per_month * labor.fte_count * 12; // 12 months
        const baseCost = baseHours * labor.hourly_rate;
        const onCost = baseCost * (labor.on_cost_percentage / 100);
        return sum + baseCost + onCost;
      }, 0);

      const totalNonLaborCost = nonLaborEstimates.reduce(
        (sum, item) => sum + item.amount,
        0
      );
      const totalAmount = totalLaborCost + totalNonLaborCost;
      const signatureHash = baselineMeta?.signature_hash || baselineId;

      // Create baseline data structure for export
      const baselineData = {
        baseline_id: baselineId,
        project_id: dealInputs?.project_name || "Unknown Project",
        project_name: dealInputs?.project_name || "Unknown Project",
        created_by: "Current User", // In real app, get from auth
        accepted_by: "Current User",
        accepted_ts: new Date().toISOString(),
        signature_hash: signatureHash,
        total_amount: totalAmount,
        currency: "USD" as const,
        created_at: new Date().toISOString(),
        status: "signed" as const,
        line_items: [
          ...laborEstimates.map((labor, index) => ({
            id: `labor_${index}`,
            category: "Labor",
            subtype: labor.level,
            description: `${labor.role} (${labor.level}) - ${labor.fte_count} FTE`,
            one_time: false,
            recurring: true,
            qty: labor.fte_count,
            unit_cost: labor.hourly_rate * labor.hours_per_month,
            currency: "USD" as const,
            start_month: labor.start_month,
            end_month: labor.end_month,
            amortization: "none" as const,
            capex_flag: false,
            indexation_policy: "none" as const,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            created_by: "Current User",
          })),
          ...nonLaborEstimates.map((nonLabor, index) => ({
            id: `nonlabor_${index}`,
            category: nonLabor.category,
            description: nonLabor.description,
            one_time: nonLabor.one_time,
            recurring: !nonLabor.one_time,
            qty: 1,
            unit_cost: nonLabor.amount,
            currency: nonLabor.currency,
            start_month: nonLabor.start_month || 1,
            end_month: nonLabor.end_month || 1,
            amortization: "none" as const,
            capex_flag: nonLabor.capex_flag,
            vendor: nonLabor.vendor,
            indexation_policy: "none" as const,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            created_by: "Current User",
          })),
        ],
        monthly_totals: monthlyBreakdown.map((month) => ({
          month: month.month,
          amount_planned: month.Labor + month["Non-Labor"],
        })),
        assumptions: [
          "Labor rates include standard benefits and overhead",
          "FX rates locked at booking time",
          "Non-labor costs subject to vendor confirmation",
          "Timeline assumes standard project execution",
        ],
      };

      const buffer = await excelExporter.exportBaselineBudget(baselineData);
      const filename = `baseline-budget-${baselineId}-${
        new Date().toISOString().split("T")[0]
      }.xlsx`;
      downloadExcelFile(buffer, filename);
      toast.success("Baseline budget exported successfully");
    } catch (error) {
      toast.error("Failed to export baseline budget");
      console.error(error);
    }
  };

  const handleExportPDFSummary = async () => {
    if (!signatureComplete || !baselineId) {
      toast.error("Please complete the digital signature first");
      return;
    }

    try {
      const totalLaborCost = laborEstimates.reduce((sum, labor) => {
        const baseHours = labor.hours_per_month * labor.fte_count * 12;
        const baseCost = baseHours * labor.hourly_rate;
        return sum + baseCost + (baseCost * labor.on_cost_percentage) / 100;
      }, 0);

      const totalNonLaborCost = nonLaborEstimates.reduce((sum, item) => {
        const duration =
          item.end_month && item.start_month
            ? item.end_month - item.start_month + 1
            : 1;
        return sum + (item.one_time ? item.amount : item.amount * duration);
      }, 0);

      const totalAmount = totalLaborCost + totalNonLaborCost;
      const laborPercentage = (totalLaborCost / totalAmount) * 100;

      const reportData = {
        title: "Project Baseline Budget",
        subtitle: "PMO Pre-Factura Estimate Summary",
        generated: new Date().toLocaleDateString(),
        metrics: [
          {
            label: "Total Project Cost",
            value: formatReportCurrency(totalAmount),
            color: "#2BB673",
          },
          {
            label: "Labor Costs",
            value: formatReportCurrency(totalLaborCost),
            change: `${laborPercentage.toFixed(1)}% of total`,
            changeType: "neutral" as const,
            color: "#14B8A6",
          },
          {
            label: "Non-Labor Costs",
            value: formatReportCurrency(totalNonLaborCost),
            change: `${(100 - laborPercentage).toFixed(1)}% of total`,
            changeType: "neutral" as const,
            color: "#f59e0b",
          },
          {
            label: "Team Size",
            value: `${laborEstimates.reduce(
              (sum, labor) => sum + labor.fte_count,
              0
            )} FTE`,
            change: `${laborEstimates.length} roles`,
            changeType: "positive" as const,
            color: "#6366f1",
          },
        ],
        summary: [
          `Project: ${dealInputs?.project_name || "Unnamed Project"}`,
          `Duration: ${dealInputs?.duration_months || 12} months`,
          `Team composition: ${
            laborEstimates.length
          } roles, ${laborEstimates.reduce(
            (sum, labor) => sum + labor.fte_count,
            0
          )} FTE`,
          `Baseline ID: ${baselineId} (digitally signed)`,
        ],
        recommendations: [
          "Review labor rates quarterly for market alignment",
          "Validate vendor quotes before project commencement",
          "Establish change control process for scope modifications",
          "Monitor actual costs against baseline for variance analysis",
        ],
      };

      await PDFExporter.exportToPDF(reportData);
      toast.success("Professional baseline summary generated");
    } catch (error) {
      toast.error("Failed to generate PDF summary");
      console.error(error);
    }
  };

  const handleSupportingDocsSelected = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (!files.length) {
      return;
    }

    try {
      setIsUploadingDoc(true);
      setUploadProgress((prev) => {
        const next = { ...prev };
        for (const file of files) {
          next[file.name] = "presigning";
        }
        return next;
      });

      const { successes, failures } = await uploadDocumentsBatch(
        files,
        { projectId: derivedProjectId, module: "prefactura" },
        {
          onStageChange: (stage, file) => {
            setUploadProgress((prev) => ({ ...prev, [file.name]: stage }));
            if (stage === "complete") {
              setTimeout(() => {
                setUploadProgress((current) => {
                  const next = { ...current };
                  delete next[file.name];
                  return next;
                });
              }, 1200);
            }
          },
          onError: (file) => {
            setUploadProgress((current) => {
              const next = { ...current };
              delete next[file.name];
              return next;
            });
          },
        }
      );

      if (successes.length) {
        setSupportingDocs((prev) => [...successes, ...prev]);
        toast.success(
          successes.length > 1
            ? `${successes.length} supporting documents uploaded`
            : "Supporting document uploaded"
        );
      }

      if (failures.length) {
        const message =
          failures.length === 1
            ? `${failures[0].file.name}: ${failures[0].message}`
            : `${failures.length} uploads failed. Check console for details.`;
        toast.error(message);
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to upload supporting document";
      toast.error(message);
    } finally {
      setIsUploadingDoc(false);
      event.target.value = "";
    }
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-semibold mb-2">
          Review & Digital Signature
        </h2>
        <p className="text-muted-foreground">
          Review your complete baseline estimate and digitally sign for handoff
          to SDMT
        </p>
      </div>

      {/* Executive Summary */}
      <Card className="bg-linear-to-r from-primary/5 to-accent/5 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText size={24} />
            Executive Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <DollarSign className="mx-auto mb-2 text-primary" size={32} />
              <p className="text-3xl font-bold text-primary">
                ${grandTotal.toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground">
                Total Project Cost
              </p>
            </div>
            <div className="text-center">
              <Clock className="mx-auto mb-2 text-muted-foreground" size={32} />
              <p className="text-3xl font-bold">
                {dealInputs?.duration_months || 0}
              </p>
              <p className="text-sm text-muted-foreground">Months Duration</p>
            </div>
            <div className="text-center">
              <Users className="mx-auto mb-2 text-muted-foreground" size={32} />
              <p className="text-3xl font-bold">
                {laborEstimates.reduce((sum, item) => sum + item.fte_count, 0)}
              </p>
              <p className="text-sm text-muted-foreground">Total FTEs</p>
            </div>
            <div className="text-center">
              <Server
                className="mx-auto mb-2 text-muted-foreground"
                size={32}
              />
              <p className="text-3xl font-bold">{nonLaborEstimates.length}</p>
              <p className="text-sm text-muted-foreground">Cost Items</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Project Details */}
        <Card>
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <span className="font-medium">Project Name:</span>
              <p className="text-muted-foreground">
                {dealInputs?.project_name}
              </p>
            </div>
            <div>
              <span className="font-medium">Client:</span>
              <p className="text-muted-foreground">
                {dealInputs?.client_name || "Not specified"}
              </p>
            </div>
            <div>
              <span className="font-medium">Currency:</span>
              <Badge className="ml-2">{dealInputs?.currency}</Badge>
            </div>
            <div>
              <span className="font-medium">Start Date:</span>
              <p className="text-muted-foreground">{dealInputs?.start_date}</p>
            </div>
            <div>
              <span className="font-medium">Duration:</span>
              <p className="text-muted-foreground">
                {dealInputs?.duration_months} months
              </p>
            </div>
            {dealInputs?.contract_value && (
              <div>
                <span className="font-medium">Contract Value:</span>
                <p className="text-muted-foreground">
                  ${dealInputs.contract_value.toLocaleString()}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cost Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Cost Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span>Labor Costs:</span>
              <span className="font-bold">${laborTotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Non-Labor Costs:</span>
              <span className="font-bold">
                ${nonLaborTotal.toLocaleString()}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between items-center text-lg">
              <span className="font-bold">Total Estimate:</span>
              <span className="font-bold text-primary">
                ${grandTotal.toLocaleString()}
              </span>
            </div>

            <div className="pt-4">
              <span className="font-medium">Cost Distribution:</span>
              <div className="mt-2 space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">
                    Labor ({((laborTotal / grandTotal) * 100).toFixed(1)}%)
                  </span>
                  <div className="w-32 bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full"
                      style={{ width: `${(laborTotal / grandTotal) * 100}%` }}
                    />
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">
                    Non-Labor ({((nonLaborTotal / grandTotal) * 100).toFixed(1)}
                    %)
                  </span>
                  <div className="w-32 bg-muted rounded-full h-2">
                    <div
                      className="bg-accent h-2 rounded-full"
                      style={{
                        width: `${(nonLaborTotal / grandTotal) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Assumptions */}
      {dealInputs?.assumptions && dealInputs.assumptions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Key Assumptions</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {dealInputs.assumptions.map(
                (assumption, index) =>
                  assumption.trim() && (
                    <li key={index} className="flex items-start gap-2">
                      <CheckCircle2
                        size={16}
                        className="text-green-600 mt-0.5 shrink-0"
                      />
                      <span className="text-sm">{assumption}</span>
                    </li>
                  )
              )}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <ChartInsightsPanel
        title="Cost Analysis & Insights"
        charts={[
          <DonutChart
            key="cost-mix"
            data={costMixData}
            title="Cost Mix Breakdown"
          />,
          <StackedColumnsChart
            key="monthly-breakdown"
            data={monthlyBreakdown}
            stacks={[
              {
                dataKey: "Labor",
                name: "Labor",
                color: "oklch(0.61 0.15 160)",
              },
              {
                dataKey: "Non-Labor",
                name: "Non-Labor",
                color: "oklch(0.72 0.15 65)",
              },
            ]}
            title="Monthly Cost Distribution"
          />,
        ]}
        insights={[
          {
            title: "Labor vs Non-Labor",
            value: `${((laborTotal / grandTotal) * 100).toFixed(0)}% / ${(
              (nonLaborTotal / grandTotal) *
              100
            ).toFixed(0)}%`,
            type: laborTotal > nonLaborTotal ? "positive" : "neutral",
          },
          {
            title: "Average Monthly Cost",
            value: `$${Math.round(
              grandTotal / (dealInputs?.duration_months || 1)
            ).toLocaleString()}`,
            type: "neutral",
          },
          {
            title: "Team Size",
            value: `${laborEstimates.reduce(
              (sum, item) => sum + item.fte_count,
              0
            )} FTE`,
            type: "positive",
          },
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload size={18} /> Supporting Documents
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Label
            htmlFor={supportingDocsInputId}
            className="text-sm font-medium text-foreground"
          >
            Attach supporting documents
          </Label>
          <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-4">
            <Input
              id={supportingDocsInputId}
              name="supportingDocuments"
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg"
              onChange={handleSupportingDocsSelected}
              disabled={isUploadingDoc}
              aria-describedby={supportingDocsHelpId}
            />
            <p
              id={supportingDocsHelpId}
              className="text-xs text-muted-foreground mt-2"
            >
              Files upload via the shared `/uploads/docs` endpoint using the
              Prefactura module tag so SDMT can reference them later.
            </p>
          </div>
          {isUploadingDoc && (
            <div className="text-sm text-primary space-y-1">
              {Object.keys(uploadProgress).length === 0 ? (
                <p>Preparing uploads…</p>
              ) : (
                Object.entries(uploadProgress).map(([name, stage]) => (
                  <p key={name} className="flex items-center gap-2">
                    <span className="font-medium">{name}</span>
                    <span className="text-xs text-muted-foreground">
                      {uploadStageText[stage]}
                    </span>
                  </p>
                ))
              )}
            </div>
          )}
          {supportingDocs.length ? (
            <div className="space-y-2">
              {supportingDocs.map((doc) => (
                <div
                  key={doc.documentKey}
                  className="flex items-center justify-between gap-4 rounded border border-border p-3 text-sm"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {doc.originalName}
                    </div>
                    <div
                      className="text-xs text-muted-foreground font-mono truncate"
                      title={doc.documentKey}
                    >
                      {doc.documentKey}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(doc.uploadedAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No supporting documents uploaded yet.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Review & Sign Section */}
      {!signatureComplete ? (
        <Card className="border-primary/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PenTool size={20} />
              Digital Signature Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                By signing this baseline estimate, you confirm the accuracy of
                all data and authorize handoff to the SDMT team for ongoing cost
                management and forecasting.
              </AlertDescription>
            </Alert>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="review-confirm"
                checked={isReviewed}
                onCheckedChange={(checked) => setIsReviewed(checked === true)}
              />
              <label
                htmlFor="review-confirm"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                I have reviewed all project details, costs, and assumptions
                above and confirm their accuracy
              </label>
            </div>

            <div className="flex justify-between items-center">
              <div className="text-sm text-muted-foreground">
                Signing as: PMO User • {new Date().toLocaleDateString()}
              </div>
              <Button
                onClick={handleDigitalSign}
                disabled={!isReviewed || isSigning}
                className="gap-2"
                size="lg"
              >
                {isSigning ? (
                  <>
                    <Clock size={16} className="animate-spin" />
                    Creating Baseline...
                  </>
                ) : (
                  <>
                    <PenTool size={16} />
                    Sign & Create Baseline
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-green-500 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle2 size={20} />
              Baseline Successfully Created
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700">
                Your baseline estimate has been digitally signed and is ready
                for SDMT handoff.
              </AlertDescription>
            </Alert>

            <div className="bg-white rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Baseline ID:</span>
                  <p className="font-mono font-bold">{baselineId}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Created:</span>
                  <p className="font-medium">{new Date().toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={handleExportBaseline}
                >
                  <FileSpreadsheet size={16} />
                  Export Excel
                </Button>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={handleExportPDFSummary}
                >
                  <FileText size={16} />
                  Share Report
                </Button>
              </div>
              <Button
                onClick={handleComplete}
                className="gap-2"
                size="lg"
                disabled={isHandingOff}
              >
                {isHandingOff ? (
                  <>
                    <Clock size={16} className="animate-spin" />
                    Handing Off...
                  </>
                ) : (
                  <>
                    Complete & Handoff to SDMT
                    <CheckCircle2 size={16} />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Handoff Confirmation Dialog */}
      <AlertDialog
        open={showHandoffConfirm}
        onOpenChange={setShowHandoffConfirm}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Handoff to SDMT</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <div>
                <p className="font-medium text-foreground mb-3">
                  Review handoff details:
                </p>
                <ul className="space-y-2 text-sm">
                  <li>
                    <span className="font-medium">Project:</span>{" "}
                    {dealInputs?.project_name}
                  </li>
                  <li>
                    <span className="font-medium">Baseline ID:</span>{" "}
                    <code className="bg-muted px-2 py-1 rounded">
                      {baselineId}
                    </code>
                  </li>
                  <li>
                    <span className="font-medium">Total Budget:</span> $
                    {(
                      laborEstimates.reduce((sum, item) => {
                        const baseHours = item.hours_per_month * item.fte_count;
                        const baseCost = baseHours * item.hourly_rate;
                        const onCost =
                          baseCost * (item.on_cost_percentage / 100);
                        const duration = item.end_month - item.start_month + 1;
                        return sum + (baseCost + onCost) * duration;
                      }, 0) +
                      nonLaborEstimates.reduce((sum, item) => {
                        if (item.one_time) return sum + item.amount;
                        const duration =
                          (item.end_month || 1) - (item.start_month || 1) + 1;
                        return sum + item.amount * duration;
                      }, 0)
                    ).toLocaleString()}
                  </li>
                </ul>
              </div>
              <p className="text-xs text-muted-foreground">
                Once handed off, the project data will be transferred to the
                SDMT team for cost management and monitoring.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmHandoff} disabled={isHandingOff}>
              {isHandingOff ? "Handing Off..." : "Confirm Handoff"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default ReviewSignStep;
