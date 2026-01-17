import { handler } from "../../src/handlers/allocations";
import { ddb } from "../../src/lib/dynamo";
import { ensureCanRead } from "../../src/lib/auth";

type Mutable<T> = { -readonly [P in keyof T]: Mutable<T[P]> };
type ApiEvent = Mutable<Parameters<typeof handler>[0]>;

jest.mock("../../src/lib/auth", () => ({
  ensureCanRead: jest.fn(async () => undefined),
  ensureCanWrite: jest.fn(async () => undefined),
  getUserContext: jest.fn(async () => ({
    email: "test@example.com",
    groups: ["SDMT"],
    roles: ["SDMT"],
    isAdmin: false,
    isExecRO: false,
    isSDM: false,
    isPMO: false,
    isSDMT: true,
    sub: "test-user-123",
  })),
}));

jest.mock("../../src/lib/dynamo", () => {
  const actual = jest.requireActual("../../src/lib/dynamo");
  const sendDdb = jest.fn();
  return {
    ...actual,
    sendDdb,
    ddb: { send: sendDdb },
    tableName: jest.fn((key: string) => `test-${key}`),
  };
});

const mockDdbSend = ddb.send as jest.Mock;
const mockEnsureCanRead = ensureCanRead as jest.Mock;

describe("allocations handler - robust GET with fallbacks", () => {
  beforeEach(() => {
    mockDdbSend.mockReset();
    mockEnsureCanRead.mockClear();
  });

  const baseGetEvent: ApiEvent = {
    version: "2.0",
    routeKey: "GET /allocations",
    rawPath: "/allocations",
    rawQueryString: "",
    headers: { authorization: "Bearer fake" },
    queryStringParameters: {},
    requestContext: {
      accountId: "123456789012",
      apiId: "api-id",
      domainName: "example.com",
      domainPrefix: "example",
      http: {
        method: "GET",
        path: "/allocations",
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "jest",
      },
      requestId: "test-request-id",
      routeKey: "GET /allocations",
      stage: "$default",
      time: "",
      timeEpoch: Date.now(),
    },
    isBase64Encoded: false,
  } as any;

  it("should retrieve allocations when they exist under PROJECT# pk", async () => {
    const projectId = "PROJ-2025-001";
    const mockAllocations = [
      {
        pk: `PROJECT#${projectId}`,
        sk: "ALLOCATION#baseline1#2025-01#RUBRO-001",
        projectId,
        baselineId: "baseline1",
        rubroId: "RUBRO-001",
        month: "2025-01",
        planned: 1000,
      },
      {
        pk: `PROJECT#${projectId}`,
        sk: "ALLOCATION#baseline1#2025-02#RUBRO-001",
        projectId,
        baselineId: "baseline1",
        rubroId: "RUBRO-001",
        month: "2025-02",
        planned: 1500,
      },
    ];

    // Mock DynamoDB query to return allocations
    mockDdbSend.mockResolvedValueOnce({
      Items: mockAllocations,
    });

    const event = {
      ...baseGetEvent,
      queryStringParameters: { projectId },
    };

    const response = await handler(event as any);

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body).toEqual(mockAllocations);
    expect(mockDdbSend).toHaveBeenCalledTimes(1);
    expect(mockDdbSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          ExpressionAttributeValues: { ":pk": `PROJECT#${projectId}` },
        }),
      })
    );
  });

  it("should fallback to baseline→project resolution when projectId is baseline-like", async () => {
    const baselineId = "base_2025_001";
    const projectId = "PROJ-2025-001";
    const mockAllocations = [
      {
        pk: `PROJECT#${projectId}`,
        sk: "ALLOCATION#base_2025_001#2025-01#RUBRO-001",
        projectId,
        baselineId,
        rubroId: "RUBRO-001",
        month: "2025-01",
        planned: 2000,
      },
    ];

    // First query with PROJECT#base_2025_001 returns empty
    mockDdbSend.mockResolvedValueOnce({ Items: [] });

    // Baseline lookup returns baseline with project_id
    mockDdbSend.mockResolvedValueOnce({
      Item: {
        pk: `BASELINE#${baselineId}`,
        sk: "METADATA",
        baseline_id: baselineId,
        project_id: projectId,
      },
    });

    // Second query with PROJECT#PROJ-2025-001 returns allocations
    mockDdbSend.mockResolvedValueOnce({
      Items: mockAllocations,
    });

    const event = {
      ...baseGetEvent,
      queryStringParameters: { projectId: baselineId },
    };

    const response = await handler(event as any);

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body).toEqual(mockAllocations);
    expect(mockDdbSend).toHaveBeenCalledTimes(3);
    
    // Verify baseline lookup was called
    expect(mockDdbSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          Key: { pk: `BASELINE#${baselineId}`, sk: "METADATA" },
        }),
      })
    );
  });

  it("should fallback to BASELINE# pk for legacy allocations", async () => {
    const baselineId = "BL-2024-LEGACY";
    const mockAllocations = [
      {
        pk: `BASELINE#${baselineId}`,
        sk: "ALLOCATION#BL-2024-LEGACY#2024-12#RUBRO-001",
        baselineId,
        rubroId: "RUBRO-001",
        month: "2024-12",
        planned: 3000,
      },
    ];

    // First query with PROJECT#BL-2024-LEGACY returns empty
    mockDdbSend.mockResolvedValueOnce({ Items: [] });

    // Baseline lookup returns baseline but with no project_id
    mockDdbSend.mockResolvedValueOnce({
      Item: {
        pk: `BASELINE#${baselineId}`,
        sk: "METADATA",
        baseline_id: baselineId,
        // No project_id - old baseline
      },
    });

    // Third query with BASELINE#BL-2024-LEGACY returns allocations
    mockDdbSend.mockResolvedValueOnce({
      Items: mockAllocations,
    });

    const event = {
      ...baseGetEvent,
      queryStringParameters: { projectId: baselineId },
    };

    const response = await handler(event as any);

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body).toEqual(mockAllocations);
    expect(mockDdbSend).toHaveBeenCalledTimes(3);
    
    // Verify BASELINE# query was called with SK filter
    expect(mockDdbSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          ExpressionAttributeValues: expect.objectContaining({
            ":pk": `BASELINE#${baselineId}`,
            ":skPrefix": `ALLOCATION#${baselineId}#`,
          }),
        }),
      })
    );
  });

  it("should return empty array when no allocations found", async () => {
    const projectId = "PROJ-NONEXISTENT";

    // Query returns empty
    mockDdbSend.mockResolvedValueOnce({ Items: [] });

    const event = {
      ...baseGetEvent,
      queryStringParameters: { projectId },
    };

    const response = await handler(event as any);

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body).toEqual([]);
  });

  it("should handle baseline lookup failure gracefully", async () => {
    const baselineId = "base_error_test";

    // First query returns empty
    mockDdbSend.mockResolvedValueOnce({ Items: [] });

    // Baseline lookup fails
    mockDdbSend.mockRejectedValueOnce(new Error("DynamoDB error"));

    // Fallback to BASELINE# query returns empty
    mockDdbSend.mockResolvedValueOnce({ Items: [] });

    const event = {
      ...baseGetEvent,
      queryStringParameters: { projectId: baselineId },
    };

    const response = await handler(event as any);

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body).toEqual([]);
  });
});
