import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getProjectDisplay } from "@/lib/projects/display";
import { type ProjectForUI } from "./useProjects";

interface ProjectDetailsPanelProps {
  project: ProjectForUI;
  formatCurrency: (value: number, currencyCode?: string) => string;
  calculateDurationInMonths: (start?: string, end?: string) => number | null;
  formatDate: (value?: string | null) => string;
}

export default function ProjectDetailsPanel({
  project,
  formatCurrency,
  calculateDurationInMonths,
  formatDate,
}: ProjectDetailsPanelProps) {
  const display = getProjectDisplay(project);
  const durationMonths = calculateDurationInMonths(
    project.start_date,
    project.end_date,
  );
  const modMensual =
    durationMonths && durationMonths > 0
      ? project.mod_total / durationMonths
      : null;

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base font-semibold">
          Detalles del proyecto seleccionado
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Código – Nombre</p>
          <p className="font-semibold">
            {display.code || "—"} {display.name ? `· ${display.name}` : ""}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Cliente</p>
          <p className="font-medium">{display.client || "—"}</p>
        </div>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Periodo</p>
          <p className="font-medium">
            {formatDate(project.start_date)} → {formatDate(project.end_date)}
            {durationMonths != null ? ` · ${durationMonths} meses` : ""}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">MOD total</p>
          <p className="font-medium">
            {formatCurrency(project.mod_total, project.currency)}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">MOD mensual</p>
          <p className="font-medium">
            {modMensual != null
              ? formatCurrency(modMensual, project.currency)
              : "—"}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Estado</p>
          <p className="font-medium">{project.status || "Desconocido"}</p>
        </div>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Baseline ID</p>
          <p className="font-medium font-mono">
            {project.baseline_id || "—"}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Estatus de baseline</p>
          <p className="font-medium capitalize">
            {project.baseline_status || "—"}
          </p>
        </div>
        {project.accepted_by && (
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Aceptado por</p>
            <p className="font-medium">{project.accepted_by}</p>
          </div>
        )}
        {project.baseline_accepted_at && (
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Aceptado el</p>
            <p className="font-medium">
              {formatDate(project.baseline_accepted_at)}
            </p>
          </div>
        )}
        {project.rejected_by && (
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Rechazado por</p>
            <p className="font-medium">{project.rejected_by}</p>
          </div>
        )}
        {project.baseline_rejected_at && (
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Rechazado el</p>
            <p className="font-medium">
              {formatDate(project.baseline_rejected_at)}
            </p>
          </div>
        )}
        {project.rejection_comment && (
          <div className="space-y-1 md:col-span-2">
            <p className="text-sm text-muted-foreground">Motivo de rechazo</p>
            <p className="font-medium text-sm">{project.rejection_comment}</p>
          </div>
        )}
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Última actualización</p>
          <p className="font-medium">
            {formatDate(
              project.updated_at ||
                (project as any)?.updatedAt ||
                project.created_at ||
                (project as any)?.createdAt ||
                null,
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
