/**
 * Hub CORS Tests
 *
 * Validates that Hub endpoints respond with correct CORS headers for CloudFront origin
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { corsPreflight, getApiBaseUrl, getCloudFrontOrigin } from "./utils/test-helpers.js";

const REQUIRED_HEADERS = [
  "authorization",
  "content-type",
  "x-amz-date",
  "x-amz-security-token",
  "x-api-key",
  "x-requested-with",
];

const HUB_ROUTES = [
  { path: "/finanzas/hub/summary?scope=ALL", method: "GET" },
  { path: "/finanzas/hub/mod-performance?scope=ALL", method: "GET" },
  { path: "/finanzas/hub/cashflow?scope=ALL", method: "GET" },
  { path: "/finanzas/hub/rubros-breakdown?scope=ALL", method: "GET" },
  { path: "/finanzas/hub/export", method: "POST" },
];

describe("Hub CORS", () => {
  const baseUrl = getApiBaseUrl();
  const origin = getCloudFrontOrigin();
  const requestHeaders = `${REQUIRED_HEADERS.join(",")}`;

  for (const route of HUB_ROUTES) {
    it(`OPTIONS ${route.path} responds with Hub CORS headers`, async () => {
      const url = `${baseUrl}${route.path}`;
      const result = await corsPreflight(url, route.method, requestHeaders);

      const allowOrigin = result.headers["access-control-allow-origin"];
      const allowMethods = result.headers["access-control-allow-methods"]?.toUpperCase() || "";
      const allowHeaders = result.headers["access-control-allow-headers"]?.toLowerCase() || "";

      assert.ok(
        result.status === 200 || result.status === 204,
        `Expected 200/204 for OPTIONS ${route.path}, got ${result.status}`
      );

      assert.ok(
        allowOrigin === origin || allowOrigin === "*",
        `access-control-allow-origin should echo ${origin} (or *), got ${allowOrigin}`
      );

      assert.ok(
        allowMethods.includes(route.method.toUpperCase()),
        `access-control-allow-methods should include ${route.method}, got ${allowMethods}`
      );

      for (const header of REQUIRED_HEADERS) {
        assert.ok(
          allowHeaders.includes(header),
          `access-control-allow-headers missing ${header}. Got: ${allowHeaders}`
        );
      }

      assert.equal(
        result.headers["access-control-max-age"],
        "86400",
        "access-control-max-age should be 86400"
      );
    });
  }
});
