import { z } from "zod";
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
  PaginatedResponse,
} from "@/types/domain";
import {
  buildApiUrl,
  buildHeaders,
  handleApiError,
  API_ENDPOINTS,
} from "@/config/api";
import { logger } from "@/utils/logger";

import baselineData from "@/mocks/baseline.json";
import baselineFintechData from "@/mocks/baseline-fintech.json";
import baselineRetailData from "@/mocks/baseline-retail.json";
import forecastData from "@/mocks/forecast.json";
import forecastFintechData from "@/mocks/forecast-fintech.json";
import forecastRetailData from "@/mocks/forecast-retail.json";
import invoicesData from "@/mocks/invoices.json";
import invoicesFintechData from "@/mocks/invoices-fintech.json";
import invoicesRetailData from "@/mocks/invoices-retail.json";
import billingPlanData from "@/mocks/billing-plan.json";
import billingPlanFintechData from "@/mocks/billing-plan-fintech.json";
import billingPlanRetailData from "@/mocks/billing-plan-retail.json";

// Mock data helper - only use in development with explicit flag
const shouldUseMockData = () => {
  return import.meta.env.DEV && import.meta.env.VITE_USE_MOCKS === 'true';
};

// Mock API service with simulated async operations and proper types
export class ApiService {
  private static delay = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  // Project management
  static async getProjects(): Promise<Project[]> {
    try {
      const response = await fetch(buildApiUrl(API_ENDPOINTS.projects), {
        method: "GET",
        headers: buildHeaders(),
      });

      if (!response.ok) {
        // Only use mock data in development with explicit flag
        if (shouldUseMockData()) {
          logger.warn("API call failed, falling back to mock data (DEV mode)");
          return [
            {
              id: "PRJ-HEALTHCARE-MODERNIZATION",
              name: "Healthcare System Modernization",
              description:
                "Digital transformation for national healthcare provider",
              baseline_id: "BL-2024-001",
              baseline_accepted_at: "2024-01-15T10:30:00Z",
              next_billing_periods: billingPlanData.slice(
                0,
                3
              ) as BillingPeriod[],
              status: "active",
              created_at: "2024-01-10T09:00:00Z",
            },
            {
              id: "PRJ-FINTECH-PLATFORM",
              name: "Banking Core Platform Upgrade",
              description:
                "Next-generation banking platform with real-time processing",
              baseline_id: "BL-2024-002",
              baseline_accepted_at: "2024-01-20T14:15:00Z",
              next_billing_periods: billingPlanFintechData.slice(
                0,
                3
              ) as BillingPeriod[],
              status: "active",
              created_at: "2024-01-12T10:00:00Z",
            },
            {
              id: "PRJ-RETAIL-ANALYTICS",
              name: "Retail Intelligence & Analytics Suite",
              description:
                "AI-powered analytics platform for retail optimization",
              baseline_id: "BL-2024-003",
              baseline_accepted_at: "2024-02-05T09:45:00Z",
              next_billing_periods: billingPlanRetailData.slice(
                0,
                3
              ) as BillingPeriod[],
              status: "active",
              created_at: "2024-01-25T11:30:00Z",
            },
          ];
        }
        
        // In production, return empty array
        logger.warn("Failed to fetch projects from API, returning empty array");
        return [];
      }

      const data = await response.json();
      logger.info("Projects loaded from API:", data);

      // Transform API response to match Project type
      return data.map((project: any) => ({
        id: project.project_id,
        name: project.project_name || project.name,
        description: project.description || "",
        baseline_id: project.baseline_id || "",
        baseline_accepted_at:
          project.baseline_accepted_at || project.created_at,
        next_billing_periods: [],
        status: project.status || "active",
        created_at: project.created_at || new Date().toISOString(),
      }));
    } catch (error) {
      logger.error("Failed to fetch projects from API:", error);
      // Return empty array on error in production
      return [];
    }
  }

