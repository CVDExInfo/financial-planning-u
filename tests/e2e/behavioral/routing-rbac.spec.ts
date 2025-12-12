/**
 * Routing and Navigation RBAC Tests
 * 
 * Validates that UI routing respects role-based access control
 */

import { test, expect } from "@playwright/test";
import { setupAuthenticatedPage, getRoleCredentials } from "./auth-helper";

const BASE_URL = process.env.FINZ_UI_BASE_URL || "https://d7t9x3j66yd8k.cloudfront.net/finanzas";

test.describe("Routing RBAC Tests", () => {
  test.describe("NO_GROUP User Access", () => {
    test("users with no Cognito group cannot access protected routes", async ({ page }) => {
      const credentials = getRoleCredentials("NO_GROUP") || getRoleCredentials("NOGROUP");

      if (!credentials) {
        test.skip(
          true,
          "NO_GROUP credentials not configured - this is a critical security test!"
        );
        return;
      }

      // Setup authentication
      await setupAuthenticatedPage(page, credentials.username, credentials.password);

      // Try to access a protected route
      await page.goto(`${BASE_URL}/projects`, { waitUntil: "networkidle" });

      // User should be redirected to login or see access denied
      const url = page.url();
      const content = await page.content();

      const isRedirectedToLogin =
        url.includes("/login") || url.includes("/auth") || url === `${BASE_URL}/`;
      const hasAccessDeniedMessage =
        content.includes("no access") ||
        content.includes("denied") ||
        content.includes("unauthorized") ||
        content.includes("403");

      expect(isRedirectedToLogin || hasAccessDeniedMessage).toBeTruthy();

      if (isRedirectedToLogin) {
        console.log("✅ NO_GROUP user redirected to login/home");
      } else if (hasAccessDeniedMessage) {
        console.log("✅ NO_GROUP user sees access denied message");
      }
    });

    test("NO_GROUP users cannot see SDMT navigation items", async ({ page }) => {
      const credentials = getRoleCredentials("NO_GROUP") || getRoleCredentials("NOGROUP");

      if (!credentials) {
        test.skip(true, "NO_GROUP credentials not configured");
        return;
      }

      await setupAuthenticatedPage(page, credentials.username, credentials.password);
      await page.goto(BASE_URL, { waitUntil: "networkidle" });

      // Check that SDMT-specific nav items are not visible
      const sdmtLinks = [
        'a[href*="/projects"]',
        'a[href*="/catalog"]',
        'a[href*="/forecast"]',
        'a[href*="/adjustments"]',
      ];

      for (const selector of sdmtLinks) {
        const link = await page.$(selector);
        if (link) {
          const isVisible = await link.isVisible();
          expect(isVisible).toBeFalsy();
        }
      }

      console.log("✅ NO_GROUP user cannot see SDMT navigation");
    });
  });

  test.describe("SDMT Role Access", () => {
    test("SDMT users can access SDMT routes", async ({ page }) => {
      const credentials = getRoleCredentials("SDMT");

      if (!credentials) {
        test.skip(true, "SDMT credentials not configured");
        return;
      }

      await setupAuthenticatedPage(page, credentials.username, credentials.password);

      // Navigate to SDMT route
      await page.goto(`${BASE_URL}/projects`, { waitUntil: "networkidle" });

      // Should not be redirected away
      expect(page.url()).toContain("/projects");

      // Should not see access denied
      const content = await page.content();
      expect(content).not.toContain("access denied");
      expect(content).not.toContain("unauthorized");

      console.log("✅ SDMT user can access /projects route");
    });

    test("SDMT users see SDMT navigation items", async ({ page }) => {
      const credentials = getRoleCredentials("SDMT");

      if (!credentials) {
        test.skip(true, "SDMT credentials not configured");
        return;
      }

      await setupAuthenticatedPage(page, credentials.username, credentials.password);
      await page.goto(BASE_URL, { waitUntil: "networkidle" });

      // Wait for navigation to load
      await page.waitForLoadState("networkidle");

      // Check for at least one SDMT nav item (they may have different structures)
      const hasNavigation =
        (await page.$('a[href*="/projects"]')) !== null ||
        (await page.$('a[href*="/catalog"]')) !== null ||
        (await page.$('text=Projects')) !== null;

      expect(hasNavigation).toBeTruthy();

      console.log("✅ SDMT user sees navigation items");
    });
  });

  test.describe("SDM_FIN Role Access", () => {
    test("SDM_FIN users can access finanzas routes", async ({ page }) => {
      const credentials = getRoleCredentials("SDM_FIN");

      if (!credentials) {
        test.skip(true, "SDM_FIN credentials not configured");
        return;
      }

      await setupAuthenticatedPage(page, credentials.username, credentials.password);
      await page.goto(`${BASE_URL}/projects`, { waitUntil: "networkidle" });

      expect(page.url()).toContain("/projects");

      const content = await page.content();
      expect(content).not.toContain("access denied");

      console.log("✅ SDM_FIN user can access finanzas routes");
    });
  });

  test.describe("EXEC_RO Role Access", () => {
    test("EXEC_RO users can view routes but actions are disabled", async ({ page }) => {
      const credentials = getRoleCredentials("EXEC_RO");

      if (!credentials) {
        test.skip(true, "EXEC_RO credentials not configured");
        return;
      }

      await setupAuthenticatedPage(page, credentials.username, credentials.password);
      await page.goto(`${BASE_URL}/projects`, { waitUntil: "networkidle" });

      // Should be able to view the page
      expect(page.url()).toContain("/projects");

      // Look for disabled or missing action buttons
      const createButton = await page.$('button:has-text("Create")');
      const addButton = await page.$('button:has-text("Add")');
      const editButton = await page.$('button:has-text("Edit")');

      // If buttons exist, they should be disabled
      if (createButton) {
        const isDisabled = await createButton.isDisabled();
        expect(isDisabled).toBeTruthy();
      }

      if (addButton) {
        const isDisabled = await addButton.isDisabled();
        expect(isDisabled).toBeTruthy();
      }

      if (editButton) {
        const isDisabled = await editButton.isDisabled();
        expect(isDisabled).toBeTruthy();
      }

      console.log("✅ EXEC_RO user can view but write actions are disabled");
    });

    test("EXEC_RO users see all routes (read-only access)", async ({ page }) => {
      const credentials = getRoleCredentials("EXEC_RO");

      if (!credentials) {
        test.skip(true, "EXEC_RO credentials not configured");
        return;
      }

      await setupAuthenticatedPage(page, credentials.username, credentials.password);
      await page.goto(BASE_URL, { waitUntil: "networkidle" });

      // EXEC_RO should see navigation for all modules (but read-only)
      const hasNavigation =
        (await page.$('a[href*="/projects"]')) !== null ||
        (await page.$('text=Projects')) !== null;

      expect(hasNavigation).toBeTruthy();

      console.log("✅ EXEC_RO user sees navigation (read-only)");
    });
  });

  test.describe("PMO Role Access", () => {
    test("PMO users cannot access SDMT-only routes", async ({ page }) => {
      const credentials = getRoleCredentials("PMO");

      if (!credentials) {
        test.skip(true, "PMO credentials not configured");
        return;
      }

      await setupAuthenticatedPage(page, credentials.username, credentials.password);

      // Try to access SDMT route
      await page.goto(`${BASE_URL}/catalog/rubros`, { waitUntil: "networkidle" });

      // Should be redirected or see access denied
      const url = page.url();
      const content = await page.content();

      const isBlocked =
        url.includes("/pmo") ||
        url === `${BASE_URL}/` ||
        content.includes("access denied") ||
        content.includes("unauthorized");

      expect(isBlocked).toBeTruthy();

      console.log("✅ PMO user blocked from SDMT-only routes");
    });
  });
});
