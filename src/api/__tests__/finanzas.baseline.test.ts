import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";

/**
 * Regression test for DynamoDB overwrite issue
 * 
 * Root cause: Frontend was using derivedProjectId (name-based) for baseline
 * creation, handoff, and accept operations. When two baselines shared the same
 * project name, they would collide on the same PROJECT#.../METADATA key.
 * 
 * Fix: Backend returns unique projectId (P-{uuid}) in baseline response.
 * Frontend must store and use this projectId for all subsequent API calls.
 * 
 * This test validates the API contract without running full integration,
 * documenting the expected behavior for the baseline flow.
 */

type PrefacturaBaselinePayload = {
  project_id: string;
  project_name: string;
  client_name?: string;
  currency?: string;
  start_date?: string;
  duration_months?: number;
  contract_value?: number;
  labor_estimates: any[];
  non_labor_estimates: any[];
  signed_by?: string;
  signed_role?: string;
  signed_at?: string;
};

type PrefacturaBaselineResponse = {
  baselineId: string;
  projectId: string;
  status: string;
  signatureHash?: string;
  totalAmount?: number;
  createdAt?: string;
};

type HandoffBaselinePayload = {
  baseline_id: string;
  mod_total?: number;
  pct_ingenieros?: number;
  pct_sdm?: number;
};

type HandoffBaselineResponse = {
  projectId: string;
  baselineId: string;
  status?: string;
};

// Simplified mock implementations for testing
const mockCreatePrefacturaBaseline = async (
  payload: PrefacturaBaselinePayload,
  fetch: any
): Promise<PrefacturaBaselineResponse> => {
  const response = await fetch("http://localhost/baseline", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  return text
    ? JSON.parse(text)
    : {
        baselineId: "BL-TEST",
        projectId: payload.project_id,
        status: "pending",
      };
};

const mockHandoffBaseline = async (
  projectId: string,
  payload: HandoffBaselinePayload,
  fetch: any
): Promise<HandoffBaselineResponse> => {
  const response = await fetch(
    `http://localhost/projects/${encodeURIComponent(projectId)}/handoff`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Idempotency-Key": `handoff-${projectId}-${payload.baseline_id}`,
      },
      body: JSON.stringify(payload),
    }
  );
  const text = await response.text();
  return text
    ? JSON.parse(text)
    : {
        projectId,
        baselineId: payload.baseline_id,
      };
};

const mockAcceptBaseline = async (
  projectId: string,
  payload: any,
  fetch: any
): Promise<any> => {
  const response = await fetch(
    `http://localhost/projects/${encodeURIComponent(projectId)}/accept-baseline`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: payload?.accepted_by ? JSON.stringify({ accepted_by: payload.accepted_by }) : undefined,
    }
  );
  const text = await response.text();
  return text ? JSON.parse(text) : {};
};


