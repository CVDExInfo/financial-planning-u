jest.mock("node:crypto", () => ({
  __esModule: true,
  default: { randomUUID: jest.fn() },
  randomUUID: jest.fn(),
}));

import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  MigrationContext,
  normalizeBaselineId,
  runMigration,
} from "../../scripts/migrate-handoff-baseline-projects";

class FakeDdb {
  constructor(private items: Record<string, any>[]) {}

  async send(command: any) {
    if (command instanceof ScanCommand) {
      const filter = command.input.FilterExpression as string | undefined;
      const values = command.input.ExpressionAttributeValues || {};
      let filtered = [...this.items];

      if (filter?.includes("begins_with(pk")) {
        const prefix = values[":pkPrefix"];
        filtered = filtered.filter(item => String(item.pk || "").startsWith(prefix));
      }

      if (filter === "pk = :pk") {
        const pkValue = values[":pk"];
        filtered = filtered.filter(item => item.pk === pkValue);
      }

      return { Items: filtered };
    }

    if (command instanceof PutCommand) {
      const item = command.input.Item;
      this.items = this.items.filter(existing => !(existing.pk === item.pk && existing.sk === item.sk));
      this.items.push({ ...item });
      return {};
    }

    if (command instanceof DeleteCommand) {
      const key = command.input.Key;
      this.items = this.items.filter(item => !(item.pk === key.pk && item.sk === key.sk));
      return {};
    }

    if (command instanceof UpdateCommand) {
      const { pk, sk } = command.input.Key;
      const record = this.items.find(item => item.pk === pk && item.sk === sk);
      if (record) {
        record.result = record.result || {};
        record.result.projectId = command.input.ExpressionAttributeValues[":newProjectId"];
      }
      return {};
    }

    if (command instanceof GetCommand) {
      const { pk, sk } = command.input.Key;
      const record = this.items.find(item => item.pk === pk && item.sk === sk);
      return { Item: record };
    }

    throw new Error(`Unsupported command: ${command.constructor.name}`);
  }

  getItems() {
    return this.items;
  }
}

const legacyFixture = () => [
  { pk: "PROJECT#P-LEGACY", sk: "METADATA", baseline_id: "base_latest", name: "Legacy" },
  { pk: "PROJECT#P-LEGACY", sk: "HANDOFF#handoff_a", handoffId: "handoff_a", baseline_id: "base_a" },
  { pk: "PROJECT#P-LEGACY", sk: "HANDOFF#handoff_b", handoffId: "handoff_b", baseline_id: "base_b" },
  { pk: "PROJECT#P-LEGACY", sk: "HANDOFF#handoff_latest", handoffId: "handoff_latest", baseline_id: "base_latest" },
  {
    pk: "IDEMPOTENCY#HANDOFF",
    sk: "idemp_a",
    result: { projectId: "P-LEGACY", baselineId: "base_a" },
  },
  {
    pk: "IDEMPOTENCY#HANDOFF",
    sk: "idemp_b",
    result: { projectId: "P-LEGACY", baselineId: "base_b" },
  },
];

describe("migrate-handoff-baseline-projects", () => {
  const cryptoMock = jest.requireMock("node:crypto") as { randomUUID: jest.Mock; default: { randomUUID: jest.Mock } };

  beforeEach(() => {
    cryptoMock.randomUUID.mockReset();
    cryptoMock.default.randomUUID.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("detects collisions in dry-run mode without mutating data", async () => {
    cryptoMock.randomUUID.mockReturnValueOnce("uuid-a").mockReturnValueOnce("uuid-b");
    cryptoMock.default.randomUUID.mockReturnValueOnce("uuid-a").mockReturnValueOnce("uuid-b");

    const fake = new FakeDdb(legacyFixture());
    const context: MigrationContext = { ddb: fake as any, tableName: "finz_projects_test", dryRun: true };

    const result = await runMigration(context);

    expect(result.projectsWithMultipleBaselines).toBe(1);
    expect(result.handoffsMigrated).toBe(2);
    expect(fake.getItems().filter(item => item.pk === "PROJECT#P-LEGACY").length).toBe(4);
  });

  it("splits collided handoffs into new projects and rewrites idempotency", async () => {
    cryptoMock.randomUUID.mockReturnValueOnce("uuid-a").mockReturnValueOnce("uuid-b");
    cryptoMock.default.randomUUID.mockReturnValueOnce("uuid-a").mockReturnValueOnce("uuid-b");

    const fake = new FakeDdb(legacyFixture());
    const context: MigrationContext = { ddb: fake as any, tableName: "finz_projects_test", dryRun: false };

    const result = await runMigration(context);

    const items = fake.getItems();
    const legacyHandoffs = items.filter(item => item.pk === "PROJECT#P-LEGACY" && item.sk.startsWith("HANDOFF#"));
    const legacyMetadata = items.find(item => item.pk === "PROJECT#P-LEGACY" && item.sk === "METADATA");

    expect(legacyMetadata?.baseline_id).toBe("base_latest");
    expect(legacyHandoffs).toHaveLength(1);
    expect(normalizeBaselineId(legacyHandoffs[0]!)).toBe("base_latest");

    const newProjectA = items.find(item => item.pk === "PROJECT#P-uuid-a" && item.sk === "METADATA");
    const newProjectB = items.find(item => item.pk === "PROJECT#P-uuid-b" && item.sk === "METADATA");

    expect(normalizeBaselineId(newProjectA!)).toBe("base_a");
    expect(normalizeBaselineId(newProjectB!)).toBe("base_b");

    const idempA = items.find(item => item.pk === "IDEMPOTENCY#HANDOFF" && item.sk === "idemp_a");
    const idempB = items.find(item => item.pk === "IDEMPOTENCY#HANDOFF" && item.sk === "idemp_b");

    expect(idempA?.result?.projectId).toBe("P-uuid-a");
    expect(idempB?.result?.projectId).toBe("P-uuid-b");

    expect(result.newProjectsCreated).toBe(2);
    expect(result.handoffsMigrated).toBe(2);
  });
});
