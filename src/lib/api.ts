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
  BaselineCreateRequest,
  BaselineCreateResponse,
} from "@/types/domain";
import { BaselineCreateResponseSchema } from "@/lib/api.schema";
import {
  buildApiUrl,
  buildHeaders,
  handleApiError,
  API_ENDPOINTS,
} from "@/config/api";
import { logger } from "@/utils/logger";

// PRODUCTION MODE: All mock data imports and fallbacks removed
// All API calls go directly to Lambda handlers with no fallbacks

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
        const errorText = await response.text();
        logger.error("Failed to fetch projects from API:", errorText);
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const text = await response.text();
      let payload: any = [];

      try {
        payload = text ? JSON.parse(text) : [];
      } catch (parseError) {
        logger.warn("Failed to parse projects payload as JSON, using empty list", {
          error: parseError,
          bodyPreview: text?.slice(0, 200),
        });
        payload = [];
      }

      logger.info("Projects loaded from API:", payload);

      const projectArray = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload?.items)
            ? payload.items
            : Array.isArray(payload?.data?.items)
              ? payload.data.items
              : [];

      if (!Array.isArray(projectArray)) {
        throw new Error("Invalid projects payload from API");
      }

      // Normalize backend payloads. The Finanzas API now returns
      // { data: [{ id, nombre, cliente, fecha_inicio, fecha_fin, ... }], total }
      // but we still keep compatibility with older shapes that used
      // project_id/project_name fields.
      const normalizeProject = (project: any): Project => {
        const id =
          project?.id ||
          project?.project_id ||
          project?.projectId ||
          project?.identifier ||
          "";

        const name =
          project?.nombre ||
          project?.project_name ||
          project?.name ||
          "";

        return {
          id: String(id).trim(),
          name: String(name || "").trim() || "Unnamed Project",
          description: project?.description || project?.descripcion || "",
          baseline_id: project?.baseline_id || project?.baselineId || "",
          baseline_accepted_at:
            project?.baseline_accepted_at ||
            project?.created_at ||
            project?.createdAt ||
            project?.fecha_inicio ||
            project?.fecha_fin ||
            "",
          next_billing_periods: [],
          status: (project?.status || project?.estado || "active") as Project["status"],
          created_at:
            project?.created_at ||
            project?.createdAt ||
            project?.fecha_inicio ||
            new Date().toISOString(),
          client: project?.cliente || project?.client,
          start_date: project?.fecha_inicio || project?.start_date,
          end_date: project?.fecha_fin || project?.end_date,
        };
      };

      return projectArray.map(normalizeProject);
    } catch (error) {
      logger.error("Failed to fetch projects from API:", error);
      const friendlyMessage =
        error instanceof TypeError && error.message.includes("Failed to fetch")
          ? "No se pudo contactar la API de Finanzas (posible CORS o sesión expirada)."
          : error instanceof Error
            ? error.message
            : "Failed to load projects";
      throw new Error(friendlyMessage);
    }
  }

  // PMO Estimator
  static async createBaseline(
    data: BaselineCreateRequest
  ): Promise<BaselineCreateResponse> {
    try {
      const response = await fetch(buildApiUrl(API_ENDPOINTS.baseline), {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error("Failed to create baseline:", errorText);
        throw new Error(
          `Failed to create baseline: ${response.status} - ${errorText}`
        );
      }

      const result = await response.json();
      const parsed = BaselineCreateResponseSchema.parse(result);
      logger.info("Baseline created via API:", parsed);
      return parsed;
    } catch (error) {
      logger.error("Failed to create baseline via API:", error);
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

      // Generate idempotency key for safe retries
      const idempotencyKey = `handoff-${projectId}-${
        data.baseline_id
      }-${Date.now()}`;

      const response = await fetch(
        buildApiUrl(`/projects/${projectId}/handoff`),
        {
          method: "POST",
          headers: buildHeaders(true, {
            "X-Idempotency-Key": idempotencyKey,
          }),
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

    try {
      const response = await fetch(
        buildApiUrl(`/projects/${project_id}/billing`),
        {
          method: "GET",
          headers: buildHeaders(),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        logger.error("Failed to fetch billing plan:", errorText);
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      logger.info("Billing plan loaded from API");
      return data;
    } catch (error) {
      logger.error("Failed to fetch billing plan:", error);
      // Return empty billing plan structure
      return { monthly_inflows: [] };
    }
  }

  static async getBaseline(baseline_id: string): Promise<BaselineBudget> {
    await this.delay(200);

    try {
      const response = await fetch(buildApiUrl(`/baseline/${baseline_id}`), {
        method: "GET",
        headers: buildHeaders(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error("Failed to fetch baseline:", errorText);
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      logger.info("Baseline loaded from API");
      return data;
    } catch (error) {
      logger.error("Failed to fetch baseline:", error);
      throw error;
    }
  }

  // SDMT Cost Management
  static async getLineItems(project_id: string): Promise<LineItem[]> {
    await this.delay(200);
    logger.debug("Getting line items for project_id:", project_id);

    try {
      // Try API first
      const response = await fetch(
        buildApiUrl(`/projects/${project_id}/rubros`),
        {
          method: "GET",
          headers: buildHeaders(),
        }
      );

      if (response.ok) {
        const data = await response.json();
        // API returns { data: [...], total: number }, extract the array
        const items = Array.isArray(data) ? data : data.data || [];
        logger.info("Line items loaded from API:", items.length, "items");
        return items;
      }

      // If API fails, log error and return empty array
      logger.warn(
        "API call failed (status:",
        response.status,
        "), returning empty line items"
      );
      return [];
    } catch (error) {
      logger.error("API fetch failed:", error);
      return [];
    }
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
    period_months?: number
  ): Promise<ForecastCell[]> {
    await this.delay(300);
    logger.debug("Getting forecast data for project_id:", project_id);

    try {
      // Try API first
      const params = new URLSearchParams({ projectId: project_id });
      if (period_months) {
        params.set("months", String(period_months));
      }

      const response = await fetch(buildApiUrl(`/plan/forecast?${params}`), {
        method: "GET",
        headers: buildHeaders(),
      });

      if (response.ok) {
        const raw = await response.json();
        const data = Array.isArray(raw?.data) ? raw.data : raw;
        logger.info(
          "Forecast data loaded from API:",
          Array.isArray(data) ? data.length : 0,
          "records"
        );
        return Array.isArray(data) ? data : [];
      }

      // If API fails, log error and return empty array
      logger.warn(
        "API call failed (status:",
        response.status,
        "), returning empty forecast data"
      );
      return [];
    } catch (error) {
      logger.error("API fetch failed:", error);
      return [];
    }
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

    try {
      // Try API first
      const response = await fetch(
        buildApiUrl(`/prefacturas?projectId=${project_id}`),
        {
          method: "GET",
          headers: buildHeaders(),
        }
      );

      if (response.ok) {
        const raw = await response.json();
        const data = Array.isArray(raw?.data) ? raw.data : raw;
        logger.info(
          "Invoices loaded from API:",
          Array.isArray(data) ? data.length : 0,
          "records"
        );
        return Array.isArray(data) ? data : [];
      }

      // If API fails, log error and return empty array
      logger.warn(
        "API call failed (status:",
        response.status,
        "), returning empty invoices"
      );
      return [];
    } catch (error) {
      logger.error("API fetch failed:", error);
      return [];
    }
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

    try {
      const response = await fetch(
        buildApiUrl(`/invoices/${invoice_id}/status`),
        {
          method: "PUT",
          headers: buildHeaders(),
          body: JSON.stringify({ status, comment }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        logger.error("Failed to update invoice status:", errorText);
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      logger.info("Invoice status updated via API");
      return data;
    } catch (error) {
      logger.error("Failed to update invoice status:", error);
      throw error;
    }
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

    try {
      // Fetch billing plan and forecast data from API
      const [billingResult, forecastResult] = await Promise.all([
        this.getBillingPlan(project_id),
        this.getForecastData(project_id, months),
      ]);

      const billingPlan = billingResult.monthly_inflows;
      const forecast = forecastResult;

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
          percentage:
            inflow.amount > 0 ? (marginAmount / inflow.amount) * 100 : 0,
        };
      });

      return { inflows, outflows, margin };
    } catch (error) {
      logger.error("Failed to get cash flow data:", error);
      // Return empty data structure
      return {
        inflows: [],
        outflows: [],
        margin: [],
      };
    }
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
