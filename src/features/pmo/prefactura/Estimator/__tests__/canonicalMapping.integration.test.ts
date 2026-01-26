/**
 * Integration test for PMO Estimator canonical mapping
 * 
 * This test validates the end-to-end flow of:
 * 1. Selecting a role in LaborStep
 * 2. Auto-populating description and category
 * 3. Normalizing to canonical DB shape
 * 4. Validating canonical IDs
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getCanonicalRubroId } from "@/lib/rubros/canonical-taxonomy";
import { getRubroById } from "@/lib/rubros/taxonomyHelpers";
import { mapModRoleToRubroId, type MODRole } from "@/api/helpers/rubros";
import { normalizeLaborEstimate, normalizeNonLaborEstimate } from "../utils/normalizeEstimates";

describe("PMO Estimator canonical mapping integration", () => {
  describe("Role to canonical ID mapping", () => {
    it("should map 'Ingeniero Delivery' to canonical MOD-LEAD", () => {
      const role: MODRole = "Ingeniero Delivery";
      const rubroId = mapModRoleToRubroId(role);
      
      assert.equal(rubroId, "MOD-LEAD", "Should return canonical MOD-LEAD");
    });

    it("should map 'Service Delivery Manager' to canonical MOD-SDM", () => {
      const role: MODRole = "Service Delivery Manager";
      const rubroId = mapModRoleToRubroId(role);
      
      assert.equal(rubroId, "MOD-SDM", "Should return canonical MOD-SDM");
    });

    it("should map 'Project Manager' to canonical MOD-LEAD", () => {
      const role: MODRole = "Project Manager";
      const rubroId = mapModRoleToRubroId(role);
      
      // Note: PM maps to MOD-LEAD since MOD-PMO doesn't exist in canonical taxonomy
      assert.equal(rubroId, "MOD-LEAD", "Should return canonical MOD-LEAD");
    });
  });

  describe("Taxonomy lookup for auto-population", () => {
    it("should retrieve taxonomy entry for MOD-LEAD", () => {
      const tax = getRubroById("MOD-LEAD");
      
      assert.ok(tax, "Should find taxonomy entry");
      assert.equal(tax?.linea_codigo, "MOD-LEAD");
      assert.ok(tax?.descripcion || tax?.linea_gasto, "Should have description");
      assert.ok(tax?.categoria, "Should have categoria");
    });

    it("should retrieve taxonomy entry for INF-CLOUD", () => {
      const tax = getRubroById("INF-CLOUD");
      
      assert.ok(tax, "Should find taxonomy entry");
      assert.equal(tax?.linea_codigo, "INF-CLOUD");
      assert.ok(tax?.descripcion || tax?.linea_gasto, "Should have description");
    });
  });

  describe("Legacy ID resolution", () => {
    it("should resolve legacy 'mod-lead-ingeniero-delivery' to MOD-LEAD", () => {
      const canonical = getCanonicalRubroId("mod-lead-ingeniero-delivery");
      assert.equal(canonical, "MOD-LEAD");
    });

    it("should resolve legacy 'RUBRO-AWS-INFRA' to INF-CLOUD", () => {
      const canonical = getCanonicalRubroId("RUBRO-AWS-INFRA");
      assert.equal(canonical, "INF-CLOUD");
    });

    it("should resolve legacy 'project-manager' to MOD-LEAD", () => {
      const canonical = getCanonicalRubroId("project-manager");
      assert.equal(canonical, "MOD-LEAD");
    });
  });

  describe("End-to-end labor flow", () => {
    it("should complete full flow: role -> canonical ID -> auto-populate -> normalize", () => {
      // Step 1: User selects role
      const role: MODRole = "Ingeniero Delivery";
      
      // Step 2: Map to canonical ID
      const rubroId = mapModRoleToRubroId(role);
      assert.equal(rubroId, "MOD-LEAD");
      
      // Step 3: Fetch taxonomy for auto-population
      const tax = getRubroById(rubroId!);
      assert.ok(tax, "Should find taxonomy entry");
      
      // Step 4: Create labor estimate (simulating UI state)
      const estimate: any = {
        rubroId: rubroId,
        role: role,
        country: "Colombia",
        level: "senior",
        fte_count: 1,
        hourly_rate: 6000,
        hours_per_month: 160,
        on_cost_percentage: 25,
        start_month: 1,
        end_month: 12,
        // Description would be auto-populated from tax
        description: tax?.descripcion || tax?.linea_gasto || role,
        category: tax?.categoria || "",
      };
      
      // Step 5: Normalize for DB submission
      const normalized = normalizeLaborEstimate(estimate);
      
      // Validate normalized result
      assert.equal(normalized.line_item_id, "MOD-LEAD", "line_item_id should be canonical");
      assert.equal(normalized.linea_codigo, "MOD-LEAD", "linea_codigo should be canonical");
      assert.equal(normalized.rubro_canonical, "MOD-LEAD", "rubro_canonical should be set");
      assert.ok(normalized.descripcion, "descripcion should be populated");
      assert.ok(normalized.categoria, "categoria should be populated");
    });
  });

  describe("End-to-end non-labor flow", () => {
    it("should complete full flow: rubro -> canonical ID -> auto-populate -> normalize", () => {
      // Step 1: User selects rubro (could be legacy or canonical)
      const selectedRubroId = "INF-CLOUD";
      
      // Step 2: Canonicalize (already canonical in this case)
      const canonical = getCanonicalRubroId(selectedRubroId);
      assert.equal(canonical, "INF-CLOUD");
      
      // Step 3: Fetch taxonomy for auto-population
      const tax = getRubroById(canonical!);
      assert.ok(tax, "Should find taxonomy entry");
      
      // Step 4: Create non-labor estimate (simulating UI state)
      const estimate: any = {
        rubroId: canonical,
        category: tax?.categoria || "",
        description: tax?.descripcion || tax?.linea_gasto || "",
        amount: 5000,
        currency: "USD",
        one_time: false,
        start_month: 1,
        end_month: 12,
        capex_flag: false,
      };
      
      // Step 5: Normalize for DB submission
      const normalized = normalizeNonLaborEstimate(estimate);
      
      // Validate normalized result
      assert.equal(normalized.line_item_id, "INF-CLOUD", "line_item_id should be canonical");
      assert.equal(normalized.rubro_canonical, "INF-CLOUD", "rubro_canonical should be set");
      assert.ok(normalized.descripcion, "descripcion should be populated");
      assert.ok(normalized.categoria, "categoria should be populated");
    });
  });

  describe("Validation", () => {
    it("should validate that all common labor rubros are canonical", () => {
      const roles: MODRole[] = [
        "Ingeniero Delivery",
        "Service Delivery Manager",
        "Project Manager",
        "Ingeniero Soporte N1",
        "Ingeniero Soporte N2",
        "Ingeniero Soporte N3",
      ];
      
      roles.forEach(role => {
        const rubroId = mapModRoleToRubroId(role);
        assert.ok(rubroId, `${role} should map to a rubroId`);
        
        const canonical = getCanonicalRubroId(rubroId!);
        assert.ok(canonical, `${rubroId} should be canonical or resolvable`);
      });
    });

    it("should validate that common non-labor rubros are canonical", () => {
      const rubros = ["INF-CLOUD", "TEC-LIC-MON", "GSV-REU", "TEC-HW-FIELD"];
      
      rubros.forEach(rubro => {
        const canonical = getCanonicalRubroId(rubro);
        assert.ok(canonical, `${rubro} should be canonical`);
        assert.equal(canonical, rubro, `${rubro} should already be canonical`);
      });
    });
  });
});
