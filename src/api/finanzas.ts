import type {
  ForecastCell,
  InvoiceDoc,
  InvoiceStatus,
  LineItem,
} from "@/types/domain";
import { API_BASE, HAS_API_BASE } from "@/config/env";
import { safeFetch } from "./client";

if (!HAS_API_BASE) {
  console.error(
    "VITE_API_BASE_URL is missing. Finanzas API helpers cannot reach the backend until it is configured."
  );
} else if (import.meta.env.DEV) {
  console.debug("[Finz] API base configured:", API_BASE);
}

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

export type UploadModule = "prefactura" | "catalog" | "reconciliation";

export type UploadSessionResponse = {
  uploadUrl: string;
  objectKey: string;
};

export type CreateUploadSessionParams = {
  projectId: string;
  module: UploadModule;
  file: File;
  lineItemId?: string;
  invoiceNumber?: string;
};

const FALLBACK_CONTENT_TYPE = "application/octet-stream";

async function createUploadSession(
  params: CreateUploadSessionParams
): Promise<UploadSessionResponse> {
  const { file, module, projectId, lineItemId, invoiceNumber } = params;

  return safeFetch<UploadSessionResponse>("/uploads/docs", {
    method: "POST",
    body: {
      projectId,
      module,
      lineItemId,
      invoiceNumber,
      originalName: file.name,
      contentType: file.type || FALLBACK_CONTENT_TYPE,
    },
  });
}

async function putFileToS3(uploadUrl: string, file: File) {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type || FALLBACK_CONTENT_TYPE,
    },
    body: file,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Failed to upload document to S3 (HTTP ${response.status}) ${body || ""}`
    );
  }
}

export async function uploadSupportingDocument(
  params: CreateUploadSessionParams
) {
  const session = await createUploadSession(params);
  await putFileToS3(session.uploadUrl, params.file);
  return session.objectKey;
}

export async function uploadInvoice(
  projectId: string,
  payload: UploadInvoicePayload
) {
  if (!payload.file) {
    throw new Error("Invoice file is required");
  }

  const invoiceNumber =
    payload.invoice_number?.trim() || `INV-${Date.now().toString(36)}`;

  const documentKey = await uploadSupportingDocument({
    projectId,
    module: "prefactura",
    lineItemId: payload.line_item_id,
    invoiceNumber,
    file: payload.file,
  });

  return safeFetch<InvoiceDoc>("/prefacturas", {
    method: "POST",
    body: {
      projectId,
      lineItemId: payload.line_item_id,
      invoiceNumber,
      amount: payload.amount,
      month: payload.month,
      vendor: payload.vendor,
      description: payload.description,
      documentKey,
    },
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
