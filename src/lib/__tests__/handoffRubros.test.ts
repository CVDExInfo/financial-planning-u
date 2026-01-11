import assert from "node:assert/strict";
import { describe, it } from "node:test";
describe("handoff baseline materialization", () => {
  it("seeds rubros from baseline and supports forecast fallback", async () => {
    process.env.COGNITO_CLIENT_ID ||= "test-client-id";
    process.env.COGNITO_DOMAIN ||= "example.com";
    process.env.COGNITO_POOL_ID ||= "test-pool";

    const { normalizeBaseline, seedLineItemsFromBaseline } = await import(
      "../../../services/finanzas-api/src/handlers/handoff"
    );

    const baselineId = "base_unit";
    const projectId = "P-UNIT";
    const baseline = normalizeBaseline({
      payload: {
        currency: "USD",
        project_name: "Unit Test Project",
        client_name: "ACME",
        duration_months: 6,
        labor_estimates: [
          {
            rubroId: "MOD-ING",
            role: "Engineer",
            level: "SSE",
            hours_per_month: 160,
            fte_count: 1,
            hourly_rate: 50,
            start_month: 1,
            end_month: 3,
          },
        ],
        non_labor_estimates: [
          {
            rubroId: "GSV-REU",
            category: "Software",
            description: "Cloud subscription",
            amount: 1000,
            one_time: true,
            start_month: 2,
          },
        ],
      },
    });

    const inMemoryDb: Record<string, any>[] = [];

    const fakeSend = async (command: any) => {
      const commandName = command?.constructor?.name;
      
      if (commandName === 'QueryCommand') {
        const pk = command.input.ExpressionAttributeValues?.[":pk"];
        const skPrefix = command.input.ExpressionAttributeValues?.[":sk"] || "";
        const items = inMemoryDb.filter(
          (item) => item.pk === pk && typeof item.sk === "string" && item.sk.startsWith(skPrefix)
        );
        return { Items: items };
      }

      if (commandName === 'PutCommand') {
        inMemoryDb.push(command.input.Item);
        return {};
      }

      throw new Error(`Unexpected command: ${commandName}`);
    };

    const seedResult = await seedLineItemsFromBaseline(projectId, baseline, baselineId, {
      send: fakeSend,
      tableName: () => "rubros",
    });

    assert.equal(seedResult.seeded, 2, "should seed labor and non-labor rubros");
    assert.equal(inMemoryDb.length, 2, "rubros table should contain seeded items");

    const baselineTagged = inMemoryDb.every(
      (item) => item.metadata?.baseline_id === baselineId && item.pk === `PROJECT#${projectId}`
    );
    assert.ok(baselineTagged, "rubros should preserve baseline lineage in metadata");

    const attachments = inMemoryDb.map((item) => ({
      ...(item as Record<string, any>),
      rubroId: item.rubroId,
    })) as Array<Record<string, any>>;

    // Simulate forecast fallback path for seeded rubros
    const months = 6;
    const forecastData = [] as Array<{ line_item_id: string; month: number; planned: number }>;

    for (const attachment of attachments) {
      const rubroId = (attachment.rubroId as string) || (attachment.sk as string) || "unknown";
      const qty = Number(attachment.qty ?? 1) || 1;
      const unitCost = Number(attachment.unit_cost ?? attachment.total_cost ?? 0) || 0;
      const startMonth = Math.min(Math.max(Number(attachment.start_month ?? 1) || 1, 1), months);
      const endMonth = Math.min(
        Math.max(Number(attachment.end_month ?? startMonth) || startMonth, startMonth),
        months
      );
      const recurring = Boolean(attachment.recurring && !attachment.one_time);
      const baseCost = qty * unitCost;
      const monthsToMaterialize = recurring ? Math.max(endMonth - startMonth + 1, 1) : 1;

      for (let idx = 0; idx < monthsToMaterialize; idx += 1) {
        const month = startMonth + idx;
        if (month > months) break;

        forecastData.push({
          line_item_id: rubroId.replace(/^RUBRO#/, ""),
          month,
          planned: baseCost,
        });
      }
    }

    assert.ok(forecastData.length > 0, "forecast fallback should produce monthly cells");
    const distinctLineItems = new Set(forecastData.map((cell) => cell.line_item_id));
    assert.equal(distinctLineItems.size, 2, "both rubros should materialize into forecast cells");
  });
});
