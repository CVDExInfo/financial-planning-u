/**
 * Unit tests for baseline-aware project resolution helper
 */

jest.mock("node:crypto", () => ({
  __esModule: true,
  default: { randomUUID: jest.fn(() => "generated-uuid") },
  randomUUID: jest.fn(() => "generated-uuid"),
}));

import { GetCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { resolveProjectForHandoff } from "../../src/lib/projects-handoff";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

// Mock DynamoDB client
const mockSend = jest.fn();
const mockDdb = {
  send: mockSend,
} as unknown as DynamoDBDocumentClient;

const cryptoMock = jest.requireMock("node:crypto") as { randomUUID: jest.Mock; default: { randomUUID: jest.Mock } };

const mockTableName = jest.fn((name: string) => `test-${name}`);

describe("resolveProjectForHandoff", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSend.mockReset();
    cryptoMock.randomUUID.mockReturnValue("generated-uuid");
    cryptoMock.default.randomUUID.mockReturnValue("generated-uuid");
  });

  describe("First handoff for a baseline", () => {
    it("should return new projectId when baseline has no existing project", async () => {
      const getKeys: Array<Record<string, unknown>> = [];

      mockSend.mockImplementation((command) => {
        if (command instanceof GetCommand) {
          const key = (command as any).input.Key;
          getKeys.push(key);

          if (key?.pk === "IDEMPOTENCY#HANDOFF") {
            return Promise.resolve({ Item: undefined });
          }

          if (key?.pk === "PROJECT#P-existing" && key?.sk === "METADATA") {
            return Promise.resolve({ Item: { baseline_id: "base_old123" } });
          }

          return Promise.resolve({ Item: undefined });
        }

        if (command instanceof ScanCommand) {
          return Promise.resolve({ Items: [] });
        }

        throw new Error("Unexpected command");
      });

      const result = await resolveProjectForHandoff({
        ddb: mockDdb,
        tableName: mockTableName,
        incomingProjectId: "P-test123",
        baselineId: "base_abc123",
        idempotencyKey: "key-1",
      });

      expect(result.resolvedProjectId).toBe("P-test123");
      expect(result.isNewProject).toBe(true);
      expect(result.baselineId).toBe("base_abc123");
      expect(result.existingProjectMetadata).toBeUndefined();
    });

    it("should generate new projectId when no incoming projectId provided", async () => {
      mockSend.mockImplementation((command) => {
        if (command instanceof GetCommand) {
          return Promise.resolve({ Item: undefined });
        }

        if (command instanceof ScanCommand) {
          return Promise.resolve({ Items: [] });
        }

        throw new Error("Unexpected command");
      });

    const result = await resolveProjectForHandoff({
      ddb: mockDdb,
      tableName: mockTableName,
      baselineId: "base_abc123",
      idempotencyKey: "key-1",
    });

      expect(result.resolvedProjectId).toBe("P-generated-uuid");
      expect(result.isNewProject).toBe(true);
      expect(result.baselineId).toBe("base_abc123");
    });
  });

  describe("Second handoff for same baseline", () => {
    it("should reuse existing project when baseline matches", async () => {
      const existingMetadata = {
        pk: "PROJECT#P-existing",
        sk: "METADATA",
        baseline_id: "base_abc123",
        name: "Existing Project",
      };

      mockSend.mockImplementation((command) => {
        if (command instanceof GetCommand) {
          return Promise.resolve({ Item: undefined });
        }

        if (command instanceof ScanCommand) {
          return Promise.resolve({ Items: [existingMetadata] });
        }

        throw new Error("Unexpected command");
      });

      const result = await resolveProjectForHandoff({
        ddb: mockDdb,
        tableName: mockTableName,
        incomingProjectId: "P-existing",
        baselineId: "base_abc123",
        idempotencyKey: "key-2",
      });

      expect(result.resolvedProjectId).toBe("P-existing");
      expect(result.isNewProject).toBe(false);
      expect(result.existingProjectMetadata).toEqual(existingMetadata);
    });

    it("should find existing project by baseline when no incoming ID", async () => {
      const existingMetadata = {
        pk: "PROJECT#P-found",
        sk: "METADATA",
        baseline_id: "base_abc123",
        name: "Found Project",
      };

      mockSend.mockImplementation((command) => {
        if (command instanceof GetCommand) {
          return Promise.resolve({ Item: undefined });
        }

        if (command instanceof ScanCommand) {
          return Promise.resolve({ Items: [existingMetadata] });
        }

        throw new Error("Unexpected command");
      });

      const result = await resolveProjectForHandoff({
        ddb: mockDdb,
        tableName: mockTableName,
        baselineId: "base_abc123",
        idempotencyKey: "key-3",
      });

      expect(result.resolvedProjectId).toBe("P-found");
      expect(result.isNewProject).toBe(false);
      expect(result.existingProjectMetadata).toEqual(existingMetadata);
    });
  });

  describe("Handoff for different baseline (collision prevention)", () => {
    it("should create new projectId when existing project has different baseline", async () => {
      const getKeys: Array<Record<string, unknown>> = [];

      mockSend.mockImplementation((command) => {
        if (command instanceof GetCommand) {
          const key = (command as any).input.Key;
          getKeys.push(key);

          if (key?.pk === "IDEMPOTENCY#HANDOFF") {
            return Promise.resolve({ Item: undefined });
          }

          if (key?.pk === "PROJECT#P-existing" && key?.sk === "METADATA") {
            return Promise.resolve({ Item: { baseline_id: "base_old123" } });
          }

          return Promise.resolve({ Item: undefined });
        }

        if (command instanceof ScanCommand) {
          return Promise.resolve({ Items: [] });
        }

        throw new Error("Unexpected command");
      });

      const result = await resolveProjectForHandoff({
        ddb: mockDdb,
        tableName: mockTableName,
        incomingProjectId: "P-existing",
        baselineId: "base_new456",
        idempotencyKey: "key-4",
      });

      expect(getKeys).toContainEqual({ pk: "PROJECT#P-existing", sk: "METADATA" });
      expect(result.resolvedProjectId).not.toBe("P-existing");
      expect(result.resolvedProjectId).toBe("P-generated-uuid");
      expect(result.isNewProject).toBe(true);
      expect(result.baselineId).toBe("base_new456");
    });

    it("should create new projectId when existing project metadata lacks baseline", async () => {
      const getKeys: Array<Record<string, unknown>> = [];

      mockSend.mockImplementation((command) => {
        if (command instanceof GetCommand) {
          const key = (command as any).input.Key;
          getKeys.push(key);

          if (key?.pk === "IDEMPOTENCY#HANDOFF") {
            return Promise.resolve({ Item: undefined });
          }

          if (key?.pk === "PROJECT#P-existing" && key?.sk === "METADATA") {
            return Promise.resolve({ Item: { name: "no baseline" } });
          }

          return Promise.resolve({ Item: undefined });
        }

        if (command instanceof ScanCommand) {
          return Promise.resolve({ Items: [] });
        }

        throw new Error("Unexpected command");
      });

      const result = await resolveProjectForHandoff({
        ddb: mockDdb,
        tableName: mockTableName,
        incomingProjectId: "P-existing",
        baselineId: "base_new456",
        idempotencyKey: "key-4b",
      });

      expect(getKeys).toContainEqual({ pk: "PROJECT#P-existing", sk: "METADATA" });
      expect(result.resolvedProjectId).toBe("P-generated-uuid");
      expect(result.isNewProject).toBe(true);
      expect(result.baselineId).toBe("base_new456");
    });

    it("should find and reuse project when different baseline already has project", async () => {
      const existingMetadataNew = {
        pk: "PROJECT#P-baseline-new",
        sk: "METADATA",
        baseline_id: "base_new456",
        name: "Project for New Baseline",
      };

      mockSend.mockImplementation((command) => {
        if (command instanceof GetCommand) {
          return Promise.resolve({ Item: undefined });
        }

        if (command instanceof ScanCommand) {
          return Promise.resolve({ Items: [existingMetadataNew] });
        }

        throw new Error("Unexpected command");
      });

      const result = await resolveProjectForHandoff({
        ddb: mockDdb,
        tableName: mockTableName,
        incomingProjectId: "P-existing",
        baselineId: "base_new456",
        idempotencyKey: "key-5",
      });

      expect(result.resolvedProjectId).toBe("P-baseline-new");
      expect(result.isNewProject).toBe(false);
      expect(result.existingProjectMetadata).toEqual(existingMetadataNew);
    });
  });

  describe("Idempotency handling", () => {
    it("should return cached result when idempotency key matches", async () => {
      const cachedResult = {
        projectId: "P-cached",
        baselineId: "base_abc123",
      };

      const existingMetadata = {
        pk: "PROJECT#P-cached",
        sk: "METADATA",
        baseline_id: "base_abc123",
      };

      mockSend.mockImplementation((command) => {
        if (command instanceof GetCommand) {
          if ((command as any).input.Key.pk === "IDEMPOTENCY#HANDOFF") {
            return Promise.resolve({
              Item: {
                pk: "IDEMPOTENCY#HANDOFF",
                sk: "key-6",
                result: cachedResult,
              },
            });
          }

          return Promise.resolve({ Item: existingMetadata });
        }

        throw new Error("Unexpected command");
      });

      const result = await resolveProjectForHandoff({
        ddb: mockDdb,
        tableName: mockTableName,
        incomingProjectId: "P-test",
        baselineId: "base_abc123",
        idempotencyKey: "key-6",
      });

      expect(result.resolvedProjectId).toBe("P-cached");
      expect(result.isNewProject).toBe(false);
    });

    it("should throw error when idempotency key used with different baseline", async () => {
      const cachedResult = {
        projectId: "P-cached",
        baselineId: "base_old123",
      };

      mockSend.mockImplementation((command) => {
        if (command instanceof GetCommand) {
          return Promise.resolve({
            Item: {
              pk: "IDEMPOTENCY#HANDOFF",
              sk: "key-7",
              result: cachedResult,
            },
          });
        }

        throw new Error("Unexpected command");
      });

      await expect(
        resolveProjectForHandoff({
          ddb: mockDdb,
          tableName: mockTableName,
          incomingProjectId: "P-test",
          baselineId: "base_new456",
          idempotencyKey: "key-7",
        })
      ).rejects.toThrow("Idempotency key");
    });
  });

  describe("Error handling", () => {
    it("should throw error when baselineId is missing", async () => {
      await expect(
        resolveProjectForHandoff({
          ddb: mockDdb,
          tableName: mockTableName,
          incomingProjectId: "P-test",
          baselineId: undefined as any,
          idempotencyKey: "key-8",
        })
      ).rejects.toThrow("baselineId is required");
    });
  });

  describe("Backward compatibility", () => {
    it("should support both baseline_id and baselineId fields", async () => {
      const existingMetadataWithCamelCase = {
        pk: "PROJECT#P-camel",
        sk: "METADATA",
        baselineId: "base_abc123", // camelCase
        name: "Project with camelCase",
      };

      mockSend.mockImplementation((command) => {
        if (command instanceof GetCommand) {
          return Promise.resolve({ Item: undefined });
        }

        if (command instanceof ScanCommand) {
          return Promise.resolve({ Items: [existingMetadataWithCamelCase] });
        }

        throw new Error("Unexpected command");
      });

      const result = await resolveProjectForHandoff({
        ddb: mockDdb,
        tableName: mockTableName,
        incomingProjectId: "P-camel",
        baselineId: "base_abc123",
        idempotencyKey: "key-9",
      });

      expect(result.resolvedProjectId).toBe("P-camel");
      expect(result.isNewProject).toBe(false);
    });
  });
});
