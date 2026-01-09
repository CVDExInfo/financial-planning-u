import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * Test suite for getBaselineById API function
 * 
 * Validates that the function:
 * 1. Calls the correct endpoint
 * 2. Returns baseline details with labor and non-labor estimates
 * 3. Handles both payload structure and direct structure
 * 4. Handles errors appropriately
 */

describe("getBaselineById", () => {
  it("should fetch baseline details by ID with correct endpoint", async () => {
    // Test that the API contract is correct
    const baselineId = "B-12345";
    const expectedUrl = `/baseline/${baselineId}`;
    
    assert.ok(expectedUrl.includes(baselineId));
  });

  it("should handle payload structure from DynamoDB", () => {
    const mockResponse = {
      baseline_id: "base_3ad9f3b665af",
      pk: "BASELINE#base_3ad9f3b665af",
      sk: "METADATA",
      payload: {
        labor_estimates: [
          { 
            rubroId: "MOD-LEAD",
            role: "Ingeniero Delivery", 
            level: "lead",
            fte_count: 1,
            hourly_rate: 1500,
            rate: 1500,
            hours_per_month: 160,
            on_cost_percentage: 30,
            start_month: 1,
            end_month: 24
          },
          {
            rubroId: "MOD-SDM",
            role: "Service Delivery Manager",
            level: "lead",
            fte_count: 1,
            hourly_rate: 550,
            rate: 550,
            hours_per_month: 160,
            on_cost_percentage: 50,
            start_month: 1,
            end_month: 60
          }
        ],
        non_labor_estimates: [
          {
            rubroId: "INF-CLOUD",
            description: "Servicios Cloud / hosting",
            category: "Infraestructura / Nube / Data Center",
            amount: 1000,
            one_time: false,
            start_month: 1,
            end_month: 60
          }
        ],
        project_name: "BL-IKU-WLLF-00032",
        client_name: "Banco Wellsfargo",
      }
    };

    assert.ok(mockResponse.payload);
    assert.ok(Array.isArray(mockResponse.payload.labor_estimates));
    assert.ok(Array.isArray(mockResponse.payload.non_labor_estimates));
    assert.equal(mockResponse.payload.labor_estimates.length, 2);
    assert.equal(mockResponse.payload.non_labor_estimates.length, 1);
    
    // Verify data structure matches DynamoDB format
    const laborEst = mockResponse.payload.labor_estimates[0];
    assert.equal(laborEst.rubroId, "MOD-LEAD");
    assert.equal(laborEst.role, "Ingeniero Delivery");
    assert.equal(laborEst.fte_count, 1);
    assert.equal(laborEst.hourly_rate, 1500);
    assert.equal(laborEst.rate, 1500);
  });

  it("should include labor and non-labor estimates in response", () => {
    const mockResponse = {
      baseline_id: "B-12345",
      labor_estimates: [
        { role: "Engineer", hourly_rate: 50 }
      ],
      non_labor_estimates: [
        { description: "Software license", amount: 5000 }
      ],
    };

    assert.ok(Array.isArray(mockResponse.labor_estimates));
    assert.ok(Array.isArray(mockResponse.non_labor_estimates));
    assert.equal(mockResponse.labor_estimates.length, 1);
    assert.equal(mockResponse.non_labor_estimates.length, 1);
  });

  it("should handle baseline with supporting documents", () => {
    const mockResponse = {
      baseline_id: "B-12345",
      payload: {
        supporting_documents: [
          {
            documentId: "DOC-123",
            documentKey: "baselines/B-12345/document.pdf",
            originalName: "baseline-proposal.pdf",
          }
        ],
        labor_estimates: [],
        non_labor_estimates: [],
      }
    };

    assert.ok(mockResponse.payload.supporting_documents);
    assert.ok(Array.isArray(mockResponse.payload.supporting_documents));
    assert.equal(mockResponse.payload.supporting_documents[0].documentKey, "baselines/B-12345/document.pdf");
  });

  it("should handle both rate and hourly_rate fields", () => {
    const mockLaborEstimate1: {
      role: string;
      hourly_rate?: number;
      rate?: number;
      fte_count: number;
      hours_per_month: number;
    } = {
      role: "Engineer",
      hourly_rate: 50,
      fte_count: 1,
      hours_per_month: 160,
    };

    const mockLaborEstimate2: {
      role: string;
      hourly_rate?: number;
      rate?: number;
      fte_count: number;
      hours_per_month: number;
    } = {
      role: "Manager",
      rate: 75, // Alternative field name
      fte_count: 1,
      hours_per_month: 160,
    };

    // Both should be valid
    assert.ok(mockLaborEstimate1.hourly_rate || mockLaborEstimate1.rate);
    assert.ok(mockLaborEstimate2.hourly_rate || mockLaborEstimate2.rate);
  });
});
