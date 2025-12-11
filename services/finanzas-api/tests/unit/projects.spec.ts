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
    expect(result.name).toBe("Proyecto Demo");
    expect(result.cliente).toBe("ACME");
    expect(result.client).toBe("ACME");
    expect(result.fecha_fin).toBe("2024-12-31");
    expect(result.end_date).toBe("2024-12-31");
    expect(result.presupuesto_total).toBe(1000);
    expect(result.mod_total).toBe(1000);
  });

  it("falls back to pk when no identifiers exist", () => {
    // Note: Using "META" (legacy) to test backward compatibility with old data
    const item = { pk: "LEGACY", sk: "META" };

    const result = normalizeProjectItem(item);

    expect(result.id).toBe("LEGACY");
    expect(result.identifier).toBe("LEGACY");
  });

  describe("Short code generation", () => {
    it("should generate short code from long UUID projectId using baselineId", () => {
      const item = {
        pk: "PROJECT#P-e3f6647d-3b01-492d-8e54-28bcedcf8919",
        sk: "META",
        baseline_id: "base_17d353bb1566",
        nombre: "Test Project",
      };

      const result = normalizeProjectItem(item);

      expect(result.id).toBe("P-e3f6647d-3b01-492d-8e54-28bcedcf8919");
      expect(result.code).toBe("P-17d353bb");
      expect(result.codigo).toBe("P-17d353bb");
      expect(result.code?.length).toBeLessThanOrEqual(20);
    });

    it("should generate short code from long UUID projectId without baselineId", () => {
      const item = {
        pk: "PROJECT#P-e3f6647d-3b01-492d-8e54-28bcedcf8919",
        sk: "META",
        nombre: "Test Project",
      };

      const result = normalizeProjectItem(item);

      expect(result.id).toBe("P-e3f6647d-3b01-492d-8e54-28bcedcf8919");
      expect(result.code).toBe("P-e3f6647d");
      expect(result.codigo).toBe("P-e3f6647d");
      expect(result.code?.length).toBeLessThanOrEqual(20);
    });

    it("should keep short projectId as-is", () => {
      const item = {
        pk: "PROJECT#P-SHORT123",
        sk: "META",
        nombre: "Short Project",
      };

      const result = normalizeProjectItem(item);

      expect(result.id).toBe("P-SHORT123");
      expect(result.code).toBe("P-SHORT123");
      expect(result.codigo).toBe("P-SHORT123");
    });

    it("should preserve existing code field", () => {
      const item = {
        pk: "PROJECT#P-e3f6647d-3b01-492d-8e54-28bcedcf8919",
        sk: "META",
        code: "PROJ-2025-001",
        nombre: "Custom Code Project",
      };

      const result = normalizeProjectItem(item);

      expect(result.id).toBe("P-e3f6647d-3b01-492d-8e54-28bcedcf8919");
      expect(result.code).toBe("PROJ-2025-001");
      expect(result.codigo).toBe("PROJ-2025-001");
    });

    it("should handle PROJ-YYYY-NNN format codes", () => {
      const item = {
        pk: "PROJECT#P-12345",
        sk: "META",
        code: "PROJ-2025-653",
        nombre: "Standard Format Project",
      };

      const result = normalizeProjectItem(item);

      expect(result.id).toBe("P-12345");
      expect(result.code).toBe("PROJ-2025-653");
      expect(result.codigo).toBe("PROJ-2025-653");
    });
  });
});
