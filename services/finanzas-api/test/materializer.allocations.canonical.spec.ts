import { jest } from "@jest/globals";
import { materializeAllocationsForBaseline } from "../src/lib/materializers";
import { ddb } from "../src/lib/dynamo";
import { batchGetExistingItems } from "../src/lib/dynamodbHelpers";

jest.mock("../src/lib/dynamo", () => {
  return {
    ddb: { send: jest.fn() },
    tableName: (key: string) => `mock_${key}`,
    QueryCommand: class QueryCommand {
      input: any;
      constructor(input: any) {
        this.input = input;
      }
    },
  };
});

jest.mock("../src/lib/dynamodbHelpers", () => {
  return {
    batchGetExistingItems: jest.fn().mockResolvedValue([]),
  };
});

jest.mock("../src/utils/logging", () => ({
  logError: jest.fn(),
}));

// Mock the canonical taxonomy functions to return known mappings
jest.mock("../src/lib/rubros-taxonomy", () => ({
  getCanonicalRubroId: jest.fn((id) => {
    // Simulate canonical mappings
    const canonicalMap: Record<string, string> = {
      'MOD-LEAD': 'MOD-LEAD',
      'MOD-ING': 'MOD-ING',
      'MOD-SDM': 'MOD-SDM',
      'LINEA#MOD-LEAD': 'MOD-LEAD',
      'LINEA#MOD-ING': 'MOD-ING',
      'GSV-REU': 'GSV-REU',
      'GSV-CLOUD': 'GSV-CLOUD',
      // Variant that should be normalized to canonical
      'MOD-ENGINEER': 'MOD-ING',
      'SERVICE-DEL-MGR': 'MOD-SDM',
    };
    return canonicalMap[id] || id;
  }),
  mapModRoleToRubroId: jest.fn(() => undefined),
  mapNonLaborCategoryToRubroId: jest.fn(() => undefined),
}));

type BaselineStub = {
  baseline_id: string;
  project_id: string;
  start_date?: string;
  duration_months?: number;
  currency?: string;
  labor_estimates?: any[];
  non_labor_estimates?: any[];
  payload?: any;
};

/**
 * Helper to extract allocations from DynamoDB mock batch write calls
 */
const extractAllocationsFromBatchCalls = (ddbSendMock: jest.Mock): any[] => {
  const batchCalls = ddbSendMock.mock.calls.filter((call) => {
    const command = call[0];
    return command?.input?.RequestItems?.mock_allocations;
  });

  return batchCalls.flatMap((call) => {
    const command = call[0] as { input?: any };
    const requests = command?.input?.RequestItems?.mock_allocations || [];
    // Items are wrapped in PutRequest.Item
    return requests.map((req: any) => req?.PutRequest?.Item).filter(Boolean);
  });
};