  // PMO Estimator
  static async createBaseline(
    data: any
  ): Promise<{ baseline_id: string; signature_hash: string }> {
    try {
      const response = await fetch(buildApiUrl(API_ENDPOINTS.baseline), {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        if (shouldUseMockData()) {
          logger.warn("API call failed, returning mock baseline (DEV mode)");
          await this.delay(500);
          return {
            baseline_id: `BL-${Date.now()}`,
            signature_hash: `SHA256-${Math.random().toString(36).substring(2)}`,
          };
        }
        throw new Error(`Failed to create baseline: ${response.statusText}`);
      }

      const result = await response.json();
      logger.info("Baseline created via API:", result);
      return result;
    } catch (error) {
      logger.error("Failed to create baseline via API:", error);
      if (shouldUseMockData()) {
        await this.delay(500);
        return {
          baseline_id: `BL-${Date.now()}`,
          signature_hash: `SHA256-${Math.random().toString(36).substring(2)}`,
        };
      }
      throw error;
    }
  }

  // Handoff baseline to SDMT
  static async handoffBaseline(
    projectId: string,
    data: {
      baseline_id: string;
      mod_total: number;
      pct_ingenieros: number;
      pct_sdm: number;
      aceptado_por: string;
    }
  ): Promise<{ ok: boolean }> {
    try {
      logger.info("Handing off baseline to SDMT:", {
        projectId,
        baselineId: data.baseline_id,
        modTotal: data.mod_total,
      });

      const response = await fetch(
        buildApiUrl(`/projects/${projectId}/handoff`),
        {
          method: "POST",
          headers: buildHeaders(),
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Handoff failed: ${response.status} ${
            errorText || response.statusText
          }`
        );
      }

      const result = await response.json();
      logger.info("Handoff successful:", result);
      return result;
    } catch (error) {
      logger.error("Failed to handoff baseline:", error);
      throw error;
    }
  }

  static async getBillingPlan(
    project_id: string
  ): Promise<{ monthly_inflows: BillingPeriod[] }> {
    await this.delay(200);

    // Return appropriate billing plan based on project
    let billingData;
    switch (project_id) {
      case "PRJ-HEALTHCARE-MODERNIZATION":
        billingData = billingPlanData;
        break;
      case "PRJ-FINTECH-PLATFORM":
        billingData = billingPlanFintechData;
        break;
      case "PRJ-RETAIL-ANALYTICS":
        billingData = billingPlanRetailData;
        break;
      default:
        billingData = billingPlanData;
    }

    return {
      monthly_inflows: billingData as BillingPeriod[],
    };
  }

  static async getBaseline(baseline_id: string): Promise<BaselineBudget> {
    await this.delay(200);

    // Return appropriate baseline based on ID
    switch (baseline_id) {
      case "BL-2024-001":
        return baselineData as BaselineBudget;
      case "BL-2024-002":
        return baselineFintechData as BaselineBudget;
      case "BL-2024-003":
        return baselineRetailData as BaselineBudget;
      default:
        return baselineData as BaselineBudget;
    }
  }

  // SDMT Cost Management
  static async getLineItems(project_id: string): Promise<LineItem[]> {
    await this.delay(200);
    logger.debug("Getting line items for project_id:", project_id);

    // Only use mock data in DEV mode with explicit flag
    if (shouldUseMockData()) {
      // Return appropriate line items based on project
      let baseline;
      switch (project_id) {
        case "PRJ-HEALTHCARE-MODERNIZATION":
          baseline = baselineData as BaselineBudget;
          logger.debug("Returning HEALTHCARE mock data (DEV mode)");
          break;
        case "PRJ-FINTECH-PLATFORM":
          baseline = baselineFintechData as BaselineBudget;
          logger.debug("Returning FINTECH mock data (DEV mode)");
          break;
        case "PRJ-RETAIL-ANALYTICS":
          baseline = baselineRetailData as BaselineBudget;
          logger.debug("Returning RETAIL mock data (DEV mode)");
          break;
        default:
          logger.warn("Unknown project_id in DEV mode, returning empty array");
          return [];
      }

      logger.debug("Returning", baseline.line_items.length, "line items");
      return baseline.line_items;
    }

    // In production, this would call the actual API
    // For now, return empty array if API integration is not complete
    logger.warn("getLineItems called in production mode without API integration");
    return [];
  }

  // Line Items
  static async createLineItem(
    projectId: string,
    lineItem: Partial<LineItem>
  ): Promise<LineItem> {
    await this.delay(300);
    const newItem: LineItem = {
      id: `LI-${Date.now()}`,
      category: lineItem.category || "Other",
      subtype: lineItem.subtype,
      vendor: lineItem.vendor || "",
      description: lineItem.description || "",
      one_time: lineItem.one_time ?? true,
      recurring: lineItem.recurring ?? false,
      qty: lineItem.qty || 1,
      unit_cost: lineItem.unit_cost || 0,
      currency: lineItem.currency || "USD",
      start_month: lineItem.start_month || 1,
      end_month: lineItem.end_month || 12,
      amortization: lineItem.amortization || "none",
      capex_flag: lineItem.capex_flag ?? false,
      cost_center: lineItem.cost_center,
      gl_code: lineItem.gl_code,
      indexation_policy: lineItem.indexation_policy || "none",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: lineItem.created_by || "system",
    };
    return newItem;
  }

  static async updateLineItem(
    itemId: string,
    updates: Partial<LineItem>
  ): Promise<LineItem> {
    await this.delay(300);
    // In real app, fetch existing item first, then merge updates
    // For mock, we construct a complete LineItem with updates
    const updatedItem: LineItem = {
      id: itemId,
      category: updates.category || "Other",
      subtype: updates.subtype || "",
      vendor: updates.vendor || "",
      description: updates.description || "",
      one_time: updates.one_time ?? true,
      recurring: updates.recurring ?? false,
      qty: updates.qty ?? 1,
      unit_cost: updates.unit_cost ?? 0,
      currency: updates.currency || "USD",
      start_month: updates.start_month ?? 1,
      end_month: updates.end_month ?? 12,
      amortization: updates.amortization || "none",
      capex_flag: updates.capex_flag ?? false,
      cost_center: updates.cost_center,
      gl_code: updates.gl_code,
      indexation_policy: updates.indexation_policy || "none",
      created_at: updates.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: updates.created_by || "system",
    };
    return updatedItem;
  }

  static async deleteLineItem(itemId: string): Promise<void> {
    await this.delay(200);
    // In a real implementation, this would delete from backend
    logger.debug(`Deleted line item: ${itemId}`);
  }

  // Forecast Management
  static async getForecastData(
    project_id: string,
    months: number
  ): Promise<ForecastCell[]> {
    await this.delay(300);
    logger.debug(
      "Getting forecast data for project_id:",
      project_id,
      "months:",
      months
    );

    // Only use mock data in DEV mode with explicit flag
    if (shouldUseMockData()) {
      // Return appropriate forecast data based on project
      let data;
      switch (project_id) {
        case "PRJ-HEALTHCARE-MODERNIZATION":
          data = forecastData;
          logger.debug("Returning HEALTHCARE forecast mock data (DEV mode)");
          break;
        case "PRJ-FINTECH-PLATFORM":
          data = forecastFintechData;
          logger.debug("Returning FINTECH forecast mock data (DEV mode)");
          break;
        case "PRJ-RETAIL-ANALYTICS":
          data = forecastRetailData;
          logger.debug("Returning RETAIL forecast mock data (DEV mode)");
          break;
        default:
          logger.warn("Unknown project_id in DEV mode, returning empty array");
          return [];
      }

      const result = data as ForecastCell[];
      logger.debug("Returning", result.length, "forecast cells");
      return result;
    }

    // In production, this would call the actual API
    logger.warn("getForecastData called in production mode without API integration");
    return [];
  }

  static async updateForecast(
    project_id: string,
    updates: ForecastCell[]
  ): Promise<void> {
    await this.delay(400);
    // Mock update - in real API would update database
  }

  static async importForecast(
    project_id: string,
    file: File,
    mapping: any
  ): Promise<{
    success: boolean;
    imported_rows: number;
    errors: Array<{ row: number; error: string }>;
  }> {
    await this.delay(2000); // Simulate processing time
    return {
      success: true,
      imported_rows: 150,
      errors: [],
    };
  }

  // Reconciliation
  static async getInvoices(project_id: string): Promise<InvoiceDoc[]> {
    await this.delay(250);
    logger.debug("Getting invoices for project_id:", project_id);

    // Only use mock data in DEV mode with explicit flag
    if (shouldUseMockData()) {
      // Return appropriate invoice data based on project
      let data;
      switch (project_id) {
        case "PRJ-HEALTHCARE-MODERNIZATION":
          data = invoicesData;
          logger.debug("Returning HEALTHCARE invoice mock data (DEV mode)");
          break;
        case "PRJ-FINTECH-PLATFORM":
          data = invoicesFintechData;
          logger.debug("Returning FINTECH invoice mock data (DEV mode)");
          break;
        case "PRJ-RETAIL-ANALYTICS":
          data = invoicesRetailData;
          logger.debug("Returning RETAIL invoice mock data (DEV mode)");
          break;
        default:
          logger.warn("Unknown project_id in DEV mode, returning empty array");
          return [];
      }

      const result = data as InvoiceDoc[];
      logger.debug("Returning", result.length, "invoices");
      return result;
    }

    // In production, this would call the actual API
    logger.warn("getInvoices called in production mode without API integration");
    return [];
  }

  static async uploadInvoice(
    project_id: string,
    file: File,
    line_item_id: string,
    month: number
  ): Promise<InvoiceDoc> {
    await this.delay(1000);
    const now = new Date().toISOString();
    return {
      id: `INV-${Date.now()}`,
      line_item_id,
      month,
      amount: 10000, // Would be extracted from file in real implementation
      currency: "USD",
      file_url: `/uploads/${file.name}`,
      file_name: file.name,
      status: "Pending",
      uploaded_by: "vendor@company.com",
      uploaded_at: now,
    };
  }

  static async updateInvoiceStatus(
    invoice_id: string,
    status: "Pending" | "Matched" | "Disputed",
    comment?: string
  ): Promise<InvoiceDoc> {
    await this.delay(300);
    const invoices = invoicesData as InvoiceDoc[];
    const invoice = invoices.find((inv) => inv.id === invoice_id);

    if (!invoice) {
      throw new Error(`Invoice with id ${invoice_id} not found`);
    }

    return {
      ...invoice,
      status,
      comments: comment
        ? [...(invoice.comments || []), comment]
        : invoice.comments,
      matched_at:
        status === "Matched" ? new Date().toISOString() : invoice.matched_at,
      matched_by:
        status === "Matched" ? "sdmt-analyst@ikusi.com" : invoice.matched_by,
    };
  }

  // Cash Flow Analysis
  static async getCashFlowData(
    project_id: string,
    months: number
  ): Promise<{
    inflows: Array<{ month: number; amount: number }>;
    outflows: Array<{ month: number; amount: number }>;
    margin: Array<{ month: number; percentage: number }>;
  }> {
    await this.delay(300);
    const billingPlan = billingPlanData as BillingPeriod[];
    const forecast = forecastData as ForecastCell[];

    // Calculate outflows by summing forecast data by month
    const outflowsByMonth = new Map<number, number>();
    forecast.forEach((cell) => {
      const current = outflowsByMonth.get(cell.month) || 0;
      outflowsByMonth.set(cell.month, current + cell.forecast);
    });

    const inflows = billingPlan.map((period) => ({
      month: period.month,
      amount: period.amount,
    }));

    const outflows = Array.from(outflowsByMonth.entries()).map(
      ([month, amount]) => ({
        month,
        amount,
      })
    );

    const margin = inflows.map((inflow) => {
      const outflow = outflows.find((o) => o.month === inflow.month);
      const marginAmount = inflow.amount - (outflow?.amount || 0);
      return {
        month: inflow.month,
        percentage: (marginAmount / inflow.amount) * 100,
      };
    });

    return { inflows, outflows, margin };
  }

  // Scenarios
  static async getScenarios(project_id: string): Promise<Scenario[]> {
    await this.delay(200);
    return [
      {
        id: "scenario_baseline",
        name: "Baseline Scenario",
        description: "Original approved baseline",
        baseline_id: "BL-2024-001",
        deltas: [],
        created_by: "sdmt-analyst@ikusi.com",
        created_at: "2024-01-15T10:30:00Z",
        total_impact: 0,
        currency: "USD",
      },
      {
        id: "scenario_optimistic",
        name: "Optimistic Scenario",
        description: "10% cost reduction through efficiency gains",
        baseline_id: "BL-2024-001",
        deltas: [
          {
            category: "Labor",
            delta_type: "percentage",
            delta_value: -10,
            reason: "Efficiency improvements and automation",
          },
        ],
        created_by: "sdmt-analyst@ikusi.com",
        created_at: "2024-02-01T14:15:00Z",
        total_impact: -48500,
        currency: "USD",
      },
    ];
  }

  static async createScenario(
    scenario: Omit<Scenario, "id" | "created_at" | "created_by">
  ): Promise<Scenario> {
    await this.delay(400);
    return {
      id: `scenario_${Date.now()}`,
      created_at: new Date().toISOString(),
      created_by: "sdmt-analyst@ikusi.com",
      ...scenario,
    };
  }

  // Changes
  static async getChangeRequests(project_id: string): Promise<ChangeRequest[]> {
    await this.delay(200);
    return [
      {
        id: "CHG-2024-001",
        baseline_id: "BL-2024-001",
        title: "Additional Senior Developer",
        description:
          "Add one additional senior developer for Q2 to meet accelerated timeline",
        impact_amount: 25500,
        currency: "USD",
        affected_line_items: ["LI-001"],
        justification: "Client requested delivery acceleration by 4 weeks",
        requested_by: "project-manager@ikusi.com",
        requested_at: "2024-02-15T11:00:00Z",
        status: "pending",
        approvals: [],
      },
    ];
  }

  static async createChangeRequest(
    change: Omit<ChangeRequest, "id" | "requested_at" | "status" | "approvals">
  ): Promise<ChangeRequest> {
    await this.delay(300);
    return {
      id: `CHG-${Date.now()}`,
      requested_at: new Date().toISOString(),
      status: "pending",
      approvals: [],
      ...change,
    };
  }

  // File Upload
  static async getSignedUploadUrl(
    filename: string
  ): Promise<{ upload_url: string; file_url: string }> {
    await this.delay(100);
    return {
      upload_url: "/mock-upload",
      file_url: `/uploads/${filename}`,
    };
  }
}

export default ApiService;
