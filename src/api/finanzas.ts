// ---- Invoice upload pipeline (presign ➜ S3 ➜ create record) ----

export type UploadInvoicePayload = {
  file: File;
  line_item_id: string;
  month: number;              // 1–12
  amount: number;             // already parsed to number in UI
  description?: string;
  vendor?: string;
  invoice_number?: string;
  invoice_date?: string;      // yyyy-mm-dd
};

type PresignPOST = {
  url: string;
  key: string;
  fields: Record<string, string>;
};

type PresignPUT = {
  url: string;
  key: string;
  method: "PUT";
  headers?: Record<string, string>;
};

type PresignResponse = PresignPOST | PresignPUT;

export type UploadedInvoiceDTO = {
  id: string;
  line_item_id: string;
  month: number;
  amount: number;
  status: "Pending" | "Matched" | "Disputed";
  documentKey?: string;
  file_name?: string;
  originalName?: string;
  uploaded_at: string;
  uploaded_by: string;
};

const API_BASE = String(import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const USE_MOCKS = String(import.meta.env.VITE_USE_MOCKS || "false") === "true";
const MAX_MB = 50;

// ---------- shared helpers ----------

function requireApiBase(): string {
  if (!API_BASE) {
    throw new Error("VITE_API_BASE_URL is not set. Finanzas API client is disabled.");
  }
  return API_BASE;
}

function authHeader(): Record<string, string> {
  // Minimal, resilient token lookup; align with rest of app
  if (typeof window === "undefined") return {};
  const token =
    window.localStorage.getItem("idToken") ||
    window.localStorage.getItem("cognitoIdToken") ||
    window.sessionStorage.getItem("idToken") ||
    "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function sha256(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fileExt(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : "";
}

/**
 * 1) Ask API for a presigned S3 upload (no file bytes here)
 *    POST {API_BASE}/uploads/docs → { url, key, fields? | headers?, method? }
 */
async function presignInvoiceUpload(
  projectId: string,
  file: File
): Promise<PresignResponse> {
  const base = requireApiBase();

  const body = {
    project_id: projectId,
    filename: file.name,
    contentType: file.type || "application/octet-stream",
    purpose: "invoice",
    checksum_sha256: await sha256(file),
  };

  const res = await fetch(`${base}/uploads/docs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeader(),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Failed to presign upload (${res.status}): ${t}`);
  }

  return (await res.json()) as PresignResponse;
}

/**
 * 2) Upload file to S3 using the presigned info.
 *    Supports both POST (fields) and PUT presign styles.
 */
async function uploadInvoiceFileToS3(
  file: File,
  presign: PresignResponse
): Promise<void> {
  if ("fields" in presign) {
    // POST policy (browser form)
    const form = new FormData();
    Object.entries(presign.fields).forEach(([k, v]) => form.set(k, v));
    form.set("file", file);

    const resp = await fetch(presign.url, {
      method: "POST",
      body: form,
    });

    if (!resp.ok) {
      const t = await resp.text().catch(() => "");
      throw new Error(`S3 POST failed (${resp.status}): ${t}`);
    }
    return;
  }

  // PUT presign
  const headers: Record<string, string> = {
    "Content-Type": file.type || "application/octet-stream",
  };

  const resp = await fetch(presign.url, {
    method: "PUT",
    headers,
    body: file,
  });

  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    throw new Error(`S3 PUT failed (${resp.status}): ${t}`);
  }
}

/**
 * 3) Create invoice record in API, referencing the uploaded documentKey.
 */
