import { test, expect } from "@playwright/test";
import { login, collectApiCalls } from "./support";

test.describe("Finanzas login & shell", () => {
  test("logs in and lands on Finanzas home", async ({ page }) => {
    const calls = collectApiCalls(page);
    await login(page);

    await expect(
      page.getByRole("heading", { name: /Finanzas · Gestión Presupuesto/i })
    ).toBeVisible();
    await expect(
      page
        .getByRole("navigation")
        .getByRole("link", { name: "Proyectos", exact: true })
    ).toBeVisible();
    await expect(
      page
        .getByRole("navigation")
        .getByRole("link", { name: "Catálogo de Rubros", exact: true })
    ).toBeVisible();

    const apiCalls = calls.filter((c) =>
      c.url.startsWith("https://pyorjw6lbe.execute-api.us-east-2.amazonaws.com")
    );
    apiCalls.forEach((call) => {
      expect(call.url).toContain("/dev/");
      expect(call.method).toMatch(/GET|POST|PUT|OPTIONS|HEAD/);
    });
  });
});
