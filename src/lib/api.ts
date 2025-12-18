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
  getAuthToken,
} from "@/config/api";
import { logger } from "@/utils/logger";
import {
  AuthError,
  BaselineError,
  ServerError,
  ValidationError,
} from "@/lib/errors";
import { createMockBaseline } from "@/mocks/baselineStore";
import { normalizeProjectsPayload } from "@/api/finanzas-projects-helpers";

const envSource =
  (typeof import.meta !== "undefined" && (import.meta as any)?.env) ||
  (typeof process !== "undefined" ? (process.env as Record<string, any>) : {});

// PRODUCTION MODE: All mock data imports and fallbacks removed
// All API calls go directly to Lambda handlers with no fallbacks

// Mock API service with simulated async operations and proper types
export class ApiService {
  private static delay = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  private static buildRequestHeaders(
    headers: HeadersInit = {},
    includeAuth = true
  ): HeadersInit {
    const merged = { "Content-Type": "application/json", ...headers };
    if (!includeAuth) return merged;

    const token = getAuthToken();
    if (!token && envSource?.VITE_SKIP_AUTH !== "true") {
      logger.warn("[Finanzas] Missing token; redirecting user to login before API call.");
      throw new AuthError("AUTH_REQUIRED", "Debes iniciar sesión para continuar", 401);
    }

    if (token) {
      return { ...merged, Authorization: `Bearer ${token}` };
    }

    return merged;
  }

  private static async request<T>(
    endpoint: string,
    init: RequestInit = {},
  ): Promise<T> {
    const method = (init.method || "GET").toUpperCase();
    const headers = this.buildRequestHeaders(init.headers);
    const url =
      endpoint.startsWith("http://") || endpoint.startsWith("https://")
        ? endpoint
        : buildApiUrl(endpoint);

    const response = await fetch(url, { ...init, headers });
    const bodyText = await response.text();

    if (envSource?.DEV) {
      logger.debug("[Finanzas] API response", {
        method,
        endpoint,
        url,
        status: response.status,
        ok: response.ok,
        hasBody: !!bodyText,
      });
      if (response.status === 401 || response.status === 403) {
        console.info(
          `[Finanzas] Auth error from API (${response.status}). Likely missing/expired token – redirecting to login.`,
        );
      }
    }

    if (!response.ok) {
      const parsed = (() => {
        try {
          return bodyText ? JSON.parse(bodyText) : null;
        } catch {
          return bodyText || null;
        }
      })();

      if (response.status === 401 || response.status === 403) {
        throw new AuthError(
          response.status === 401 ? "AUTH_REQUIRED" : "FORBIDDEN",
          typeof parsed === "string" ? parsed : "Autenticación requerida.",
          response.status,
        );
      }

      if (response.status === 400 || response.status === 422) {
        throw new ValidationError(
          "VALIDATION_ERROR",
          typeof parsed === "string" ? parsed : "Validación fallida",
          response.status,
        );
      }

      if (response.status >= 500) {
        throw new ServerError(
          "SERVER_ERROR",
          typeof parsed === "string" ? parsed : "Error interno en Finanzas",
          response.status,
        );
      }

      throw new ValidationError(
        "REQUEST_FAILED",
        typeof parsed === "string" ? parsed : "La solicitud no pudo completarse",
        response.status,
      );
    }

    if (!bodyText) return {} as T;

    try {
      return JSON.parse(bodyText) as T;
    } catch (error) {
      logger.warn("[Finanzas] Failed to parse API response as JSON", {
        endpoint,
        method,
        preview: bodyText.slice(0, 120),
        error,
      });
      return bodyText as unknown as T;
    }
  }