async function createInvoiceRecord(
  projectId: string,
  payload: UploadInvoicePayload,
  documentKey: string
): Promise<UploadedInvoiceDTO> {
  const base = requireApiBase();
  const {
    file,
    line_item_id,
    month,
    amount,
    description,
    vendor,
    invoice_number,
    invoice_date,
  } = payload;

  const res = await fetch(
    `${base}/projects/${encodeURIComponent(projectId)}/invoices`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeader(),
      },
      body: JSON.stringify({
        line_item_id,
        month,
        amount,
        description,
        vendor,
        invoice_number,
        invoice_date,
        documentKey,
        originalName: file.name,
        contentType: file.type || "application/octet-stream",
        extension: fileExt(file.name),
        size: file.size,
      }),
    }
  );

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Failed to create invoice (${res.status}): ${t}`);
  }

  return (await res.json().catch(() => ({}))) as UploadedInvoiceDTO;
}

/**
 * Public orchestrator used by SDMTReconciliation and other modules.
 * Validates, presigns, uploads to S3, then creates the invoice record.
 */
export async function uploadInvoice(
  projectId: string,
  payload: UploadInvoicePayload
): Promise<UploadedInvoiceDTO> {
  if (USE_MOCKS) {
    throw new Error("Invoice upload is disabled when VITE_USE_MOCKS=true");
  }

  if (!projectId) throw new Error("Missing projectId");
  if (!payload?.file) throw new Error("No file selected");
  if (!payload.line_item_id) throw new Error("Line item is required");

  if (!(payload.month >= 1 && payload.month <= 12)) {
    throw new Error("Month must be between 1 and 12");
  }

  if (!Number.isFinite(payload.amount)) {
    throw new Error("Amount must be a finite number");
  }

  const sizeMb = payload.file.size / (1024 * 1024);
  if (sizeMb > MAX_MB) {
    throw new Error(
      `File too large: ${sizeMb.toFixed(1)} MB (max ${MAX_MB.toFixed(1)} MB)`
    );
  }

  // 1) Presign
  const presign = await presignInvoiceUpload(projectId, payload.file);

  // 2) Upload to S3
  await uploadInvoiceFileToS3(payload.file, presign);

  // 3) Create invoice record referencing the uploaded documentKey
  const documentKey = presign.key;
  return createInvoiceRecord(projectId, payload, documentKey);
}

// Optional alias for new code that wants a more explicit name
export const uploadInvoiceDocument = uploadInvoice;

// --- Supporting documents (Prefactura) ---
//
// For now, supporting documents use the same upload pipeline and storage model
// as invoices (presigned S3 upload + documentKey + metadata).
// If the API later introduces a distinct endpoint or metadata shape for
// supporting docs, this alias can be changed to call that instead.

/**
 * Upload a supporting document for Prefactura using the same pipeline as invoices.
 * This keeps ReviewSignStep and other Prefactura flows working without
 * duplicating upload logic.
 */
export async function uploadSupportingDocument(
  projectId: string,
  payload: UploadInvoicePayload
): Promise<UploadedInvoiceDTO> {
  return uploadInvoice(projectId, payload);
}

// ---------- Project Rubros/Line Items API ----------

export type ProjectRubroPayload = {
  rubroId: string;
  qty: number;
  unitCost: number;
  type: string;
  duration: string;
};

export type ProjectRubroDTO = {
  id: string;
  rubro_id: string;
  qty: number;
  unit_cost: number;
  type: string;
  duration: string;
};

/**
 * Add a rubro (line item) to a project.
 * Used by ServiceTierSelector and SDMTCatalog to create project line items.
 */
export async function addProjectRubro(
  projectId: string,
  payload: ProjectRubroPayload
): Promise<ProjectRubroDTO> {
  const base = requireApiBase();
  
  if (USE_MOCKS) {
    // Return mock response for development
    return {
      id: `li-${Date.now()}`,
      rubro_id: payload.rubroId,
      qty: payload.qty,
      unit_cost: payload.unitCost,
      type: payload.type,
      duration: payload.duration,
    };
  }

  const res = await fetch(
    `${base}/projects/${encodeURIComponent(projectId)}/rubros`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeader(),
      },
      body: JSON.stringify({
        rubro_id: payload.rubroId,
        qty: payload.qty,
        unit_cost: payload.unitCost,
        type: payload.type,
        duration: payload.duration,
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to add project rubro (${res.status}): ${text}`);
  }

  return res.json();
}

/**
 * Get all rubros (line items) for a project.
 * Used by useProjectLineItems hook to fetch project line items.
 */
export async function getProjectRubros(projectId: string): Promise<ProjectRubroDTO[]> {
  const base = requireApiBase();
  
  if (USE_MOCKS) {
    // Return mock line items for development
    return [];
  }

  const res = await fetch(
    `${base}/projects/${encodeURIComponent(projectId)}/rubros`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...authHeader(),
      },
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to get project rubros (${res.status}): ${text}`);
  }

  const data = await res.json();
  // Handle both { data: [...] } and [...] response formats
  return Array.isArray(data) ? data : data.data || [];
}

/**
 * Get all invoices for a project.
 * Used by useProjectInvoices hook to fetch project invoices for reconciliation.
 */
export async function getInvoices(projectId: string): Promise<UploadedInvoiceDTO[]> {
  const base = requireApiBase();
  
  if (USE_MOCKS) {
    // Return mock invoices for development
    return [];
  }

  const res = await fetch(
    `${base}/projects/${encodeURIComponent(projectId)}/invoices`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...authHeader(),
      },
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to get invoices (${res.status}): ${text}`);
  }

  const data = await res.json();
  // Handle both { data: [...] } and [...] response formats
  return Array.isArray(data) ? data : data.data || [];
}

/**
 * Update the status of an invoice.
 * Used by SDMTReconciliation to mark invoices as Matched, Pending, or Disputed.
 */
export async function updateInvoiceStatus(
  projectId: string,
  invoiceId: string,
  payload: {
    status: "Pending" | "Matched" | "Disputed";
    comment?: string;
  }
): Promise<UploadedInvoiceDTO> {
  const base = requireApiBase();
  
  if (USE_MOCKS) {
    // Return mock updated invoice for development
    return {
      id: invoiceId,
      line_item_id: "mock-li",
      month: 1,
      amount: 0,
      status: payload.status,
      uploaded_at: new Date().toISOString(),
      uploaded_by: "mock-user",
    };
  }

  const res = await fetch(
    `${base}/projects/${encodeURIComponent(projectId)}/invoices/${encodeURIComponent(invoiceId)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...authHeader(),
      },
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to update invoice status (${res.status}): ${text}`);
  }

  return res.json();
}
