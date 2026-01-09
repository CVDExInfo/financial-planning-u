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
import { BaselineStatusPanel } from "@/components/baseline/BaselineStatusPanel";
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
import type { DealInputs, LaborEstimate, NonLaborEstimate } from "@/types/domain";
import { excelExporter, downloadExcelFile } from "@/lib/excel-export";
import { PDFExporter, formatReportCurrency } from "@/lib/pdf-export";
import {
  uploadDocument,
  type DocumentUploadMeta,
  type DocumentUploadStage,
} from "@/lib/documents/uploadService";
import { BaselineError } from "@/lib/errors";
import {
  createPrefacturaBaseline,
  type PrefacturaBaselineResponse,
  type PrefacturaBaselinePayload,
  handoffBaseline,
  acceptBaseline,
  FinanzasApiError,
} from "@/api/finanzas";

import {
  computeLaborTotal,
  computeNonLaborTotal,
  computeMonthlyBreakdown,
  computeGrandTotal,
  computeLaborPercentage,
} from "@/lib/cost-utils";

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
  presigning: "Solicitando espacio seguro...",
  uploading: "Subiendo a S3...",
  complete: "Verificando carga...",
};

export function ReviewSignStep({ data }: ReviewSignStepProps) {
  const navigate = useNavigate();
  const { refreshProject, setSelectedProjectId, currentProject } = useProject();
  const [isReviewed, setIsReviewed] = useState(false);
  const [shouldAcceptBaseline, setShouldAcceptBaseline] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [signatureComplete, setSignatureComplete] = useState(false);
  const [baselineId, setBaselineId] = useState<string>("");
  const [signedBy, setSignedBy] = useState<string>("");
  const [baselineMeta, setBaselineMeta] =
    useState<PrefacturaBaselineResponse | null>(null);
  const [isHandingOff, setIsHandingOff] = useState(false);
  const [showHandoffConfirm, setShowHandoffConfirm] = useState(false);
  const [supportingDocs, setSupportingDocs] = useState<
    SupportingDocumentMeta[]
  >([]);
  const [uploadProgress, setUploadProgress] =
    useState<Record<string, DocumentUploadStage>>({});
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const fallbackProjectIdRef = useRef(`PRJ-${Date.now().toString(36)}`);
  // Prefactura MUST NOT use SDMT selectedProjectId.
  // Create a unique project id per estimator session so baselines don’t collide.
  const prefacturaProjectIdRef = useRef(
    `P-${
      globalThis.crypto?.randomUUID?.() ??
      `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
    }`,
  );
  // If backend returns a projectId, it becomes authoritative (should match ref).
  const prefacturaProjectId =
    baselineMeta?.projectId ?? prefacturaProjectIdRef.current;
  const supportingDocsInputId = "prefactura-supporting-docs";
  const supportingDocsHelpId = `${supportingDocsInputId}-help`;

  const { dealInputs, laborEstimates, nonLaborEstimates, fxIndexationData } =
    data;

  const hasUploadsInFlight =
    isUploadingDoc || Object.keys(uploadProgress).length > 0;

  const derivedProjectId = useMemo(() => {
    if (dealInputs?.project_name) {
      return `PRJ-${dealInputs.project_name
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "-")
        .substring(0, 20)}`;
    }
    return fallbackProjectIdRef.current;
  }, [dealInputs?.project_name]);

  // Use shared cost utilities
  const laborTotal = useMemo(
    () => computeLaborTotal(laborEstimates),
    [laborEstimates],
  );

  const nonLaborTotal = useMemo(
    () => computeNonLaborTotal(nonLaborEstimates),
    [nonLaborEstimates],
  );

  const grandTotal = useMemo(
    () => computeGrandTotal(laborEstimates, nonLaborEstimates),
    [laborEstimates, nonLaborEstimates],
  );

  const costMixData = useMemo(
    () => [
      { name: "Labor", value: laborTotal },
      { name: "Non-Labor", value: nonLaborTotal },
    ],
    [laborTotal, nonLaborTotal],
  );

  const monthlyBreakdown = useMemo(
    () =>
      computeMonthlyBreakdown(
        dealInputs?.duration_months || 12,
        laborEstimates,
        nonLaborEstimates,
      ),
    [dealInputs?.duration_months, laborEstimates, nonLaborEstimates],
  );

  const handleDigitalSign = async () => {
    if (!isReviewed) return;
    if (hasUploadsInFlight) {
      toast.error("Espera a que terminen las cargas de documentos.");
      return;
    }
    if (!dealInputs || !dealInputs.project_name) {
      toast.error(
        "Missing project information. Please review the estimator inputs.",
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

      setSignedBy(userEmail);

      console.log("✍️  Submitting baseline for server-side signing:", {
        projectName: dealInputs?.project_name,
        client: dealInputs?.client_name,
        currency: dealInputs?.currency,
        startDate: dealInputs?.start_date,
        duration: dealInputs?.duration_months,
        createdBy: userEmail,
      });

      const baselineRequest = {
        project_id: prefacturaProjectId,
        project_name: dealInputs.project_name,
        project_description: dealInputs.project_description,
        client_name: dealInputs.client_name,
        currency: dealInputs.currency,
        start_date: dealInputs.start_date,
        duration_months: dealInputs.duration_months,
        contract_value: dealInputs.contract_value,
        sdm_manager_name: dealInputs.sdm_manager_name,
        sdm_manager_email: dealInputs.sdm_manager_email?.toLowerCase(),
        assumptions: dealInputs.assumptions || [],
        labor_estimates: laborEstimates,
        non_labor_estimates: nonLaborEstimates,
        fx_indexation: fxIndexationData ?? undefined,
        supporting_documents: supportingDocs.map((doc) => {
          const docMeta = doc as Record<string, any>;
          return {
            document_id: docMeta.documentId || docMeta.document_id,
            document_key: docMeta.documentKey || docMeta.document_key || "",
            original_name: docMeta.originalName || docMeta.original_name,
            uploaded_at:
              docMeta.uploadedAt || docMeta.uploaded_at || new Date().toISOString(),
            content_type:
              docMeta.contentType || docMeta.content_type || "application/octet-stream",
          };
        }),
        signed_by: userEmail,
        signed_role: "PMO",
        signed_at: new Date().toISOString(),
      } as PrefacturaBaselinePayload;

      const baseline = await createPrefacturaBaseline(baselineRequest);

      // CRITICAL FIX: Backend returns unique projectId to prevent DynamoDB overwrites
      // Store this projectId and use it for all subsequent API calls (handoff, accept)
      if (!baseline.projectId) {
        throw new Error(
          "Backend did not return projectId. Cannot proceed with handoff."
        );
      }
      if (baseline.projectId !== prefacturaProjectIdRef.current) {
        throw new Error(
          `ProjectId mismatch. Prefactura uploaded docs under ${prefacturaProjectIdRef.current} but backend returned ${baseline.projectId}.`
        );
      }

      setBaselineId(baseline.baselineId);
      setBaselineMeta(baseline);
      setSignatureComplete(true);
      await refreshProject();
      toast.success("Línea base creada correctamente.");
    } catch (error) {
      console.error(
        "[Finanzas Baseline] Failed to create baseline for project",
        derivedProjectId,
        error,
      );

      if (error instanceof BaselineError && error.kind === "server") {
        toast.error(
          "No se pudo crear la línea base por un problema interno en Finanzas. Inténtalo de nuevo más tarde o contacta a soporte.",
        );
      } else if (error instanceof FinanzasApiError) {
        toast.error(
          error.status && error.status >= 500
            ? "Hubo un problema al crear la línea base."
            : error.message,
        );
      } else {
        const message =
          error instanceof BaselineError
            ? error.safeMessage
            : error instanceof Error
              ? error.message
              : "No se pudo crear la línea base.";
        toast.error(message);
      }
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
      // CRITICAL FIX: Use backend-issued projectId from baseline response
      // to prevent DynamoDB METADATA overwrites when multiple baselines share same name
      if (!baselineMeta?.projectId) {
        throw new Error(
          "Backend projectId not found. Please sign the baseline first."
        );
      }
      const projectId = baselineMeta.projectId;

      const laborTotalLocal = computeLaborTotal(laborEstimates);
      const nonLaborTotalLocal = computeNonLaborTotal(nonLaborEstimates);
      const grandTotalLocal = laborTotalLocal + nonLaborTotalLocal;
      const laborPercentage =
        grandTotalLocal > 0 ? (laborTotalLocal / grandTotalLocal) * 100 : 0;

      const authData =
        localStorage.getItem("cv.jwt") || localStorage.getItem("finz_jwt");
      const userEmail = authData
        ? extractEmailFromJWT(authData)
        : "unknown@user.com";

      console.log("🚀 Initiating handoff to SDMT:", {
        projectId,
        baselineId,
        modTotal: grandTotalLocal,
        laborPercentage,
      });

      const handoffPayload = {
        baseline_id: baselineId,
        mod_total: grandTotalLocal,
        pct_ingenieros: laborPercentage,
        pct_sdm: 100 - laborPercentage,
        project_name: dealInputs?.project_name,
        client_name: dealInputs?.client_name,
      } as any;

      await handoffBaseline(projectId, handoffPayload);

      toast.success("✓ Project successfully handed off to SDMT team!");

      if (shouldAcceptBaseline) {
        try {
          await acceptBaseline(projectId, {
            baseline_id: baselineId,
            accepted_by: userEmail,
          });
          toast.success("✓ Baseline accepted!");
        } catch (acceptError) {
          console.error("❌ Baseline acceptance failed:", acceptError);
          const acceptMessage =
            acceptError instanceof FinanzasApiError
              ? acceptError.message
              : acceptError instanceof Error
                ? acceptError.message
                : "Unknown error";
          toast.error(`Baseline acceptance failed: ${acceptMessage}`);
        }
      }

      await refreshProject();
      setSelectedProjectId(projectId);
      setTimeout(() => {
        navigate("/sdmt/cost/catalog");
      }, 500);
    } catch (error) {
      console.error("❌ Handoff failed:", error);
      const handoffMessage =
        error instanceof FinanzasApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Unknown error";
      toast.error(`Handoff failed: ${handoffMessage}`);
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
      const totalLaborCost = computeLaborTotal(laborEstimates);
      const totalNonLaborCost = computeNonLaborTotal(nonLaborEstimates);
      const totalAmount = totalLaborCost + totalNonLaborCost;
      const signatureHash = baselineMeta?.signatureHash || baselineId;

      const baselineData = {
        baseline_id: baselineId,
        project_id: dealInputs?.project_name || "Unknown Project",
        project_name: dealInputs?.project_name || "Unknown Project",
        created_by: "Current User",
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
      const totalLaborCost = computeLaborTotal(laborEstimates);
      const totalNonLaborCost = computeNonLaborTotal(nonLaborEstimates);
      const totalAmount = totalLaborCost + totalNonLaborCost;
      const laborPercentage = computeLaborPercentage(totalLaborCost, totalAmount);
      const totalFte = laborEstimates.reduce((sum, labor) => sum + labor.fte_count, 0);

      const reportData = {
        title: "Project Baseline Budget",
        subtitle: "PMO Pre-Factura Estimate Summary",
        generated: new Date().toLocaleDateString("es-CO"),
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
            value: `${totalFte} FTE`,
            change: `${laborEstimates.length} roles`,
            changeType: "positive" as const,
            color: "#6366f1",
          },
        ],
        metadata: {
          projectName: dealInputs?.project_name,
          projectId: derivedProjectId,
          baselineId,
          preparedBy: signedBy || undefined,
          currency: dealInputs?.currency,
        },
        summary: [
          `Project: ${dealInputs?.project_name || "Unnamed Project"}`,
          `Duration: ${dealInputs?.duration_months || 12} months`,
          `Team composition: ${
            laborEstimates.length
          } roles, ${laborEstimates.reduce(
            (sum, labor) => sum + labor.fte_count,
            0,
          )} FTE`,
          `Baseline ID: ${baselineId} (digitally signed)`,
        ],
        recommendations: [
          "Review labor rates quarterly for market alignment",
          "Validate vendor quotes before project commencement",
          "Establish change control process for scope modifications",
          "Monitor actual costs against baseline for variance analysis",
        ],
        charts: [
          {
            type: "donut" as const,
            title: "Desglose de Mezcla de Costos",
            data: costMixData,
          },
          {
            type: "bar" as const,
            title: "Distribución de Costos Mensual",
            data: monthlyBreakdown,
            stacks: [
              { dataKey: "Labor", name: "Laboral", color: "#2BB673" },
              { dataKey: "Non-Labor", name: "No Laboral", color: "#f59e0b" },
            ],
          },
        ],
        baselineDetails: {
          baselineId,
          signatureStatus: "Signed",
          durationMonths: dealInputs?.duration_months || undefined,
          teamSize: `${totalFte} FTE`,
          roleCount: laborEstimates.length,
          totalLabor: formatReportCurrency(totalLaborCost, dealInputs?.currency),
          totalNonLabor: formatReportCurrency(
            totalNonLaborCost,
            dealInputs?.currency,
          ),
          contractValue: dealInputs?.contract_value
            ? formatReportCurrency(dealInputs.contract_value, dealInputs?.currency)
            : undefined,
          currency: dealInputs?.currency,
        },
      };

      await PDFExporter.exportToPDF(reportData);
      toast.success("Professional baseline summary generated");
    } catch (error) {
      toast.error("Failed to generate PDF summary");
      console.error(error);
    }
  };

  const handleSupportingDocsSelected = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (!files.length) {
      return;
    }

    const successfulUploads: SupportingDocumentMeta[] = [];

    try {
      setIsUploadingDoc(true);
      setUploadProgress((prev) => {
        const next = { ...prev };
        for (const file of files) {
          next[file.name] = "presigning";
        }
        return next;
      });

      for (const file of files) {
        try {
          const uploaded = await uploadDocument(
            { projectId: prefacturaProjectId, module: "prefactura", file },
            {
              onStageChange: (stage) => {
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
              onError: () => {
                setUploadProgress((current) => {
                  const next = { ...current };
                  delete next[file.name];
                  return next;
                });
              },
            },
          );

          successfulUploads.push(uploaded);
        } catch (error) {
          const message =
            error instanceof FinanzasApiError
              ? error.message
              : "No se pudo cargar el documento. Inténtelo de nuevo más tarde.";
          console.error("[Prefactura Docs] Upload failed", {
            file: file.name,
            error,
          });
          toast.error(message);
          setUploadProgress((current) => {
            const next = { ...current };
            delete next[file.name];
            return next;
          });
        }
      }

      if (successfulUploads.length) {
        setSupportingDocs((prev) => [...successfulUploads, ...prev]);
        toast.success(
          successfulUploads.length > 1
            ? "Documentos cargados correctamente"
            : "Documento cargado correctamente",
        );
      }
    } finally {
      setIsUploadingDoc(false);
      event.target.value = "";
    }
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-semibold mb-2">Revisión y Firma Digital</h2>
        <p className="text-muted-foreground">
          Revise su estimación de línea base completa y firme digitalmente para la entrega a SDMT
        </p>
      </div>

      {/* Executive Summary */}
      <Card className="bg-linear-to-r from-primary/5 to-accent/5 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText size={24} />
            Resumen Ejecutivo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <DollarSign className="mx-auto mb-2 text-primary" size={32} />
              <p className="text-3xl font-bold text-primary">
                ${grandTotal.toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground">Costo Total del Proyecto</p>
            </div>
            <div className="text-center">
              <Clock className="mx-auto mb-2 text-muted-foreground" size={32} />
              <p className="text-3xl font-bold">{dealInputs?.duration_months || 0}</p>
              <p className="text-sm text-muted-foreground">Meses de Duración</p>
            </div>
            <div className="text-center">
              <Users className="mx-auto mb-2 text-muted-foreground" size={32} />
              <p className="text-3xl font-bold">
                {laborEstimates.reduce((sum, item) => sum + item.fte_count, 0)}
              </p>
              <p className="text-sm text-muted-foreground">FTEs Totales</p>
            </div>
            <div className="text-center">
              <Server className="mx-auto mb-2 text-muted-foreground" size={32} />
              <p className="text-3xl font-bold">{nonLaborEstimates.length}</p>
              <p className="text-sm text-muted-foreground">Elementos de Costo</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Baseline Status Panel - Read-only view for PMO */}
      {currentProject?.baselineId && currentProject?.baseline_status && (
        <BaselineStatusPanel className="mb-6" />
      )}

      {/* Detailed Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Project Details */}
        <Card>
          <CardHeader>
            <CardTitle>Detalles del Proyecto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <span className="font-medium">Nombre del Proyecto:</span>
              <p className="text-muted-foreground">{dealInputs?.project_name}</p>
            </div>
            <div>
              <span className="font-medium">Cliente:</span>
              <p className="text-muted-foreground">
                {dealInputs?.client_name || "No especificado"}
              </p>
            </div>
            <div>
              <span className="font-medium">Moneda:</span>
              <Badge className="ml-2">{dealInputs?.currency}</Badge>
            </div>
            <div>
              <span className="font-medium">Fecha de Inicio:</span>
              <p className="text-muted-foreground">{dealInputs?.start_date}</p>
            </div>
            <div>
              <span className="font-medium">Duración:</span>
              <p className="text-muted-foreground">{dealInputs?.duration_months} meses</p>
            </div>
            {dealInputs?.contract_value && (
              <div>
                <span className="font-medium">Valor del Contrato:</span>
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
            <CardTitle>Desglose de Costos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span>Costos Laborales:</span>
              <span className="font-bold">${laborTotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Costos No Laborales:</span>
              <span className="font-bold">${nonLaborTotal.toLocaleString()}</span>
            </div>
            <Separator />
            <div className="flex justify-between items-center text-lg">
              <span className="font-bold">Estimación Total:</span>
              <span className="font-bold text-primary">${grandTotal.toLocaleString()}</span>
            </div>

            <div className="pt-4">
              <span className="font-medium">Distribución de Costos:</span>
              <div className="mt-2 space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">
                    Laboral ({((laborTotal / grandTotal) * 100).toFixed(1)}%)
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
                    No Laboral ({((nonLaborTotal / grandTotal) * 100).toFixed(1)}%)
                  </span>
                  <div className="w-32 bg-muted rounded-full h-2">
                    <div
                      className="bg-accent h-2 rounded-full"
                      style={{ width: `${(nonLaborTotal / grandTotal) * 100}%` }}
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
            <CardTitle>Supuestos Clave</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {dealInputs.assumptions.map(
                (assumption, index) =>
                  assumption.trim() && (
                    <li key={index} className="flex items-start gap-2">
                      <CheckCircle2 size={16} className="text-green-600 mt-0.5 shrink-0" />
                      <span className="text-sm">{assumption}</span>
                    </li>
                  ),
              )}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <ChartInsightsPanel
        title="Análisis de Costos e Insights"
        charts={[
          <DonutChart key="cost-mix" data={costMixData} title="Desglose de Mezcla de Costos" />,
          <StackedColumnsChart
            key="monthly-breakdown"
            data={monthlyBreakdown}
            stacks={[
              {
                dataKey: "Labor",
                name: "Laboral",
                color: "#2BB673",
              },
              {
                dataKey: "Non-Labor",
                name: "No Laboral",
                color: "#f59e0b",
              },
            ]}
            title="Distribución de Costos Mensual"
          />,
        ]}
        insights={[
          {
            title: "Laboral vs No Laboral",
            value: `${((laborTotal / grandTotal) * 100).toFixed(0)}% / ${(
              (nonLaborTotal / grandTotal) * 100
            ).toFixed(0)}%`,
            type: laborTotal > nonLaborTotal ? "positive" : "neutral",
          },
          {
            title: "Costo Mensual Promedio",
            value: `$${Math.round(
              grandTotal / (dealInputs?.duration_months || 1),
            ).toLocaleString()}`,
            type: "neutral",
          },
          {
            title: "Tamaño del Equipo",
            value: `${laborEstimates.reduce(
              (sum, item) => sum + item.fte_count,
              0,
            )} FTE`,
            type: "positive",
          },
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload size={18} /> Documentos de Soporte
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Label htmlFor={supportingDocsInputId} className="text-sm font-medium text-foreground">
            Adjuntar documentos de soporte
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
            <p id={supportingDocsHelpId} className="text-xs text-muted-foreground mt-2">
              Los archivos se cargan a través del endpoint compartido `/uploads/docs` usando la etiqueta del módulo Prefactura para que SDMT pueda referenciarlos más tarde.
            </p>
          </div>
          {isUploadingDoc && (
            <div className="text-sm text-primary space-y-1">
              {Object.keys(uploadProgress).length === 0 ? (
                <p>Preparando cargas…</p>
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
                    <div className="font-medium truncate">{doc.originalName}</div>
                    <div
                      className="text-xs text-muted-foreground font-mono truncate"
                      title={doc.documentKey}
                    >
                      {doc.documentKey}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(doc.uploadedAt).toLocaleDateString("es-CO")}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No se han cargado documentos de soporte todavía.
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
              Firma Digital Requerida
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                Al firmar esta estimación de línea base, confirma la precisión de todos los datos y autoriza la entrega al equipo SDMT para la gestión y previsión continua de costos.
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
                He revisado todos los detalles del proyecto, costos y supuestos anteriores y confirmo su precisión
              </label>
            </div>

            <div className="flex justify-between items-center">
              <div className="text-sm text-muted-foreground">
                Firmando como: {signedBy || "Usuario PMO"} • {new Date().toLocaleDateString("es-CO")}
              </div>
              <Button
                onClick={handleDigitalSign}
                disabled={!isReviewed || isSigning || hasUploadsInFlight}
                className="gap-2"
                size="lg"
              >
                {isSigning ? (
                  <>
                    <Clock size={16} className="animate-spin" />
                    Creando Línea Base...
                  </>
                ) : (
                  <>
                    <PenTool size={16} />
                    Firmar y Crear Línea Base
                  </>
                )}
              </Button>
              {hasUploadsInFlight && (
                <p className="text-xs text-muted-foreground text-right">
                  Subiendo documentos de respaldo...
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-green-500 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle2 size={20} />
              Línea Base Creada Exitosamente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700">
                Su estimación de línea base ha sido firmada digitalmente y está lista para la entrega a SDMT.
              </AlertDescription>
            </Alert>

            <div className="bg-white rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">ID de Línea Base:</span>
                  <p className="font-mono font-bold">{baselineId}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Creado:</span>
                  <p className="font-medium">{new Date().toLocaleString("es-CO")}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <div className="flex gap-2">
                <Button variant="outline" className="gap-2" onClick={handleExportBaseline}>
                  <FileSpreadsheet size={16} />
                  Exportar Excel
                </Button>
                <Button variant="outline" className="gap-2" onClick={handleExportPDFSummary}>
                  <FileText size={16} />
                  Compartir Reporte
                </Button>
              </div>
              <Button onClick={handleComplete} className="gap-2" size="lg" disabled={isHandingOff}>
                {isHandingOff ? (
                  <>
                    <Clock size={16} className="animate-spin" />
                    Entregando...
                  </>
                ) : (
                  <>
                    Completar y Entregar a SDMT
                    <CheckCircle2 size={16} />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Handoff Confirmation Dialog */}
      <AlertDialog open={showHandoffConfirm} onOpenChange={setShowHandoffConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Entrega a SDMT</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <div>
                <p className="font-medium text-foreground mb-3">Revisar detalles de la entrega:</p>
                <ul className="space-y-2 text-sm">
                  <li>
                    <span className="font-medium">Proyecto:</span> {dealInputs?.project_name}
                  </li>
                  <li>
                    <span className="font-medium">ID de Línea Base:</span>{" "}
                    <code className="bg-muted px-2 py-1 rounded">{baselineId}</code>
                  </li>
                  {signedBy && (
                    <li>
                      <span className="font-medium">Firmado por:</span> {signedBy}
                    </li>
                  )}
                  <li>
                    <span className="font-medium">Presupuesto Total:</span> $
                    {(computeLaborTotal(laborEstimates) + computeNonLaborTotal(nonLaborEstimates)).toLocaleString()}
                  </li>
                </ul>
              </div>
              <div className="flex items-center space-x-2 pt-2">
                <Checkbox
                  id="accept-baseline-confirm"
                  checked={shouldAcceptBaseline}
                  onCheckedChange={(checked) => setShouldAcceptBaseline(checked === true)}
                />
                <label
                  htmlFor="accept-baseline-confirm"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  También aceptar línea base inmediatamente (opcional)
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                Una vez entregado, los datos del proyecto se transferirán al equipo SDMT para la gestión y monitoreo de costos.
                {!shouldAcceptBaseline && " Puede aceptar la línea base más tarde desde la vista del proyecto."}
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmHandoff} disabled={isHandingOff}>
              {isHandingOff ? "Entregando..." : "Confirmar Entrega"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default ReviewSignStep;
