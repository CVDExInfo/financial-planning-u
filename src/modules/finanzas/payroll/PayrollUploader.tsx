import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createPayrollActual, bulkUploadPayrollActuals, type PayrollActualInput } from "@/api/finanzas";
import finanzasClient, { type Rubro } from "@/api/finanzasClient";
import useProjects, { type ProjectForUI } from "../projects/useProjects";
import { useAuth } from "@/hooks/useAuth";
import { useRubrosTaxonomy } from "@/hooks/useRubrosTaxonomy";
import { toast } from "sonner";

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
  return `${TEMPLATE_HEADERS.join(",")}` + "\n" + "proj_xxxxxx,2025-01,MOD-ING,10000,,,excel,user@example.com,Optional note";
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

const CURRENCY_OPTIONS = ["USD", "COP", "MXN", "EUR"] as const;

export default function PayrollUploader({ onUploaded }: PayrollUploaderProps) {
  const { user } = useAuth();
  const { projects } = useProjects();
  const { categories, getRubrosByCategory } = useRubrosTaxonomy();
  const [manual, setManual] = React.useState<PayrollActualInput>({
    projectId: "",
    month: "",
    rubroId: "",
    amount: 0,
    currency: "USD",
    notes: "",
  });
  const [currency, setCurrency] = React.useState<(typeof CURRENCY_OPTIONS)[number]>("USD");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [preview, setPreview] = React.useState<PayrollActualInput[]>([]);
  const [previewErrors, setPreviewErrors] = React.useState<Record<number, string[]>>({});
  const [rubros, setRubros] = React.useState<Rubro[]>([]);

  React.useEffect(() => {
    const fetchRubros = async () => {
      try {
        const catalog = await finanzasClient.getRubros();
        setRubros(catalog);
      } catch (error) {
        console.error("No se pudieron cargar los rubros", error);
        toast.error("No pudimos cargar los rubros desde Finanzas");
      }
    };

    void fetchRubros();
  }, []);

  React.useEffect(() => {
    const selectedProject = projects.find((proj) => proj.id === manual.projectId);
    if (selectedProject?.currency && CURRENCY_OPTIONS.includes(selectedProject.currency as any)) {
      setCurrency(selectedProject.currency as (typeof CURRENCY_OPTIONS)[number]);
    }
  }, [manual.projectId, projects]);

  const selectedRubro = React.useMemo(() => {
    return (
      rubros.find(
        (rubro) => rubro.linea_codigo === manual.rubroId || rubro.rubro_id === manual.rubroId,
      ) || null
    );
  }, [manual.rubroId, rubros]);

  const selectedProject = React.useMemo<ProjectForUI | undefined>(() => {
    return projects.find((proj) => proj.id === manual.projectId);
  }, [manual.projectId, projects]);

  const handleDownloadTemplate = () => {
    const blob = new Blob([buildCsvTemplate()], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "payroll_actuals_template.csv";
    link.click();
  };

  const handleManualSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!manual.projectId || !manual.rubroId || !manual.month) {
      toast.error("Completa los campos obligatorios antes de guardar");
      return;
    }
    setIsSubmitting(true);
    try {
      await createPayrollActual({
        ...manual,
        amount: Number(manual.amount),
        currency,
        uploadedBy: user?.email || user?.login,
      });
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
              <Label htmlFor="projectId">Proyecto</Label>
              <Select
                value={manual.projectId}
                onValueChange={(value) => setManual((prev) => ({ ...prev, projectId: value }))}
                disabled={!projects.length}
                required
              >
                <SelectTrigger id="projectId">
                  <SelectValue placeholder="Selecciona un proyecto" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      <span className="font-medium">{project.code}</span>
                      {" · "}
                      {project.name}
                      {project.client && <span className="text-muted-foreground"> · {project.client}</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="month">Mes (YYYY-MM) *</Label>
              <Input
                id="month"
                type="month"
                value={manual.month}
                onChange={(e) => setManual((prev) => ({ ...prev, month: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rubroId">Rubro</Label>
              <Select
                value={manual.rubroId}
                onValueChange={(value) => setManual((prev) => ({ ...prev, rubroId: value }))}
                required
              >
                <SelectTrigger id="rubroId">
                  <SelectValue placeholder="Selecciona un rubro" />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {categories.map((category) => {
                    const items = getRubrosByCategory(category.codigo);
                    return (
                      <React.Fragment key={category.codigo}>
                        <div className="px-3 py-2 text-xs font-semibold text-muted-foreground">
                          {category.nombre}
                        </div>
                        {items.map((rubro) => (
                          <SelectItem key={rubro.linea_codigo} value={rubro.linea_codigo}>
                            <div className="flex flex-col text-left">
                              <span className="font-medium">{rubro.linea_codigo}</span>
                              <span className="text-xs text-muted-foreground">{rubro.linea_gasto}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </SelectContent>
              </Select>
              {selectedRubro ? (
                <div className="space-y-1 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                  <div className="font-medium text-foreground">{selectedRubro.linea_gasto}</div>
                  <div className="text-muted-foreground/80">{selectedRubro.descripcion}</div>
                  <div className="text-[11px] uppercase tracking-wide text-primary">
                    {selectedRubro.categoria} • {selectedRubro.linea_codigo}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Monto (MOD)</Label>
              <div className="flex gap-2">
                <Input
                  id="amount"
                  type="number"
                  value={manual.amount}
                  onChange={(e) => setManual((prev) => ({ ...prev, amount: Number(e.target.value) }))}
                  min={0}
                  step="0.01"
                  required
                />
                <Select value={currency} onValueChange={(value) => setCurrency(value as (typeof CURRENCY_OPTIONS)[number])}>
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCY_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                {new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(Number(manual.amount) || 0)}
              </p>
              {selectedProject?.currency && selectedProject.currency !== currency ? (
                <p className="text-[11px] text-amber-600">
                  Moneda del proyecto: {selectedProject.currency}. Ajusta si tu carga debe usar otra divisa.
                </p>
              ) : null}
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
                    <li key={index}>{`Fila ${Number(index) + 2}: ${(messages as string[]).join(', ')}`}</li>
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