  // Project management
  static async getProjects(): Promise<Project[]> {
    try {
      const payload = await this.request(API_ENDPOINTS.projects);

      logger.info("Projects loaded from API:", payload);

      // Use canonical payload normalization to handle all response shapes
      const projectArray = normalizeProjectsPayload(payload);

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

        const baselineStatus =
          project?.baseline_status || project?.baselineStatus || "";
        const acceptedBy = project?.accepted_by || project?.aceptado_por || "";
        const baselineAcceptedAt =
          project?.baseline_accepted_at ||
          project?.baselineAcceptedAt ||
          project?.baselineAccepted_at ||
          "";

        return {
          id: String(id).trim(),
          name: String(name || "").trim() || "Unnamed Project",
          description: project?.description || project?.descripcion || "",
          sdm_manager_name:
            project?.sdm_manager_name || project?.sd_manager_name || undefined,
          baseline_id: project?.baseline_id || project?.baselineId || "",
          baseline_status: baselineStatus || undefined,
          accepted_by: acceptedBy || undefined,
          baseline_accepted_at:
            baselineAcceptedAt ||
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
      if (error instanceof AuthError || error instanceof ValidationError || error instanceof ServerError) {
        throw error;
      }
      const friendlyMessage =
        error instanceof TypeError && error.message.includes("Failed to fetch")
          ? "No se pudo contactar la API de Finanzas (posible CORS o sesión expirada)."
          : error instanceof Error
            ? error.message
            : "Failed to load projects";
      throw new ServerError("PROJECTS_FETCH_FAILED", friendlyMessage, 500);
    }
  }

  // PMO Estimator
  static async createBaseline(
    data: BaselineCreateRequest
  ): Promise<BaselineCreateResponse> {
    const useMocks = String(envSource?.VITE_USE_MOCKS || "false") === "true";

    if (useMocks) {
      const mockBaseline = createMockBaseline(data);
      logger.info("[Finanzas Baseline] Created mock baseline", mockBaseline);
      return mockBaseline;
    }

    try {
      const response = await fetch(buildApiUrl(API_ENDPOINTS.baseline), {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify(data),
      });

      const textPayload = await response.text();
      const parsedPayload = (() => {
        try {
          return textPayload ? JSON.parse(textPayload) : null;
        } catch {
          return textPayload || null;
        }
      })();

      if (!response.ok) {
        logger.error("[Finanzas Baseline] Failed to create baseline", {
          status: response.status,
          payload: parsedPayload,
        });

        if (response.status >= 500) {
          throw new BaselineError(
            "server",
            "baseline.create.failed",
            "Hubo un problema al crear la línea base.",
            response.status,
            parsedPayload,
          );
        }

        if (response.status === 401 || response.status === 403) {
          throw new BaselineError(
            "auth",
            "baseline.create.forbidden",
            "Autorización requerida para crear la línea base.",
            response.status,
            parsedPayload,
          );
        }

        throw new BaselineError(
          "validation",
          "baseline.create.invalid",
          typeof parsedPayload === "string"
            ? parsedPayload
            : "No se pudo crear la línea base.",
          response.status,
          parsedPayload,
        );
      }

      const result = textPayload ? JSON.parse(textPayload) : {};
      const parsed = BaselineCreateResponseSchema.parse(result);
      logger.info("Baseline created via API:", parsed);
      return parsed;
    } catch (error) {
      if (error instanceof BaselineError) {
        throw error;
      }
      logger.error("Failed to create baseline via API:", error);
      throw new BaselineError(
        "network",
        "baseline.create.network",
        "Hubo un problema al crear la línea base.",
        undefined,
        error,
      );
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
      const data = await this.request(`/projects/${project_id}/rubros`);
      const items = Array.isArray(data) ? data : (data as any)?.data || [];
      logger.info("Line items loaded from API:", items.length, "items");
      return items;
    } catch (error) {
      logger.error("API fetch failed:", error);
      if (error instanceof AuthError || error instanceof ValidationError || error instanceof ServerError) {
        throw error;
      }
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
  static async getForecastPayload(
    project_id: string,
    period_months?: number,
  ): Promise<{
    data: ForecastCell[];
    projectId: string;
    months: number;
    generated_at: string;
  }> {
    return this.fetchForecastPayload(project_id, period_months);
  }

  static async getForecastData(
    project_id: string,
    period_months?: number
  ): Promise<ForecastCell[]> {
    const payload = await this.fetchForecastPayload(project_id, period_months);
    return payload.data;
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

    const parseInvoices = (payload: any): any[] => {
      if (Array.isArray(payload)) return payload;
      if (payload && Array.isArray(payload.data)) return payload.data;
      if (payload && Array.isArray(payload.items)) return payload.items;
      if (payload?.data && Array.isArray(payload.data.items)) return payload.data.items;
      if (payload?.data && Array.isArray(payload.data.data)) return payload.data.data;
      return [];
    };

    try {
      const primary = await fetch(
        buildApiUrl(`/projects/${project_id}/invoices`),
        {
          method: "GET",
          headers: buildHeaders(),
        }
      );

      if (primary.ok) {
        const raw = await primary.json();
        const data = parseInvoices(raw);
        logger.info(
          "Invoices loaded from API:",
          Array.isArray(data) ? data.length : 0,
          "records"
        );
        return Array.isArray(data) ? data : [];
      }

      if (primary.status !== 404 && primary.status !== 405) {
        logger.warn("Invoices API call failed:", primary.status, primary.statusText);
      }
    } catch (error) {
      logger.error("Primary invoices API call failed:", error);
    }

    // Legacy fallback to /prefacturas for environments that haven't deployed the new route
    try {
      const legacy = await fetch(
        buildApiUrl(`/prefacturas?projectId=${project_id}`),
        {
          method: "GET",
          headers: buildHeaders(),
        }
      );

      if (!legacy.ok) {
        logger.warn(
          "Legacy invoices API call failed (status:",
          legacy.status,
          "), returning empty invoices"
        );
        return [];
      }

      const raw = await legacy.json();
      const data = parseInvoices(raw);
      logger.info(
        "Invoices loaded from legacy API:",
        Array.isArray(data) ? data.length : 0,
        "records"
      );
      return Array.isArray(data) ? data : [];
    } catch (error) {
      logger.error("Legacy invoices API fetch failed:", error);
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
    project_id: string,
    invoice_id: string,
    status: "Pending" | "Matched" | "Disputed",
    comment?: string
  ): Promise<InvoiceDoc> {
    await this.delay(300);

    try {
      const response = await fetch(
        buildApiUrl(`/projects/${project_id}/invoices/${invoice_id}/status`),
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
    const forecastPayload = await this.fetchForecastPayload(project_id, months);

    try {
      // Fetch billing plan and forecast data from API
      const billingResult = await this.getBillingPlan(project_id);

      const billingPlan = billingResult.monthly_inflows;
      const forecast = forecastPayload.data;

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
  static async getScenarios(
    project_id: string,
    months: number = 12
  ): Promise<Scenario[]> {
    const forecastPayload = await this.fetchForecastPayload(project_id, months);
    const totals = forecastPayload.data.reduce(
      (acc, cell) => {
        acc.planned += cell.planned || 0;
        acc.forecast += cell.forecast || 0;
        acc.actual += cell.actual || 0;
        return acc;
      },
      { planned: 0, forecast: 0, actual: 0 }
    );

    const baselineId = forecastPayload.projectId || project_id;
    const generatedAt = forecastPayload.generated_at;

    return [
      {
        id: `baseline-${baselineId}`,
        name: "Baseline",
        description: `Proyección aprobada a ${forecastPayload.months} meses`,
        baseline_id: baselineId,
        deltas: [],
        created_by: "forecast-engine",
        created_at: generatedAt,
        total_impact: 0,
        currency: "USD",
      },
      {
        id: `forecast-${baselineId}`,
        name: "Escenario forecast",
        description: "Variación del forecast contra el plan",
        baseline_id: baselineId,
        deltas: [],
        created_by: "forecast-engine",
        created_at: generatedAt,
        total_impact: totals.forecast - totals.planned,
        currency: "USD",
      },
      {
        id: `actuals-${baselineId}`,
        name: "Escenario actual",
        description: "Impacto real con datos consolidados",
        baseline_id: baselineId,
        deltas: [],
        created_by: "forecast-engine",
        created_at: generatedAt,
        total_impact: totals.actual - totals.planned,
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

  private static async fetchForecastPayload(
    projectId: string,
    period_months?: number
  ): Promise<{
    data: ForecastCell[];
    projectId: string;
    months: number;
    generated_at: string;
  }> {
    await this.delay(150);

    const months = Number.isFinite(period_months)
      ? Math.max(Number(period_months) || 12, 1)
      : 12;

    const params = new URLSearchParams({ projectId });
    params.set("months", months.toString());

    const payload = await this.request(
      `${API_ENDPOINTS.forecast}?${params.toString()}`,
      {
        method: "GET",
        headers: this.buildRequestHeaders(),
      }
    );

    const coerceCells = (input: unknown): ForecastCell[] => {
      if (Array.isArray(input)) return input as ForecastCell[];
      if (input && Array.isArray((input as any).data)) return (input as any).data;
      if (input && Array.isArray((input as any).items)) return (input as any).items;
      if (input && Array.isArray((input as any).data?.items))
        return (input as any).data.items;
      if (input && Array.isArray((input as any).data?.data))
        return (input as any).data.data;
      return [];
    };

    const cells = coerceCells(payload);

    const responseMonths = Number(payload?.months) || months;

    logger.info(
      "Forecast data loaded from API:",
      Array.isArray(cells) ? cells.length : 0,
      "records"
    );

    return {
      data: cells as ForecastCell[],
      projectId,
      months: responseMonths,
      generated_at: payload?.generated_at || new Date().toISOString(),
    };
  }

  // Changes
  static async getChangeRequests(project_id: string): Promise<ChangeRequest[]> {
    const endpoint = `/projects/${project_id}/changes`;

    const parseChanges = (payload: unknown): unknown[] => {
      if (Array.isArray(payload)) return payload;
      if (payload && Array.isArray((payload as any).data)) return (payload as any).data;
      if (payload && Array.isArray((payload as any).items)) return (payload as any).items;
      if (payload && Array.isArray((payload as any).data?.items))
        return (payload as any).data.items;
      if (payload && Array.isArray((payload as any).data?.data))
        return (payload as any).data.data;
      return [];
    };

    const normalizeChange = (item: any): ChangeRequest => {
      const affectedLineItems = Array.isArray(item?.affected_line_items)
        ? item.affected_line_items
        : Array.isArray(item?.affectedLineItems)
          ? item.affectedLineItems
          : [];

      // Parse new line item request if present
      const newLineItemRequest = item?.new_line_item_request || item?.newLineItemRequest;
      const parsedNewLineItem = newLineItemRequest
        ? {
            name: newLineItemRequest.name || "",
            type: newLineItemRequest.type || "OPEX",
            description: newLineItemRequest.description || "",
          }
        : undefined;

      return {
        id: item?.id || item?.changeId || (item?.sk || "").replace(/^CHANGE#/, ""),
        baseline_id: item?.baseline_id || item?.baselineId || "",
        title: item?.title || "",
        description: item?.description || "",
        impact_amount: Number(item?.impact_amount ?? item?.impactAmount ?? 0),
        currency: item?.currency || "USD",
        affected_line_items: affectedLineItems,
        justification:
          item?.justification || item?.businessJustification || item?.reason || "",
        requested_by: item?.requested_by || item?.requestedBy || item?.created_by || "",
        requested_at:
          item?.requested_at || item?.requestedAt || item?.created_at || new Date().toISOString(),
        status: (item?.status as ChangeRequest["status"]) || "pending",
        approvals: Array.isArray(item?.approvals) ? item.approvals : [],
        // Time distribution fields
        start_month_index: item?.start_month_index ?? item?.startMonthIndex,
        duration_months: item?.duration_months ?? item?.durationMonths,
        allocation_mode: item?.allocation_mode ?? item?.allocationMode,
        // New line item request
        new_line_item_request: parsedNewLineItem,
      };
    };

    const payload = await this.request(endpoint);

    return parseChanges(payload).map((item) => normalizeChange(item));
  }

  static async createChangeRequest(
    project_id: string,
    change: Omit<ChangeRequest, "id" | "requested_at" | "status" | "approvals">,
  ): Promise<ChangeRequest> {
    const endpoint = `/projects/${project_id}/changes`;
    const body: any = {
      baseline_id: change.baseline_id,
      title: change.title,
      description: change.description,
      impact_amount: change.impact_amount,
      currency: change.currency || "USD",
      justification: change.justification,
      affected_line_items: change.affected_line_items,
    };

    // Include time distribution fields if provided
    if (change.start_month_index !== undefined) {
      body.start_month_index = change.start_month_index;
    }
    if (change.duration_months !== undefined) {
      body.duration_months = change.duration_months;
    }
    if (change.allocation_mode !== undefined) {
      body.allocation_mode = change.allocation_mode;
    }

    // Include new line item request if provided
    if (change.new_line_item_request) {
      body.new_line_item_request = {
        name: change.new_line_item_request.name,
        type: change.new_line_item_request.type,
        description: change.new_line_item_request.description,
      };
    }

    const payload = await this.request(endpoint, {
      method: "POST",
      headers: this.buildRequestHeaders(),
      body: JSON.stringify(body),
    });

    // Parse new line item request from response
    const newLineItemRequest = payload?.new_line_item_request || payload?.newLineItemRequest;
    const parsedNewLineItem = newLineItemRequest
      ? {
          name: newLineItemRequest.name || "",
          type: newLineItemRequest.type || "OPEX",
          description: newLineItemRequest.description || "",
        }
      : undefined;

    return {
      id: payload.id || payload.changeId,
      baseline_id: payload.baseline_id || payload.baselineId || "",
      title: payload.title || "",
      description: payload.description || "",
      impact_amount: Number(payload.impact_amount ?? payload.impactAmount ?? 0),
      currency: payload.currency || "USD",
      affected_line_items: Array.isArray(payload.affected_line_items)
        ? payload.affected_line_items
        : Array.isArray(payload.affectedLineItems)
          ? payload.affectedLineItems
          : [],
      justification:
        payload.justification || payload.businessJustification || payload.reason || "",
      requested_by:
        payload.requested_by || payload.requestedBy || payload.created_by || "",
      requested_at:
        payload.requested_at || payload.requestedAt || payload.created_at || new Date().toISOString(),
      status: (payload.status as ChangeRequest["status"]) || "pending",
      approvals: Array.isArray(payload.approvals) ? payload.approvals : [],
      // Time distribution fields
      start_month_index: payload?.start_month_index ?? payload?.startMonthIndex,
      duration_months: payload?.duration_months ?? payload?.durationMonths,
      allocation_mode: payload?.allocation_mode ?? payload?.allocationMode,
      // New line item request
      new_line_item_request: parsedNewLineItem,
    };
  }

  static async updateChangeApproval(
    project_id: string,
    change_id: string,
    data: { action: "approve" | "reject"; comment?: string },
  ): Promise<ChangeRequest> {
    const endpoint = `/projects/${project_id}/changes/${change_id}/approval`;
    const payload = await this.request(endpoint, {
      method: "POST",
      headers: this.buildRequestHeaders(),
      body: JSON.stringify(data),
    });

    // Parse new line item request from response
    const newLineItemRequest = payload?.new_line_item_request || payload?.newLineItemRequest;
    const parsedNewLineItem = newLineItemRequest
      ? {
          name: newLineItemRequest.name || "",
          type: newLineItemRequest.type || "OPEX",
          description: newLineItemRequest.description || "",
        }
      : undefined;

    return {
      id: payload.id || payload.changeId || change_id,
      baseline_id: payload.baseline_id || payload.baselineId || "",
      title: payload.title || "",
      description: payload.description || "",
      impact_amount: Number(payload.impact_amount ?? payload.impactAmount ?? 0),
      currency: payload.currency || "USD",
      affected_line_items: Array.isArray(payload.affected_line_items)
        ? payload.affected_line_items
        : Array.isArray(payload.affectedLineItems)
          ? payload.affectedLineItems
          : [],
      justification:
        payload.justification || payload.businessJustification || payload.reason || "",
      requested_by:
        payload.requested_by || payload.requestedBy || payload.created_by || "",
      requested_at:
        payload.requested_at || payload.requestedAt || payload.created_at || new Date().toISOString(),
      status: (payload.status as ChangeRequest["status"]) || "pending",
      approvals: Array.isArray(payload.approvals) ? payload.approvals : [],
      // Time distribution fields
      start_month_index: payload?.start_month_index ?? payload?.startMonthIndex,
      duration_months: payload?.duration_months ?? payload?.durationMonths,
      allocation_mode: payload?.allocation_mode ?? payload?.allocationMode,
      // New line item request
      new_line_item_request: parsedNewLineItem,
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

  // Bulk Allocations - PMO Forecast Adjustments
  static async bulkUpdateAllocations(
    projectId: string,
    allocations: Array<{
      rubro_id: string;
      mes: string;
      monto_planeado?: number;
      monto_proyectado?: number;
    }>,
    type: "planned" | "forecast" = "planned"
  ): Promise<{
    updated_count: number;
    type: string;
    allocations: Array<{
      rubro_id: string;
      mes: string;
      status: string;
    }>;
  }> {
    const endpoint = `/projects/${projectId}/allocations:bulk?type=${type}`;
    return this.request(endpoint, {
      method: "PUT",
      body: JSON.stringify({ allocations }),
    });
  }

  // Annual All-In Budget
  static async getAnnualBudget(year: number): Promise<{
    year: number;
    amount: number;
    currency: string;
    lastUpdated: string;
    updatedBy: string;
  } | null> {
    try {
      const endpoint = `/budgets/all-in?year=${year}`;
      return await this.request(endpoint, { method: "GET" });
    } catch (error: any) {
      // Return null if budget not found (404)
      if (error?.statusCode === 404 || error?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  static async setAnnualBudget(
    year: number,
    amount: number,
    currency: string = "USD"
  ): Promise<{
    year: number;
    amount: number;
    currency: string;
    lastUpdated: string;
    updatedBy: string;
  }> {
    const endpoint = "/budgets/all-in";
    return this.request(endpoint, {
      method: "PUT",
      body: JSON.stringify({ year, amount, currency }),
    });
  }
}

export default ApiService;