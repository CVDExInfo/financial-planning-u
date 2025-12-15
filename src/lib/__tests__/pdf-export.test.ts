import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PDFExporter } from "@/lib/pdf-export";

describe("PDFExporter", () => {
  it("generateHTMLReport contains svg for charts", () => {
    const html = PDFExporter.generateHTMLReport({
      title: "T",
      generated: "01/01/2025",
      metrics: [],
      charts: [
        {
          type: "donut" as const,
          title: "A",
          data: [
            { name: "Labor", value: 100 },
            { name: "Non-Labor", value: 50 },
          ],
        },
      ],
      summary: [],
    });
    assert.ok(html.includes("<svg"));
    assert.ok(html.includes("Labor"));
    assert.ok(html.includes("Non-Labor"));
  });

  it("renders metadata fields in the header", () => {
    const html = PDFExporter.generateHTMLReport({
      title: "Baseline",
      subtitle: "Summary",
      generated: "02/02/2025",
      metrics: [],
      summary: [],
      metadata: {
        projectName: "Project X",
        projectId: "PRJ-123",
        baselineId: "BL-999",
        preparedBy: "user@example.com",
        currency: "USD",
      },
    });

    assert.ok(html.includes("Project X"));
    assert.ok(html.includes("PRJ-123"));
    assert.ok(html.includes("BL-999"));
    assert.ok(html.includes("user@example.com"));
    assert.ok(html.includes("USD"));
  });
});
