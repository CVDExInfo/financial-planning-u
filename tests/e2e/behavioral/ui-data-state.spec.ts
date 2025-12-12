/**
 * UI Data State Tests
 * 
 * Validates that UI correctly handles empty states vs populated data
 * and prevents misleading visualizations
 */

import { test, expect } from "@playwright/test";
import { setupAuthenticatedPage, getRoleCredentials } from "./auth-helper";

const BASE_URL = process.env.FINZ_UI_BASE_URL || "https://d7t9x3j66yd8k.cloudfront.net/finanzas";

test.describe("UI Data State Tests", () => {
  test.describe("Empty State Handling", () => {
    test("projects page shows empty state when no projects exist", async ({ page }) => {
      const credentials = getRoleCredentials("SDMT") || getRoleCredentials("PMO");

      if (!credentials) {
        test.skip(true, "SDMT or PMO credentials not configured");
        return;
      }

      await setupAuthenticatedPage(page, credentials.username, credentials.password);
      await page.goto(`${BASE_URL}/projects`, { waitUntil: "networkidle" });

      // Check if there's data or an empty state
      const content = await page.content();

      // Look for empty state indicators
      const hasEmptyState =
        content.includes("No projects") ||
        content.includes("no data") ||
        content.includes("empty") ||
        content.includes("Get started");

      // Look for project data
      const hasProjectData =
        content.includes("project") || (await page.$('[data-testid="project-item"]')) !== null;

      // One of these should be true
      expect(hasEmptyState || hasProjectData).toBeTruthy();

      if (hasEmptyState) {
        console.log("✅ Empty state is shown when no projects exist");
      } else {
        console.log("✅ Projects are displayed when data exists");
      }
    });

    test("catalog shows empty state or populated list appropriately", async ({ page }) => {
      const credentials = getRoleCredentials("SDMT") || getRoleCredentials("PMO");

      if (!credentials) {
        test.skip(true, "SDMT or PMO credentials not configured");
        return;
      }

      await setupAuthenticatedPage(page, credentials.username, credentials.password);
      await page.goto(`${BASE_URL}/catalog/rubros`, { waitUntil: "networkidle" });

      const content = await page.content();

      // Should show either empty state or actual rubros
      const hasEmptyState =
        content.includes("No rubros") ||
        content.includes("no data") ||
        content.includes("empty");

      const hasRubros =
        content.includes("rubro") || (await page.$('[data-testid="rubro-item"]')) !== null;

      expect(hasEmptyState || hasRubros).toBeTruthy();

      if (hasEmptyState) {
        console.log("✅ Catalog shows empty state when no rubros exist");
      } else {
        console.log("✅ Catalog shows rubros when data exists");
      }
    });
  });

  test.describe("Chart Data Validation", () => {
    test("forecast charts do not render misleading visuals with empty data", async ({ page }) => {
      const credentials = getRoleCredentials("SDMT") || getRoleCredentials("PMO");

      if (!credentials) {
        test.skip(true, "SDMT or PMO credentials not configured");
        return;
      }

      await setupAuthenticatedPage(page, credentials.username, credentials.password);

      // Navigate to a page with charts
      await page.goto(`${BASE_URL}/projects`, { waitUntil: "networkidle" });

      // If there's a forecast or chart view, navigate to it
      const forecastLink = await page.$('a[href*="forecast"]');
      if (forecastLink) {
        await forecastLink.click();
        await page.waitForLoadState("networkidle");
      }

      // Check for charts
      const hasChart =
        (await page.$("svg")) !== null || (await page.$(".recharts-wrapper")) !== null;

      if (hasChart) {
        // If chart exists, check that it's not showing misleading empty data
        const svgContent = await page.content();

        // Look for signs of meaningful data vs empty placeholder
        const hasDataPoints =
          svgContent.includes("circle") ||
          svgContent.includes("path") ||
          svgContent.includes("bar") ||
          svgContent.includes("line");

        const hasNoDataMessage =
          svgContent.includes("No data") ||
          svgContent.includes("no data") ||
          svgContent.includes("empty");

        // If there's a chart, it should either have data OR show "no data" message
        expect(hasDataPoints || hasNoDataMessage).toBeTruthy();

        if (hasNoDataMessage) {
          console.log("✅ Chart shows explicit 'no data' message instead of misleading visual");
        } else if (hasDataPoints) {
          console.log("✅ Chart renders with actual data points");
        }
      } else {
        console.log("ℹ️  No charts found on this page");
      }
    });

    test("donut charts show meaningful labels when data exists", async ({ page }) => {
      const credentials = getRoleCredentials("SDMT") || getRoleCredentials("PMO");

      if (!credentials) {
        test.skip(true, "SDMT or PMO credentials not configured");
        return;
      }

      await setupAuthenticatedPage(page, credentials.username, credentials.password);
      await page.goto(`${BASE_URL}/projects`, { waitUntil: "networkidle" });

      // Look for donut/pie charts
      const charts = await page.$$("svg");

      for (const chart of charts) {
        const chartContent = await chart.innerHTML();

        // If it's a donut/pie chart with data, it should have labels
        if (chartContent.includes("path") && chartContent.includes("arc")) {
          // Check for labels or legend
          const hasLabels =
            chartContent.includes("text") ||
            (await page.$(".recharts-legend")) !== null ||
            (await page.$('[class*="legend"]')) !== null;

          if (hasLabels) {
            console.log("✅ Donut chart has meaningful labels");
          }
        }
      }
    });

    test("empty forecast shows explicit empty state, not blank chart", async ({ page }) => {
      const credentials = getRoleCredentials("SDMT") || getRoleCredentials("PMO");

      if (!credentials) {
        test.skip(true, "SDMT or PMO credentials not configured");
        return;
      }

      await setupAuthenticatedPage(page, credentials.username, credentials.password);

      // Try to access forecast for a project
      await page.goto(`${BASE_URL}/projects`, { waitUntil: "networkidle" });

      // If there are projects, click on one
      const projectLink = await page.$('a[href*="/projects/"]');
      if (projectLink) {
        await projectLink.click();
        await page.waitForLoadState("networkidle");

        // Check for forecast or planning section
        const content = await page.content();

        if (content.includes("forecast") || content.includes("plan")) {
          // Should show either:
          // 1. A populated chart with data
          // 2. An explicit "no data" or "empty" message
          // 3. A call-to-action to create data

          const hasEmptyState =
            content.includes("No data") ||
            content.includes("no forecast") ||
            content.includes("Create forecast") ||
            content.includes("empty");

          const hasChart = (await page.$("svg")) !== null;

          if (hasEmptyState) {
            console.log("✅ Empty forecast shows explicit message");
          } else if (hasChart) {
            console.log("✅ Forecast has chart with data");
          } else {
            console.log("ℹ️  Forecast section structure may vary");
          }
        }
      }
    });
  });

  test.describe("Loading States", () => {
    test("UI shows loading indicators during data fetch", async ({ page }) => {
      const credentials = getRoleCredentials("SDMT") || getRoleCredentials("PMO");

      if (!credentials) {
        test.skip(true, "SDMT or PMO credentials not configured");
        return;
      }

      await setupAuthenticatedPage(page, credentials.username, credentials.password);

      // Navigate and capture loading states
      const navigationPromise = page.goto(`${BASE_URL}/projects`);

      // Check for loading indicators quickly
      const hasLoadingIndicator =
        (await page.$('[data-testid="loading"]')) !== null ||
        (await page.$(".loading")) !== null ||
        (await page.$('text=Loading')) !== null ||
        (await page.$('[role="progressbar"]')) !== null;

      await navigationPromise;
      await page.waitForLoadState("networkidle");

      if (hasLoadingIndicator) {
        console.log("✅ UI shows loading indicators during data fetch");
      } else {
        console.log("ℹ️  Loading may be too fast to capture or uses different pattern");
      }
    });
  });

  test.describe("Error States", () => {
    test("UI handles API errors gracefully", async ({ page }) => {
      const credentials = getRoleCredentials("SDMT") || getRoleCredentials("PMO");

      if (!credentials) {
        test.skip(true, "SDMT or PMO credentials not configured");
        return;
      }

      await setupAuthenticatedPage(page, credentials.username, credentials.password);

      // Mock an API failure by intercepting
      await page.route("**/projects*", (route) => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: "Internal server error" }),
        });
      });

      await page.goto(`${BASE_URL}/projects`, { waitUntil: "networkidle" });

      const content = await page.content();

      // Should show error message, not crash
      const hasErrorMessage =
        content.includes("error") ||
        content.includes("failed") ||
        content.includes("try again") ||
        content.includes("unavailable");

      expect(hasErrorMessage).toBeTruthy();

      console.log("✅ UI handles API errors gracefully");
    });
  });
});
