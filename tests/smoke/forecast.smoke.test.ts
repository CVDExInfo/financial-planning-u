import { test, expect } from "@playwright/test";

test("forecast route loads without ReferenceError", async ({ page }) => {
  const consoleErrors: string[] = [];

  page.on("pageerror", (error) => {
    consoleErrors.push(error.message);
  });

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  const baseUrl = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:4173/finanzas";
  await page.goto(`${baseUrl}/sdmt/cost/forecast`, { waitUntil: "networkidle" });

  const referenceErrors = consoleErrors.filter((err) => err.includes("ReferenceError"));
  expect(referenceErrors, `Console errors: ${consoleErrors.join("\n")}`).toEqual([]);
});
