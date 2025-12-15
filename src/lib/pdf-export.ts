/**
 * Enhanced PDF export utilities for creating visually appealing reports
 * Creates professional-grade PDFs that demonstrate real business value
 */

interface PDFReportData {
  title: string;
  subtitle?: string;
  generated: string;
  metrics: Array<{
    label: string;
    value: string;
    change?: string;
    changeType?: "positive" | "negative" | "neutral";
    color?: string;
  }>;
  charts?: Array<{
    type: "donut" | "line" | "bar";
    title: string;
    data: any[];
    stacks?: Array<{ dataKey: string; name: string; color?: string }>;
  }>;
  summary?: string[];
  recommendations?: string[];
  metadata?: {
    projectName?: string;
    projectId?: string;
    baselineId?: string;
    preparedBy?: string;
    currency?: string;
  };
  baselineDetails?: {
    baselineId?: string;
    signatureStatus?: string;
    durationMonths?: number;
    teamSize?: string;
    roleCount?: number;
    totalLabor?: string;
    totalNonLabor?: string;
    contractValue?: string;
    currency?: string;
  };
}

export class PDFExporter {
  /**
   * Generate a visually appealing HTML report for printing/PDF
   */
  static generateHTMLReport(data: PDFReportData): string {
    const {
      title,
      subtitle,
      generated,
      metrics,
      charts,
      summary,
      recommendations,
      metadata,
      baselineDetails,
    } = data;

    const getDefaultColor = (i: number) => {
      const DEFAULT = [
        "#2BB673",
        "#14B8A6",
        "#f59e0b",
        "#6366f1",
        "#e11d48",
        "#8b5cf6",
      ];
      return DEFAULT[i % DEFAULT.length];
    };

    const escapeHtml = (s: string) =>
      String(s).replace(
        /[&<>"']/g,
        (m) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          }[m] as string),
      );

    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
      }).format(amount);
    };

    // NOTE: We render a slightly smaller donut for PDF to avoid label collisions
    // while keeping the on-screen charts unchanged. These dimensions are scoped
    // to the PDF export path only.
    const generateDonutSVG = (
      dataPoints: Array<{ name: string; value: number; color?: string }>,
      width = 480,
      height = 280,
    ) => {
      const total = dataPoints.reduce((s, d) => s + (d.value || 0), 0);
      const radius = Math.min(width, height) / 2 - 48;
      const innerRadius = radius * 0.62;
      const cx = width / 2;
      const cy = height / 2 - 10;
      let startAngle = -90;
      const colors = dataPoints.map((d, i) => d.color || getDefaultColor(i));

      const arcs = dataPoints.map((d, i) => {
        const value = d.value || 0;
        const angle = total > 0 ? (value / total) * 360 : 0;
        const endAngle = startAngle + angle;
        const largeArcFlag = angle > 180 ? 1 : 0;

        const outerStartX = cx + radius * Math.cos((Math.PI * startAngle) / 180);
        const outerStartY = cy + radius * Math.sin((Math.PI * startAngle) / 180);
        const outerEndX = cx + radius * Math.cos((Math.PI * endAngle) / 180);
        const outerEndY = cy + radius * Math.sin((Math.PI * endAngle) / 180);

        const innerStartX = cx + innerRadius * Math.cos((Math.PI * startAngle) / 180);
        const innerStartY = cy + innerRadius * Math.sin((Math.PI * startAngle) / 180);
        const innerEndX = cx + innerRadius * Math.cos((Math.PI * endAngle) / 180);
        const innerEndY = cy + innerRadius * Math.sin((Math.PI * endAngle) / 180);

        const path =
          angle === 0
            ? ""
            : `<path d="M ${outerStartX} ${outerStartY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${outerEndX} ${outerEndY} L ${innerEndX} ${innerEndY} A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerStartX} ${innerStartY} Z" fill="${colors[i]}" />`;

        const midAngle = startAngle + angle / 2;
        const labelRadius = (radius + innerRadius) / 2;
        const lx = cx + labelRadius * Math.cos((Math.PI * midAngle) / 180);
        const ly = cy + labelRadius * Math.sin((Math.PI * midAngle) / 180);

        const percentText = total > 0 ? `${Math.round((value / total) * 100)}%` : "0%";
        const label =
          angle < 18
            ? ""
            : `<text x="${lx}" y="${ly}" fill="white" font-size="12" text-anchor="${lx > cx ? "start" : "end"}">${percentText}</text>`;

        startAngle += angle;
        return { path, label };
      });

      let currentX = 20;
      let currentY = Math.min(height - 34, cy + radius + 26);
      const legendMaxWidth = width - 40;
      const legendItems = dataPoints
        .map((d, i) => {
          const color = colors[i];
          const labelText = `${escapeHtml(
            d.name.length > 28 ? `${d.name.slice(0, 25)}…` : d.name,
          )} - ${formatCurrency(d.value || 0)}`;
          const estimatedWidth = Math.min(labelText.length * 7, 240);
          if (currentX + estimatedWidth > legendMaxWidth) {
            currentX = 20;
            currentY += 22;
          }
          const legend = `<g transform="translate(${currentX}, ${currentY})">
          <rect x="0" y="-12" width="14" height="14" rx="3" fill="${color}" />
          <text x="22" y="0" font-size="12" fill="#1a1a1a">${labelText}</text>
        </g>`;
          currentX += estimatedWidth + 18;
          return legend;
        })
        .join("");

      const svgPaths = arcs.map((a) => `${a.path}${a.label}`).join("");

      return `<svg width="${width}px" height="${height}px" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <style type="text/css">
            .label { font-family: 'Inter', Arial, sans-serif; }
          </style>
        </defs>
        ${svgPaths}
        <circle cx="${cx}" cy="${cy}" r="${innerRadius * 0.82}" fill="white" />
        ${legendItems}
      </svg>`;
    };

    // NOTE: PDF charts get tighter padding to keep bars visible even with many months.
    const generateStackedBarSVG = (
      monthlyData: Array<any>,
      stacks: Array<{ dataKey: string; name: string; color?: string }>,
      width = 560,
      height = 300,
    ) => {
      const rotateLabels = monthlyData.length > 8;
      const padding = {
        top: 50,
        right: 18,
        bottom: rotateLabels ? 64 : 42,
        left: 66,
      };
      const innerWidth = width - padding.left - padding.right;
      const innerHeight = height - padding.top - padding.bottom;

      const maxVal =
        monthlyData.reduce((max, row) => {
          const total = stacks.reduce((s, st) => s + (row[st.dataKey] || 0), 0);
          return Math.max(max, total);
        }, 0) || 1;

      const barW = innerWidth / Math.max(1, monthlyData.length);
      const palette = stacks.map((s, i) => s.color || getDefaultColor(i));
      const labelStep = rotateLabels ? Math.ceil(monthlyData.length / 8) : 1;

      const bars = monthlyData
        .map((row, idx) => {
          const x = padding.left + idx * barW;
          let yAcc = padding.top + innerHeight;
          const parts = stacks.map((st, sIdx) => {
            const val = row[st.dataKey] || 0;
            const h = Math.min((val / maxVal) * innerHeight, innerHeight);
            yAcc -= h;
            const widthAdjusted = Math.max(barW - 4, 2);
            const rect = `<rect x="${x + (barW - widthAdjusted) / 2}" y="${yAcc}" width="${widthAdjusted}" height="${h}" fill="${palette[sIdx]}" rx="2" />`;
            return { rect };
          });
          const shouldRenderLabel = idx % labelStep === 0;
          const labelY = padding.top + innerHeight + 22;
          const xLabel = shouldRenderLabel
            ? `<text transform="translate(${x + barW / 2}, ${labelY}) rotate(-35)" font-size="11" text-anchor="end">M${
                row.month
              }</text>`
            : "";
          return parts.map((p) => p.rect).join("") + xLabel;
        })
        .join("");

      const ticks = 4;
      const yTicks = Array.from({ length: ticks + 1 })
        .map((_, i) => {
          const val = Math.round((maxVal / ticks) * i);
          const y = padding.top + innerHeight - (i / ticks) * innerHeight;
          return `<g><line x1="${padding.left}" x2="${width - padding.right}" y1="${y}" y2="${y}" stroke="#e6edf0" stroke-dasharray="3 3" /><text x="${
            padding.left - 8
          }" y="${y + 4}" font-size="11" text-anchor="end">${formatCurrency(val)}</text></g>`;
        })
        .join("");

      const legendSpacing = 150;
      const legend = stacks
        .map((st, i) => {
          const x = padding.left + i * legendSpacing;
          return `<g transform="translate(${x}, ${padding.top - 20})"><rect x="0" y="0" width="14" height="14" fill="${
            st.color || getDefaultColor(i)
          }" rx="3"/><text x="20" y="12" font-size="12" fill="#1a1a1a">${escapeHtml(
            st.name,
          )}</text></g>`;
        })
        .join("");

      return `<svg width="${width}px" height="${height}px" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs><style>.label{font-family:'Inter',Arial,sans-serif;}</style></defs>
        ${yTicks}
        ${bars}
        ${legend}
      </svg>`;
    };

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${escapeHtml(title)}</title>
          <meta charset="UTF-8">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              line-height: 1.6;
              color: #1a1a1a;
              background: #f6f8fb;
              min-height: 100vh;
              padding: 24px;
            }
            .report-container {
              width: 100%;
              max-width: 100%;
              margin: 0 auto;
              background: white;
              border-radius: 12px;
              box-shadow: 0 16px 30px rgba(0,0,0,0.08);
              overflow: hidden;
            }
            .header {
              background: linear-gradient(135deg, #2BB673 0%, #22a066 100%);
              color: white;
              padding: 36px 40px 28px;
              text-align: left;
              position: relative;
              overflow: hidden;
            }
            .env-label { display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px; background: rgba(255,255,255,0.16); border-radius: 999px; font-size: 0.9rem; margin-bottom: 12px; }
            .header h1 { font-size: 2.4rem; font-weight: 700; margin-bottom: 8px; text-shadow: 0 2px 4px rgba(0,0,0,0.08); }
            .header .subtitle { font-size: 1.1rem; opacity: 0.92; font-weight: 400; }
            .header .generated { margin-top: 10px; font-size: 0.95rem; opacity: 0.9; }
            .metadata-grid { margin-top: 18px; display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
            .metadata-pill { background: rgba(255,255,255,0.14); padding: 10px 14px; border-radius: 12px; backdrop-filter: blur(2px); border: 1px solid rgba(255,255,255,0.18); }
            .metadata-label { font-size: 0.8rem; letter-spacing: 0.02em; opacity: 0.85; }
            .metadata-value { font-weight: 600; font-size: 1rem; margin-top: 4px; }
            .content { padding: 32px 32px 42px; background: #f6f8fb; }
            .section { margin-bottom: 36px; break-inside: avoid; }
            .metrics-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; margin-bottom: 28px; }
            .metric-card { background: white; border-radius: 12px; padding: 18px; text-align: left; position: relative; border: 1px solid #e2e8f0; display: grid; gap: 6px; min-height: 120px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.6); }
            .metric-value { font-size: 1.8rem; font-weight: 700; margin-bottom: 2px; }
            .metric-label { font-size: 0.95rem; color: #475569; font-weight: 600; text-transform: uppercase; letter-spacing: 0.02em; }
            .metric-change { margin-top: 2px; font-size: 0.85rem; font-weight: 600; padding: 4px 10px; border-radius: 10px; display: inline-flex; width: fit-content; }
            .metric-change.positive { color: #059669; background: #d1fae5; }
            .metric-change.negative { color: #dc2626; background: #fee2e2; }
            .metric-change.neutral { color: #6b7280; background: #f3f4f6; }
            .section-title { font-size: 1.5rem; font-weight: 700; color: #0f172a; margin-bottom: 14px; display: flex; align-items: center; gap: 10px; }
            .section-title::after { content: ""; flex: 1; height: 2px; background: linear-gradient(90deg, #2BB673, transparent); }
            .summary-list, .recommendations-list { list-style: none; padding: 0; }
            .summary-list li, .recommendations-list li { background: white; margin-bottom: 12px; padding: 20px; border-radius: 8px; border-left: 4px solid #2BB673; box-shadow: 0 2px 8px rgba(0,0,0,0.05); font-size: 1.05rem; line-height: 1.7; }
            .summary-list li::before { content: '✓'; color: #2BB673; font-weight: bold; margin-right: 12px; }
            .recommendations-list li::before { content: '→'; color: #2BB673; font-weight: bold; margin-right: 12px; }
            .charts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 12px; }
            .chart-card { background: #fff; border: 1px solid #e2e8f0; padding: 14px; border-radius: 12px; text-align: center; break-inside: avoid; }
            .chart-card h4 { font-size: 1.05rem; margin-bottom: 10px; text-align: left; color: #0f172a; }
            .details-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
            .detail-item { background: white; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; display: grid; gap: 6px; }
            .detail-label { font-size: 0.85rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; }
            .detail-value { font-size: 1.05rem; font-weight: 700; color: #111827; }
            .details-section { page-break-before: always; }
            .footer { background: #0b1625; padding: 18px 32px; display: flex; align-items: center; justify-content: space-between; color: #e2e8f0; font-size: 0.95rem; letter-spacing: 0.01em; }
            @media print {
              @page { size: Letter; margin: 12mm; }
              body { background: white; padding: 0; }
              .report-container { width: 100%; max-width: none; box-shadow: none; border-radius: 0; }
              .content { padding: 24px 16px 30px; }
              .header { padding: 28px 28px 18px; }
              .metrics-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
              .section { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="report-container">
            <div class="header">
              <div class="env-label">PMO • Baseline Summary</div>
              <h1>${escapeHtml(title)}</h1>
              ${subtitle ? `<div class="subtitle">${escapeHtml(subtitle)}</div>` : ""}
              <div class="metadata-grid">
                <div class="metadata-pill">
                  <div class="metadata-label">Project Name</div>
                  <div class="metadata-value">${escapeHtml(metadata?.projectName || "N/A")}</div>
                </div>
                <div class="metadata-pill">
                  <div class="metadata-label">Project ID</div>
                  <div class="metadata-value">${escapeHtml(metadata?.projectId || "N/A")}</div>
                </div>
                <div class="metadata-pill">
                  <div class="metadata-label">Baseline ID</div>
                  <div class="metadata-value">${escapeHtml(metadata?.baselineId || "N/A")}</div>
                </div>
                <div class="metadata-pill">
                  <div class="metadata-label">Generated</div>
                  <div class="metadata-value">${escapeHtml(generated)}</div>
                </div>
                ${metadata?.preparedBy
                  ? `<div class="metadata-pill"><div class="metadata-label">Prepared by</div><div class="metadata-value">${escapeHtml(metadata.preparedBy)}</div></div>`
                  : ""}
                ${metadata?.currency
                  ? `<div class="metadata-pill"><div class="metadata-label">Currency</div><div class="metadata-value">${escapeHtml(metadata.currency)}</div></div>`
                  : ""}
              </div>
              <div class="generated">Executive-ready baseline summary</div>
            </div>

            <div class="content">
              ${
                metrics.length > 0
                  ? `
                <div class="metrics-grid">
                  ${metrics
                    .map(
                      (metric) => `
                    <div class="metric-card">
                      <div class="metric-value" ${metric.color ? `style="color: ${metric.color}"` : ""}>${metric.value}</div>
                      <div class="metric-label">${escapeHtml(metric.label)}</div>
                      ${
                        metric.change
                          ? `<div class="metric-change ${metric.changeType || "neutral"}">${escapeHtml(metric.change)}</div>`
                          : ""
                      }
                    </div>
                  `,
                    )
                    .join("")}
                </div>
              `
                  : ""
              }

              ${
                summary && summary.length > 0
                  ? `
                <div class="section">
                  <div class="section-title">Executive Summary</div>
                  <ul class="summary-list">
                    ${summary.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
                  </ul>
                </div>
              `
                  : ""
              }

              ${
                recommendations && recommendations.length > 0
                  ? `
                <div class="section">
                  <div class="section-title">Key Recommendations</div>
                  <ul class="recommendations-list">
                    ${recommendations.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
                  </ul>
                </div>
              `
                  : ""
              }

              ${
                charts && charts.length
                  ? `
                <div class="section">
                  <div class="section-title">Análisis de Costos e Insights</div>
                  <div class="charts-grid">
                    ${charts
                      .map((chart) => {
                        if (chart.type === "donut") {
                          return `<div class="chart-card"><h4 style="text-align:left;margin-bottom:8px;">${escapeHtml(chart.title)}</h4>${generateDonutSVG(
                            chart.data,
                            460,
                            280,
                          )}</div>`;
                        }
                        if (chart.type === "bar") {
                          return `<div class="chart-card"><h4 style="text-align:left;margin-bottom:8px;">${escapeHtml(chart.title)}</h4>${generateStackedBarSVG(
                            chart.data,
                            chart.stacks || [],
                            520,
                            300,
                          )}</div>`;
                        }
                        return "";
                      })
                      .join("")}
                  </div>
                </div>
              `
                  : ""
              }

              ${
                baselineDetails
                  ? `
                <div class="section details-section">
                  <div class="section-title">Baseline Details</div>
                  <div class="details-grid">
                    ${
                      [
                        { label: "Baseline ID", value: baselineDetails.baselineId || "N/A" },
                        { label: "Signature Status", value: baselineDetails.signatureStatus || "Pending" },
                        { label: "Duration (months)", value: baselineDetails.durationMonths?.toString() || "N/A" },
                        { label: "Team Size", value: baselineDetails.teamSize || "N/A" },
                        { label: "Role Count", value: baselineDetails.roleCount?.toString() || "N/A" },
                        { label: "Total Labor", value: baselineDetails.totalLabor || "N/A" },
                        { label: "Total Non-Labor", value: baselineDetails.totalNonLabor || "N/A" },
                        { label: "Valor del contrato", value: baselineDetails.contractValue || "-" },
                        { label: "Currency", value: baselineDetails.currency || metadata?.currency || "N/A" },
                      ]
                        .map(
                          (detail) => `
                        <div class="detail-item">
                          <div class="detail-label">${escapeHtml(detail.label)}</div>
                          <div class="detail-value">${escapeHtml(detail.value || "N/A")}</div>
                        </div>
                      `,
                        )
                        .join("")
                    }
                  </div>
                </div>
              `
                  : ""
              }

            </div>

            <div class="footer">
              <div>Ikusi • Finanzas SD</div>
              <div>Confidential • Generated ${escapeHtml(generated)}</div>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Generate and display a PDF report
   */
  static async exportToPDF(data: PDFReportData): Promise<void> {
    const htmlContent = this.generateHTMLReport(data);

    const printWindow = window.open("", "_blank", "width=1200,height=800");
    if (!printWindow) {
      throw new Error("Popup blocked - please allow popups for this site");
    }

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();

    // Wait for content to load, then trigger print
    setTimeout(() => {
      printWindow.print();
    }, 500);
  }

  /**
   * Create a shareable URL with report data
   * Note: baseUrl should be the CloudFront domain from VITE_CLOUDFRONT_URL env var
   * NOT window.location.origin or github.dev URLs
   */
  static createShareableURL(data: PDFReportData, baseUrl: string = ""): string {
    const compressedData = btoa(JSON.stringify(data));
    const finalUrl = baseUrl
      ? `${baseUrl}/shared/report?data=${compressedData}`
      : `/shared/report?data=${compressedData}`;
    return finalUrl;
  }
}

// Helper function to format currency values
export const formatReportCurrency = (
  amount: number,
  currency = "USD",
): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// Helper function to format percentages
export const formatReportPercentage = (value: number, decimals = 1): string => {
  return `${value >= 0 ? "+" : ""}${value.toFixed(decimals)}%`;
};

// Helper function to determine change type
export const getChangeType = (
  value: number,
): "positive" | "negative" | "neutral" => {
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "neutral";
};
