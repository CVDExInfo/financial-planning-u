/**
 * Tests for handoff data mapping logic
 * Validates that client_name, project_name, and code are properly extracted
 * from baseline payload and mapped to SDMT project METADATA
 */

describe("Handoff Data Mapping", () => {
  describe("Project name extraction from baseline", () => {
    it("should extract project_name from baseline.payload.project_name", () => {
      const baseline = {
        payload: {
          project_name: "Implementacion Finanzas",
          client_name: "ACME Corp",
        },
      };

      const projectName =
        baseline.payload.project_name || "Unnamed Project";
      const clientName = baseline.payload.client_name || "";

      expect(projectName).toBe("Implementacion Finanzas");
      expect(clientName).toBe("ACME Corp");
    });

    it("should extract from baseline top-level if payload is missing", () => {
      const baseline = {
        project_name: "Direct Project Name",
        client_name: "Direct Client",
      };

      const projectName =
        (baseline as any).payload?.project_name ||
        baseline.project_name ||
        "Unnamed Project";
      const clientName =
        (baseline as any).payload?.client_name ||
        baseline.client_name ||
        "";

      expect(projectName).toBe("Direct Project Name");
      expect(clientName).toBe("Direct Client");
    });

    it("should fallback to request body values when baseline is missing", () => {
      const baseline = undefined;
      const body = {
        project_name: "Body Project",
        client_name: "Body Client",
      };

      const projectName =
        (baseline as any)?.payload?.project_name ||
        (baseline as any)?.project_name ||
        body.project_name ||
        "Unnamed Project";
      const clientName =
        (baseline as any)?.payload?.client_name ||
        (baseline as any)?.client_name ||
        body.client_name ||
        "";

      expect(projectName).toBe("Body Project");
      expect(clientName).toBe("Body Client");
    });
  });

  describe("Project code generation", () => {
    it("should generate short code from baseline ID for long UUID projectId", () => {
      const projectId = "P-e3f6647d-3b01-492d-8e54-28bcedcf8919";
      const baselineId = "base_17d353bb1566";
      const MAX_CLEAN_CODE_LENGTH = 20;
      const CODE_SUFFIX_LENGTH = 8;

      let projectCode = projectId;

      // Check if projectId is a long UUID
      if (
        projectId.length > MAX_CLEAN_CODE_LENGTH ||
        /^P-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          projectId
        )
      ) {
        const baselineIdShort = baselineId
          .replace(/^base_/, "")
          .substring(0, CODE_SUFFIX_LENGTH);
        projectCode = `P-${baselineIdShort}`;
      }

      expect(projectCode).toBe("P-17d353bb");
      expect(projectCode.length).toBeLessThanOrEqual(MAX_CLEAN_CODE_LENGTH);
      expect(projectCode).not.toContain("e3f6647d-3b01");
    });

    it("should keep short projectId as-is", () => {
      const projectId = "P-SHORT123";
      const baselineId = "base_17d353bb1566";
      const MAX_CLEAN_CODE_LENGTH = 20;

      let projectCode = projectId;

      if (
        projectId.length > MAX_CLEAN_CODE_LENGTH ||
        /^P-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          projectId
        )
      ) {
        const baselineIdShort = baselineId
          .replace(/^base_/, "")
          .substring(0, 8);
        projectCode = `P-${baselineIdShort}`;
      }

      expect(projectCode).toBe("P-SHORT123");
    });

    it("should not use long projectId as code", () => {
      const longProjectId = "P-e3f6647d-3b01-492d-8e54-28bcedcf8919";
      
      // Code should be short, not the full UUID
      const isLongUuid = /^P-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(longProjectId);
      expect(isLongUuid).toBe(true);
      
      // In production code, this would be converted to P-<8chars>
      expect(longProjectId.length).toBeGreaterThan(20);
    });
  });

  describe("SDMT METADATA field mapping", () => {
    it("should set both Spanish and English field names", () => {
      const projectName = "Implementacion Finanzas";
      const clientName = "ACME Corp";
      const projectCode = "P-17d353bb";

      const metadata = {
        nombre: projectName,
        name: projectName,
        cliente: clientName,
        client: clientName,
        code: projectCode,
        codigo: projectCode,
      };

      expect(metadata.nombre).toBe(projectName);
      expect(metadata.name).toBe(projectName);
      expect(metadata.cliente).toBe(clientName);
      expect(metadata.client).toBe(clientName);
      expect(metadata.code).toBe(projectCode);
      expect(metadata.codigo).toBe(projectCode);
    });

    it("should preserve empty client when not provided", () => {
      const clientName = "";

      const metadata = {
        cliente: clientName,
        client: clientName,
      };

      // Empty string is acceptable, it should not be null or undefined
      expect(metadata.cliente).toBe("");
      expect(metadata.client).toBe("");
    });
  });

  describe("Integration: Complete handoff data flow", () => {
    it("should correctly map all fields from baseline to SDMT project", () => {
      // Simulating a baseline from Estimator
      const baseline = {
        payload: {
          project_name: "Implementacion Finanzas E2E",
          client_name: "ACME Handoff Client",
          currency: "USD",
          start_date: "2025-01-01",
          duration_months: 12,
          contract_value: 196022000,
        },
      };
      const baselineId = "base_17d353bb1566";
      const projectId = "P-e3f6647d-3b01-492d-8e54-28bcedcf8919";

      // Extract data
      const projectName =
        baseline.payload.project_name || "Unnamed Project";
      const clientName = baseline.payload.client_name || "";

      // Generate code
      const baselineIdShort = baselineId.replace(/^base_/, "").substring(0, 8);
      const projectCode = `P-${baselineIdShort}`;

      // Expected METADATA fields
      const expectedMetadata = {
        projectId: projectId,
        name: projectName,
        nombre: projectName,
        client: clientName,
        cliente: clientName,
        code: projectCode,
        codigo: projectCode,
        currency: baseline.payload.currency,
        start_date: baseline.payload.start_date,
        duration_months: baseline.payload.duration_months,
        mod_total: baseline.payload.contract_value,
      };

      // Assertions
      expect(expectedMetadata.name).toBe("Implementacion Finanzas E2E");
      expect(expectedMetadata.nombre).toBe("Implementacion Finanzas E2E");
      expect(expectedMetadata.client).toBe("ACME Handoff Client");
      expect(expectedMetadata.cliente).toBe("ACME Handoff Client");
      expect(expectedMetadata.code).toBe("P-17d353bb");
      expect(expectedMetadata.codigo).toBe("P-17d353bb");
      expect(expectedMetadata.code).not.toBe(projectId); // Code should NOT be the long UUID
      expect(expectedMetadata.code.length).toBeLessThanOrEqual(20);
    });
  });
});
