/**
 * Unit tests for baseline-aware project resolution helper
 */

import {
  resolveProjectForHandoff,
  normalizeBaselineId,
  type ResolveProjectParams,
} from "../../src/lib/projects-handoff";

// Mock DynamoDB
const mockSend = jest.fn();
const mockDdb = {
  send: mockSend,
} as any;

const mockTableName = jest.fn((name: string) => `test-${name}`);

describe("projects-handoff", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("normalizeBaselineId", () => {
    it("should return null for undefined input", () => {
      expect(normalizeBaselineId(undefined)).toBeNull();
    });

    it("should return baseline_id when present", () => {
      expect(normalizeBaselineId({ baseline_id: "base_123" })).toBe("base_123");
    });

    it("should return baselineId when present", () => {
      expect(normalizeBaselineId({ baselineId: "base_456" })).toBe("base_456");
    });

    it("should prefer baseline_id over baselineId", () => {
      expect(
        normalizeBaselineId({ baseline_id: "base_123", baselineId: "base_456" })
      ).toBe("base_123");
    });
  });

  describe("resolveProjectForHandoff", () => {
    const baseParams: ResolveProjectParams = {
      ddb: mockDdb,
      tableName: mockTableName,
      baselineId: "base_abc123",
      idempotencyKey: "test-key-1",
      idempotencyPayload: { test: "payload" },
    };

    it("should throw error if no baseline ID provided", async () => {
      await expect(
        resolveProjectForHandoff({
          ...baseParams,
          baselineId: undefined,
        })
      ).rejects.toThrow("baseline_id is required for handoff");
    });

    it("should return cached result for idempotent request with matching payload", async () => {
      // Mock idempotency cache hit
      mockSend.mockResolvedValueOnce({
        Item: {
          pk: "IDEMPOTENCY#HANDOFF",
          sk: "test-key-1",
          payload: { test: "payload" },
          result: {
            projectId: "P-cached-123",
            baselineId: "base_abc123",
          },
        },
      });

      const result = await resolveProjectForHandoff(baseParams);

      expect(result).toEqual({
        resolvedProjectId: "P-cached-123",
        baselineId: "base_abc123",
        isNewProject: false,
        wasIdempotent: true,
      });
    });

    it("should create new project when no incoming projectId and no existing project for baseline", async () => {
      // Mock no idempotency cache
      mockSend.mockResolvedValueOnce({ Item: null });

      // Mock scan for baseline returns empty
      mockSend.mockResolvedValueOnce({ Items: [] });

      const result = await resolveProjectForHandoff(baseParams);

      expect(result).toMatchObject({
        baselineId: "base_abc123",
        isNewProject: true,
        wasIdempotent: false,
      });
      expect(result?.resolvedProjectId).toMatch(/^P-[a-f0-9-]{36}$/);
    });

    it("should reuse existing project when incoming projectId matches baseline", async () => {
      const params = {
        ...baseParams,
        incomingProjectId: "P-existing-123",
      };

      // Mock no idempotency cache
      mockSend.mockResolvedValueOnce({ Item: null });

      // Mock existing project with matching baseline
      mockSend.mockResolvedValueOnce({
        Item: {
          pk: "PROJECT#P-existing-123",
          sk: "METADATA",
          baseline_id: "base_abc123",
          name: "Test Project",
        },
      });

      const result = await resolveProjectForHandoff(params);

      expect(result).toMatchObject({
        resolvedProjectId: "P-existing-123",
        baselineId: "base_abc123",
        isNewProject: false,
        wasIdempotent: false,
      });
      expect(result?.existingProjectMetadata).toBeDefined();
      expect(result?.existingProjectMetadata?.baseline_id).toBe("base_abc123");
    });

    it("should generate new projectId when incoming project has different baseline and no other project exists", async () => {
      const params = {
        ...baseParams,
        incomingProjectId: "P-existing-123",
        baselineId: "base_new456",
      };

      // Mock no idempotency cache
      mockSend.mockResolvedValueOnce({ Item: null });

      // Mock existing project with DIFFERENT baseline
      mockSend.mockResolvedValueOnce({
        Item: {
          pk: "PROJECT#P-existing-123",
          sk: "METADATA",
          baseline_id: "base_old123",
          name: "Old Project",
        },
      });

      // Mock scan for new baseline returns empty (no existing project for base_new456)
      mockSend.mockResolvedValueOnce({ Items: [] });

      const result = await resolveProjectForHandoff(params);

      expect(result).toMatchObject({
        baselineId: "base_new456",
        isNewProject: true,
        wasIdempotent: false,
      });
      expect(result?.resolvedProjectId).not.toBe("P-existing-123");
      expect(result?.resolvedProjectId).toMatch(/^P-[a-f0-9-]{36}$/);
    });

    it("should reuse existing project when incoming project has different baseline but another project exists for new baseline", async () => {
      const params = {
        ...baseParams,
        incomingProjectId: "P-existing-123",
        baselineId: "base_new456",
      };

      // Mock no idempotency cache
      mockSend.mockResolvedValueOnce({ Item: null });

      // Mock incoming project with OLD baseline
      mockSend.mockResolvedValueOnce({
        Item: {
          pk: "PROJECT#P-existing-123",
          sk: "METADATA",
          baseline_id: "base_old123",
          name: "Old Project",
        },
      });

      // Mock scan finds another project with NEW baseline
      mockSend.mockResolvedValueOnce({
        Items: [
          {
            pk: "PROJECT#P-other-456",
            sk: "METADATA",
            baseline_id: "base_new456",
            name: "Project for New Baseline",
          },
        ],
      });

      const result = await resolveProjectForHandoff(params);

      expect(result).toMatchObject({
        resolvedProjectId: "P-other-456",
        baselineId: "base_new456",
        isNewProject: false,
        wasIdempotent: false,
      });
      expect(result?.existingProjectMetadata).toBeDefined();
    });

    it("should search for and reuse project when no incoming projectId but project exists for baseline", async () => {
      // Mock no idempotency cache
      mockSend.mockResolvedValueOnce({ Item: null });

      // Mock scan finds project with matching baseline
      mockSend.mockResolvedValueOnce({
        Items: [
          {
            pk: "PROJECT#P-found-789",
            sk: "METADATA",
            baseline_id: "base_abc123",
            name: "Found Project",
          },
        ],
      });

      const result = await resolveProjectForHandoff(baseParams);

      expect(result).toMatchObject({
        resolvedProjectId: "P-found-789",
        baselineId: "base_abc123",
        isNewProject: false,
        wasIdempotent: false,
      });
      expect(result?.existingProjectMetadata).toBeDefined();
    });

    it("should handle incoming project with no baseline gracefully", async () => {
      const params = {
        ...baseParams,
        incomingProjectId: "P-no-baseline",
      };

      // Mock no idempotency cache
      mockSend.mockResolvedValueOnce({ Item: null });

      // Mock existing project with NO baseline
      mockSend.mockResolvedValueOnce({
        Item: {
          pk: "PROJECT#P-no-baseline",
          sk: "METADATA",
          name: "Project Without Baseline",
        },
      });

      const result = await resolveProjectForHandoff(params);

      expect(result).toMatchObject({
        resolvedProjectId: "P-no-baseline",
        baselineId: "base_abc123",
        isNewProject: false,
        wasIdempotent: false,
      });
    });

    it("should create new project when incoming projectId does not exist", async () => {
      const params = {
        ...baseParams,
        incomingProjectId: "P-nonexistent",
      };

      // Mock no idempotency cache
      mockSend.mockResolvedValueOnce({ Item: null });

      // Mock project does not exist
      mockSend.mockResolvedValueOnce({ Item: null });

      const result = await resolveProjectForHandoff(params);

      expect(result).toMatchObject({
        resolvedProjectId: "P-nonexistent",
        baselineId: "base_abc123",
        isNewProject: true,
        wasIdempotent: false,
      });
      expect(result?.existingProjectMetadata).toBeUndefined();
    });
  });
});
