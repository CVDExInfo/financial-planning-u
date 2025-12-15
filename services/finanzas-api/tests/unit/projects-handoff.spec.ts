/**
 * Unit tests for baseline-aware project resolution helper
 */

import { resolveProjectForHandoff } from "../../src/lib/projects-handoff";
import { DynamoDBDocumentClient, GetCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

// Mock DynamoDB client
const mockSend = jest.fn();
const mockDdb = {
  send: mockSend,
} as unknown as DynamoDBDocumentClient;

const mockTableName = jest.fn((name: string) => `test-${name}`);

describe("resolveProjectForHandoff", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("First handoff for a baseline", () => {
    it("should return new projectId when baseline has no existing project", async () => {
      // Mock: no idempotency record
      mockSend.mockResolvedValueOnce({ Item: undefined });
      // Mock: no existing project with incoming ID
      mockSend.mockResolvedValueOnce({ Item: undefined });
      // Mock: scan for baseline finds nothing
      mockSend.mockResolvedValueOnce({ Items: [] });

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
      // Mock: no idempotency record
      mockSend.mockResolvedValueOnce({ Item: undefined });
      // Mock: scan for baseline finds nothing
      mockSend.mockResolvedValueOnce({ Items: [] });

      const result = await resolveProjectForHandoff({
        ddb: mockDdb,
        tableName: mockTableName,
        baselineId: "base_abc123",
        idempotencyKey: "key-1",
      });

      expect(result.resolvedProjectId).toMatch(/^P-[0-9a-f-]+$/);
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

      // Mock: no idempotency record
      mockSend.mockResolvedValueOnce({ Item: undefined });
      // Mock: existing project with matching baseline
      mockSend.mockResolvedValueOnce({ Item: existingMetadata });

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

      // Mock: no idempotency record
      mockSend.mockResolvedValueOnce({ Item: undefined });
      // Mock: scan finds existing project
      mockSend.mockResolvedValueOnce({
        Items: [existingMetadata],
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
      const existingMetadata = {
        pk: "PROJECT#P-existing",
        sk: "METADATA",
        baseline_id: "base_old123",
        name: "Existing Project",
      };

      // Mock: no idempotency record
      mockSend.mockResolvedValueOnce({ Item: undefined });
      // Mock: existing project with DIFFERENT baseline
      mockSend.mockResolvedValueOnce({ Item: existingMetadata });
      // Mock: scan for new baseline finds nothing
      mockSend.mockResolvedValueOnce({ Items: [] });

      const result = await resolveProjectForHandoff({
        ddb: mockDdb,
        tableName: mockTableName,
        incomingProjectId: "P-existing",
        baselineId: "base_new456",
        idempotencyKey: "key-4",
      });

      expect(result.resolvedProjectId).not.toBe("P-existing");
      expect(result.resolvedProjectId).toMatch(/^P-[0-9a-f-]+$/);
      expect(result.isNewProject).toBe(true);
      expect(result.baselineId).toBe("base_new456");
    });

    it("should find and reuse project when different baseline already has project", async () => {
      const existingMetadataOld = {
        pk: "PROJECT#P-existing",
        sk: "METADATA",
        baseline_id: "base_old123",
      };

      const existingMetadataNew = {
        pk: "PROJECT#P-baseline-new",
        sk: "METADATA",
        baseline_id: "base_new456",
        name: "Project for New Baseline",
      };

      // Mock: no idempotency record
      mockSend.mockResolvedValueOnce({ Item: undefined });
      // Mock: existing project with DIFFERENT baseline
      mockSend.mockResolvedValueOnce({ Item: existingMetadataOld });
      // Mock: scan finds project with NEW baseline
      mockSend.mockResolvedValueOnce({
        Items: [existingMetadataNew],
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

      // Mock: idempotency record exists
      mockSend.mockResolvedValueOnce({
        Item: {
          pk: "IDEMPOTENCY#HANDOFF",
          sk: "key-6",
          result: cachedResult,
        },
      });
      // Mock: get metadata
      mockSend.mockResolvedValueOnce({ Item: existingMetadata });

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

      // Mock: idempotency record exists with DIFFERENT baseline
      mockSend.mockResolvedValueOnce({
        Item: {
          pk: "IDEMPOTENCY#HANDOFF",
          sk: "key-7",
          result: cachedResult,
        },
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

      // Mock: no idempotency record
      mockSend.mockResolvedValueOnce({ Item: undefined });
      // Mock: existing project with camelCase baselineId
      mockSend.mockResolvedValueOnce({ Item: existingMetadataWithCamelCase });

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
