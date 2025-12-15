import assert from "node:assert/strict";
import test, { mock } from "node:test";
import crypto from "node:crypto";
import { GetCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import {
  resolveProjectForHandoff,
  IdempotencyConflictError,
} from "../projects-handoff";

type FakeOptions = {
  items?: Record<string, Record<string, unknown>>;
  scanResponses?: Record<string, unknown>[][];
};

class FakeDdb {
  private items: Map<string, Record<string, unknown>>;
  private scanResponses: Record<string, unknown>[][];

  constructor(options: FakeOptions = {}) {
    this.items = new Map(Object.entries(options.items ?? {}));
    this.scanResponses = options.scanResponses ?? [];
  }

  async send(command: unknown) {
    if (command instanceof GetCommand) {
      const { Key, TableName } = command.input;
      if (!Key || !TableName) return {};
      const key = `${Key.pk}|${Key.sk}`;
      return { Item: this.items.get(key) };
    }

    if (command instanceof ScanCommand) {
      const response = this.scanResponses.shift() ?? [];
      return { Items: response };
    }

    throw new Error(`Unsupported command in FakeDdb: ${String(command)}`);
  }
}

test("reuses existing project when baseline already mapped", async () => {
  const ddb = new FakeDdb({
    scanResponses: [
      [
        {
          pk: "PROJECT#P-existing",
          sk: "METADATA",
          baseline_id: "base-123",
        },
      ],
    ],
  });

  const result = await resolveProjectForHandoff({
    ddb: ddb as never,
    tableName: () => "projects-table",
    incomingProjectId: "P-from-path",
    baselineId: "base-123",
    idempotencyKey: "idem-1",
  });

  assert.equal(result.resolvedProjectId, "P-existing");
  assert.equal(result.strategy, "reuse-existing-baseline");
  assert.equal(result.isNewProject, false);
});

test("creates new project when incoming project owns different baseline", async () => {
  const randomMock = mock.method(crypto, "randomUUID", () => "uuid-new");

  const ddb = new FakeDdb({
    items: {
      "PROJECT#P-from-path|METADATA": {
        pk: "PROJECT#P-from-path",
        sk: "METADATA",
        baseline_id: "base-old",
      },
    },
    scanResponses: [[]],
  });

  const result = await resolveProjectForHandoff({
    ddb: ddb as never,
    tableName: () => "projects-table",
    incomingProjectId: "P-from-path",
    baselineId: "base-new",
    idempotencyKey: "idem-2",
  });

  assert.equal(result.resolvedProjectId, "P-uuid-new");
  assert.equal(result.strategy, "create-new-project");
  assert.equal(result.isNewProject, true);

  randomMock.mock.restore();
});

test("throws idempotency conflict when baseline differs for same key", async () => {
  const ddb = new FakeDdb({
    items: {
      "IDEMPOTENCY#HANDOFF|idem-3": {
        pk: "IDEMPOTENCY#HANDOFF",
        sk: "idem-3",
        result: { projectId: "P-1", baselineId: "base-a" },
      },
    },
    scanResponses: [[]],
  });

  await assert.rejects(
    () =>
      resolveProjectForHandoff({
        ddb: ddb as never,
        tableName: () => "projects-table",
        incomingProjectId: "P-from-path",
        baselineId: "base-b",
        idempotencyKey: "idem-3",
      }),
    (error: unknown) => error instanceof IdempotencyConflictError
  );
});
