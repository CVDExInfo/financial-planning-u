import assert from "node:assert/strict";
import test from "node:test";
import { batchGetExistingItems } from "../dynamodbHelpers";

test("batchGetExistingItems returns empty array for empty keys", async () => {
  const result = await batchGetExistingItems("test-table", []);
  assert.deepEqual(result, []);
});

test("batchGetExistingItems validates function exists and has correct signature", () => {
  assert.equal(typeof batchGetExistingItems, "function");
  assert.equal(batchGetExistingItems.length, 2); // expects 2 parameters
});
