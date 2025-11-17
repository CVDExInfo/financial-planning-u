import type {
  ForecastCell,
  InvoiceDoc,
  InvoiceStatus,
  LineItem,
} from "@/types/domain";
import { safeFetch } from "./client";

type ApiArray<T> = T | { data: T; total?: number };

const unwrap = <T>(payload: ApiArray<T>): T => {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (typeof payload === "object" && payload && "data" in payload) {
    return payload.data;
  }
  return payload;
};

export async function getForecast(projectId: string, months: number) {
  const params = new URLSearchParams({
    projectId,
    months: String(months),
  });

  return safeFetch<ForecastCell[]>(`/plan/forecast?${params.toString()}`);
}

export async function getInvoices(projectId: string) {
  const params = new URLSearchParams({ projectId });
  const response = await safeFetch<ApiArray<InvoiceDoc[]>>(
    `/prefacturas?${params.toString()}`
  );
  return unwrap(response);
}

export async function getProjectRubros(projectId: string) {
  const response = await safeFetch<ApiArray<LineItem[]>>(
    `/projects/${encodeURIComponent(projectId)}/rubros`
  );
  return unwrap(response);
}

export type AddProjectRubroPayload = {
  rubroId: string;
  qty: number;
  unitCost: number;
  type: string;
  duration: string;
};

export function addProjectRubro(
  projectId: string,
  payload: AddProjectRubroPayload
) {
  return safeFetch<LineItem>(
    `/projects/${encodeURIComponent(projectId)}/rubros`,
    {
      method: "POST",
      body: payload,
    }
  );
}

export type UploadInvoicePayload = {
  file: File;
  line_item_id: string;
  month: number;
  amount: number;
  description?: string;
  vendor?: string;
  invoice_number?: string;
  invoice_date?: string;
};

export function uploadInvoice(
  projectId: string,
  payload: UploadInvoicePayload
) {
  const formData = new FormData();
  formData.append("projectId", projectId);
  formData.append("line_item_id", payload.line_item_id);
  formData.append("month", String(payload.month));
  formData.append("amount", String(payload.amount));
  formData.append("file", payload.file);

  if (payload.description) {
    formData.append("description", payload.description);
  }
  if (payload.vendor) {
    formData.append("vendor", payload.vendor);
  }
  if (payload.invoice_number) {
    formData.append("invoice_number", payload.invoice_number);
  }
  if (payload.invoice_date) {
    formData.append("invoice_date", payload.invoice_date);
  }

  return safeFetch<InvoiceDoc>("/prefacturas", {
    method: "POST",
    body: formData,
  });
}

export type UpdateInvoiceStatusPayload = {
  status: InvoiceStatus;
  comment?: string;
};

export function updateInvoiceStatus(
  projectId: string,
  invoiceId: string,
  payload: UpdateInvoiceStatusPayload
) {
  return safeFetch<InvoiceDoc>(
    `/prefacturas/${encodeURIComponent(invoiceId)}`,
    {
      method: "PATCH",
      body: {
        projectId,
        status: payload.status,
        comment: payload.comment,
      },
    }
  );
}
