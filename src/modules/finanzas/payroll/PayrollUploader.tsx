import React, { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createPayrollActual, bulkUploadPayrollActuals, type PayrollActualInput, fetchProjects, fetchRubros } from "@/api/finanzas";
import CurrencySelector, { formatCurrency } from "@/components/shared/CurrencySelector";
import type { Currency } from "@/types/domain";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface PayrollUploaderProps {
  onUploaded?: () => void;
}

const TEMPLATE_HEADERS = [
  "projectId",
  "month",
  "rubroId",
  "amount",
  "allocationId",
  "resourceCount",
  "source",
  "uploadedBy",
  "notes",
];

function buildCsvTemplate(): string {
  return `${TEMPLATE_HEADERS.join(",")}` + "\n" + "proj_xxxxxx,2025-01,rubro_mod,10000,,,excel,user@example.com,Optional note";
}

function parseCsv(content: string): PayrollActualInput[] {
  const lines = content.trim().split(/\r?\n/);
  if (lines.length === 0) return [];
  const headers = lines[0].split(",").map((h) => h.trim());

  return lines
    .slice(1)
    .filter(Boolean)
    .map((line) => {
      const cells = line.split(",");
      const row: any = {};
      headers.forEach((header, idx) => {
        row[header] = cells[idx]?.trim();
      });
      return {
        projectId: row.projectId,
        month: row.month,
        rubroId: row.rubroId,
        amount: Number(row.amount || 0),
        allocationId: row.allocationId,
        resourceCount: row.resourceCount ? Number(row.resourceCount) : undefined,
        source: row.source,
        uploadedBy: row.uploadedBy,
        notes: row.notes,
      } as PayrollActualInput;
    });
}

function validateRow(row: PayrollActualInput): string[] {
  const errors: string[] = [];
  if (!row.projectId) errors.push("Falta projectId");
  if (!row.month) errors.push("Falta month (YYYY-MM)");
  if (!row.rubroId) errors.push("Falta rubroId");
  if (row.amount === undefined || Number.isNaN(row.amount)) errors.push("Monto inválido");
  return errors;
}

