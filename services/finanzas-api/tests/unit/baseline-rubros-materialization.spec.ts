/**
 * Unit tests for baseline → rubros materialization with canonical taxonomy
 * 
 * Tests that labor and non-labor estimates properly materialize into rubros
 * with canonical linea_codigo from the rubros taxonomy.
 */

import { describe, it, expect } from "@jest/globals";

// Mock baseline data structures matching new schema
type LaborEstimate = {
  rubroId: string;
  role: string;
  country: string;
  level: string;
  fte_count: number;
  hourly_rate: number;
  hours_per_month: number;
  on_cost_percentage: number;
  start_month: number;
  end_month: number;
};

type NonLaborEstimate = {
  rubroId: string;
  category: string;
  description: string;
  amount: number;
  one_time: boolean;
  start_month?: number;
  end_month?: number;
  vendor?: string;
};

type RubroItem = {
  rubroId: string;
  nombre: string;
  descripcion?: string;
  category: string;
  qty: number;
  unit_cost: number;
  currency: string;
  recurring: boolean;
  one_time: boolean;
  start_month: number;
  end_month: number;
  total_cost: number;
  metadata: {
    source: string;
    baseline_id?: string;
    project_id?: string;
    linea_codigo?: string;
    role?: string;
    vendor?: string;
  };
};

/**
 * Simulates the generateLineItems function behavior with canonical taxonomy
 */
function generateLineItems(
  projectId: string,
  baselineId: string,
  laborEstimates: LaborEstimate[],
  nonLaborEstimates: NonLaborEstimate[],
  currency: string = "USD"
): RubroItem[] {
  const items: RubroItem[] = [];

  // Process labor estimates
  laborEstimates.forEach((estimate, index) => {
    const hoursPerMonth = estimate.hours_per_month;
    const fteCount = estimate.fte_count;
    const hourlyRate = estimate.hourly_rate;
    const onCostPct = estimate.on_cost_percentage;
    const baseCost = hoursPerMonth * fteCount * hourlyRate;
    const onCost = baseCost * (onCostPct / 100);
    const monthlyCost = baseCost + onCost;
    const startMonth = estimate.start_month;
    const endMonth = estimate.end_month;
    const months = endMonth - startMonth + 1;
    const totalCost = monthlyCost * months;

    // Use canonical rubroId from taxonomy
    const canonicalRubroId = estimate.rubroId || "MOD-ING";
    const rubroSK = `${canonicalRubroId}#${baselineId}#${index + 1}`;

    items.push({
      rubroId: rubroSK,
      nombre: estimate.role || canonicalRubroId,
      descripcion: `${estimate.role} (${estimate.level})`,
      category: "Labor",
      qty: 1,
      unit_cost: monthlyCost,
      currency,
      recurring: true,
      one_time: false,
      start_month: startMonth,
      end_month: endMonth,
      total_cost: totalCost,
      metadata: {
        source: "baseline",
        baseline_id: baselineId,
        project_id: projectId,
        linea_codigo: canonicalRubroId,
        role: estimate.role,
      },
    });
  });

  // Process non-labor estimates
  nonLaborEstimates.forEach((estimate, index) => {
    const amount = estimate.amount;
    const recurring = !estimate.one_time;
    const startMonth = estimate.start_month || 1;
    const endMonth = recurring ? (estimate.end_month || startMonth) : startMonth;
    const months = recurring ? endMonth - startMonth + 1 : 1;
    const totalCost = recurring ? amount * months : amount;

    // Use canonical rubroId from taxonomy
    const canonicalRubroId = estimate.rubroId || "GSV-REU";
    const rubroSK = `${canonicalRubroId}#${baselineId}#${index + 1}`;

    items.push({
      rubroId: rubroSK,
      nombre: estimate.description || estimate.category || canonicalRubroId,
      descripcion: estimate.description,
      category: estimate.category || "Non-labor",
      qty: 1,
      unit_cost: amount,
      currency,
      recurring,
      one_time: !recurring,
      start_month: startMonth,
      end_month: endMonth,
      total_cost: totalCost,
      metadata: {
        source: "baseline",
        baseline_id: baselineId,
        project_id: projectId,
        linea_codigo: canonicalRubroId,
        vendor: estimate.vendor,
      },
    });
  });

  return items;
}

