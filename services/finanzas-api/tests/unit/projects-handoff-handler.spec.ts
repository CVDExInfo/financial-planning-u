import { APIGatewayProxyEventV2 } from "aws-lambda";

jest.mock("../../src/lib/auth", () => ({
  ensureCanWrite: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../src/lib/dynamo", () => {
  const sendDdb = jest.fn();
  return {
    sendDdb,
    ddb: { send: sendDdb },
    PutCommand: jest.fn().mockImplementation((input) => ({ input })),
    GetCommand: jest.fn().mockImplementation((input) => ({ input })),
    QueryCommand: jest.fn().mockImplementation((input) => ({ input })),
    UpdateCommand: jest.fn().mockImplementation((input) => ({ input })),
    tableName: jest.fn((name: string) => `test-${name}`),
  };
});

jest.mock("../../src/lib/projects-handoff", () => ({
  resolveProjectForHandoff: jest.fn(),
}));

import { handler } from "../../src/handlers/projects";
import { sendDdb, tableName } from "../../src/lib/dynamo";
import { resolveProjectForHandoff } from "../../src/lib/projects-handoff";

const mockSendDdb = sendDdb as jest.Mock;
const mockResolve = resolveProjectForHandoff as jest.MockedFunction<
  typeof resolveProjectForHandoff
>;

const makeEvent = (baselineId: string, idempotencyKey: string): APIGatewayProxyEventV2 => ({
  version: "2.0",
  routeKey: "POST /projects/{projectId}/handoff",
  rawPath: "/projects/P-canonical/handoff",
  rawQueryString: "",
  headers: {
    "x-idempotency-key": idempotencyKey,
  },
  pathParameters: {
    projectId: "P-canonical",
  },
  requestContext: {
    accountId: "123",
    apiId: "api",
    domainName: "example.com",
    domainPrefix: "example",
    http: {
      method: "POST",
      path: "/projects/P-canonical/handoff",
      protocol: "HTTP/1.1",
      sourceIp: "127.0.0.1",
      userAgent: "jest",
    },
    requestId: "id",
    routeKey: "POST /projects/{projectId}/handoff",
    stage: "$default",
    time: "",
    timeEpoch: 0,
  },
  isBase64Encoded: false,
  body: JSON.stringify({ baseline_id: baselineId }),
});

describe("projects handler handoff collision prevention", () => {
  const makeKey = (table: string, pk: string, sk: string) => `${table}|${pk}|${sk}`;
  let store: Map<string, Record<string, unknown>>;

  beforeEach(() => {
    jest.clearAllMocks();
    store = new Map();

    mockSendDdb.mockImplementation(async (command: any) => {
      const { TableName, Key, Item, ConditionExpression } = command.input || {};

      if (Key) {
        const key = makeKey(TableName, Key.pk, Key.sk);
        const found = store.get(key);
        return { Item: found };
      }

      if (Item) {
        const key = makeKey(TableName, Item.pk, Item.sk);
        if (ConditionExpression?.includes("attribute_not_exists") && store.has(key)) {
          const error = new Error("ConditionalCheckFailedException");
          (error as any).name = "ConditionalCheckFailedException";
          throw error;
        }

        store.set(key, Item);
        return {};
      }

      return {};
    });

    // Prefill baseline metadata (prefacturas) pointing to the same project
    const prefacturasTable = tableName("prefacturas");
    store.set(
      makeKey(prefacturasTable, "BASELINE#base_a", "METADATA"),
      {
        pk: "BASELINE#base_a",
        sk: "METADATA",
        project_id: "P-canonical",
        project_name: "Project From Baseline A",
        client_name: "Client",
        currency: "USD",
        duration_months: 12,
        start_date: "2025-01-01",
      }
    );
    store.set(
      makeKey(prefacturasTable, "BASELINE#base_b", "METADATA"),
      {
        pk: "BASELINE#base_b",
        sk: "METADATA",
        project_id: "P-canonical",
        project_name: "Project From Baseline B",
        client_name: "Client",
        currency: "USD",
        duration_months: 12,
        start_date: "2025-02-01",
      }
    );
  });

  it("keeps resolver projectId and seeds new partition when baselines share prefacturas project_id", async () => {
    mockResolve
      .mockResolvedValueOnce({
        resolvedProjectId: "P-canonical",
        baselineId: "base_a",
        isNewProject: true,
      })
      .mockResolvedValueOnce({
        resolvedProjectId: "P-new",
        baselineId: "base_b",
        isNewProject: true,
      });

    const firstResponse = await handler(makeEvent("base_a", "key-a"));
    expect(firstResponse.statusCode).toBe(201);

    const secondResponse = await handler(makeEvent("base_b", "key-b"));
    expect(secondResponse.statusCode).toBe(201);

    const projectsTable = tableName("projects");
    const originalMetadata = store.get(
      makeKey(projectsTable, "PROJECT#P-canonical", "METADATA")
    );
    const newMetadata = store.get(makeKey(projectsTable, "PROJECT#P-new", "METADATA"));

    expect(originalMetadata?.baseline_id).toBe("base_a");
    expect(newMetadata?.baseline_id).toBe("base_b");
    expect(newMetadata?.baseline_source_project_id).toBe("P-canonical");
    expect(newMetadata?.pk).toBe("PROJECT#P-new");
  });

  it("returns 409 when resolved project already has a different baseline", async () => {
    const projectsTable = tableName("projects");
    store.set(makeKey(projectsTable, "PROJECT#P-canonical", "METADATA"), {
      pk: "PROJECT#P-canonical",
      sk: "METADATA",
      baseline_id: "base_a",
    });

    mockResolve.mockResolvedValue({
      resolvedProjectId: "P-canonical",
      baselineId: "base_b",
      isNewProject: false,
      existingProjectMetadata: store.get(
        makeKey(projectsTable, "PROJECT#P-canonical", "METADATA")
      ),
    });

    const response = await handler(makeEvent("base_b", "key-collision"));
    expect(response.statusCode).toBe(409);

    const unchangedMetadata = store.get(
      makeKey(projectsTable, "PROJECT#P-canonical", "METADATA")
    );
    expect(unchangedMetadata?.baseline_id).toBe("base_a");
  });
});
