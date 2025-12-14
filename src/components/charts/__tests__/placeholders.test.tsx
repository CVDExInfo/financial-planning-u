import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToString } from "react-dom/server";
import { DonutChart } from "../DonutChart";
import { LineChartComponent } from "../LineChart";

describe("chart placeholders", () => {
  it("renders a placeholder for empty line chart data", () => {
    const html = renderToString(
      <LineChartComponent
        data={[]}
        lines={[{ dataKey: "value", name: "Value" }]}
        title="Line Placeholder"
      />
    );

    assert.match(html, /No data available/);
  });

  it("renders a placeholder for empty donut chart data", () => {
    const html = renderToString(
      <DonutChart
        data={[]}
        title="Donut Placeholder"
        emptyStateMessage="No data available"
        emptyStateDetail="Esperando datos de asignaciones"
      />
    );

    assert.match(html, /No data available/);
    assert.match(html, /Esperando datos de asignaciones/);
  });
});

