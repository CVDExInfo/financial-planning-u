import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeProjectItem } from "../../src/handlers/projects";

describe("Projects handler", () => {
  it("derives id from pk and preserves fields", () => {
    const item = {
      pk: "PROJECT#P-123",
      sk: "METADATA",
      nombre: "Proyecto Demo",
      cliente: "ACME",
      fecha_inicio: "2024-01-01",
      fecha_fin: "2024-12-31",
      moneda: "USD",
      presupuesto_total: 1000,
      estado: "active",
    };

    const result = normalizeProjectItem(item);

    assert.equal(result.id, "P-123");
    assert.equal(result.identifier, "P-123");
    assert.equal(result.nombre, "Proyecto Demo");
    assert.equal(result.cliente, "ACME");
    assert.equal(result.fecha_fin, "2024-12-31");
    assert.equal(result.presupuesto_total, 1000);
  });

  it("falls back to pk when no identifiers exist", () => {
    const item = { pk: "LEGACY", sk: "META" };

    const result = normalizeProjectItem(item);

    assert.equal(result.id, "LEGACY");
    assert.equal(result.identifier, "LEGACY");
  });
});
