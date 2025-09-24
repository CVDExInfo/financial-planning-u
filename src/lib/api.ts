import { z } from 'zod';
import type { 
  BaselineBudget, 
  BillingPlan, 
  ForecastCell, 
  InvoiceDoc, 
  LineItem, 
  Scenario, 
  Approval, 
  Project 
} from '@/types/domain';

// Import mock data
import baselineData from '@/mocks/baseline.json';
import forecastData from '@/mocks/forecast.json';
import invoicesData from '@/mocks/invoices.json';
import billingPlanData from '@/mocks/billing-plan.json';

// Validation schemas
const CreateBaselineSchema = z.object({
  project_id: z.string(),
  line_items: z.array(z.any()),
  monthly_totals: z.array(z.any()),
  created_by: z.string(),
  assumptions: z.array(z.string()).optional(),
});

export class ApiService {
  private static baseUrl = '/api'; // Will be replaced with real API

  // PMO Estimator APIs
  static async createBaseline(data: z.infer<typeof CreateBaselineSchema>) {
    try {
      const validated = CreateBaselineSchema.parse(data);
      
      // Mock implementation - generate signature hash
      const signature_hash = `SHA256:${Math.random().toString(36).substring(2, 15)}`;
      const baseline_id = `BSL-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      
      await this.delay(800); // Simulate network delay
      
      return {
        baseline_id,
        signature_hash,
        created_at: new Date().toISOString(),
      };
    } catch (error) {
      throw new Error('Failed to create baseline: ' + (error as Error).message);
    }
  }

  static async getBillingPlan(projectId: string): Promise<BillingPlan> {
    await this.delay(300);
    
    // Return mock data for now
    return {
      project_id: projectId,
      monthly_inflows: billingPlanData.monthly_inflows,
    };
  }

  // SDMT APIs
  static async getLineItems(projectId: string): Promise<LineItem[]> {
    await this.delay(400);
    
    // Return mock data based on baseline
    return baselineData.line_items as LineItem[];
  }

  static async createLineItem(data: Omit<LineItem, 'id'>): Promise<LineItem> {
    await this.delay(500);
    
    return {
      ...data,
      id: `LI-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
    };
  }

  static async updateLineItem(id: string, data: Partial<LineItem>): Promise<LineItem> {
    await this.delay(400);
    
    // Mock update - find existing item and merge
    const existing = baselineData.line_items.find(item => item.id === id) as LineItem;
    if (!existing) {
      throw new Error('Line item not found');
    }
    
    return { ...existing, ...data };
  }

  static async deleteLineItem(id: string): Promise<void> {
    await this.delay(300);
    // Mock deletion - in real app would remove from database
  }

  // Forecast APIs
  static async getForecast(projectId: string, period?: string): Promise<ForecastCell[]> {
    await this.delay(600);
    
    // Transform mock data to ForecastCell format
    const cells: ForecastCell[] = [];
    
    forecastData.periods.forEach(period => {
      period.forecasts.forEach(forecast => {
        cells.push({
          line_item_id: period.line_item_id,
          month: forecast.month,
          planned: forecast.planned,
          forecast: forecast.forecast,
          actual: forecast.actual,
          variance: forecast.variance,
          variance_reason: forecast.variance_reason as ForecastCell['variance_reason'],
          notes: (forecast as any).notes,
        });
      });
    });
    
    return cells;
  }

  static async updateForecast(cells: ForecastCell[]): Promise<ForecastCell[]> {
    await this.delay(700);
    
    // Mock update - in real implementation would save to database
    return cells;
  }

  static async importForecast(file: File): Promise<{ success: number; errors: string[] }> {
    await this.delay(1500); // Longer delay for file processing
    
    // Mock import validation
    const errors: string[] = [];
    if (file.size > 10 * 1024 * 1024) {
      errors.push('File size exceeds 10MB limit');
    }
    if (!file.name.match(/\.(csv|xlsx)$/i)) {
      errors.push('File must be CSV or Excel format');
    }
    
    // Simulate some import errors for demo
    if (Math.random() > 0.8) {
      errors.push('Row 45: Invalid date format');
      errors.push('Row 67: Missing line item ID');
    }
    
    const success = Math.floor(Math.random() * 100) + 150; // Mock success count
    
    return { success, errors };
  }

  // Reconciliation APIs
  static async getInvoices(projectId: string): Promise<InvoiceDoc[]> {
    await this.delay(450);
    
    return invoicesData as InvoiceDoc[];
  }

