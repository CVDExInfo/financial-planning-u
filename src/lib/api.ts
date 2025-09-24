import { z } from 'zod';
import {
  BillingPeriod,
  LineItem,
  BaselineBudget,
  ForecastCell,
  InvoiceDoc,
  Scenario,
  ChangeRequest,
  Project,
  APIResponse,
  PaginatedResponse
} from '@/types/domain';

import baselineData from '@/mocks/baseline.json';
import forecastData from '@/mocks/forecast.json';
import invoicesData from '@/mocks/invoices.json';
import billingPlanData from '@/mocks/billing-plan.json';

// Mock API service with simulated async operations and proper types
export class ApiService {
  private static delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Project management
  static async getProjects(): Promise<Project[]> {
    await this.delay(100);
    return [
      {
        id: 'PRJ-IKUSI-PLATFORM',
        name: 'Ikusi Digital Platform',
        description: 'Digital transformation platform for enterprise clients',
        baseline_id: 'BL-2024-001',
        baseline_accepted_at: '2024-01-15T10:30:00Z',
        next_billing_periods: billingPlanData.slice(0, 3) as BillingPeriod[],
        status: 'active',
        created_at: '2024-01-10T09:00:00Z'
      },
      {
        id: 'PRJ-MOBILE-APP',
        name: 'Mobile Application Suite',
        description: 'Cross-platform mobile application development',
        baseline_id: 'BL-2024-002',
        baseline_accepted_at: '2024-01-20T14:15:00Z',
        next_billing_periods: [
          { month: 2, amount: 85000, currency: 'USD', status: 'planned' },
          { month: 3, amount: 76000, currency: 'USD', status: 'planned' },
          { month: 4, amount: 91000, currency: 'USD', status: 'planned' }
        ],
        status: 'active',
        created_at: '2024-01-12T10:00:00Z'
      }
    ];
  }

  // PMO Estimator
  static async createBaseline(data: any): Promise<{ baseline_id: string; signature_hash: string }> {
    await this.delay(500);
    return {
      baseline_id: `BL-${Date.now()}`,
      signature_hash: `SHA256-${Math.random().toString(36).substring(2)}`
    };
  }

  static async getBillingPlan(project_id: string): Promise<{ monthly_inflows: BillingPeriod[] }> {
    await this.delay(200);
    return {
      monthly_inflows: billingPlanData as BillingPeriod[]
    };
  }

  static async getBaseline(baseline_id: string): Promise<BaselineBudget> {
    await this.delay(200);
    return baselineData as BaselineBudget;
  }

  // SDMT Cost Management
  static async getLineItems(project_id: string): Promise<LineItem[]> {
    await this.delay(200);
    const baseline = baselineData as BaselineBudget;
    return baseline.line_items;
  }

  static async createLineItem(lineItem: Omit<LineItem, 'id' | 'created_at' | 'updated_at' | 'created_by'>): Promise<LineItem> {
    await this.delay(300);
    const now = new Date().toISOString();
    return {
      id: `item_${Date.now()}`,
      created_at: now,
      updated_at: now,
      created_by: 'sdmt-user@ikusi.com',
      ...lineItem
    };
  }

  static async updateLineItem(id: string, updates: Partial<LineItem>): Promise<LineItem> {
    await this.delay(300);
    const baseline = baselineData as BaselineBudget;
    const existingItem = baseline.line_items.find(item => item.id === id);
    
    if (!existingItem) {
      throw new Error(`LineItem with id ${id} not found`);
    }

    return {
      ...existingItem,
      ...updates,
      updated_at: new Date().toISOString()
    };
  }

  static async deleteLineItem(id: string): Promise<void> {
    await this.delay(200);
    // Mock deletion - in real API would remove from database
  }

  // Forecast Management
  static async getForecastData(project_id: string, months: number): Promise<ForecastCell[]> {
    await this.delay(300);
    return forecastData as ForecastCell[];
  }

  static async updateForecast(project_id: string, updates: ForecastCell[]): Promise<void> {
    await this.delay(400);
    // Mock update - in real API would update database
  }

  static async importForecast(project_id: string, file: File, mapping: any): Promise<{
    success: boolean;
    imported_rows: number;
    errors: Array<{ row: number; error: string }>;
  }> {
    await this.delay(2000); // Simulate processing time
    return {
      success: true,
      imported_rows: 150,
      errors: []
    };
  }

  // Reconciliation
  static async getInvoices(project_id: string): Promise<InvoiceDoc[]> {
    await this.delay(250);
    return invoicesData as InvoiceDoc[];
  }

  static async uploadInvoice(project_id: string, file: File, line_item_id: string, month: number): Promise<InvoiceDoc> {
    await this.delay(1000);
    const now = new Date().toISOString();
    return {
      id: `INV-${Date.now()}`,
      line_item_id,
      month,
      amount: 10000, // Would be extracted from file in real implementation
      currency: 'USD',
      file_url: `/uploads/${file.name}`,
      file_name: file.name,
      status: 'Pending',
      uploaded_by: 'vendor@company.com',
      uploaded_at: now
    };
  }

