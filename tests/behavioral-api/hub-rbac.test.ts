/**
 * Hub de Desempeño RBAC Tests
 * 
 * Validates that the Hub endpoints are only accessible to SDMT and EXEC_RO roles
 * All other roles (PMO, SDM_FIN, NO_GROUP) must be denied
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getCognitoToken,
  getRoleCredentials,
  apiRequest,
  printEvidence,
  skipTier1Test,
} from "./utils/test-helpers.js";

describe("Hub de Desempeño RBAC Tests", () => {
  const hubEndpoints = [
    { path: "/finanzas/hub/summary?scope=ALL", method: "GET", description: "Hub summary" },
    { path: "/finanzas/hub/mod-performance?scope=ALL", method: "GET", description: "MOD performance" },
    { path: "/finanzas/hub/cashflow?scope=ALL", method: "GET", description: "Cashflow data" },
    { path: "/finanzas/hub/rubros-breakdown?scope=ALL", method: "GET", description: "Rubros breakdown" },
  ];

  describe("SDMT Role Access (Allowed)", () => {
    it("SDMT can access all Hub endpoints (Tier-1)", async () => {
      const credentials = getRoleCredentials("SDMT");

      if (!credentials) {
        skipTier1Test("SDMT");
        return;
      }

      const token = await getCognitoToken(
        credentials.username,
        credentials.password
      );
      assert.ok(token, "Should get valid Cognito token for SDMT");

      printEvidence("RBAC", "SDMT role accessing Hub endpoints", {
        username: credentials.username,
        role: "SDMT",
        expectedResult: "All Hub endpoints should return 200",
      });

      // Test all Hub endpoints
      for (const endpoint of hubEndpoints) {
        const response = await apiRequest(endpoint.path, {
          method: endpoint.method,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        assert.ok(
          [200, 404, 501].includes(response.status),
          `SDMT ${endpoint.method} ${endpoint.path} should return 200, 404, or 501 (implementation pending), got ${response.status}`
        );

        // 403 would indicate RBAC denial, which should NOT happen for SDMT
        assert.notEqual(
          response.status,
          403,
          `SDMT should have access to ${endpoint.path}, but got 403 Forbidden`
        );
      }
    });
  });

  describe("EXEC_RO Role Access (Allowed)", () => {
    it("EXEC_RO can access all Hub endpoints (read-only) (Tier-1)", async () => {
      const credentials = getRoleCredentials("EXEC_RO");

      if (!credentials) {
        skipTier1Test("EXEC_RO");
        return;
      }

      const token = await getCognitoToken(
        credentials.username,
        credentials.password
      );
      assert.ok(token, "Should get valid Cognito token for EXEC_RO");

      printEvidence("RBAC", "EXEC_RO role accessing Hub endpoints", {
        username: credentials.username,
        role: "EXEC_RO",
        expectedResult: "All Hub GET endpoints should return 200",
      });

      // Test all Hub GET endpoints (EXEC_RO should have read access)
      for (const endpoint of hubEndpoints) {
        const response = await apiRequest(endpoint.path, {
          method: endpoint.method,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        assert.ok(
          [200, 404, 501].includes(response.status),
          `EXEC_RO ${endpoint.method} ${endpoint.path} should return 200, 404, or 501, got ${response.status}`
        );

        assert.notEqual(
          response.status,
          403,
          `EXEC_RO should have read access to ${endpoint.path}, but got 403 Forbidden`
        );
      }
    });
  });

  describe("PMO Role Access (Denied)", () => {
    it("PMO should be denied access to Hub endpoints (Tier-1)", async () => {
      const credentials = getRoleCredentials("PMO");

      if (!credentials) {
        skipTier1Test("PMO");
        return;
      }

      const token = await getCognitoToken(
        credentials.username,
        credentials.password
      );
      assert.ok(token, "Should get valid Cognito token for PMO");

      printEvidence("RBAC", "PMO role attempting Hub access (should be denied)", {
        username: credentials.username,
        role: "PMO",
        expectedResult: "All Hub endpoints should return 403 Forbidden",
      });

      // PMO should NOT have access to Hub endpoints
      for (const endpoint of hubEndpoints) {
        const response = await apiRequest(endpoint.path, {
          method: endpoint.method,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        assert.equal(
          response.status,
          403,
          `PMO should be denied access to ${endpoint.path}, but got ${response.status}`
        );
      }
    });
  });

  describe("NO_GROUP User Access (Denied)", () => {
    it("NO_GROUP user should be denied access to Hub endpoints (Tier-1 - CRITICAL)", async () => {
      const credentials = getRoleCredentials("NO_GROUP");

      if (!credentials) {
        skipTier1Test("NO_GROUP");
        return;
      }

      const token = await getCognitoToken(
        credentials.username,
        credentials.password
      );
      assert.ok(token, "Should get valid Cognito token for NO_GROUP");

      printEvidence("SECURITY", "NO_GROUP user attempting Hub access (CRITICAL - must be denied)", {
        username: credentials.username,
        role: "NO_GROUP",
        expectedResult: "All Hub endpoints must return 403 Forbidden",
      });

      // NO_GROUP users must be explicitly denied
      for (const endpoint of hubEndpoints) {
        const response = await apiRequest(endpoint.path, {
          method: endpoint.method,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        assert.equal(
          response.status,
          403,
          `NO_GROUP user MUST be denied access to ${endpoint.path}, but got ${response.status}. This is a CRITICAL SECURITY ISSUE.`
        );

        // Also verify error message indicates role requirement
        if (response.status === 403) {
          const body = await response.json().catch(() => ({}));
          assert.ok(
            body.error || body.message,
            "403 response should include an error message"
          );
        }
      }
    });
  });

  describe("Hub Export Endpoint (POST)", () => {
    it("SDMT can initiate export (Tier-1)", async () => {
      const credentials = getRoleCredentials("SDMT");

      if (!credentials) {
        skipTier1Test("SDMT");
        return;
      }

      const token = await getCognitoToken(
        credentials.username,
        credentials.password
      );
      assert.ok(token, "Should get valid Cognito token for SDMT");

      printEvidence("RBAC", "SDMT initiating Hub export", {
        username: credentials.username,
        role: "SDMT",
        expectedResult: "Export endpoint should return 200 or 501",
      });

      const response = await apiRequest("/finanzas/hub/export", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          scope: "ALL",
          dateRange: "12months",
          sections: ["summary", "mod-performance"],
        }),
      });

      assert.ok(
        [200, 501].includes(response.status),
        `SDMT POST /finanzas/hub/export should return 200 or 501, got ${response.status}`
      );
    });

    it("PMO should be denied export access (Tier-1)", async () => {
      const credentials = getRoleCredentials("PMO");

      if (!credentials) {
        skipTier1Test("PMO");
        return;
      }

      const token = await getCognitoToken(
        credentials.username,
        credentials.password
      );
      assert.ok(token, "Should get valid Cognito token for PMO");

      const response = await apiRequest("/finanzas/hub/export", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          scope: "ALL",
          dateRange: "12months",
          sections: ["summary"],
        }),
      });

      assert.equal(
        response.status,
        403,
        `PMO should be denied export access, but got ${response.status}`
      );
    });
  });

  describe("Hub Data Shape Validation", () => {
    it("Hub summary returns expected data structure (Tier-2)", async () => {
      const credentials = getRoleCredentials("SDMT");

      if (!credentials) {
        console.log("⏭️  Skipping Tier-2: SDMT credentials not available");
        return;
      }

      const token = await getCognitoToken(
        credentials.username,
        credentials.password
      );

      const response = await apiRequest("/finanzas/hub/summary?scope=ALL", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 200) {
        const data = await response.json();

        // Validate response structure
        assert.ok(data.scope, "Response should include scope");
        assert.ok(data.currency, "Response should include currency");
        assert.ok(data.asOf, "Response should include asOf date");
        assert.ok(data.kpis, "Response should include kpis object");

        // Validate KPIs structure
        const kpis = data.kpis;
        assert.ok(typeof kpis.baselineMOD === "number", "baselineMOD should be a number");
        assert.ok(typeof kpis.allocations === "number", "allocations should be a number");
        assert.ok(typeof kpis.adjustedMOD === "number", "adjustedMOD should be a number");
        assert.ok(typeof kpis.actualPayroll === "number", "actualPayroll should be a number");
        assert.ok(typeof kpis.variance === "number", "variance should be a number");

        printEvidence("DATA_SHAPE", "Hub summary data structure validation", {
          scope: data.scope,
          currency: data.currency,
          kpisKeys: Object.keys(data.kpis),
        });
      }
    });
  });
});