describe("Baseline → Rubros Materialization with Canonical Taxonomy", () => {
  const TEST_PROJECT_ID = "PRJ-TEST";
  const TEST_BASELINE_ID = "base_abc123def456";

  describe("Labor estimates → rubros", () => {
    it("should materialize labor estimate with canonical MOD-LEAD rubroId", () => {
      const laborEstimates: LaborEstimate[] = [
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
      ];

      const rubros = generateLineItems(
        TEST_PROJECT_ID,
        TEST_BASELINE_ID,
        laborEstimates,
        [],
        "USD"
      );

      expect(rubros).toHaveLength(1);
      const rubro = rubros[0];

      // Check rubroId format includes canonical code
      expect(rubro.rubroId).toBe(`MOD-LEAD#${TEST_BASELINE_ID}#1`);
      
      // Check metadata contains canonical linea_codigo
      expect(rubro.metadata.linea_codigo).toBe("MOD-LEAD");
      expect(rubro.metadata.baseline_id).toBe(TEST_BASELINE_ID);
      expect(rubro.metadata.project_id).toBe(TEST_PROJECT_ID);
      expect(rubro.metadata.source).toBe("baseline");

      // Check cost calculation
      const baseCost = 160 * 1 * 6000; // 960,000
      const onCost = baseCost * 0.25; // 240,000
      const monthlyCost = baseCost + onCost; // 1,200,000
      const totalCost = monthlyCost * 12; // 14,400,000

      expect(rubro.unit_cost).toBe(monthlyCost);
      expect(rubro.total_cost).toBe(totalCost);
      expect(rubro.recurring).toBe(true);
      expect(rubro.one_time).toBe(false);
    });

    it("should materialize multiple labor estimates with different canonical codes", () => {
      const laborEstimates: LaborEstimate[] = [
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
          rubroId: "MOD-ING",
          role: "Ingeniero Soporte N2",
          country: "Colombia",
          level: "mid",
          fte_count: 2,
          hourly_rate: 4000,
          hours_per_month: 160,
          on_cost_percentage: 25,
          start_month: 1,
          end_month: 12,
        },
        {
          rubroId: "MOD-SDM",
          role: "Service Delivery Manager",
          country: "USA",
          level: "senior",
          fte_count: 1,
          hourly_rate: 12000,
          hours_per_month: 160,
          on_cost_percentage: 35,
          start_month: 1,
          end_month: 12,
        },
      ];

      const rubros = generateLineItems(
        TEST_PROJECT_ID,
        TEST_BASELINE_ID,
        laborEstimates,
        [],
        "USD"
      );

      expect(rubros).toHaveLength(3);

      // Check each rubro has correct canonical code
      expect(rubros[0].metadata.linea_codigo).toBe("MOD-LEAD");
      expect(rubros[1].metadata.linea_codigo).toBe("MOD-ING");
      expect(rubros[2].metadata.linea_codigo).toBe("MOD-SDM");

      // Check rubroIds are unique but contain canonical codes
      expect(rubros[0].rubroId).toContain("MOD-LEAD");
      expect(rubros[1].rubroId).toContain("MOD-ING");
      expect(rubros[2].rubroId).toContain("MOD-SDM");
    });

    it("should handle labor estimate without rubroId (backward compatibility)", () => {
      const laborEstimates: LaborEstimate[] = [
        {
          rubroId: "", // Empty rubroId
          role: "Ingeniero Soporte",
          country: "Colombia",
          level: "junior",
          fte_count: 1,
          hourly_rate: 3000,
          hours_per_month: 160,
          on_cost_percentage: 25,
          start_month: 1,
          end_month: 12,
        },
      ];

      const rubros = generateLineItems(
        TEST_PROJECT_ID,
        TEST_BASELINE_ID,
        laborEstimates,
        [],
        "USD"
      );

      expect(rubros).toHaveLength(1);
      
      // Should default to MOD-ING
      expect(rubros[0].metadata.linea_codigo).toBe("MOD-ING");
      expect(rubros[0].rubroId).toContain("MOD-ING");
    });
  });

  describe("Non-labor estimates → rubros", () => {
    it("should materialize non-labor estimate with canonical GSV-REU rubroId", () => {
      const nonLaborEstimates: NonLaborEstimate[] = [
        {
          rubroId: "GSV-REU",
          category: "Gestión del Servicio",
          description: "Reuniones de seguimiento",
          amount: 1000,
          one_time: false,
          start_month: 1,
          end_month: 12,
        },
      ];

      const rubros = generateLineItems(
        TEST_PROJECT_ID,
        TEST_BASELINE_ID,
        [],
        nonLaborEstimates,
        "USD"
      );

      expect(rubros).toHaveLength(1);
      const rubro = rubros[0];

      // Check rubroId format includes canonical code
      expect(rubro.rubroId).toBe(`GSV-REU#${TEST_BASELINE_ID}#1`);
      
      // Check metadata contains canonical linea_codigo
      expect(rubro.metadata.linea_codigo).toBe("GSV-REU");
      expect(rubro.metadata.baseline_id).toBe(TEST_BASELINE_ID);
      expect(rubro.metadata.project_id).toBe(TEST_PROJECT_ID);

      // Check cost calculation for recurring item
      expect(rubro.unit_cost).toBe(1000);
      expect(rubro.total_cost).toBe(12000); // 1000 × 12 months
      expect(rubro.recurring).toBe(true);
      expect(rubro.one_time).toBe(false);
    });

    it("should materialize one-time non-labor estimate", () => {
      const nonLaborEstimates: NonLaborEstimate[] = [
        {
          rubroId: "SOI-AWS",
          category: "Soporte e Infraestructura",
          description: "AWS Infrastructure Setup",
          amount: 5000,
          one_time: true,
          start_month: 1,
        },
      ];

      const rubros = generateLineItems(
        TEST_PROJECT_ID,
        TEST_BASELINE_ID,
        [],
        nonLaborEstimates,
        "USD"
      );

      expect(rubros).toHaveLength(1);
      const rubro = rubros[0];

      // Check one-time flags
      expect(rubro.one_time).toBe(true);
      expect(rubro.recurring).toBe(false);
      
      // Check cost is not multiplied for one-time
      expect(rubro.unit_cost).toBe(5000);
      expect(rubro.total_cost).toBe(5000);
      expect(rubro.start_month).toBe(1);
      expect(rubro.end_month).toBe(1);
    });

    it("should materialize mixed recurring and one-time estimates", () => {
      const nonLaborEstimates: NonLaborEstimate[] = [
        {
          rubroId: "GSV-REU",
          category: "Gestión del Servicio",
          description: "Monthly meetings",
          amount: 500,
          one_time: false,
          start_month: 1,
          end_month: 12,
        },
        {
          rubroId: "SOI-AWS",
          category: "Soporte e Infraestructura",
          description: "One-time setup",
          amount: 3000,
          one_time: true,
          start_month: 1,
        },
        {
          rubroId: "SEC-AUDIT",
          category: "Seguridad y Cumplimiento",
          description: "Quarterly audits",
          amount: 2000,
          one_time: false,
          start_month: 1,
          end_month: 12,
        },
      ];

      const rubros = generateLineItems(
        TEST_PROJECT_ID,
        TEST_BASELINE_ID,
        [],
        nonLaborEstimates,
        "USD"
      );

      expect(rubros).toHaveLength(3);

      // Check canonical codes
      expect(rubros[0].metadata.linea_codigo).toBe("GSV-REU");
      expect(rubros[1].metadata.linea_codigo).toBe("SOI-AWS");
      expect(rubros[2].metadata.linea_codigo).toBe("SEC-AUDIT");

      // Check recurring vs one-time
      expect(rubros[0].recurring).toBe(true);
      expect(rubros[0].total_cost).toBe(6000); // 500 × 12

      expect(rubros[1].one_time).toBe(true);
      expect(rubros[1].total_cost).toBe(3000); // one-time

      expect(rubros[2].recurring).toBe(true);
      expect(rubros[2].total_cost).toBe(24000); // 2000 × 12
    });
  });

  describe("Combined labor + non-labor materialization", () => {
    it("should materialize complete baseline with labor and non-labor", () => {
      const laborEstimates: LaborEstimate[] = [
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
          rubroId: "MOD-ING",
          role: "Ingeniero Soporte N2",
          country: "Colombia",
          level: "mid",
          fte_count: 2,
          hourly_rate: 4000,
          hours_per_month: 160,
          on_cost_percentage: 25,
          start_month: 1,
          end_month: 12,
        },
      ];

      const nonLaborEstimates: NonLaborEstimate[] = [
        {
          rubroId: "GSV-REU",
          category: "Gestión del Servicio",
          description: "Reuniones de seguimiento",
          amount: 1000,
          one_time: false,
          start_month: 1,
          end_month: 12,
        },
        {
          rubroId: "SOI-AWS",
          category: "Soporte e Infraestructura",
          description: "AWS Cloud Services",
          amount: 2000,
          one_time: false,
          start_month: 1,
          end_month: 12,
        },
      ];

      const rubros = generateLineItems(
        TEST_PROJECT_ID,
        TEST_BASELINE_ID,
        laborEstimates,
        nonLaborEstimates,
        "USD"
      );

      expect(rubros).toHaveLength(4);

      // Check all have baseline metadata
      rubros.forEach((rubro) => {
        expect(rubro.metadata.baseline_id).toBe(TEST_BASELINE_ID);
        expect(rubro.metadata.project_id).toBe(TEST_PROJECT_ID);
        expect(rubro.metadata.source).toBe("baseline");
        expect(rubro.metadata.linea_codigo).toBeTruthy();
      });

      // Check labor rubros (first 2)
      expect(rubros[0].category).toBe("Labor");
      expect(rubros[1].category).toBe("Labor");

      // Check non-labor rubros (last 2)
      expect(rubros[2].category).toBe("Gestión del Servicio");
      expect(rubros[3].category).toBe("Soporte e Infraestructura");

      // Verify total cost calculation
      const totalLaborCost = rubros
        .filter((r) => r.category === "Labor")
        .reduce((sum, r) => sum + r.total_cost, 0);

      const totalNonLaborCost = rubros
        .filter((r) => r.category !== "Labor")
        .reduce((sum, r) => sum + r.total_cost, 0);

      expect(totalLaborCost).toBeGreaterThan(0);
      expect(totalNonLaborCost).toBeGreaterThan(0);
    });
  });
});
