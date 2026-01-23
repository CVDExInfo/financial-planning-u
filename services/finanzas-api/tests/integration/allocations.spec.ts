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
    
    // Mock baseline metadata lookups for normalization
    mockDdbSend.mockResolvedValue({
      Item: {
        pk: "BASELINE#baseline1",
        sk: "METADATA",
        baseline_id: "baseline1",
        start_date: "2025-01-01",
      },
    });

    const event = {
      ...baseGetEvent,
      queryStringParameters: { projectId },
    };

    const response = await handler(event as any);

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    // Check that allocations are returned with normalized fields
    expect(body.data).toHaveLength(mockAllocations.length);
    body.data.forEach((item: any, idx: number) => {
      expect(item).toMatchObject({
        pk: mockAllocations[idx].pk,
        sk: mockAllocations[idx].sk,
        rubroId: mockAllocations[idx].rubroId,
        month: mockAllocations[idx].month,
        planned: mockAllocations[idx].planned,
      });
      // Verify normalization added expected fields
      expect(item).toHaveProperty('amount');
      expect(item).toHaveProperty('monthIndex');
    });
    // First call is query, then baseline metadata lookups for each allocation
    expect(mockDdbSend).toHaveBeenCalled();
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
        start_date: "2025-01-01",
      },
    });

    // Second query with PROJECT#PROJ-2025-001 returns allocations
    mockDdbSend.mockResolvedValueOnce({
      Items: mockAllocations,
    });
    
    // Baseline metadata lookup for normalization
    mockDdbSend.mockResolvedValue({
      Item: {
        pk: `BASELINE#${baselineId}`,
        sk: "METADATA",
        baseline_id: baselineId,
        start_date: "2025-01-01",
      },
    });

    const event = {
      ...baseGetEvent,
      queryStringParameters: { projectId: baselineId },
    };

    const response = await handler(event as any);

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    // Check that allocations are returned with normalized fields
    expect(body.data).toHaveLength(mockAllocations.length);
    expect(body.data[0]).toMatchObject({
      pk: mockAllocations[0].pk,
      sk: mockAllocations[0].sk,
      rubroId: mockAllocations[0].rubroId,
      month: mockAllocations[0].month,
      planned: mockAllocations[0].planned,
    });
    // Verify normalization added expected fields
    expect(body.data[0]).toHaveProperty('amount');
    expect(body.data[0]).toHaveProperty('monthIndex');
    // Calls: 1) empty query, 2) baseline lookup, 3) successful query, 4+) baseline metadata for normalization
    expect(mockDdbSend).toHaveBeenCalled();
    
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
        start_date: "2024-01-01",
        // No project_id - old baseline
      },
    });

    // Third query with BASELINE#BL-2024-LEGACY returns allocations
    mockDdbSend.mockResolvedValueOnce({
      Items: mockAllocations,
    });
    
    // Baseline metadata lookup for normalization
    mockDdbSend.mockResolvedValue({
      Item: {
        pk: `BASELINE#${baselineId}`,
        sk: "METADATA",
        baseline_id: baselineId,
        start_date: "2024-01-01",
      },
    });

    const event = {
      ...baseGetEvent,
      queryStringParameters: { projectId: baselineId },
    };

    const response = await handler(event as any);

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    // Check that allocations are returned with normalized fields
    expect(body.data).toHaveLength(mockAllocations.length);
    expect(body.data[0]).toMatchObject({
      pk: mockAllocations[0].pk,
      sk: mockAllocations[0].sk,
      rubroId: mockAllocations[0].rubroId,
      month: mockAllocations[0].month,
      planned: mockAllocations[0].planned,
    });
    // Verify normalization added expected fields
    expect(body.data[0]).toHaveProperty('amount');
    expect(body.data[0]).toHaveProperty('monthIndex');
    // Calls: 1) empty query, 2) baseline lookup, 3) successful query, 4+) baseline metadata for normalization
    expect(mockDdbSend).toHaveBeenCalled();
    
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
    expect(body.data).toEqual([]);
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
    expect(body.data).toEqual([]);
  });

  describe("contract month index (M1..M60) integration tests", () => {
    it("should compute correct month_index for multi-year baseline with calendar keys", async () => {
      const projectId = "PROJ-2025-MULTIYEAR";
      const baselineId = "baseline_24months";
      
      // Mock allocations with calendar keys spanning 2 years
      const mockAllocations = [
        {
          pk: `PROJECT#${projectId}`,
          sk: "ALLOCATION#baseline_24months#2025-06#MOD-ING",
          projectId,
          baselineId,
          rubroId: "MOD-ING",
          calendarMonthKey: "2025-06", // June 2025 = M1
          monto_planeado: 50000,
        },
        {
          pk: `PROJECT#${projectId}`,
          sk: "ALLOCATION#baseline_24months#2025-12#MOD-ING",
          projectId,
          baselineId,
          rubroId: "MOD-ING",
          calendarMonthKey: "2025-12", // December 2025 = M7
          monto_planeado: 50000,
        },
        {
          pk: `PROJECT#${projectId}`,
          sk: "ALLOCATION#baseline_24months#2026-06#MOD-ING",
          projectId,
          baselineId,
          rubroId: "MOD-ING",
          calendarMonthKey: "2026-06", // June 2026 = M13
          monto_planeado: 50000,
        },
        {
          pk: `PROJECT#${projectId}`,
          sk: "ALLOCATION#baseline_24months#2026-11#MOD-ING",
          projectId,
          baselineId,
          rubroId: "MOD-ING",
          calendarMonthKey: "2026-11", // November 2026 = M18
          monto_planeado: 50000,
        },
      ];

      const mockBaseline = {
        pk: `BASELINE#${baselineId}`,
        sk: "METADATA",
        baseline_id: baselineId,
        project_id: projectId,
        start_date: "2025-06-01", // Project starts June 2025
        duration_months: 24,
      };

      // First query: get allocations
      mockDdbSend.mockResolvedValueOnce({
        Items: mockAllocations,
      });

      // Baseline metadata lookups for normalization (one per allocation)
      mockDdbSend.mockResolvedValue({
        Item: mockBaseline,
      });

      const event = {
        ...baseGetEvent,
        queryStringParameters: { projectId, baseline: baselineId },
      };

      const response = await handler(event as any);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      expect(body.data).toHaveLength(4);
      
      // Verify each allocation has the correct month_index computed from calendar key
      const june2025 = body.data.find((a: any) => a.calendarMonthKey === "2025-06");
      expect(june2025.month_index).toBe(1); // M1
      expect(june2025.monthIndex).toBe(1);
      
      const dec2025 = body.data.find((a: any) => a.calendarMonthKey === "2025-12");
      expect(dec2025.month_index).toBe(7); // M7
      expect(dec2025.monthIndex).toBe(7);
      
      const june2026 = body.data.find((a: any) => a.calendarMonthKey === "2026-06");
      expect(june2026.month_index).toBe(13); // M13
      expect(june2026.monthIndex).toBe(13);
      
      const nov2026 = body.data.find((a: any) => a.calendarMonthKey === "2026-11");
      expect(nov2026.month_index).toBe(18); // M18
      expect(nov2026.monthIndex).toBe(18);
    });

    it("should write allocations with correct month_index from calendar keys", async () => {
      const projectId = "PROJ-2025-WRITETEST";
      const baselineId = "baseline_write";
      
      const mockProject = {
        pk: `PROJECT#${projectId}`,
        sk: "METADATA",
        baseline_id: baselineId,
        start_date: "2025-06-01", // Project starts June 2025
      };

      // Mock project lookup
      mockDdbSend.mockResolvedValueOnce({
        Item: mockProject,
      });

      // Mock existing allocation checks (not found)
      mockDdbSend.mockResolvedValueOnce({ Item: undefined }); // 2025-06
      mockDdbSend.mockResolvedValueOnce({}); // put
      mockDdbSend.mockResolvedValueOnce({ Item: undefined }); // 2026-11
      mockDdbSend.mockResolvedValueOnce({}); // put

      const basePutEvent: ApiEvent = {
        version: "2.0",
        routeKey: "PUT /projects/{id}/allocations:bulk",
        rawPath: "/projects/PROJ-2025-WRITETEST/allocations:bulk",
        rawQueryString: "type=forecast",
        headers: { authorization: "Bearer fake" },
        pathParameters: { id: projectId },
        queryStringParameters: { type: "forecast" },
        requestContext: {
          accountId: "123456789012",
          apiId: "api-id",
          domainName: "example.com",
          domainPrefix: "example",
          http: {
            method: "PUT",
            path: "/projects/PROJ-2025-WRITETEST/allocations:bulk",
            protocol: "HTTP/1.1",
            sourceIp: "127.0.0.1",
            userAgent: "jest",
          },
          requestId: "test-write-request",
          routeKey: "PUT /projects/{id}/allocations:bulk",
          stage: "$default",
          time: "",
          timeEpoch: Date.now(),
        },
        isBase64Encoded: false,
        body: JSON.stringify({
          items: [
            {
              rubroId: "MOD-ING",
              month: "2025-06", // M1
              forecast: 50000,
            },
            {
              rubroId: "MOD-ING",
              month: "2026-11", // M18
              forecast: 60000,
            },
          ],
        }),
      } as any;

      const response = await handler(basePutEvent);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.updated_count).toBe(2);
      
      // Verify first allocation (June 2025 = M1)
      const june2025 = body.allocations.find((a: any) => a.calendarMonthKey === "2025-06");
      expect(june2025.monthIndex).toBe(1);
      expect(june2025.calendarMonthKey).toBe("2025-06");
      
      // Verify second allocation (November 2026 = M18)
      const nov2026 = body.allocations.find((a: any) => a.calendarMonthKey === "2026-11");
      expect(nov2026.monthIndex).toBe(18);
      expect(nov2026.calendarMonthKey).toBe("2026-11");
    });

    it("should handle allocations without baseline start_date gracefully", async () => {
      const projectId = "PROJ-NO-STARTDATE";
      const baselineId = "baseline_nodate";
      
      const mockAllocations = [
        {
          pk: `PROJECT#${projectId}`,
          sk: "ALLOCATION#baseline_nodate#2026-11#MOD-ING",
          projectId,
          baselineId,
          rubroId: "MOD-ING",
          calendarMonthKey: "2026-11",
          monto_planeado: 50000,
        },
      ];

      // Baseline without start_date
      const mockBaseline = {
        pk: `BASELINE#${baselineId}`,
        sk: "METADATA",
        baseline_id: baselineId,
        duration_months: 24,
        // No start_date field
      };

      // Query allocations
      mockDdbSend.mockResolvedValueOnce({
        Items: mockAllocations,
      });

      // Baseline metadata lookup
      mockDdbSend.mockResolvedValue({
        Item: mockBaseline,
      });

      const event = {
        ...baseGetEvent,
        queryStringParameters: { projectId, baseline: baselineId },
      };

      const response = await handler(event as any);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      expect(body.data).toHaveLength(1);
      // Should fall back to month-of-year (11)
      expect(body.data[0].month_index).toBe(11);
      expect(body.data[0].monthIndex).toBe(11);
      expect(body.data[0].calendarMonthKey).toBe("2026-11");
    });
  });
});
