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

    const generateDonutSVG = (
      dataPoints: Array<{ name: string; value: number; color?: string }>,
      width = 520,
      height = 300,
    ) => {
      const total = dataPoints.reduce((s, d) => s + (d.value || 0), 0);
      const radius = Math.min(width, height) / 2 - 20;
      const cx = width / 2;
      const cy = height / 2;
      let startAngle = -90;
      const colors = dataPoints.map((d, i) => d.color || getDefaultColor(i));

      const arcs = dataPoints.map((d, i) => {
        const value = d.value || 0;
        const angle = total > 0 ? (value / total) * 360 : 0;
        const endAngle = startAngle + angle;
        const largeArcFlag = angle > 180 ? 1 : 0;

        const sx = cx + radius * Math.cos((Math.PI * startAngle) / 180);
        const sy = cy + radius * Math.sin((Math.PI * startAngle) / 180);
        const ex = cx + radius * Math.cos((Math.PI * endAngle) / 180);
        const ey = cy + radius * Math.sin((Math.PI * endAngle) / 180);

        const path =
          angle === 0
            ? ""
            : `<path d="M ${cx} ${cy} L ${sx} ${sy} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${ex} ${ey} Z" fill="${colors[i]}" />`;

        const midAngle = startAngle + angle / 2;
        const labelRadius = radius * 0.6;
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

      const legendItems = dataPoints
        .map((d, i) => {
          const color = colors[i];
          return `<g transform="translate(${20 + i * 170}, ${height - 30})">
          <rect x="0" y="-12" width="14" height="14" rx="3" fill="${color}" />
          <text x="22" y="0" font-size="12" fill="#1a1a1a">${escapeHtml(d.name)} - ${formatCurrency(
            d.value || 0,
          )}</text>
        </g>`;
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
        ${legendItems}
      </svg>`;
    };

    const generateStackedBarSVG = (
      monthlyData: Array<any>,
      stacks: Array<{ dataKey: string; name: string; color?: string }>,
      width = 520,
      height = 300,
    ) => {
      const padding = { top: 20, right: 20, bottom: 40, left: 60 };
      const innerWidth = width - padding.left - padding.right;
      const innerHeight = height - padding.top - padding.bottom;

      const maxVal =
        monthlyData.reduce((max, row) => {
          const total = stacks.reduce((s, st) => s + (row[st.dataKey] || 0), 0);
          return Math.max(max, total);
        }, 0) || 1;

      const barW = innerWidth / Math.max(1, monthlyData.length);
      const palette = stacks.map((s, i) => s.color || getDefaultColor(i));

      const bars = monthlyData
        .map((row, idx) => {
          const x = padding.left + idx * barW;
          let yAcc = padding.top + innerHeight;
          const parts = stacks.map((st, sIdx) => {
            const val = row[st.dataKey] || 0;
            const h = (val / maxVal) * innerHeight;
            yAcc -= h;
            const rect = `<rect x="${x + 4}" y="${yAcc}" width="${barW - 8}" height="${h}" fill="${palette[sIdx]}" rx="2" />`;
            return { rect };
          });
          const xLabel = `<text x="${x + barW / 2}" y="${padding.top + innerHeight + 18}" font-size="11" text-anchor="middle">M${row.month}</text>`;
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

      const legend = stacks
        .map((st, i) => {
          const x = padding.left + i * 140;
          return `<g transform="translate(${x}, ${padding.top - 6})"><rect x="0" y="0" width="14" height="14" fill="${
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
              background: linear-gradient(135deg, #f8fffe 0%, #f0f9ff 100%);
              min-height: 100vh;
              padding: 40px;
            }
            .report-container {
              max-width: 1200px;
              margin: 0 auto;
              background: white;
              border-radius: 16px;
              box-shadow: 0 20px 40px rgba(0,0,0,0.1);
              overflow: hidden;
            }
            .header {
              background: linear-gradient(135deg, #2BB673 0%, #22a066 100%);
              color: white;
              padding: 60px 40px;
              text-align: center;
              position: relative;
              overflow: hidden;
            }
            .header h1 { font-size: 2.5rem; font-weight: 700; margin-bottom: 8px; text-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .header .subtitle { font-size: 1.2rem; opacity: 0.9; font-weight: 400; }
            .header .generated { margin-top: 20px; font-size: 0.9rem; opacity: 0.8; }
            .content { padding: 50px 40px; }
            .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; margin-bottom: 50px; }
            .metric-card { background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 12px; padding: 32px; text-align: center; position: relative; border: 1px solid #e2e8f0; transition: transform 0.3s ease, box-shadow 0.3s ease; }
            .metric-value { font-size: 2.2rem; font-weight: 700; margin-bottom: 8px; }
            .metric-label { font-size: 1rem; color: #64748b; font-weight: 500; }
            .metric-change { margin-top: 8px; font-size: 0.85rem; font-weight: 600; padding: 4px 12px; border-radius: 20px; display: inline-block; }
            .metric-change.positive { color: #059669; background: #d1fae5; }
            .metric-change.negative { color: #dc2626; background: #fee2e2; }
            .metric-change.neutral { color: #6b7280; background: #f3f4f6; }
            .section { margin-bottom: 50px; }
            .section-title { font-size: 1.8rem; font-weight: 600; color: #1e293b; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #2BB673; position: relative; }
            .summary-list, .recommendations-list { list-style: none; padding: 0; }
            .summary-list li, .recommendations-list li { background: white; margin-bottom: 12px; padding: 20px; border-radius: 8px; border-left: 4px solid #2BB673; box-shadow: 0 2px 8px rgba(0,0,0,0.05); font-size: 1.05rem; line-height: 1.7; }
            .summary-list li::before { content: '✓'; color: #2BB673; font-weight: bold; margin-right: 12px; }
            .recommendations-list li::before { content: '→'; color: #2BB673; font-weight: bold; margin-right: 12px; }
            .charts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 20px; }
            .chart-card { background: #fff; border: 1px solid #eef2f7; padding: 16px; border-radius: 12px; text-align: center; }
            .footer { background: #f8fafc; padding: 30px 40px; text-align: center; color: #64748b; font-size: 0.9rem; border-top: 1px solid #e2e8f0; }
            .logo { width: 32px; height: 32px; background: #2BB673; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; color: white; font-weight: bold; margin-right: 12px; vertical-align: middle; }
            @media print {
              body { background: white; padding: 0; }
              .report-container { box-shadow: none; border-radius: 0; }
            }
          </style>
        </head>
        <body>
          <div class="report-container">
            <div class="header">
              <h1>${escapeHtml(title)}</h1>
              ${subtitle ? `<div class="subtitle">${escapeHtml(subtitle)}</div>` : ""}
              <div class="generated">Generated on ${escapeHtml(generated)}</div>
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
                            520,
                            300,
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

            </div>

            <div class="footer">
              <div class="logo">I</div>
              Professional Financial Planning & Management Platform
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
