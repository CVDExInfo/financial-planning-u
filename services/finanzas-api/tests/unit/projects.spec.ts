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

    expect(result.id).toBe("P-123");
    expect(result.identifier).toBe("P-123");
    expect(result.nombre).toBe("Proyecto Demo");
    expect(result.cliente).toBe("ACME");
    expect(result.fecha_fin).toBe("2024-12-31");
    expect(result.presupuesto_total).toBe(1000);
  });

  it("falls back to pk when no identifiers exist", () => {
    const item = { pk: "LEGACY", sk: "META" };

    const result = normalizeProjectItem(item);

    expect(result.id).toBe("LEGACY");
    expect(result.identifier).toBe("LEGACY");
  });
});