describe("Materializer - Canonical Rubro ID", () => {
  beforeEach(() => {
    (ddb.send as jest.Mock).mockReset();
    (batchGetExistingItems as jest.Mock).mockReset();

    // Default: no existing items
    (batchGetExistingItems as jest.Mock).mockResolvedValue([]);

    // Mock DynamoDB send
    (ddb.send as jest.Mock).mockImplementation((command: any) => {
      // Mock QueryCommand for rubros
      if (command.constructor.name === "QueryCommand") {
        // Return empty rubros by default (tests will override this)
        return Promise.resolve({ Items: [] });
      }
      // Mock BatchWriteCommand
      return Promise.resolve({});
    });
  });

  describe("Primary path (seeded rubros)", () => {
    it("should write canonical_rubro_id for labor rubros", async () => {
      const baseline: BaselineStub = {
        baseline_id: "base_canonical_test",
        project_id: "P-CANONICAL-001",
        start_date: "2025-01-01",
        duration_months: 3,
      };

      // Mock rubros query to return labor rubros
      (ddb.send as jest.Mock).mockImplementation((command: any) => {
        if (command.constructor.name === "QueryCommand") {
          return Promise.resolve({
            Items: [
              {
                pk: "PROJECT#P-CANONICAL-001",
                sk: "RUBRO#MOD-LEAD#base_canonical_test#1",
                rubroId: "MOD-LEAD#base_canonical_test#1",
                linea_codigo: "MOD-LEAD",
                nombre: "Tech Lead",
                unit_cost: 5000,
                start_month: 1,
                end_month: 3,
              },
              {
                pk: "PROJECT#P-CANONICAL-001",
                sk: "RUBRO#MOD-ING#base_canonical_test#1",
                rubroId: "MOD-ING#base_canonical_test#1",
                linea_codigo: "MOD-ING",
                nombre: "Engineer",
                unit_cost: 4000,
                start_month: 1,
                end_month: 3,
              },
            ],
          });
        }
        return Promise.resolve({});
      });

      await materializeAllocationsForBaseline(baseline, { dryRun: false });

      const allocations = extractAllocationsFromBatchCalls(ddb.send as jest.Mock);

      // Should have 6 allocations (2 rubros × 3 months)
      expect(allocations.length).toBe(6);

      // All allocations should have canonical_rubro_id
      allocations.forEach((alloc) => {
        expect(alloc.canonical_rubro_id).toBeDefined();
        expect(alloc.canonical_rubro_id).toBeTruthy();
      });

      // Check MOD-LEAD allocations
      const modLeadAllocs = allocations.filter((a) => a.rubroId === "MOD-LEAD");
      expect(modLeadAllocs.length).toBe(3);
      modLeadAllocs.forEach((alloc) => {
        expect(alloc.canonical_rubro_id).toBe("MOD-LEAD");
        expect(alloc.sk).toMatch(/^ALLOCATION#base_canonical_test#\d{4}-\d{2}#MOD-LEAD$/);
      });

      // Check MOD-ING allocations
      const modIngAllocs = allocations.filter((a) => a.rubroId === "MOD-ING");
      expect(modIngAllocs.length).toBe(3);
      modIngAllocs.forEach((alloc) => {
        expect(alloc.canonical_rubro_id).toBe("MOD-ING");
        expect(alloc.sk).toMatch(/^ALLOCATION#base_canonical_test#\d{4}-\d{2}#MOD-ING$/);
      });
    });

    it("should write canonical_rubro_id for non-labor rubros", async () => {
      const baseline: BaselineStub = {
        baseline_id: "base_nonlabor_test",
        project_id: "P-NONLABOR-001",
        start_date: "2025-01-01",
        duration_months: 2,
      };

      // Mock rubros query to return non-labor rubros
      (ddb.send as jest.Mock).mockImplementation((command: any) => {
        if (command.constructor.name === "QueryCommand") {
          return Promise.resolve({
            Items: [
              {
                pk: "PROJECT#P-NONLABOR-001",
                sk: "RUBRO#GSV-CLOUD#base_nonlabor_test#1",
                rubroId: "GSV-CLOUD#base_nonlabor_test#1",
                linea_codigo: "GSV-CLOUD",
                nombre: "Cloud Services",
                unit_cost: 1500,
                start_month: 1,
                end_month: 2,
              },
            ],
          });
        }
        return Promise.resolve({});
      });

      await materializeAllocationsForBaseline(baseline, { dryRun: false });

      const allocations = extractAllocationsFromBatchCalls(ddb.send as jest.Mock);

      // Should have 2 allocations (1 rubro × 2 months)
      expect(allocations.length).toBe(2);

      // All allocations should have canonical_rubro_id
      allocations.forEach((alloc) => {
        expect(alloc.canonical_rubro_id).toBeDefined();
        expect(alloc.canonical_rubro_id).toBe("GSV-CLOUD");
        expect(alloc.sk).toMatch(/^ALLOCATION#base_nonlabor_test#\d{4}-\d{2}#GSV-CLOUD$/);
      });
    });
  });

  describe("Fallback path (estimates)", () => {
    it("should write canonical_rubro_id for labor estimates", async () => {
      const baseline: BaselineStub = {
        baseline_id: "base_estimates_test",
        project_id: "P-ESTIMATES-001",
        start_date: "2025-01-01",
        duration_months: 2,
        labor_estimates: [
          {
            rubroId: "MOD-LEAD",
            role: "Tech Lead",
            monthly_cost: 5000,
            total_cost: 10000,
          },
          {
            rubroId: "MOD-ING",
            role: "Engineer",
            monthly_cost: 4000,
            total_cost: 8000,
          },
        ],
      };

      // Mock rubros query to return empty (force fallback path)
      (ddb.send as jest.Mock).mockImplementation((command: any) => {
        if (command.constructor.name === "QueryCommand") {
          return Promise.resolve({ Items: [] });
        }
        return Promise.resolve({});
      });

      await materializeAllocationsForBaseline(baseline, { dryRun: false });

      const allocations = extractAllocationsFromBatchCalls(ddb.send as jest.Mock);

      // Should have 4 allocations (2 estimates × 2 months)
      expect(allocations.length).toBe(4);

      // All allocations should have canonical_rubro_id
      allocations.forEach((alloc) => {
        expect(alloc.canonical_rubro_id).toBeDefined();
        expect(alloc.canonical_rubro_id).toBeTruthy();
      });

      // Check MOD-LEAD allocations
      const modLeadAllocs = allocations.filter((a) => a.rubro_id === "MOD-LEAD");
      expect(modLeadAllocs.length).toBe(2);
      modLeadAllocs.forEach((alloc) => {
        expect(alloc.canonical_rubro_id).toBe("MOD-LEAD");
        expect(alloc.sk).toMatch(/^ALLOCATION#base_estimates_test#\d{4}-\d{2}#MOD-LEAD$/);
      });

      // Check MOD-ING allocations
      const modIngAllocs = allocations.filter((a) => a.rubro_id === "MOD-ING");
      expect(modIngAllocs.length).toBe(2);
      modIngAllocs.forEach((alloc) => {
        expect(alloc.canonical_rubro_id).toBe("MOD-ING");
        expect(alloc.sk).toMatch(/^ALLOCATION#base_estimates_test#\d{4}-\d{2}#MOD-ING$/);
      });
    });

    it("should write canonical_rubro_id for non-labor estimates", async () => {
      const baseline: BaselineStub = {
        baseline_id: "base_nonlabor_estimates_test",
        project_id: "P-NONLABOR-ESTIMATES-001",
        start_date: "2025-01-01",
        duration_months: 2,
        non_labor_estimates: [
          {
            rubroId: "GSV-CLOUD",
            category: "Cloud Services",
            monthly_cost: 1500,
            total_cost: 3000,
          },
        ],
      };

      // Mock rubros query to return empty (force fallback path)
      (ddb.send as jest.Mock).mockImplementation((command: any) => {
        if (command.constructor.name === "QueryCommand") {
          return Promise.resolve({ Items: [] });
        }
        return Promise.resolve({});
      });

      await materializeAllocationsForBaseline(baseline, { dryRun: false });

      const allocations = extractAllocationsFromBatchCalls(ddb.send as jest.Mock);

      // Should have 2 allocations (1 estimate × 2 months)
      expect(allocations.length).toBe(2);

      // All allocations should have canonical_rubro_id
      allocations.forEach((alloc) => {
        expect(alloc.canonical_rubro_id).toBeDefined();
        expect(alloc.canonical_rubro_id).toBe("GSV-CLOUD");
        expect(alloc.sk).toMatch(/^ALLOCATION#base_nonlabor_estimates_test#\d{4}-\d{2}#GSV-CLOUD$/);
      });
    });
  });

  describe("Canonical token in SK", () => {
    it("should use canonical token in allocation SK construction", async () => {
      const baseline: BaselineStub = {
        baseline_id: "base_sk_test",
        project_id: "P-SK-001",
        start_date: "2025-01-01",
        duration_months: 1,
      };

      // Mock rubros query to return rubros with variant IDs
      (ddb.send as jest.Mock).mockImplementation((command: any) => {
        if (command.constructor.name === "QueryCommand") {
          return Promise.resolve({
            Items: [
              {
                pk: "PROJECT#P-SK-001",
                sk: "RUBRO#MOD-ENGINEER#base_sk_test#1",
                rubroId: "MOD-ENGINEER#base_sk_test#1",
                linea_codigo: "MOD-ENGINEER", // Variant that should map to MOD-ING
                nombre: "Engineer",
                unit_cost: 4000,
                start_month: 1,
                end_month: 1,
              },
            ],
          });
        }
        return Promise.resolve({});
      });

      await materializeAllocationsForBaseline(baseline, { dryRun: false });

      const allocations = extractAllocationsFromBatchCalls(ddb.send as jest.Mock);

      expect(allocations.length).toBe(1);
      const alloc = allocations[0];

      // Should use canonical token MOD-ING in SK (not MOD-ENGINEER)
      expect(alloc.canonical_rubro_id).toBe("MOD-ING");
      expect(alloc.rubroId).toBe("MOD-ING");
      expect(alloc.sk).toMatch(/^ALLOCATION#base_sk_test#2025-01#MOD-ING$/);
    });

    it("should handle allocations with no canonical mapping gracefully", async () => {
      const baseline: BaselineStub = {
        baseline_id: "base_unmapped_test",
        project_id: "P-UNMAPPED-001",
        start_date: "2025-01-01",
        duration_months: 1,
        labor_estimates: [
          {
            rubroId: "UNKNOWN-RUBRO",
            role: "Unknown Role",
            monthly_cost: 1000,
            total_cost: 1000,
          },
        ],
      };

      // Mock rubros query to return empty (force fallback path)
      (ddb.send as jest.Mock).mockImplementation((command: any) => {
        if (command.constructor.name === "QueryCommand") {
          return Promise.resolve({ Items: [] });
        }
        return Promise.resolve({});
      });

      await materializeAllocationsForBaseline(baseline, { dryRun: false });

      const allocations = extractAllocationsFromBatchCalls(ddb.send as jest.Mock);

      expect(allocations.length).toBe(1);
      const alloc = allocations[0];

      // Should still have canonical_rubro_id (falls back to original)
      expect(alloc.canonical_rubro_id).toBeDefined();
      expect(alloc.canonical_rubro_id).toBe("UNKNOWN-RUBRO");
      expect(alloc.sk).toMatch(/^ALLOCATION#base_unmapped_test#2025-01#UNKNOWN-RUBRO$/);
    });
  });
});