  static async uploadInvoice(file: File, lineItemId: string, month: number): Promise<InvoiceDoc> {
    await this.delay(1200);
    
    return {
      id: `INV-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      line_item_id: lineItemId,
      month,
      file_url: `/uploads/${file.name}`,
      status: 'Pending',
    };
  }

  static async updateInvoiceStatus(id: string, status: InvoiceDoc['status'], comment?: string): Promise<InvoiceDoc> {
    await this.delay(400);
    
    const existing = invoicesData.find(inv => inv.id === id) as InvoiceDoc;
    if (!existing) {
      throw new Error('Invoice not found');
    }
    
    return {
      ...existing,
      status,
      comments: comment ? [...(existing.comments || []), comment] : existing.comments,
    };
  }

  // Cash Flow APIs
  static async getCashFlow(projectId: string, period?: string): Promise<{
    inflows: { month: number; amount: number }[];
    outflows: { month: number; amount: number }[];
    margin_pct: { month: number; pct: number }[];
  }> {
    await this.delay(800);
    
    const billingPlan = await this.getBillingPlan(projectId);
    const forecast = await this.getForecast(projectId);
    
    // Calculate outflows by month
    const outflowsByMonth = new Map<number, number>();
    forecast.forEach(cell => {
      const current = outflowsByMonth.get(cell.month) || 0;
      outflowsByMonth.set(cell.month, current + (cell.actual || cell.forecast));
    });
    
    const outflows = Array.from(outflowsByMonth.entries())
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => a.month - b.month);
    
    // Calculate margin percentages
    const margin_pct = billingPlan.monthly_inflows.map(inflow => {
      const outflow = outflowsByMonth.get(inflow.month) || 0;
      const margin = ((inflow.amount - outflow) / inflow.amount) * 100;
      return { month: inflow.month, pct: Math.max(0, margin) };
    });
    
    return {
      inflows: billingPlan.monthly_inflows,
      outflows,
      margin_pct,
    };
  }

  // Scenarios APIs
  static async getScenarios(projectId: string): Promise<Scenario[]> {
    await this.delay(350);
    
    // Mock scenarios
    return [
      {
        id: 'SCN-001',
        name: 'Baseline',
        baseline_id: baselineData.baseline_id,
        deltas: [],
      },
      {
        id: 'SCN-002', 
        name: 'FX Rate +15%',
        baseline_id: baselineData.baseline_id,
        deltas: [{ type: 'fx_adjustment', factor: 1.15 }],
      },
      {
        id: 'SCN-003',
        name: 'Delayed Start (2 months)',
        baseline_id: baselineData.baseline_id,
        deltas: [{ type: 'timeline_shift', months: 2 }],
      },
    ];
  }

  static async createScenario(data: Omit<Scenario, 'id'>): Promise<Scenario> {
    await this.delay(600);
    
    return {
      ...data,
      id: `SCN-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
    };
  }

  // Change Management APIs
  static async getChanges(projectId: string): Promise<{
    id: string;
    title: string;
    description: string;
    impact_amount: number;
    status: 'pending' | 'approved' | 'rejected';
    created_at: string;
    approvals: Approval[];
  }[]> {
    await this.delay(400);
    
    // Mock change requests
    return [
      {
        id: 'CHG-001',
        title: 'Additional Security Requirements',
        description: 'Client requested enhanced security audit and penetration testing',
        impact_amount: 15000,
        status: 'approved',
        created_at: '2024-03-10T14:30:00Z',
        approvals: [
          {
            id: 'APP-001',
            change_id: 'CHG-001',
            approver_role: 'SDMT',
            decision: 'approve',
            comment: 'Justified by client requirements',
            ts: '2024-03-11T09:15:00Z',
          },
        ],
      },
      {
        id: 'CHG-002',
        title: 'Infrastructure Scale-up',
        description: 'Increase server capacity due to higher than expected load',
        impact_amount: 8500,
        status: 'pending',
        created_at: '2024-03-20T11:20:00Z',
        approvals: [],
      },
    ];
  }

  // File upload APIs
  static async getSignedUploadUrl(fileName: string, fileType: string): Promise<{
    uploadUrl: string;
    fileUrl: string;
  }> {
    await this.delay(200);
    
    // Mock signed URL generation
    return {
      uploadUrl: `https://mock-s3.amazonaws.com/uploads/${fileName}?signature=mock`,
      fileUrl: `/uploads/${fileName}`,
    };
  }

  // Project APIs
  static async getProjects(): Promise<Project[]> {
    await this.delay(300);
    
    return [
      {
        id: 'PRJ-IKUSI-PLATFORM',
        name: 'Ikusi Platform Modernization',
        baseline_id: 'BSL-2024-001',
        baseline_accepted_ts: '2024-03-15T10:30:00Z',
        next_billing_periods: [
          { month: 4, amount: 72000 },
          { month: 5, amount: 75000 },
          { month: 6, amount: 95000 },
        ],
      },
      {
        id: 'PRJ-MOBILE-APP',
        name: 'Mobile Application Development',
        baseline_id: 'BSL-2024-002',
        baseline_accepted_ts: '2024-03-20T15:45:00Z',
        next_billing_periods: [
          { month: 2, amount: 45000 },
          { month: 3, amount: 52000 },
          { month: 4, amount: 48000 },
        ],
      },
      {
        id: 'PRJ-DATA-ANALYTICS',
        name: 'Data Analytics Platform',
      },
    ];
  }

  // Utility method for simulating network delays
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default ApiService;