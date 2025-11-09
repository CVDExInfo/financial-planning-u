import React from "react";
import { Link } from "react-router-dom";

export default function FinanzasHome() {
  return (
    <div className="max-w-5xl mx-auto p-8 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">
          Finanzas · Gestión Presupuesto (R1)
        </h1>
        <p className="text-sm text-muted-foreground">
          Módulo inicial para catálogo de rubros y reglas de asignación (MVP).
          Esta sección evolucionará para incluir presupuesto, asignaciones
          mensuales y reconciliaciones de costos.
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        <Link
          to="/catalog/rubros"
          className="rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors block"
        >
          <h2 className="font-medium mb-1">Catálogo de Rubros</h2>
          <p className="text-xs text-muted-foreground">
            Lista enriquecida de rubros con taxonomía, línea contable y tipo de
            costo.
          </p>
        </Link>
        <Link
          to="/rules"
          className="rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors block"
        >
          <h2 className="font-medium mb-1">Reglas de Asignación</h2>
          <p className="text-xs text-muted-foreground">
            Vista previa de reglas MVP (driver percent, fixed, tickets, hours).
          </p>
        </Link>
      </div>
      <section className="text-xs text-muted-foreground">
        <p>
          Próximos incrementos: persistencia en DynamoDB, edición de reglas,
          asignaciones automáticas y panel de costos consolidado.
        </p>
      </section>
    </div>
  );
}
