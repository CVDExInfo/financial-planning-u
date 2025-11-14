import { z } from 'zod';
import type {
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
import baselineFintechData from '@/mocks/baseline-fintech.json';
import baselineRetailData from '@/mocks/baseline-retail.json';
import forecastData from '@/mocks/forecast.json';
import forecastFintechData from '@/mocks/forecast-fintech.json';
import forecastRetailData from '@/mocks/forecast-retail.json';
import invoicesData from '@/mocks/invoices.json';
import invoicesFintechData from '@/mocks/invoices-fintech.json';
import invoicesRetailData from '@/mocks/invoices-retail.json';
import billingPlanData from '@/mocks/billing-plan.json';
import billingPlanFintechData from '@/mocks/billing-plan-fintech.json';
import billingPlanRetailData from '@/mocks/billing-plan-retail.json';

// Mock API service with simulated async operations and proper types
export class ApiService {
  private static delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Project management
  static async getProjects(): Promise<Project[]> {
    await this.delay(100);
    return [
      {
        id: 'PRJ-HEALTHCARE-MODERNIZATION',
        name: 'Healthcare System Modernization',
        description: 'Digital transformation for national healthcare provider',
        baseline_id: 'BL-2024-001',
        baseline_accepted_at: '2024-01-15T10:30:00Z',
        next_billing_periods: billingPlanData.slice(0, 3) as BillingPeriod[],
        status: 'active',
        created_at: '2024-01-10T09:00:00Z'
      },
      {
        id: 'PRJ-FINTECH-PLATFORM',
        name: 'Banking Core Platform Upgrade',
        description: 'Next-generation banking platform with real-time processing',
        baseline_id: 'BL-2024-002',
        baseline_accepted_at: '2024-01-20T14:15:00Z',
        next_billing_periods: billingPlanFintechData.slice(0, 3) as BillingPeriod[],
        status: 'active',
        created_at: '2024-01-12T10:00:00Z'
      },
      {
        id: 'PRJ-RETAIL-ANALYTICS',
        name: 'Retail Intelligence & Analytics Suite',
        description: 'AI-powered analytics platform for retail optimization',
        baseline_id: 'BL-2024-003',
        baseline_accepted_at: '2024-02-05T09:45:00Z',
        next_billing_periods: billingPlanRetailData.slice(0, 3) as BillingPeriod[],
        status: 'active',
        created_at: '2024-01-25T11:30:00Z'
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
    
    // Return appropriate billing plan based on project
    let billingData;
    switch (project_id) {
      case 'PRJ-HEALTHCARE-MODERNIZATION':
        billingData = billingPlanData;
        break;
      case 'PRJ-FINTECH-PLATFORM':
        billingData = billingPlanFintechData;
        break;
      case 'PRJ-RETAIL-ANALYTICS':
        billingData = billingPlanRetailData;
        break;
      default:
        billingData = billingPlanData;
    }
    
    return {
      monthly_inflows: billingData as BillingPeriod[]
    };
  }

  static async getBaseline(baseline_id: string): Promise<BaselineBudget> {
    await this.delay(200);
    
    // Return appropriate baseline based on ID
    switch (baseline_id) {
      case 'BL-2024-001':
        return baselineData as BaselineBudget;
      case 'BL-2024-002':
        return baselineFintechData as BaselineBudget;
      case 'BL-2024-003':
        return baselineRetailData as BaselineBudget;
      default:
        return baselineData as BaselineBudget;
    }
  }

  // SDMT Cost Management
  static async getLineItems(project_id: string): Promise<LineItem[]> {
    await this.delay(200);
    console.log('🔄 API: Getting line items for project_id:', project_id);
    
    // Return appropriate line items based on project
    let baseline;
    switch (project_id) {
      case 'PRJ-HEALTHCARE-MODERNIZATION':
        baseline = baselineData as BaselineBudget;
        console.log('📊 API: Returning HEALTHCARE data');
        break;
      case 'PRJ-FINTECH-PLATFORM':
        baseline = baselineFintechData as BaselineBudget;
        console.log('📊 API: Returning FINTECH data');
        break;
      case 'PRJ-RETAIL-ANALYTICS':
        baseline = baselineRetailData as BaselineBudget;
        console.log('📊 API: Returning RETAIL data');
        break;
      default:
        baseline = baselineData as BaselineBudget;
        console.log('📊 API: Returning DEFAULT (healthcare) data for unknown project:', project_id);
    }
    
    console.log('📊 API: Returning', baseline.line_items.length, 'line items');
    console.log('📊 API: Sample items:', baseline.line_items.slice(0, 2).map(item => ({ 
      id: item.id, 
      description: item.description, 
      unit_cost: item.unit_cost 
    })));
    
    return baseline.line_items;
  }

  // Line Items
  static async createLineItem(projectId: string, lineItem: Partial<LineItem>): Promise<LineItem> {
    await this.delay(300);
    const newItem: LineItem = {
      id: `LI-${Date.now()}`,
      category: lineItem.category || 'Other',
      subtype: lineItem.subtype,
      vendor: lineItem.vendor || '',
      description: lineItem.description || '',
      one_time: lineItem.one_time ?? true,
      recurring: lineItem.recurring ?? false,
      qty: lineItem.qty || 1,
      unit_cost: lineItem.unit_cost || 0,
      currency: lineItem.currency || 'USD',
      start_month: lineItem.start_month || 1,
      end_month: lineItem.end_month || 12,
      amortization: lineItem.amortization || 'none',
      capex_flag: lineItem.capex_flag ?? false,
      cost_center: lineItem.cost_center,
      gl_code: lineItem.gl_code,
      indexation_policy: lineItem.indexation_policy || 'none',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: lineItem.created_by || 'system'
    };
    return newItem;
  }

  static async updateLineItem(itemId: string, updates: Partial<LineItem>): Promise<LineItem> {
    await this.delay(300);
    // In real app, fetch existing item first, then merge updates
    // For mock, we construct a complete LineItem with updates
    const updatedItem: LineItem = {
      id: itemId,
      category: updates.category || 'Other',
      subtype: updates.subtype || '',
      vendor: updates.vendor || '',
      description: updates.description || '',
      one_time: updates.one_time ?? true,
      recurring: updates.recurring ?? false,
      qty: updates.qty ?? 1,
      unit_cost: updates.unit_cost ?? 0,
      currency: updates.currency || 'USD',
      start_month: updates.start_month ?? 1,
      end_month: updates.end_month ?? 12,
      amortization: updates.amortization || 'none',
      capex_flag: updates.capex_flag ?? false,
      cost_center: updates.cost_center,
      gl_code: updates.gl_code,
      indexation_policy: updates.indexation_policy || 'none',
      created_at: updates.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: updates.created_by || 'system'
    };
    return updatedItem;
  }

  static async deleteLineItem(itemId: string): Promise<void> {
    await this.delay(200);
    // In a real implementation, this would delete from backend
    console.log(`Deleted line item: ${itemId}`);
  }

  // Forecast Management
  static async getForecastData(project_id: string, months: number): Promise<ForecastCell[]> {
    await this.delay(300);
    console.log('🔄 API: Getting forecast data for project_id:', project_id, 'months:', months);
    
    // Return appropriate forecast data based on project
    let data;
    switch (project_id) {
      case 'PRJ-HEALTHCARE-MODERNIZATION':
        data = forecastData;
        console.log('📊 API: Returning HEALTHCARE forecast data');
        break;
      case 'PRJ-FINTECH-PLATFORM':
        data = forecastFintechData;
        console.log('📊 API: Returning FINTECH forecast data');
        break;
      case 'PRJ-RETAIL-ANALYTICS':
        data = forecastRetailData;
        console.log('📊 API: Returning RETAIL forecast data');
        break;
      default:
        data = forecastData;
        console.log('📊 API: Returning DEFAULT (healthcare) forecast data for unknown project:', project_id);
    }
    
    const result = data as ForecastCell[];
    console.log('📊 API: Returning', result.length, 'forecast cells');
    console.log('📊 API: Total planned amount:', result.reduce((sum, cell) => sum + cell.planned, 0));
    console.log('📊 API: Total forecast amount:', result.reduce((sum, cell) => sum + cell.forecast, 0));
    
    return result;
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
    console.log('🔄 API: Getting invoices for project_id:', project_id);
    
    // Return appropriate invoice data based on project
    let data;
    switch (project_id) {
      case 'PRJ-HEALTHCARE-MODERNIZATION':
        data = invoicesData;
        console.log('🧾 API: Returning HEALTHCARE invoice data');
        break;
      case 'PRJ-FINTECH-PLATFORM':
        data = invoicesFintechData;
        console.log('🧾 API: Returning FINTECH invoice data');
        break;
      case 'PRJ-RETAIL-ANALYTICS':
        data = invoicesRetailData;
        console.log('🧾 API: Returning RETAIL invoice data');
        break;
      default:
        data = invoicesData;
        console.log('🧾 API: Returning DEFAULT (healthcare) invoice data for unknown project:', project_id);
    }
    
    const result = data as InvoiceDoc[];
    console.log('🧾 API: Returning', result.length, 'invoices');
    
    return result;
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