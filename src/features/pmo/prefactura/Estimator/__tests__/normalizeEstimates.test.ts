/**
 * Tests for normalizeEstimates utility
 * 
 * Validates that:
 * - Labor and NonLabor estimates are normalized to canonical DB shape
 * - Canonical line_item_id is set correctly
 * - Description and category are populated from taxonomy
 * - User overrides are preserved
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeLaborEstimate,
  normalizeNonLaborEstimate,
  normalizeLaborEstimates,
  normalizeNonLaborEstimates,
} from "../utils/normalizeEstimates";
import type { LaborEstimate, NonLaborEstimate } from "@/types/domain";

describe("normalizeLaborEstimate", () => {
  it("should normalize labor estimate with canonical ID", () => {
    const input: LaborEstimate = {
      rubroId: "MOD-LEAD",
      role: "Ingeniero Delivery",
      country: "Colombia",
      level: "senior",
      fte_count: 1,
      hourly_rate: 6000,
      hours_per_month: 160,
      on_cost_percentage: 25,
      start_month: 1,
      end_month: 12,
    };

    const result = normalizeLaborEstimate(input);

    // Should have canonical line_item_id
    assert.equal(result.line_item_id, "MOD-LEAD");
    assert.equal(result.linea_codigo, "MOD-LEAD");
    assert.equal(result.rubro_canonical, "MOD-LEAD");
    
    // Should populate description from taxonomy
    assert.ok(result.descripcion, "descripcion should be populated");
    assert.ok(result.categoria, "categoria should be populated");
    
    // Should preserve original fields
    assert.equal(result.role, "Ingeniero Delivery");
    assert.equal(result.fte_count, 1);
  });

  it("should resolve legacy ID to canonical", () => {
    const input: LaborEstimate = {
      rubroId: "mod-lead-ingeniero-delivery", // Legacy ID
      role: "Ingeniero Delivery",
      country: "Colombia",
      level: "senior",
      fte_count: 1,
      hourly_rate: 6000,
      hours_per_month: 160,
      on_cost_percentage: 25,
      start_month: 1,
      end_month: 12,
    };

    const result = normalizeLaborEstimate(input);

    // Should resolve to canonical MOD-LEAD
    assert.equal(result.line_item_id, "MOD-LEAD");
    assert.equal(result.rubro_canonical, "MOD-LEAD");
  });

  it("should preserve user-provided description", () => {
    const input: any = {
      rubroId: "MOD-ING",
      role: "Ingeniero Soporte N1",
      country: "Colombia",
      level: "mid",
      fte_count: 1,
      hourly_rate: 4000,
      hours_per_month: 160,
      on_cost_percentage: 25,
      start_month: 1,
      end_month: 12,
      description: "Custom engineer description", // User override
      category: "Custom category",
    };

    const result = normalizeLaborEstimate(input);

    // Should preserve user description
    assert.equal(result.descripcion, "Custom engineer description");
    assert.equal(result.description, "Custom engineer description");
    assert.equal(result.category, "Custom category");
  });

  it("should handle array of labor estimates", () => {
    const input: LaborEstimate[] = [
      {
        rubroId: "MOD-LEAD",
        role: "Ingeniero Delivery",
        country: "Colombia",
        level: "senior",
        fte_count: 1,
        hourly_rate: 6000,
        hours_per_month: 160,
        on_cost_percentage: 25,
        start_month: 1,
        end_month: 12,
      },
      {
        rubroId: "MOD-SDM",
        role: "Service Delivery Manager",
        country: "Colombia",
        level: "lead",
        fte_count: 1,
        hourly_rate: 8500,
        hours_per_month: 160,
        on_cost_percentage: 30,
        start_month: 1,
        end_month: 12,
      },
    ];

    const result = normalizeLaborEstimates(input);

    assert.equal(result.length, 2);
    assert.equal(result[0].line_item_id, "MOD-LEAD");
    assert.equal(result[1].line_item_id, "MOD-SDM");
  });
});

describe("normalizeNonLaborEstimate", () => {
  it("should normalize non-labor estimate with canonical ID", () => {
    const input: NonLaborEstimate = {
      rubroId: "INF-CLOUD",
      category: "Infraestructura",
      description: "AWS Cloud Infrastructure",
      amount: 5000,
      currency: "USD",
      one_time: false,
      start_month: 1,
      end_month: 12,
      capex_flag: false,
    };

    const result = normalizeNonLaborEstimate(input);

    // Should have canonical line_item_id
    assert.equal(result.line_item_id, "INF-CLOUD");
    assert.equal(result.rubro_canonical, "INF-CLOUD");
    
    // Should populate fields
    assert.ok(result.descripcion, "descripcion should be populated");
    assert.ok(result.categoria, "categoria should be populated");
    
    // Should preserve original fields
    assert.equal(result.amount, 5000);
    assert.equal(result.one_time, false);
  });

  it("should resolve legacy ID to canonical", () => {
    const input: NonLaborEstimate = {
      rubroId: "RUBRO-AWS-INFRA", // Legacy ID
      category: "Infraestructura",
      description: "Cloud services",
      amount: 5000,
      currency: "USD",
      one_time: false,
      capex_flag: false,
    };

    const result = normalizeNonLaborEstimate(input);

    // Should resolve to canonical INF-CLOUD
    assert.equal(result.line_item_id, "INF-CLOUD");
    assert.equal(result.rubro_canonical, "INF-CLOUD");
  });

  it("should preserve user-provided description", () => {
    const input: NonLaborEstimate = {
      rubroId: "GSV-REU",
      category: "Servicios",
      description: "Custom meeting description", // User override
      amount: 1000,
      currency: "USD",
      one_time: true,
      capex_flag: false,
    };

    const result = normalizeNonLaborEstimate(input);

    // Should preserve user description
    assert.equal(result.descripcion, "Custom meeting description");
    assert.equal(result.description, "Custom meeting description");
  });

  it("should handle array of non-labor estimates", () => {
    const input: NonLaborEstimate[] = [
      {
        rubroId: "INF-CLOUD",
        category: "Infraestructura",
        description: "AWS",
        amount: 5000,
        currency: "USD",
        one_time: false,
        capex_flag: false,
      },
      {
        rubroId: "TEC-LIC-MON",
        category: "Tecnología",
        description: "Software licenses",
        amount: 2000,
        currency: "USD",
        one_time: false,
        capex_flag: false,
      },
    ];

    const result = normalizeNonLaborEstimates(input);

    assert.equal(result.length, 2);
    assert.equal(result[0].line_item_id, "INF-CLOUD");
    assert.equal(result[1].line_item_id, "TEC-LIC-MON");
  });

  it("should handle one-time and capex flags", () => {
    const input: NonLaborEstimate = {
      rubroId: "TEC-HW-FIELD",
      category: "Tecnología",
      description: "Field equipment purchase",
      amount: 50000,
      currency: "USD",
      one_time: true,
      capex_flag: true,
    };

    const result = normalizeNonLaborEstimate(input);

    assert.equal(result.one_time, true);
    assert.equal(result.capex_flag, true);
    assert.equal(result.line_item_id, "TEC-HW-FIELD");
  });
});
