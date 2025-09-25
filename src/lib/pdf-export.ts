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
    changeType?: 'positive' | 'negative' | 'neutral';
    color?: string;
  }>;
  charts?: Array<{
    type: 'donut' | 'line' | 'bar';
    title: string;
    data: any[];
  }>;
  summary?: string[];
  recommendations?: string[];
}

export class PDFExporter {
  /**
   * Generate a visually appealing HTML report for printing/PDF
   */
  static generateHTMLReport(data: PDFReportData): string {
    const { title, subtitle, generated, metrics, charts, summary, recommendations } = data;

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
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
            
            .header::before {
              content: '';
              position: absolute;
              top: 0;
              right: 0;
              width: 200px;
              height: 200px;
              background: linear-gradient(45deg, rgba(255,255,255,0.1) 0%, transparent 100%);
              border-radius: 50%;
              transform: translate(50px, -50px);
            }
            
            .header h1 {
              font-size: 2.5rem;
              font-weight: 700;
              margin-bottom: 8px;
              text-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            
            .header .subtitle {
              font-size: 1.2rem;
              opacity: 0.9;
              font-weight: 400;
            }
            
            .header .generated {
              margin-top: 20px;
              font-size: 0.9rem;
              opacity: 0.8;
            }
            
            .content {
              padding: 50px 40px;
            }
            
            .metrics-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
              gap: 24px;
              margin-bottom: 50px;
            }
            
            .metric-card {
              background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
              border-radius: 12px;
              padding: 32px;
              text-align: center;
              position: relative;
              border: 1px solid #e2e8f0;
              transition: transform 0.3s ease, box-shadow 0.3s ease;
            }
            
            .metric-card:hover {
              transform: translateY(-2px);
              box-shadow: 0 8px 25px rgba(0,0,0,0.1);
            }
            
            .metric-value {
              font-size: 2.2rem;
              font-weight: 700;
              margin-bottom: 8px;
            }
            
            .metric-label {
              font-size: 1rem;
              color: #64748b;
              font-weight: 500;
            }
            
            .metric-change {
              margin-top: 8px;
              font-size: 0.85rem;
              font-weight: 600;
              padding: 4px 12px;
              border-radius: 20px;
              display: inline-block;
            }
            
            .metric-change.positive {
              color: #059669;
              background: #d1fae5;
            }
            
            .metric-change.negative {
              color: #dc2626;
              background: #fee2e2;
            }
            
            .metric-change.neutral {
              color: #6b7280;
              background: #f3f4f6;
            }
            
            .section {
              margin-bottom: 50px;
            }
            
            .section-title {
              font-size: 1.8rem;
              font-weight: 600;
              color: #1e293b;
              margin-bottom: 20px;
              padding-bottom: 10px;
              border-bottom: 2px solid #2BB673;
              position: relative;
            }
            
            .section-title::before {
              content: '';
              position: absolute;
              bottom: -2px;
              left: 0;
              width: 60px;
              height: 2px;
              background: linear-gradient(135deg, #2BB673, #22a066);
            }
            
            .summary-list, .recommendations-list {
              list-style: none;
              padding: 0;
            }
            
            .summary-list li, .recommendations-list li {
              background: white;
              margin-bottom: 12px;
              padding: 20px;
              border-radius: 8px;
              border-left: 4px solid #2BB673;
              box-shadow: 0 2px 8px rgba(0,0,0,0.05);
              font-size: 1.05rem;
              line-height: 1.7;
            }
            
            .summary-list li::before {
              content: '✓';
              color: #2BB673;
              font-weight: bold;
              margin-right: 12px;
            }
            
            .recommendations-list li::before {
              content: '→';
              color: #2BB673;
              font-weight: bold;
              margin-right: 12px;
            }
            
            .footer {
              background: #f8fafc;
              padding: 30px 40px;
              text-align: center;
              color: #64748b;
              font-size: 0.9rem;
              border-top: 1px solid #e2e8f0;
            }
            
            .logo {
              width: 32px;
              height: 32px;
              background: #2BB673;
              border-radius: 8px;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-weight: bold;
              margin-right: 12px;
              vertical-align: middle;
            }
            
            @media print {
              body {
                background: white;
                padding: 0;
              }
              
              .report-container {
                box-shadow: none;
                border-radius: 0;
              }
              
              .metric-card:hover {
                transform: none;
                box-shadow: 0 2px 8px rgba(0,0,0,0.05);
              }
            }
          </style>
        </head>
        <body>
          <div class="report-container">
            <div class="header">
              <h1>${title}</h1>
              ${subtitle ? `<div class="subtitle">${subtitle}</div>` : ''}
              <div class="generated">Generated on ${generated}</div>
            </div>
            
            <div class="content">
              ${metrics.length > 0 ? `
                <div class="metrics-grid">
                  ${metrics.map(metric => `
                    <div class="metric-card">
                      <div class="metric-value" ${metric.color ? `style="color: ${metric.color}"` : ''}>${metric.value}</div>
                      <div class="metric-label">${metric.label}</div>
                      ${metric.change ? `
                        <div class="metric-change ${metric.changeType || 'neutral'}">${metric.change}</div>
                      ` : ''}
                    </div>
                  `).join('')}
                </div>
              ` : ''}
              
              ${summary && summary.length > 0 ? `
                <div class="section">
                  <div class="section-title">Executive Summary</div>
                  <ul class="summary-list">
                    ${summary.map(item => `<li>${item}</li>`).join('')}
                  </ul>
                </div>
              ` : ''}
              
              ${recommendations && recommendations.length > 0 ? `
                <div class="section">
                  <div class="section-title">Key Recommendations</div>
                  <ul class="recommendations-list">
                    ${recommendations.map(item => `<li>${item}</li>`).join('')}
                  </ul>
                </div>
              ` : ''}
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
    
    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    if (!printWindow) {
      throw new Error('Popup blocked - please allow popups for this site');
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
   */
  static createShareableURL(data: PDFReportData, baseUrl: string = window.location.origin): string {
    const compressedData = btoa(JSON.stringify(data));
    return `${baseUrl}/shared/report?data=${compressedData}`;
  }
}

// Helper function to format currency values
export const formatReportCurrency = (amount: number, currency = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// Helper function to format percentages
export const formatReportPercentage = (value: number, decimals = 1): string => {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
};

// Helper function to determine change type
export const getChangeType = (value: number): 'positive' | 'negative' | 'neutral' => {
  if (value > 0) return 'positive';
  if (value < 0) return 'negative';
  return 'neutral';
};