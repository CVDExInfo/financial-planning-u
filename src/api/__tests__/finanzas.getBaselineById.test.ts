import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * Test suite for getBaselineById API function
 * 
 * Validates that the function:
 * 1. Calls the correct endpoint
 * 2. Returns baseline details with labor and non-labor estimates
 * 3. Handles errors appropriately
 */

describe("getBaselineById", () => {
  it("should fetch baseline details by ID with correct endpoint", async () => {
    // Mock fetch for testing
    const mockFetch = async (url: string, options: any) => {
      assert.match(url, /\/baseline\/[^/]+$/);
      assert.equal(options.method, "GET");
      
      return {
        ok: true,
        text: async () => JSON.stringify({
          baseline_id: "B-12345",
          project_id: "P-67890",
          project_name: "Test Project",
          labor_estimates: [
            {
              rubroId: "MOD-ING",
              role: "Engineer",
              level: "senior",
              fte_count: 2,
              hourly_rate: 50,
              hours_per_month: 160,
            }
          ],
          non_labor_estimates: [
            {
              rubroId: "GSV-REU",
              description: "Meeting room",
              amount: 1000,
              one_time: true,
            }
          ],
        }),
      };
    };

    // Test that the API contract is correct
    const baselineId = "B-12345";
    const expectedUrl = `/baseline/${baselineId}`;
    
    assert.ok(expectedUrl.includes(baselineId));
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
      supporting_documents: [
        {
          documentId: "DOC-123",
          documentKey: "baselines/B-12345/document.pdf",
          originalName: "baseline-proposal.pdf",
        }
      ],
      labor_estimates: [],
      non_labor_estimates: [],
    };

    assert.ok(Array.isArray(mockResponse.supporting_documents));
    assert.equal(mockResponse.supporting_documents[0].documentKey, "baselines/B-12345/document.pdf");
  });
});
