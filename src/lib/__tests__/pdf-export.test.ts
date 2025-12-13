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
});
