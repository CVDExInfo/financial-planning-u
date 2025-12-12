/**
 * RBAC Enforcement Tests
 * 
 * Validates that role-based access control is properly enforced by the backend API
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

describe("RBAC Enforcement Tests", () => {
  // Define role-based access rules
  // Each role has allowed and denied endpoints
  const rbacRules = {
    PMO: {
      allowed: [
        { path: "/projects?limit=1", method: "GET", description: "List projects" },
        // PMO typically has read access to projects
      ],
      denied: [
        // PMO should not have access to SDM_FIN specific endpoints (if they exist)
        // This is a placeholder - adjust based on actual API
      ],
    },
    SDM_FIN: {
      // SDM_FIN is mapped to SDMT in our role system
      allowed: [
        { path: "/projects?limit=1", method: "GET", description: "List projects" },
        { path: "/catalog/rubros", method: "GET", description: "View rubros catalog" },
        { path: "/allocation-rules", method: "GET", description: "View allocation rules" },
        { path: "/providers", method: "GET", description: "View providers" },
      ],
      denied: [
        // SDMT should not be able to access PMO-exclusive endpoints (if any exist)
      ],
    },
    SDMT: {
      allowed: [
        { path: "/projects?limit=1", method: "GET", description: "List projects" },
        { path: "/catalog/rubros", method: "GET", description: "View rubros catalog" },
        { path: "/allocation-rules", method: "GET", description: "View allocation rules" },
        { path: "/providers", method: "GET", description: "View providers" },
      ],
      denied: [
        // SDMT should not be able to access PMO-exclusive endpoints (if any exist)
      ],
    },
    EXEC_RO: {
      allowed: [
        { path: "/projects?limit=1", method: "GET", description: "List projects (read-only)" },
        { path: "/catalog/rubros", method: "GET", description: "View rubros catalog" },
        { path: "/allocation-rules", method: "GET", description: "View allocation rules" },
      ],
      denied: [
        // EXEC_RO should not be able to POST/PATCH/DELETE anything
        // Testing write operations would require actual endpoints that accept writes
      ],
    },
    NO_GROUP: {
      allowed: [],
      denied: [
        { path: "/projects", method: "GET", description: "List projects" },
        { path: "/catalog/rubros", method: "GET", description: "View rubros catalog" },
        { path: "/allocation-rules", method: "GET", description: "View allocation rules" },
        { path: "/providers", method: "GET", description: "View providers" },
      ],
    },
  };

  describe("PMO Role Access", () => {
    it("PMO can access allowed endpoints (Tier-1)", async () => {
      const credentials = getRoleCredentials("PMO");

      if (!credentials) {
        skipTier1Test("PMO allowed endpoints", "PMO credentials not configured");
        return;
      }

      const token = await getCognitoToken(credentials);
      const rules = rbacRules.PMO;

      for (const endpoint of rules.allowed) {
        const result = await apiRequest(endpoint.path, token, {
          method: endpoint.method,
        });

        printEvidence(
          "PMO",
          `${endpoint.method} ${endpoint.path}`,
          result.status,
          result.status === 200 ? "PASS" : "FAIL",
          endpoint.description
        );

        assert.ok(
          result.status === 200,
          `PMO should be able to access ${endpoint.path}, got ${result.status}`
        );
      }
    });

    it("PMO is denied access to forbidden endpoints (Tier-1)", async () => {
      const credentials = getRoleCredentials("PMO");

      if (!credentials) {
        skipTier1Test("PMO denied endpoints", "PMO credentials not configured");
        return;
      }

      const token = await getCognitoToken(credentials);
      const rules = rbacRules.PMO;

      if (rules.denied.length === 0) {
        console.log("ℹ️  No denied endpoints configured for PMO role");
        return;
      }

      for (const endpoint of rules.denied) {
        const result = await apiRequest(endpoint.path, token, {
          method: endpoint.method,
        });

        printEvidence(
          "PMO",
          `${endpoint.method} ${endpoint.path}`,
          result.status,
          result.status === 403 || result.status === 401 ? "PASS" : "FAIL",
          `Should be denied`
        );

        assert.ok(
          result.status === 403 || result.status === 401,
          `PMO should be denied ${endpoint.path}, got ${result.status} (expected 401/403)`
        );
      }
    });
  });

  describe("SDM_FIN (SDMT) Role Access", () => {
    it("SDM_FIN can access allowed endpoints (Tier-1)", async () => {
      const credentials = getRoleCredentials("SDM_FIN") || getRoleCredentials("SDMT");

      if (!credentials) {
        skipTier1Test("SDM_FIN allowed endpoints", "SDM_FIN/SDMT credentials not configured");
        return;
      }

      const token = await getCognitoToken(credentials);
      const rules = rbacRules.SDM_FIN;

      for (const endpoint of rules.allowed) {
        const result = await apiRequest(endpoint.path, token, {
          method: endpoint.method,
        });

        printEvidence(
          credentials.role,
          `${endpoint.method} ${endpoint.path}`,
          result.status,
          result.status === 200 ? "PASS" : "FAIL",
          endpoint.description
        );

        assert.ok(
          result.status === 200,
          `${credentials.role} should be able to access ${endpoint.path}, got ${result.status}`
        );
      }
    });
  });

  describe("SDMT Role Access", () => {
    it("SDMT can access allowed endpoints (Tier-1)", async () => {
      const credentials = getRoleCredentials("SDMT");

      if (!credentials) {
        skipTier1Test("SDMT allowed endpoints", "SDMT credentials not configured");
        return;
      }

      const token = await getCognitoToken(credentials);
      const rules = rbacRules.SDMT;

      for (const endpoint of rules.allowed) {
        const result = await apiRequest(endpoint.path, token, {
          method: endpoint.method,
        });

        printEvidence(
          "SDMT",
          `${endpoint.method} ${endpoint.path}`,
          result.status,
          result.status === 200 ? "PASS" : "FAIL",
          endpoint.description
        );

        assert.ok(
          result.status === 200,
          `SDMT should be able to access ${endpoint.path}, got ${result.status}`
        );
      }
    });
  });

  describe("EXEC_RO Role Access", () => {
    it("EXEC_RO can access read-only endpoints (Tier-1)", async () => {
      const credentials = getRoleCredentials("EXEC_RO");

      if (!credentials) {
        skipTier1Test("EXEC_RO read-only endpoints", "EXEC_RO credentials not configured");
        return;
      }

      const token = await getCognitoToken(credentials);
      const rules = rbacRules.EXEC_RO;

      for (const endpoint of rules.allowed) {
        const result = await apiRequest(endpoint.path, token, {
          method: endpoint.method,
        });

        printEvidence(
          "EXEC_RO",
          `${endpoint.method} ${endpoint.path}`,
          result.status,
          result.status === 200 ? "PASS" : "FAIL",
          endpoint.description
        );

        assert.ok(
          result.status === 200,
          `EXEC_RO should be able to read ${endpoint.path}, got ${result.status}`
        );
      }
    });
  });

  describe("NO_GROUP User Access (Security Critical)", () => {
    it("Users with no Cognito group are denied all protected endpoints (Tier-1)", async () => {
      const credentials = getRoleCredentials("NO_GROUP");

      if (!credentials) {
        skipTier1Test(
          "NO_GROUP security test",
          "NO_GROUP credentials not configured (IMPORTANT: Configure for security validation)"
        );
        return;
      }

      const token = await getCognitoToken(credentials);
      const rules = rbacRules.NO_GROUP;

      for (const endpoint of rules.denied) {
        const result = await apiRequest(endpoint.path, token, {
          method: endpoint.method,
        });

        const isDenied = result.status === 403 || result.status === 401;

        printEvidence(
          "NO_GROUP",
          `${endpoint.method} ${endpoint.path}`,
          result.status,
          isDenied ? "PASS" : "FAIL",
          isDenied ? "Correctly denied" : "⚠️  SECURITY ISSUE: Should be denied!"
        );

        assert.ok(
          isDenied,
          `NO_GROUP user MUST be denied ${endpoint.path}, got ${result.status} (expected 401/403). This is a SECURITY VULNERABILITY!`
        );
      }

      console.log("\n✅ SECURITY VALIDATION PASSED: NO_GROUP users are correctly denied access");
    });
  });

  describe("RBAC Evidence Summary", () => {
    it("prints comprehensive RBAC test results", async () => {
      console.log("\n" + "=".repeat(70));
      console.log("RBAC ENFORCEMENT TEST SUMMARY");
      console.log("=".repeat(70));

      const roles = ["PMO", "SDM_FIN", "SDMT", "EXEC_RO", "NO_GROUP"];

      for (const roleName of roles) {
        const credentials = getRoleCredentials(roleName);
        if (credentials) {
          console.log(`\n✓ ${roleName}: Credentials configured and tested`);
        } else {
          console.log(`\n⚠️  ${roleName}: Credentials NOT configured (tests skipped)`);
        }
      }

      console.log("\n" + "=".repeat(70));
    });
  });
});
