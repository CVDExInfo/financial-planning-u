import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getCanonicalRubroId } from "../canonical-taxonomy";

describe("getCanonicalRubroId - alias mapping", () => {
  it("should map category-suffixed patterns to canonical IDs", () => {
    assert.strictEqual(
      getCanonicalRubroId("tec-hw-rpl-equipos-y-tecnologia"),
      "TEC-HW-RPL"
    );
    
    assert.strictEqual(
      getCanonicalRubroId("inf-cloud-infraestructura-nube-data-center"),
      "INF-CLOUD"
    );
  });

  it("should map Service Delivery Manager variations", () => {
    assert.strictEqual(
      getCanonicalRubroId("Service Delivery Manager"),
      "MOD-SDM"
    );
    
    assert.strictEqual(
      getCanonicalRubroId("service-delivery-manager"),
      "MOD-SDM"
    );
    
    assert.strictEqual(
      getCanonicalRubroId("SDM"),
      "MOD-SDM"
    );
  });

  it("should map legacy RB IDs to canonical IDs", () => {
    assert.strictEqual(getCanonicalRubroId("RB0001"), "MOD-ING");
    assert.strictEqual(getCanonicalRubroId("RB0003"), "MOD-SDM");
    assert.strictEqual(getCanonicalRubroId("RB0020"), "TEC-HW-RPL");
  });

  it("should return canonical IDs unchanged", () => {
    assert.strictEqual(getCanonicalRubroId("MOD-ING"), "MOD-ING");
    assert.strictEqual(getCanonicalRubroId("MOD-SDM"), "MOD-SDM");
    assert.strictEqual(getCanonicalRubroId("TEC-HW-RPL"), "TEC-HW-RPL");
  });

  it("should map Project Manager variations", () => {
    assert.strictEqual(
      getCanonicalRubroId("Project Manager"),
      "MOD-LEAD"
    );
    
    assert.strictEqual(
      getCanonicalRubroId("project-manager"),
      "MOD-LEAD"
    );
  });
});
