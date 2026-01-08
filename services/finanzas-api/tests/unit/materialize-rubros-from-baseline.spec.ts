import { describe, it, expect, beforeEach } from "@jest/globals";
import { mockClient } from "aws-sdk-client-mock";
import {
  BatchGetCommand,
  BatchWriteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  buildRubrosFromBaselinePayload,
  materializeRubrosFromBaseline,
} from "../../src/lib/materializers";
import { tableName } from "../../src/lib/dynamo";

describe("materializeRubrosFromBaseline", () => {
  const docClientMock = mockClient(DynamoDBDocumentClient);
  const projectId = "PRJ-UNIT";
  const baselineId = "base_unit_123";

  const baselinePayload = {
    project_id: projectId,
    currency: "USD",
    labor_estimates: [
      {
        role: "Ingeniero Delivery",
        level: "lead",
        fte_count: 1,
        hourly_rate: 840,
        hours_per_month: 160,
        on_cost_percentage: 0,
        start_month: 1,
        end_month: 12,
      },
      {
        rubroId: "MOD-SDM",
        role: "Service Delivery Manager",
        level: "lead",
        fte_count: 1,
        hourly_rate: 250,
        hours_per_month: 160,
        on_cost_percentage: 0,
        start_month: 1,
        end_month: 12,
      },
    ],
    non_labor_estimates: [
      {
        category: "Infraestructura / Nube / Data Center",
        description: "Hosting",
        amount: 6000,
        one_time: false,
        start_month: 1,
        end_month: 12,
      },
    ],
  };

  beforeEach(() => {
    docClientMock.reset();
    docClientMock.on(ScanCommand).resolves({
      Items: [
        {
          linea_codigo: "INF-CLOUD",
          categoria: "Infraestructura / Nube / Data Center",
          descripcion: "Hosting",
        },
      ],
    });
  });

  it("builds rubros from a baseline payload", async () => {
    const { items, warnings } = await buildRubrosFromBaselinePayload(
      baselinePayload,
      projectId,
      baselineId
    );

    expect(items).toHaveLength(3);
    expect(items[0].pk).toBe(`PROJECT#${projectId}`);
    expect(items[0].baselineId).toBe(baselineId);
    expect(items[0].linea_codigo).toBeDefined();
    expect(items[2].linea_codigo).toBe("INF-CLOUD");
    expect(warnings).toHaveLength(0);
  });

  it("writes rubros idempotently when materializing", async () => {
    const { items } = await buildRubrosFromBaselinePayload(
      baselinePayload,
      projectId,
      baselineId
    );
    const existingItems = items.map((item) => ({ pk: item.pk, sk: item.sk }));

    docClientMock.on(GetCommand).resolves({
      Item: {
        pk: `BASELINE#${baselineId}`,
        sk: "METADATA",
        project_id: projectId,
        payload: baselinePayload,
      },
    });

    docClientMock
      .on(BatchGetCommand)
      .resolvesOnce({ Responses: { [tableName("rubros")]: [] } })
      .resolvesOnce({ Responses: { [tableName("rubros")]: existingItems } });

    docClientMock.on(BatchWriteCommand).resolves({});

    const first = await materializeRubrosFromBaseline({ projectId, baselineId });
    expect(first.rubrosWritten).toBe(3);

    const second = await materializeRubrosFromBaseline({ projectId, baselineId });
    expect(second.rubrosWritten).toBe(0);
    expect(second.rubrosUpdated).toBe(3);
  });
});
