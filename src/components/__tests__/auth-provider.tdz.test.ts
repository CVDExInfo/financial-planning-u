import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

describe("AuthProvider TDZ order", () => {
  it("declares initializeAuth before first usage", () => {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const targetPath = path.resolve(__dirname, "..", "AuthProvider.tsx");
    const content = fs.readFileSync(targetPath, "utf8");

    const initIndex = content.indexOf("function initializeAuth");
    const firstCallIndex = content.indexOf("void initializeAuth()");

    assert.ok(initIndex !== -1, "initializeAuth should be declared");
    assert.ok(firstCallIndex !== -1, "initializeAuth should be referenced");
    assert.ok(
      initIndex < firstCallIndex,
      "initializeAuth should be declared before it is first used",
    );
  });
});