  static async updateInvoiceStatus(invoice_id: string, status: 'Pending' | 'Matched' | 'Disputed', comment?: string): Promise<InvoiceDoc> {
    await this.delay(300);
    const invoices = invoicesData as InvoiceDoc[];
    const invoice = invoices.find(inv => inv.id === invoice_id);
    
    if (!invoice) {
      throw new Error(`Invoice with id ${invoice_id} not found`);
    }

    return {
      ...invoice,
      status,
      comments: comment ? [...(invoice.comments || []), comment] : invoice.comments,
      matched_at: status === 'Matched' ? new Date().toISOString() : invoice.matched_at,
      matched_by: status === 'Matched' ? 'sdmt-analyst@ikusi.com' : invoice.matched_by
    };
  }

  // Cash Flow Analysis
  static async getCashFlowData(project_id: string, months: number): Promise<{
    inflows: Array<{ month: number; amount: number }>;
    outflows: Array<{ month: number; amount: number }>;
    margin: Array<{ month: number; percentage: number }>;
  }> {
    await this.delay(300);
    const billingPlan = billingPlanData as BillingPeriod[];
    const forecast = forecastData as ForecastCell[];
    
    // Calculate outflows by summing forecast data by month
    const outflowsByMonth = new Map<number, number>();
    forecast.forEach(cell => {
      const current = outflowsByMonth.get(cell.month) || 0;
      outflowsByMonth.set(cell.month, current + cell.forecast);
    });

    const inflows = billingPlan.map(period => ({
      month: period.month,
      amount: period.amount
    }));

    const outflows = Array.from(outflowsByMonth.entries()).map(([month, amount]) => ({
      month,
      amount
    }));

    const margin = inflows.map(inflow => {
      const outflow = outflows.find(o => o.month === inflow.month);
      const marginAmount = inflow.amount - (outflow?.amount || 0);
      return {
        month: inflow.month,
        percentage: (marginAmount / inflow.amount) * 100
      };
    });

    return { inflows, outflows, margin };
  }

  // Scenarios
  static async getScenarios(project_id: string): Promise<Scenario[]> {
    await this.delay(200);
    return [
      {
        id: 'scenario_baseline',
        name: 'Baseline Scenario',
        description: 'Original approved baseline',
        baseline_id: 'BL-2024-001',
        deltas: [],
        created_by: 'sdmt-analyst@ikusi.com',
        created_at: '2024-01-15T10:30:00Z',
        total_impact: 0,
        currency: 'USD'
      },
      {
        id: 'scenario_optimistic',
        name: 'Optimistic Scenario',
        description: '10% cost reduction through efficiency gains',
        baseline_id: 'BL-2024-001',
        deltas: [
          {
            category: 'Labor',
            delta_type: 'percentage',
            delta_value: -10,
            reason: 'Efficiency improvements and automation'
          }
        ],
        created_by: 'sdmt-analyst@ikusi.com',
        created_at: '2024-02-01T14:15:00Z',
        total_impact: -48500,
        currency: 'USD'
      }
    ];
  }

  static async createScenario(scenario: Omit<Scenario, 'id' | 'created_at' | 'created_by'>): Promise<Scenario> {
    await this.delay(400);
    return {
      id: `scenario_${Date.now()}`,
      created_at: new Date().toISOString(),
      created_by: 'sdmt-analyst@ikusi.com',
      ...scenario
    };
  }

  // Changes
  static async getChangeRequests(project_id: string): Promise<ChangeRequest[]> {
    await this.delay(200);
    return [
      {
        id: 'CHG-2024-001',
        baseline_id: 'BL-2024-001',
        title: 'Additional Senior Developer',
        description: 'Add one additional senior developer for Q2 to meet accelerated timeline',
        impact_amount: 25500,
        currency: 'USD',
        affected_line_items: ['LI-001'],
        justification: 'Client requested delivery acceleration by 4 weeks',
        requested_by: 'project-manager@ikusi.com',
        requested_at: '2024-02-15T11:00:00Z',
        status: 'pending',
        approvals: []
      }
    ];
  }

  static async createChangeRequest(change: Omit<ChangeRequest, 'id' | 'requested_at' | 'status' | 'approvals'>): Promise<ChangeRequest> {
    await this.delay(300);
    return {
      id: `CHG-${Date.now()}`,
      requested_at: new Date().toISOString(),
      status: 'pending',
      approvals: [],
      ...change
    };
  }

  // File Upload
  static async getSignedUploadUrl(filename: string): Promise<{ upload_url: string; file_url: string }> {
    await this.delay(100);
    return {
      upload_url: '/mock-upload',
      file_url: `/uploads/${filename}`
    };
  }
}

export default ApiService;