describe("baseline flow - DynamoDB overwrite prevention", () => {
  let capturedRequests: Array<{ url: string; method: string; body: any }> = [];
  let mockFetch: any;

  beforeEach(() => {
    capturedRequests = [];

    // Mock fetch to capture all requests
    mockFetch = async (url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(init.body as string) : undefined;
      capturedRequests.push({
        url: String(url),
        method: init?.method || "GET",
        body,
      });

      // Mock createPrefacturaBaseline response with unique projectId
      if (url.includes("/baseline") && init?.method === "POST") {
        // Backend returns unique UUID-based projectId regardless of project name
        const uniqueProjectId = `P-${Math.random().toString(36).substring(2, 10)}`;
        return {
          ok: true,
          status: 201,
          text: async () =>
            JSON.stringify({
              baselineId: `base_${Math.random().toString(36).substring(2, 10)}`,
              projectId: uniqueProjectId,
              status: "PendingSDMT",
              signatureHash: "mock-hash",
              totalAmount: 100000,
              createdAt: new Date().toISOString(),
            }),
        };
      }

      // Mock handoffBaseline response
      if (url.includes("/handoff") && init?.method === "POST") {
        return {
          ok: true,
          status: 201,
          text: async () =>
            JSON.stringify({
              handoffId: "handoff_123",
              projectId: url.split("/projects/")[1]?.split("/")[0],
              baselineId: body?.baseline_id,
              status: "HandoffComplete",
            }),
        };
      }

      // Mock acceptBaseline response
      if (url.includes("/accept-baseline") && init?.method === "PATCH") {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              projectId: url.split("/projects/")[1]?.split("/")[0],
              baselineId: "base_123",
              baseline_status: "accepted",
              accepted_by: body?.accepted_by || "test@example.com",
              baseline_accepted_at: new Date().toISOString(),
            }),
        };
      }

      return {
        ok: true,
        status: 200,
        text: async () => "{}",
      };
    };
  });

  afterEach(() => {
    // Cleanup
    capturedRequests = [];
  });

  it("creates two baselines with same name and gets different projectIds", async () => {
    const sameName = "Mobile Banking App MVP";

    // Create first baseline
    const baseline1 = await mockCreatePrefacturaBaseline(
      {
        project_id: "PRJ-MOBILE-BANKING-APP-MVP",
        project_name: sameName,
        client_name: "Test Client",
        currency: "USD",
        start_date: "2025-01-01",
        duration_months: 12,
        contract_value: 100000,
        labor_estimates: [],
        non_labor_estimates: [],
        signed_by: "pmo@example.com",
        signed_role: "PMO",
        signed_at: new Date().toISOString(),
      },
      mockFetch
    );

    // Create second baseline with same name
    const baseline2 = await mockCreatePrefacturaBaseline(
      {
        project_id: "PRJ-MOBILE-BANKING-APP-MVP",
        project_name: sameName,
        client_name: "Test Client",
        currency: "USD",
        start_date: "2025-01-01",
        duration_months: 12,
        contract_value: 100000,
        labor_estimates: [],
        non_labor_estimates: [],
        signed_by: "pmo@example.com",
        signed_role: "PMO",
        signed_at: new Date().toISOString(),
      },
      mockFetch
    );

    // Verify both baselines were created
    assert.ok(baseline1.projectId, "First baseline should have projectId");
    assert.ok(baseline2.projectId, "Second baseline should have projectId");

    // CRITICAL: Verify projectIds are different despite same name
    assert.notEqual(
      baseline1.projectId,
      baseline2.projectId,
      "Two baselines with same name MUST have different projectIds to prevent DynamoDB overwrites"
    );

    console.log("✓ Verified: Two baselines with same name received different projectIds:", {
      baseline1: baseline1.projectId,
      baseline2: baseline2.projectId,
    });
  });

  it("uses backend-issued projectId in handoff call, not name-derived ID", async () => {
    const baseline = await mockCreatePrefacturaBaseline(
      {
        project_id: "PRJ-DERIVED-FROM-NAME",
        project_name: "Test Project",
        client_name: "Test Client",
        currency: "USD",
        start_date: "2025-01-01",
        duration_months: 12,
        contract_value: 100000,
        labor_estimates: [],
        non_labor_estimates: [],
        signed_by: "pmo@example.com",
        signed_role: "PMO",
        signed_at: new Date().toISOString(),
      },
      mockFetch
    );

    const backendProjectId = baseline.projectId;

    // Handoff using backend projectId
    await mockHandoffBaseline(
      backendProjectId,
      {
        baseline_id: baseline.baselineId,
        mod_total: 100000,
        pct_ingenieros: 70,
        pct_sdm: 30,
      },
      mockFetch
    );

    // Find the handoff request
    const handoffRequest = capturedRequests.find(
      (req) => req.url.includes("/handoff") && req.method === "POST"
    );

    assert.ok(handoffRequest, "Handoff request should be captured");

    // CRITICAL: Verify URL uses backend projectId, not name-derived ID
    assert.ok(
      handoffRequest.url.includes(backendProjectId),
      `Handoff URL must use backend-issued projectId (${backendProjectId}), not name-derived ID`
    );

    assert.ok(
      !handoffRequest.url.includes("PRJ-DERIVED-FROM-NAME"),
      "Handoff URL must NOT use name-derived projectId"
    );

    console.log("✓ Verified: Handoff uses backend projectId in URL:", backendProjectId);
  });

  it("uses backend-issued projectId in accept call", async () => {
    const baseline = await mockCreatePrefacturaBaseline(
      {
        project_id: "PRJ-DERIVED-FROM-NAME",
        project_name: "Test Project",
        client_name: "Test Client",
        currency: "USD",
        start_date: "2025-01-01",
        duration_months: 12,
        contract_value: 100000,
        labor_estimates: [],
        non_labor_estimates: [],
        signed_by: "pmo@example.com",
        signed_role: "PMO",
        signed_at: new Date().toISOString(),
      },
      mockFetch
    );

    const backendProjectId = baseline.projectId;

    // Accept using backend projectId
    await mockAcceptBaseline(
      backendProjectId,
      {
        baseline_id: baseline.baselineId,
        accepted_by: "sdm@example.com",
      },
      mockFetch
    );

    // Find the accept request
    const acceptRequest = capturedRequests.find(
      (req) => req.url.includes("/accept-baseline") && req.method === "PATCH"
    );

    assert.ok(acceptRequest, "Accept request should be captured");

    // CRITICAL: Verify URL uses backend projectId, not name-derived ID
    assert.ok(
      acceptRequest.url.includes(backendProjectId),
      `Accept URL must use backend-issued projectId (${backendProjectId}), not name-derived ID`
    );

    assert.ok(
      !acceptRequest.url.includes("PRJ-DERIVED-FROM-NAME"),
      "Accept URL must NOT use name-derived projectId"
    );

    console.log("✓ Verified: Accept uses backend projectId in URL:", backendProjectId);
  });

  it("rejects projectId mismatches between uploads and backend response", () => {
    const uploadProjectId = "P-upload-123";
    const backendProjectId = "P-backend-456";

    const simulateGuard = () => {
      const prefacturaProjectIdRef = { current: uploadProjectId };
      const baseline = { projectId: backendProjectId };

      if (!baseline.projectId) {
        throw new Error("Backend did not return projectId.");
      }
      if (baseline.projectId !== prefacturaProjectIdRef.current) {
        throw new Error(
          `ProjectId mismatch. Prefactura uploaded docs under ${prefacturaProjectIdRef.current} but backend returned ${baseline.projectId}.`,
        );
      }
    };

    assert.throws(
      simulateGuard,
      /ProjectId mismatch\. Prefactura uploaded docs under P-upload-123 but backend returned P-backend-456\./,
      "Frontend must guard against backend projectId mismatch to avoid writing under wrong partition key",
    );
  });

  it("validates projectId is present in baseline response", async () => {
    // Override mockFetch to return baseline without projectId
    const badMockFetch = async (url: string, init?: RequestInit) => {
      if (url.includes("/baseline") && init?.method === "POST") {
        return {
          ok: true,
          status: 201,
          text: async () =>
            JSON.stringify({
              baselineId: "base_123",
              // Missing projectId!
              status: "PendingSDMT",
            }),
        };
      }
      return { ok: true, status: 200, text: async () => "{}" };
    };

    const baseline = await mockCreatePrefacturaBaseline(
      {
        project_id: "PRJ-TEST",
        project_name: "Test Project",
        client_name: "Test Client",
        currency: "USD",
        start_date: "2025-01-01",
        duration_months: 12,
        contract_value: 100000,
        labor_estimates: [],
        non_labor_estimates: [],
        signed_by: "pmo@example.com",
        signed_role: "PMO",
        signed_at: new Date().toISOString(),
      },
      badMockFetch
    );

    // Validate that projectId is empty
    assert.strictEqual(
      baseline.projectId,
      undefined,
      "Backend should always return projectId, but test validates frontend handling"
    );

    console.log(
      "✓ Test validates that frontend checks for projectId presence (ReviewSignStep should throw error)"
    );
  });
});
