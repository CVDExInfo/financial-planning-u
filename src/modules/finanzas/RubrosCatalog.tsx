import React from "react";
import { RUBROS_ENRICHED } from "@/modules/finanzas/data/rubros.catalog.enriched";

function Cell({ children }: { children: React.ReactNode }) {
  return (
    <td className="px-3 py-2 border-b border-border text-sm text-foreground">
      {children}
    </td>
  );
}

export default function RubrosCatalog() {
  const rows = RUBROS_ENRICHED;
  return (
    <div className="max-w-6xl mx-auto p-6">
      <h2 className="text-xl font-semibold mb-4">
        Gestión presupuesto — Catálogo de Rubros
      </h2>
      <div className="rounded-lg border border-border overflow-hidden bg-card">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-muted text-muted-foreground text-xs uppercase tracking-wide">
              <th className="text-left px-3 py-2">rubro_id</th>
              <th className="text-left px-3 py-2">nombre</th>
              <th className="text-left px-3 py-2">categoria</th>
              <th className="text-left px-3 py-2">linea_codigo</th>
              <th className="text-left px-3 py-2">tipo_costo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.rubro_id} className="hover:bg-muted/50">
                <Cell>{r.rubro_id}</Cell>
                <Cell>{r.nombre}</Cell>
                <Cell>{r.categoria}</Cell>
                <Cell>{r.linea_codigo}</Cell>
                <Cell>{r.tipo_costo}</Cell>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-6 text-center text-muted-foreground"
                >
                  No hay rubros disponibles.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground mt-3">
        Mostrando {rows.length} rubros.
      </p>
    </div>
  );
}
