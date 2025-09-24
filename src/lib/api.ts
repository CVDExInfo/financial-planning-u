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

// Mock API service with simulated async operations
export class ApiService {
  private static delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Project management
  static async getProjects(): Promise<Project[]> {
    await this.delay(100);
    return [
      {
        id: 'PRJ-IKUSI-PLATFORM',
        name: 'Ikusi Digital Platform',
        baseline_id: 'BL-2024-001',
        baseline_accepted_ts: '2024-01-15T10:30:00Z',
        next_billing_periods: [
          { month: 2, amount: 125000 },
          { month: 3, amount: 98000 },
          { month: 4, amount: 142000 }
        ]
      },
      {
        id: 'PRJ-MOBILE-APP',
        name: 'Mobile Application Suite',
        baseline_id: 'BL-2024-002',
        baseline_accepted_ts: '2024-01-20T14:15:00Z',
        next_billing_periods: [
          { month: 2, amount: 85000 },
          { month: 3, amount: 76000 },
          { month: 4, amount: 91000 }
        ]
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

  static async getBillingPlan(project_id: string): Promise<BillingPlan> {
    await this.delay(200);
    return {
      project_id,
      monthly_inflows: Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        amount: 100000 + Math.random() * 50000
      }))
    };
  }

  // SDMT Cost Management
  static async getLineItems(project_id: string): Promise<LineItem[]> {
    await this.delay(200);
    return [
      {
        id: 'labor_1',
        category: 'Labor',
        subtype: 'Senior Developer',
        description: 'Senior Software Developer - 12 months',
        one_time: false,
        recurring: true,
        qty: 2,
        unit_cost: 8500,
        currency: 'USD',
        start_month: 1,
        end_month: 12,
        amortization: 'none',
        capex_flag: false,
        indexation_policy: 'CPI'
      },
      {
        id: 'software_1',
        category: 'Software',
        subtype: 'License',
        description: 'Development Tools Enterprise License',
        one_time: true,
        recurring: false,
        qty: 1,
        unit_cost: 12000,
        currency: 'USD',
        start_month: 1,
        end_month: 1,
        amortization: 'straight_line',
        capex_flag: true,
        indexation_policy: 'none'
      }
    ];
  }

  static async createLineItem(lineItem: Omit<LineItem, 'id'>): Promise<LineItem> {
    await this.delay(300);
    return {
      id: `item_${Date.now()}`,
      ...lineItem
    };
  }

  static async updateLineItem(id: string, updates: Partial<LineItem>): Promise<LineItem> {
    await this.delay(300);
    // Mock updated line item
    return {
      id,
      category: 'Labor',
      description: 'Updated item',
      one_time: false,
      recurring: true,
      qty: 1,
      unit_cost: 5000,
      currency: 'USD',
      start_month: 1,
      end_month: 12,
      amortization: 'none',
      capex_flag: false,
      indexation_policy: 'none',
      ...updates
    };
  }

  static async deleteLineItem(id: string): Promise<void> {
    await this.delay(200);
  }

  // Forecast Management
  static async getForecastData(project_id: string, months: number): Promise<ForecastCell[]> {
    await this.delay(300);
    return Array.from({ length: months }, (_, month) => ({
      line_item_id: 'labor_1',
      month: month + 1,
      planned: 17000,
      forecast: 17000 + (Math.random() - 0.5) * 2000,
      actual: month < 6 ? 17000 + (Math.random() - 0.5) * 1000 : 0,
      variance: 0
    }));
  }

  static async updateForecast(project_id: string, updates: ForecastCell[]): Promise<void> {
    await this.delay(400);
  }

  // Reconciliation
  static async getInvoices(project_id: string): Promise<InvoiceDoc[]> {
    await this.delay(250);
    return [
      {
        id: 'INV-2024-001',
        line_item_id: 'labor_1',
        month: 1,
        file_url: '/uploads/invoice-001.pdf',
        status: 'Matched',
        comments: ['Invoice matched successfully']
      }
    ];
  }

  static async uploadInvoice(project_id: string, file: File): Promise<InvoiceDoc> {
    await this.delay(1000);
    return {
      id: `INV-${Date.now()}`,
      line_item_id: 'labor_1',
      month: 1,
      file_url: '/uploads/' + file.name,
      status: 'Pending'
    };
  }

  // Cash Flow Analysis
  static async getCashFlowData(project_id: string, months: number): Promise<any> {
    await this.delay(300);
    return {
      inflows: Array.from({ length: months }, (_, i) => ({ month: i + 1, amount: 100000 })),
      outflows: Array.from({ length: months }, (_, i) => ({ month: i + 1, amount: 85000 })),
      margin: Array.from({ length: months }, (_, i) => ({ month: i + 1, percentage: 15 }))
    };
  }

  // Scenarios
  static async getScenarios(project_id: string): Promise<Scenario[]> {
    await this.delay(200);
    return [
      {
        id: 'baseline',
        name: 'Baseline',
        baseline_id: 'BL-2024-001',
        deltas: []
      }
    ];
  }

  static async createScenario(scenario: Omit<Scenario, 'id'>): Promise<Scenario> {
    await this.delay(400);
    return {
      id: `scenario_${Date.now()}`,
      ...scenario
    };
  }

  // Changes
  static async getChangeRequests(project_id: string): Promise<any[]> {
    await this.delay(200);
    return [];
  }

  static async createChangeRequest(change: any): Promise<any> {
    await this.delay(300);
    return {
      id: `CHG-${Date.now()}`,
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