export default function PayrollUploader({ onUploaded }: PayrollUploaderProps) {
  const [manual, setManual] = React.useState<PayrollActualInput & { currency: Currency }>({
    projectId: "",
    month: "",
    rubroId: "",
    amount: 0,
    currency: "USD",
    notes: "",
  });
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [preview, setPreview] = React.useState<PayrollActualInput[]>([]);
  const [previewErrors, setPreviewErrors] = React.useState<Record<number, string[]>>({});
  
  // State for projects and rubros dropdowns
  const [projects, setProjects] = React.useState<Array<{
    projectId: string;
    code: string;
    name: string;
    client?: string;
  }>>([]);
  const [rubros, setRubros] = React.useState<Array<{
    rubroId: string;
    code: string;
    description: string;
    category: string;
  }>>([]);
  const [loadingProjects, setLoadingProjects] = React.useState(false);
  const [loadingRubros, setLoadingRubros] = React.useState(false);

  // Selected rubro details for display
  const selectedRubro = React.useMemo(() => {
    return rubros.find((r) => r.rubroId === manual.rubroId);
  }, [rubros, manual.rubroId]);

  // Fetch projects and rubros on mount
  useEffect(() => {
    const loadData = async () => {
      setLoadingProjects(true);
      setLoadingRubros(true);
      
      try {
        const [projectsData, rubrosData] = await Promise.all([
          fetchProjects(),
          fetchRubros(),
        ]);
        
        setProjects(projectsData);
        setRubros(rubrosData);
      } catch (error) {
        console.error("Error loading data:", error);
        toast.error("Error al cargar proyectos y rubros");
      } finally {
        setLoadingProjects(false);
        setLoadingRubros(false);
      }
    };

    loadData();
  }, []);

  const handleDownloadTemplate = () => {
    const blob = new Blob([buildCsvTemplate()], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "payroll_actuals_template.csv";
    link.click();
  };

  const handleManualSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await createPayrollActual({ ...manual, amount: Number(manual.amount) });
      toast.success("Nómina registrada correctamente");
      onUploaded?.();
    } catch (err) {
      console.error(err);
      toast.error("No se pudo registrar la nómina");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const content = await file.text();
    const rows = parseCsv(content);
    const rowErrors: Record<number, string[]> = {};
    rows.forEach((row, idx) => {
      const errors = validateRow(row);
      if (errors.length > 0) rowErrors[idx] = errors;
    });

    setPreview(rows);
    setPreviewErrors(rowErrors);
  };

  const handleBulkUpload = async () => {
    if (preview.length === 0) {
      toast.warning("Selecciona un archivo CSV antes de subir");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await bulkUploadPayrollActuals(preview);
      const rejected = result.errors?.length || 0;
      toast.success(`Carga completa: ${result.insertedCount} filas insertadas, ${rejected} con error`);
      onUploaded?.();
    } catch (err) {
      console.error(err);
      toast.error("Error al cargar nómina en bloque");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>Carga manual</CardTitle>
          <CardDescription>Agrega una línea individual de nómina real (MOD).</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleManualSubmit} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="projectId">Proyecto *</Label>
              <Select
                value={manual.projectId}
                onValueChange={(value) => setManual((prev) => ({ ...prev, projectId: value }))}
                disabled={loadingProjects}
                required
              >
                <SelectTrigger id="projectId">
                  <SelectValue placeholder={loadingProjects ? "Cargando..." : "Selecciona proyecto"} />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.projectId} value={project.projectId}>
                      {project.code} - {project.name}
                      {project.client && ` (${project.client})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="month">Mes (YYYY-MM) *</Label>
              <Input
                id="month"
                value={manual.month}
                onChange={(e) => setManual((prev) => ({ ...prev, month: e.target.value }))}
                placeholder="2025-01"
                pattern="^\d{4}-(0[1-9]|1[0-2])$"
                title="Formato: YYYY-MM (ejemplo: 2025-01)"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rubroId">Rubro *</Label>
              <Select
                value={manual.rubroId}
                onValueChange={(value) => setManual((prev) => ({ ...prev, rubroId: value }))}
                disabled={loadingRubros}
                required
              >
                <SelectTrigger id="rubroId">
                  <SelectValue placeholder={loadingRubros ? "Cargando..." : "Selecciona rubro"} />
                </SelectTrigger>
                <SelectContent>
                  {rubros.map((rubro) => (
                    <SelectItem key={rubro.rubroId} value={rubro.rubroId}>
                      {rubro.code} - {rubro.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedRubro && (
                <div className="text-sm text-muted-foreground">
                  <Badge variant="outline" className="mr-2">
                    {selectedRubro.category}
                  </Badge>
                  {selectedRubro.description}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Monto (MOD) *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={manual.amount}
                onChange={(e) => setManual((prev) => ({ ...prev, amount: Number(e.target.value) }))}
                min={0}
                required
              />
              {manual.amount > 0 && manual.currency && (
                <div className="text-sm text-muted-foreground">
                  {formatCurrency(manual.amount, manual.currency)}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <CurrencySelector
                value={manual.currency}
                onChange={(currency) => setManual((prev) => ({ ...prev, currency }))}
                required
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="notes">Notas</Label>
              <Textarea
                id="notes"
                value={manual.notes || ""}
                onChange={(e) => setManual((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Contexto o referencia"
              />
            </div>
            <div className="md:col-span-2 flex justify-end gap-3">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Guardando…" : "Agregar"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border/70">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Carga masiva</CardTitle>
              <CardDescription>Sube un CSV con varias filas. Validamos cada renglón de forma independiente.</CardDescription>
            </div>
            <Button variant="outline" onClick={handleDownloadTemplate}>
              Descargar plantilla CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input type="file" accept=".csv" onChange={handleFileChange} />

          {preview.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {`Previsualización (${preview.length} filas). Los errores se resaltan debajo.`}
              </p>
              <div className="max-h-64 overflow-auto border rounded-md">
                <table className="w-full text-xs">
                  <thead className="bg-muted">
                    <tr>
                      {TEMPLATE_HEADERS.map((header) => (
                        <th key={header} className="px-2 py-1 text-left font-medium">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, idx) => (
                      <tr key={idx} className={previewErrors[idx] ? "bg-red-50" : ""}>
                        {TEMPLATE_HEADERS.map((header) => (
                          <td key={header} className="px-2 py-1 border-t">
                            {(row as any)[header] ?? ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {Object.keys(previewErrors).length > 0 && (
                <ul className="text-xs text-destructive space-y-1">
                  {Object.entries(previewErrors).map(([index, messages]) => (
                    <li key={index}>{`Fila ${Number(index) + 2}: ${messages.join(', ')}`}</li>
                  ))}
                </ul>
              )}
              <div className="flex justify-end">
                <Button onClick={handleBulkUpload} disabled={isSubmitting}>
                  {isSubmitting ? "Cargando…" : "Subir archivo"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
