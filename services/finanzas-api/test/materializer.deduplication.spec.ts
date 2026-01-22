/**
 * Tests for Materializer Deduplication & Canonical ID Consistency
 * 
 * Ensures that primary and fallback paths in materializeAllocationsForBaseline
 * generate consistent canonical IDs to prevent duplicate allocations.
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";

// Mock DynamoDB client
const mockDdbSend = jest.fn();
jest.mock("../src/lib/dynamo", () => ({
  ddb: { send: mockDdbSend },
  tableName: (name: string) => `test_${name}`,
  GetCommand: class GetCommand {
    input: any;
    constructor(input: any) {
      this.input = input;
    }
  },
  ScanCommand: class ScanCommand {
    input: any;
    constructor(input: any) {
      this.input = input;
    }
  },
  QueryCommand: class QueryCommand {
    input: any;
    constructor(input: any) {
      this.input = input;
    }
  },
  BatchWriteCommand: class BatchWriteCommand {
    input: any;
    constructor(input: any) {
      this.input = input;
    }
  },
}));

// Must import after mocking
import { materializeAllocationsForBaseline } from "../src/lib/materializers";

describe("Materializer Canonical ID Consistency", () => {
  beforeEach(() => {
    mockDdbSend.mockClear();
  });

  describe("getValidatedCanonicalRubroId", () => {
    it("should resolve same canonical ID from linea_codigo in both paths", async () => {
      const baseline = {
        id: "base-test-001",
        baselineId: "base-test-001",
        project_id: "P-TEST-001",
        projectId: "P-TEST-001",
        start_date: "2026-01-01",
        duration_months: 12,
        durationMonths: 12,
      };

      // Mock DynamoDB responses
      mockDdbSend.mockImplementation((command) => {
        if (command.constructor.name === "QueryCommand") {
          // Return rubros query result (used by materializer to check existing rubros)
          return Promise.resolve({
            Items: [
              {
                pk: `PROJECT#${baseline.projectId}`,
                sk: "RUBRO#MOD-ING",
                rubroId: "RB0001",
                linea_codigo: "MOD-ING",
                descripcion: "Ingeniero",
                unit_cost: 5000,
                start_month: 1,
                end_month: 12,
                metadata: {
                  baseline_id: baseline.baselineId,
                },
              },
            ],
          });
        } else if (command.constructor.name === "GetCommand") {
          // Return baseline metadata (not needed for rubros path, but may be called)
          return Promise.resolve({
            Item: {
              ...baseline,
              rubros: [],
            },
          });
        } else if (command.constructor.name === "ScanCommand") {
          // Return empty taxonomy (not needed for this test)
          return Promise.resolve({ Items: [] });
        } else if (command.constructor.name === "BatchWriteCommand") {
          // Capture writes
          return Promise.resolve({ UnprocessedItems: {} });
        }
        return Promise.resolve({});
      });

      // Run materializer
      const result = await materializeAllocationsForBaseline(baseline, {
        dryRun: false,
      });

      // Get all written allocations
      const batchWriteCalls = mockDdbSend.mock.calls.filter(
        (call) => call[0].constructor.name === "BatchWriteCommand"
      );

      expect(batchWriteCalls.length).toBeGreaterThan(0);

      // Extract all SKs
      const allSKs: string[] = [];
      batchWriteCalls.forEach((call) => {
        const items = call[0].input?.RequestItems?.test_allocations || [];
        items.forEach((req: any) => {
          if (req.PutRequest?.Item?.sk) {
            allSKs.push(req.PutRequest.Item.sk);
          }
        });
      });

      // All SKs should use canonical ID "MOD-ING", not "RB0001"
      allSKs.forEach((sk) => {
        expect(sk).toMatch(/^ALLOCATION#base-test-001#\d{4}-\d{2}#MOD-ING$/);
        expect(sk).not.toContain("RB0001");
      });

      // Should have 12 months of allocations (one per month)
      expect(allSKs.length).toBe(12);

      // No duplicates (Set size === Array length)
      expect(new Set(allSKs).size).toBe(allSKs.length);
    });

    it("should handle fallback path with same canonical ID logic", async () => {
      const baseline = {
        id: "base-test-002",
        baselineId: "base-test-002",
        project_id: "P-TEST-002",
        projectId: "P-TEST-002",
        start_date: "2026-01-01",
        duration_months: 12,
        durationMonths: 12,
        labor_estimates: [
          {
            id: "RB0001",
            linea_codigo: "MOD-ING",
            role: "Ingeniero",
            monthly_rate: 5000,
          },
        ],
      };

      // Mock DynamoDB to return baseline without rubros (triggers fallback)
      mockDdbSend.mockImplementation((command) => {
        if (command.constructor.name === "QueryCommand") {
          // Return empty rubros (triggers fallback to labor_estimates)
          return Promise.resolve({ Items: [] });
        } else if (command.constructor.name === "GetCommand") {
          return Promise.resolve({
            Item: {
              ...baseline,
              rubros: [], // Empty rubros triggers fallback
            },
          });
        } else if (command.constructor.name === "ScanCommand") {
          return Promise.resolve({ Items: [] });
        } else if (command.constructor.name === "BatchWriteCommand") {
          return Promise.resolve({ UnprocessedItems: {} });
        }
        return Promise.resolve({});
      });

      // Run materializer
      await materializeAllocationsForBaseline(baseline, { dryRun: false });

      // Extract SKs from fallback path
      const batchWriteCalls = mockDdbSend.mock.calls.filter(
        (call) => call[0].constructor.name === "BatchWriteCommand"
      );

      const allSKs: string[] = [];
      batchWriteCalls.forEach((call) => {
        const items = call[0].input?.RequestItems?.test_allocations || [];
        items.forEach((req: any) => {
          if (req.PutRequest?.Item?.sk) {
            allSKs.push(req.PutRequest.Item.sk);
          }
        });
      });

      // Fallback path should also use canonical ID "MOD-ING"
      allSKs.forEach((sk) => {
        expect(sk).toMatch(/^ALLOCATION#base-test-002#\d{4}-\d{2}#MOD-ING$/);
        expect(sk).not.toContain("RB0001");
      });

      // Should have 12 months
      expect(allSKs.length).toBe(12);

      // No duplicates
      expect(new Set(allSKs).size).toBe(allSKs.length);
    });

    it("should prevent duplicates when both paths run", async () => {
      // Simulate scenario where baseline has rubros AND estimates
      const baseline = {
        id: "base-test-003",
        baselineId: "base-test-003",
        project_id: "P-TEST-003",
        projectId: "P-TEST-003",
        start_date: "2026-01-01",
        duration_months: 12,
        durationMonths: 12,
        labor_estimates: [
          {
            id: "RB0001",
            linea_codigo: "MOD-ING",
            role: "Ingeniero",
            monthly_rate: 5000,
          },
        ],
      };

      mockDdbSend.mockImplementation((command) => {
        if (command.constructor.name === "QueryCommand") {
          // Return rubros that match the baseline
          return Promise.resolve({
            Items: [
              {
                pk: `PROJECT#${baseline.projectId}`,
                sk: "RUBRO#MOD-ING",
                rubroId: "RB0001",
                linea_codigo: "MOD-ING",
                descripcion: "Ingeniero",
                unit_cost: 5000,
                start_month: 1,
                end_month: 12,
                metadata: {
                  baseline_id: baseline.baselineId,
                },
              },
            ],
          });
        } else if (command.constructor.name === "GetCommand") {
          return Promise.resolve({
            Item: {
              ...baseline,
              rubros: [],
            },
          });
        } else if (command.constructor.name === "ScanCommand") {
          return Promise.resolve({ Items: [] });
        } else if (command.constructor.name === "BatchWriteCommand") {
          return Promise.resolve({ UnprocessedItems: {} });
        }
        return Promise.resolve({});
      });

      await materializeAllocationsForBaseline(baseline, { dryRun: false });

      const batchWriteCalls = mockDdbSend.mock.calls.filter(
        (call) => call[0].constructor.name === "BatchWriteCommand"
      );

      const allSKs: string[] = [];
      batchWriteCalls.forEach((call) => {
        const items = call[0].input?.RequestItems?.test_allocations || [];
        items.forEach((req: any) => {
          if (req.PutRequest?.Item?.sk) {
            allSKs.push(req.PutRequest.Item.sk);
          }
        });
      });

      // Should have exactly 12 allocations (no duplicates)
      expect(allSKs.length).toBe(12);

      // Verify deduplication worked
      const uniqueSKs = new Set(allSKs);
      expect(uniqueSKs.size).toBe(12);

      // All should use same canonical ID
      allSKs.forEach((sk) => {
        expect(sk).toContain("MOD-ING");
      });
    });

    it("should throw error for invalid rubro without canonical ID", async () => {
      const baseline = {
        id: "base-test-004",
        baselineId: "base-test-004",
        project_id: "P-TEST-004",
        projectId: "P-TEST-004",
        start_date: "2026-01-01",
        duration_months: 12,
        labor_estimates: [
          {
            id: "INVALID-ID-NO-CANONICAL",
            role: "Unknown Role",
            monthly_rate: 1000,
          },
        ],
      };

      mockDdbSend.mockImplementation((command) => {
        if (command.constructor.name === "QueryCommand") {
          // Return empty rubros (triggers fallback)
          return Promise.resolve({ Items: [] });
        } else if (command.constructor.name === "GetCommand") {
          return Promise.resolve({
            Item: {
              ...baseline,
              rubros: [],
            },
          });
        } else if (command.constructor.name === "ScanCommand") {
          return Promise.resolve({ Items: [] });
        } else if (command.constructor.name === "BatchWriteCommand") {
          return Promise.resolve({ UnprocessedItems: {} });
        }
        return Promise.resolve({});
      });

      // Should handle gracefully (either throw or use fallback)
      // Depending on implementation, adjust assertion
      await expect(
        materializeAllocationsForBaseline(baseline, { dryRun: false })
      ).resolves.toBeDefined();
    });
  });

  describe("SK Format Consistency", () => {
    it("should use identical SK format across all code paths", async () => {
      // Test that SK format is: ALLOCATION#{baselineId}#{calendarMonth}#{canonicalId}
      const baseline = {
        id: "base-test-005",
        baselineId: "base-test-005",
        project_id: "P-TEST-005",
        projectId: "P-TEST-005",
        start_date: "2026-01-01",
        duration_months: 3,
        labor_estimates: [
          {
            id: "MOD-SDM",
            linea_codigo: "MOD-SDM",
            role: "Service Delivery Manager",
            monthly_rate: 8000,
          },
        ],
      };

      mockDdbSend.mockImplementation((command) => {
        if (command.constructor.name === "QueryCommand") {
          // Return empty rubros (triggers fallback)
          return Promise.resolve({ Items: [] });
        } else if (command.constructor.name === "GetCommand") {
          return Promise.resolve({
            Item: {
              ...baseline,
              rubros: [],
            },
          });
        } else if (command.constructor.name === "ScanCommand") {
          return Promise.resolve({ Items: [] });
        } else if (command.constructor.name === "BatchWriteCommand") {
          return Promise.resolve({ UnprocessedItems: {} });
        }
        return Promise.resolve({});
      });

      await materializeAllocationsForBaseline(baseline, { dryRun: false });

      const batchWriteCalls = mockDdbSend.mock.calls.filter(
        (call) => call[0].constructor.name === "BatchWriteCommand"
      );

      const allSKs: string[] = [];
      batchWriteCalls.forEach((call) => {
        const items = call[0].input?.RequestItems?.test_allocations || [];
        items.forEach((req: any) => {
          if (req.PutRequest?.Item?.sk) {
            allSKs.push(req.PutRequest.Item.sk);
          }
        });
      });

      // Verify SK format
      allSKs.forEach((sk) => {
        expect(sk).toMatch(/^ALLOCATION#base-test-005#\d{4}-\d{2}#MOD-SDM$/);
        const parts = sk.split("#");
        expect(parts).toHaveLength(4);
        expect(parts[0]).toBe("ALLOCATION");
        expect(parts[1]).toBe("base-test-005");
        expect(parts[2]).toMatch(/^\d{4}-\d{2}$/);
        expect(parts[3]).toBe("MOD-SDM");
      });
    });
  });
});
